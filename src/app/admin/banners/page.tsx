'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { BannerPreviewCard } from '@/components/ui/BannerPreviewCard'
import { AdminCampaigns } from '@/components/admin/AdminCampaigns'

type BannerType = 'chip' | 'reel'
type BannerTargetType = 'menu' | 'menu_category' | 'lead' | 'subscriptions' | 'orders' | 'custom'
type MenuCategory = { id: string; name: string; slug: string }

type Banner = {
  id: string
  title: string
  description?: string | null
  image?: string | null
  href: string
  cta: string
  type: string
  targetType?: string | null
  targetId?: string | null
  order: number
  isActive: boolean
  showOnHome?: boolean
  showOnSubscriptions?: boolean
}

type BannerDraft = {
  title: string
  description: string
  image: string
  href: string
  cta: string
  type: BannerType
  targetType: BannerTargetType
  targetId: string
  showOnHome: boolean
  showOnSubscriptions: boolean
}

const targetPresets: Array<{ type: BannerTargetType; label: string; href: string; cta: string }> = [
  { type: 'menu', label: 'меню', href: '/menu', cta: 'Выбрать' },
  { type: 'menu_category', label: 'категория', href: '/menu', cta: 'Открыть' },
  { type: 'lead', label: 'заявка', href: '/requests/new?type=catering', cta: 'Оставить' },
  { type: 'subscriptions', label: 'подписки', href: '/subscriptions/new', cta: 'Собрать' },
  { type: 'orders', label: 'заказы', href: '/orders', cta: 'Открыть' },
  { type: 'custom', label: 'ссылка', href: '', cta: 'Открыть' },
]

const emptyDraft: BannerDraft = {
  title: '',
  description: '',
  image: '',
  href: '/menu',
  cta: 'Выбрать',
  type: 'chip',
  targetType: 'menu',
  targetId: '',
  showOnHome: true,
  showOnSubscriptions: false,
}

export default function AdminBannersPage() {
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banners, setBanners] = useState<Banner[]>([])
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BannerDraft>(emptyDraft)
  const [section, setSection] = useState<'banners' | 'campaigns'>('banners')

  const editingBanner = useMemo(() => banners.find((b) => b.id === editingId) || null, [banners, editingId])
  const canSave = Boolean(
    draft.title.trim() &&
      draft.href.trim() &&
      (draft.targetType !== 'menu_category' || draft.targetId.trim()) &&
      (draft.showOnHome || draft.showOnSubscriptions)
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [bannersRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/banners', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/menu/categories', { cache: 'no-store', credentials: 'include' }),
      ])
      const data = await bannersRes.json().catch(() => null)
      const categoriesData = await categoriesRes.json().catch(() => null)
      if (!bannersRes.ok || !data?.ok) {
        setError(data?.error || 'не удалось загрузить')
        setBanners([])
        return
      }
      setBanners(Array.isArray(data.banners) ? data.banners : [])
      setMenuCategories(Array.isArray(categoriesData?.categories) ? categoriesData.categories : [])
    } catch {
      setError('не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const sec = searchParams.get('section')
    if (sec === 'campaigns') setSection('campaigns')
    else if (sec === 'banners') setSection('banners')
  }, [searchParams])

  function setTarget(targetType: BannerTargetType) {
    const preset = targetPresets.find((x) => x.type === targetType) || targetPresets[0]
    setDraft((s) => ({
      ...s,
      targetType,
      href: targetType === 'custom' ? s.href : targetType === 'menu_category' ? '/menu' : preset.href,
      cta: targetType === 'custom' ? (s.cta.trim() || preset.cta) : preset.cta,
      targetId: targetType === 'menu_category' ? s.targetId : '',
      showOnSubscriptions: targetType === 'subscriptions' ? true : s.showOnSubscriptions,
    }))
  }

  function setMenuCategory(categoryId: string) {
    const category = menuCategories.find((x) => x.id === categoryId)
    setDraft((s) => ({
      ...s,
      targetId: categoryId,
      href: category?.slug ? `/menu?category=${encodeURIComponent(category.slug)}` : '/menu',
      targetType: 'menu_category',
      cta: s.cta.trim() || 'Открыть',
    }))
  }

  function resetDraft() {
    setEditingId(null)
    setDraft(emptyDraft)
    setError(null)
  }

  function editBanner(b: Banner) {
    const hrefCategorySlug = (() => {
      try {
        const url = new URL(String(b.href || '/menu'), 'https://local.ufo')
        return String(url.searchParams.get('category') || '').trim()
      } catch {
        return ''
      }
    })()
    const targetType = targetPresets.some((x) => x.type === b.targetType)
      ? (b.targetType as BannerTargetType)
      : hrefCategorySlug
        ? 'menu_category'
      : targetPresets.find((x) => x.href === b.href)?.type || 'custom'
    const inferredTargetId =
      b.targetId ||
      (hrefCategorySlug ? menuCategories.find((c) => c.slug === hrefCategorySlug)?.id || '' : '')
    setEditingId(b.id)
    setDraft({
      title: b.title || '',
      description: b.description || '',
      image: b.image || '',
      href: b.href || '/menu',
      cta: b.cta || 'Открыть',
      type: b.type === 'reel' ? 'reel' : 'chip',
      targetType,
      targetId: inferredTargetId,
      showOnHome: b.showOnHome !== false,
      showOnSubscriptions: Boolean(b.showOnSubscriptions),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Размер файла до 8MB')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/uploads/menu-image', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || typeof data?.url !== 'string') {
        toast.error(data?.error || 'Не удалось загрузить фото')
        return
      }
      setDraft((s) => ({ ...s, image: data.url }))
      toast.success('Фото добавлено')
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  async function saveBanner() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      const body = {
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        image: draft.image.trim() || '',
        href: draft.href.trim(),
        cta: draft.cta.trim() || 'Открыть',
        type: draft.type,
        targetType: draft.targetType,
        targetId: draft.targetId.trim() || '',
        showOnHome: draft.showOnHome,
        showOnSubscriptions: draft.showOnSubscriptions,
        ...(editingId ? { id: editingId } : { order: banners.length }),
      }
      const res = await fetch('/api/admin/banners', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось сохранить')
        toast.error(data?.error || 'Не удалось сохранить')
        return
      }
      resetDraft()
      await load()
      toast.success(editingId ? 'Баннер обновлён' : 'Баннер добавлен')
    } catch {
      setError('не удалось сохранить')
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(b: Banner) {
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: b.id, isActive: !b.isActive }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        toast.success('Сохранено')
      }
    } catch {
      load()
    }
  }

  async function moveBanner(b: Banner, direction: 'up' | 'down', withinType: 'chip' | 'reel') {
    const sameType = banners.filter((x) => x.type === withinType).sort((a, z) => a.order - z.order)
    const idx = sameType.findIndex((x) => x.id === b.id)
    if (idx < 0) return
    const newIdx = direction === 'up' ? Math.max(0, idx - 1) : Math.min(sameType.length - 1, idx + 1)
    if (newIdx === idx) return
    const swapped = sameType[newIdx]
    try {
      await Promise.all([
        fetch('/api/admin/banners', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: b.id, order: swapped.order }),
        }),
        fetch('/api/admin/banners', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: swapped.id, order: b.order }),
        }),
      ])
      await load()
      toast.success('Порядок изменён')
    } catch {
      load()
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('Удалить баннер?')) return
    try {
      const res = await fetch(`/api/admin/banners?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        toast.success('Баннер удалён')
      }
    } catch {
      load()
    }
  }

  const cardClass = 'overflow-hidden border border-black/[0.06] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] p-4'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const

  return (
    <main className="ui-container ui-screen !pb-20">
      <div className={cn('mt-5', cardClass)} style={cardRadius}>
        <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-black/[0.04] p-1">
          <button
            type="button"
            onClick={() => setSection('banners')}
            className={cn(
              'rounded-full px-3 py-2.5 text-[13px] font-semibold transition',
              section === 'banners' ? 'bg-white text-black shadow-sm' : 'text-black/55'
            )}
          >
            баннеры
          </button>
          <button
            type="button"
            onClick={() => setSection('campaigns')}
            className={cn(
              'rounded-full px-3 py-2.5 text-[13px] font-semibold transition',
              section === 'campaigns' ? 'bg-white text-black shadow-sm' : 'text-black/55'
            )}
          >
            акции
          </button>
        </div>
      </div>

      {section === 'banners' ? (
        <>
      <div className={cn('mt-5 overflow-visible', cardClass)} style={cardRadius}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-extrabold tracking-tight text-black/70">
              {editingBanner ? 'редактировать баннер' : 'добавить баннер'}
            </div>
            <p className="ui-muted mt-1 text-[12px]">Куда ведёт, фото и короткий текст.</p>
          </div>
          {editingBanner ? (
            <button
              type="button"
              onClick={resetDraft}
              className="shrink-0 rounded-full bg-black/[0.06] px-3 py-2 text-[12px] font-semibold text-black/60"
            >
              новый
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-[12px] font-semibold text-black/70">где показывать</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft((s) => ({ ...s, showOnHome: !s.showOnHome }))}
              className={cn(
                'rounded-full px-4 py-2.5 text-[13px] font-semibold transition',
                draft.showOnHome
                  ? 'bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]'
                  : 'bg-black/[0.06] text-black/65'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              главная
            </button>
            <button
              type="button"
              onClick={() => setDraft((s) => ({ ...s, showOnSubscriptions: !s.showOnSubscriptions }))}
              className={cn(
                'rounded-full px-4 py-2.5 text-[13px] font-semibold transition',
                draft.showOnSubscriptions
                  ? 'bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]'
                  : 'bg-black/[0.06] text-black/65'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              подписка
            </button>
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-black/45">
            Те же баннеры из БД: на главной и/или в разделе «Подписка» → обзор.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {targetPresets.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => setTarget(item.type)}
              className={cn(
                'rounded-full px-4 py-2.5 text-[13px] font-semibold transition',
                draft.targetType === item.type
                  ? 'bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]'
                  : 'bg-black/[0.06] text-black/65 active:bg-black/[0.1]'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-semibold text-black/70">Заголовок</label>
              <input
                className="input input--pill"
                placeholder="например: Бизнес-ланч"
                value={draft.title}
                onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-semibold text-black/50">Подпись</label>
              <input
                className="input input--pill"
                placeholder="короткая продающая строка"
                value={draft.description}
                onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-black/70">Формат</label>
              <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-black/[0.04] p-1">
                {[
                  { value: 'chip', label: 'широкая' },
                  { value: 'reel', label: 'вертикальная' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDraft((s) => ({ ...s, type: item.value as BannerType }))}
                    className={cn(
                      'rounded-full px-3 py-2.5 text-[12px] font-semibold transition',
                      draft.type === item.value ? 'bg-white text-black shadow-sm' : 'text-black/55'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-black/70">Кнопка</label>
              <input
                className="input input--pill"
                placeholder="например: Открыть"
                value={draft.cta}
                onChange={(e) => setDraft((s) => ({ ...s, cta: e.target.value }))}
              />
            </div>
            {draft.targetType === 'custom' ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-black/70">Ссылка</label>
                <input
                  className="input input--pill"
                  placeholder="/menu, /subscriptions/new или внешняя ссылка"
                  value={draft.href}
                  onChange={(e) => setDraft((s) => ({ ...s, href: e.target.value }))}
                />
              </div>
            ) : null}
            {draft.targetType === 'menu_category' ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[12px] font-semibold text-black/70">Категория меню</label>
                <select
                  className="input input--pill"
                  value={draft.targetId}
                  onChange={(e) => setMenuCategory(e.target.value)}
                >
                  <option value="">выберите категорию</option>
                  {menuCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] font-medium text-black/45">
                  Владелец выбирает категорию из списка, ссылка заполнится автоматически.
                </p>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(file)
                  e.currentTarget.value = ''
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-full bg-black/[0.06] px-4 py-2.5 text-[13px] font-semibold text-black/70 disabled:opacity-50"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {uploading ? 'загружаю…' : draft.image ? 'заменить фото' : 'добавить фото'}
                </button>
                {draft.image ? (
                  <button
                    type="button"
                    onClick={() => setDraft((s) => ({ ...s, image: '' }))}
                    className="rounded-full bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700"
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    убрать фото
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/45">превью</div>
            {draft.type === 'chip' ? (
              <BannerPreviewCard
                type="chip"
                title={draft.title || 'Новый баннер'}
                description={draft.description}
                image={draft.image}
                cta={draft.cta || 'Открыть'}
                isActive
                onToggle={() => {}}
                showToggle={false}
                className="max-w-none"
              />
            ) : (
              <BannerPreviewCard
                type="reel"
                title={draft.title || 'Новый баннер'}
                description={draft.description}
                image={draft.image}
                cta={draft.cta || 'Открыть'}
                isActive
                onToggle={() => {}}
                showToggle={false}
              />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={saveBanner}
          disabled={!canSave || saving}
          className="btn btn-primary mt-4 w-full rounded-full py-2.5 text-[13px] font-semibold disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          {saving ? 'сохраняю…' : editingBanner ? 'обновить' : 'сохранить'}
        </button>
        {error ? <p className="mt-2 text-[12px] font-semibold text-red-600">{error}</p> : null}
      </div>

      {/* Как на главной — превью и порядок */}
      {!loading && banners.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-extrabold tracking-tight text-black/70">опубликованные</div>
          <p className="ui-muted mb-3 text-[12px]">Порядок: ↑↓</p>
          <div className={cn('overflow-x-auto pb-2', cardClass)} style={cardRadius}>
            <div className="flex min-w-0 flex-col gap-4">
              {banners.filter((b) => b.type === 'chip').length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/45">широкие</div>
                  <div className="flex flex-wrap gap-3">
                    {banners
                      .filter((b) => b.type === 'chip')
                      .map((b, i, arr) => (
                        <div key={b.id} className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveBanner(b, 'up', 'chip')}
                              disabled={i === 0}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[12px] disabled:opacity-40"
                              aria-label="вверх"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBanner(b, 'down', 'chip')}
                              disabled={i === arr.length - 1}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[12px] disabled:opacity-40"
                              aria-label="вниз"
                            >
                              ↓
                            </button>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1">
                              {b.showOnHome !== false ? (
                                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-bold text-black/55">
                                  главная
                                </span>
                              ) : null}
                              {b.showOnSubscriptions ? (
                                <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold text-black/70">
                                  подписка
                                </span>
                              ) : null}
                            </div>
                            <BannerPreviewCard
                              type="chip"
                              title={b.title}
                              description={b.description}
                              image={b.image}
                              cta={b.cta}
                              isActive={b.isActive}
                              onToggle={() => toggleActive(b)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => editBanner(b)}
                            className="shrink-0 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold text-black/65"
                          >
                            править
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteBanner(b.id)}
                            className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"
                          >
                            удалить
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {banners.filter((b) => b.type === 'reel').length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/45">высокие</div>
                  <div className="flex flex-wrap gap-4">
                    {banners
                      .filter((b) => b.type === 'reel')
                      .map((b, i, arr) => (
                        <div key={b.id} className="flex flex-col items-start gap-2 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveBanner(b, 'up', 'reel')}
                              disabled={i === 0}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[11px] disabled:opacity-40"
                              aria-label="вверх"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBanner(b, 'down', 'reel')}
                              disabled={i === arr.length - 1}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[11px] disabled:opacity-40"
                              aria-label="вниз"
                            >
                              ↓
                            </button>
                          </div>
                          <div className="flex items-end gap-2">
                            <BannerPreviewCard
                              type="reel"
                              title={b.title}
                              description={b.description}
                              image={b.image}
                              cta={b.cta}
                              isActive={b.isActive}
                              onToggle={() => toggleActive(b)}
                            />
                          </div>
                          <div className="flex w-full items-center gap-2">
                            <button
                              type="button"
                              onClick={() => editBanner(b)}
                              className="shrink-0 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold text-black/65"
                            >
                              править
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBanner(b.id)}
                              className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"
                            >
                              удалить
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className={cn('mt-5', cardClass)} style={cardRadius}>
          <span className="ui-muted text-[13px]">загрузка…</span>
        </div>
      )}
      {!loading && banners.length === 0 && (
        <div className={cn('mt-5', cardClass)} style={cardRadius}>
          <p className="ui-muted text-[13px]">Пока нет баннеров. Добавьте первый выше.</p>
        </div>
      )}
        </>
      ) : null}
      {section === 'campaigns' ? <AdminCampaigns /> : null}
    </main>
  )
}
