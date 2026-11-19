'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { BannerPreviewCard } from '@/components/ui/BannerPreviewCard'
import { AdminCampaigns } from '@/components/admin/AdminCampaigns'
import { Screen, Card, Btn, Chip, Badge, Segmented, Sheet, Empty } from '@/components/kit'

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
  const [sheetOpen, setSheetOpen] = useState(false)

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

  function openNewBanner() {
    resetDraft()
    setSheetOpen(true)
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
    setSheetOpen(true)
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
      setSheetOpen(false)
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

  const chips = banners.filter((b) => b.type === 'chip').sort((a, z) => a.order - z.order)
  const reels = banners.filter((b) => b.type === 'reel').sort((a, z) => a.order - z.order)

  function BannerRow({ b, group, idx, arr }: { b: Banner; group: 'chip' | 'reel'; idx: number; arr: Banner[] }) {
    return (
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          <button
            type="button"
            onClick={() => moveBanner(b, 'up', group)}
            disabled={idx === 0}
            aria-label="вверх"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--surface)] text-[12px] text-[color:var(--text)] disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveBanner(b, 'down', group)}
            disabled={idx === arr.length - 1}
            aria-label="вниз"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--surface)] text-[12px] text-[color:var(--text)] disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {b.showOnHome !== false ? <Badge tone="muted">главная</Badge> : null}
            {b.showOnSubscriptions ? <Badge tone="ok">подписка</Badge> : null}
          </div>
          <BannerPreviewCard
            type={group}
            title={b.title}
            description={b.description}
            image={b.image}
            cta={b.cta}
            isActive={b.isActive}
            onToggle={() => toggleActive(b)}
            className="max-w-none"
          />
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={() => editBanner(b)} className="text-[12px] font-semibold text-[color:var(--text)] underline underline-offset-2">
              править
            </button>
            <button type="button" onClick={() => deleteBanner(b.id)} className="text-[12px] font-semibold text-[color:var(--danger)] underline underline-offset-2">
              удалить
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Screen title="акции" subtitle="баннеры на главной и промокоды" back="/admin/more">
      <div className="mb-4">
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { value: 'banners', label: 'баннеры' },
            { value: 'campaigns', label: 'акции' },
          ]}
        />
      </div>

      {section === 'banners' ? (
        <div className="space-y-4">
          <Btn full onClick={openNewBanner}>
            + добавить баннер
          </Btn>

          {loading ? (
            <Card>
              <span className="text-[13px] text-[color:var(--muted)]">загрузка…</span>
            </Card>
          ) : banners.length === 0 ? (
            <Empty title="Пока нет баннеров" hint="Добавьте первый — кнопка выше." />
          ) : (
            <>
              {chips.length > 0 ? (
                <Card>
                  <div className="mb-3 text-[12.5px] font-semibold text-[color:var(--muted)]">широкие</div>
                  <div className="space-y-4">
                    {chips.map((b, i, arr) => (
                      <BannerRow key={b.id} b={b} group="chip" idx={i} arr={arr} />
                    ))}
                  </div>
                </Card>
              ) : null}
              {reels.length > 0 ? (
                <Card>
                  <div className="mb-3 text-[12.5px] font-semibold text-[color:var(--muted)]">высокие</div>
                  <div className="space-y-4">
                    {reels.map((b, i, arr) => (
                      <BannerRow key={b.id} b={b} group="reel" idx={i} arr={arr} />
                    ))}
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <AdminCampaigns />
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          resetDraft()
        }}
        title={editingBanner ? 'редактировать баннер' : 'новый баннер'}
        footer={
          <>
            <Btn full onClick={saveBanner} disabled={!canSave || saving}>
              {saving ? 'сохраняю…' : editingBanner ? 'обновить' : 'сохранить'}
            </Btn>
            {error ? <p className="mt-2 text-[12px] font-semibold text-[color:var(--danger)]">{error}</p> : null}
          </>
        }
      >
        <div className="space-y-4 pb-2">
          <div>
            <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">где показывать</div>
            <div className="flex flex-wrap gap-2">
              <Chip active={draft.showOnHome} onClick={() => setDraft((s) => ({ ...s, showOnHome: !s.showOnHome }))}>
                главная
              </Chip>
              <Chip
                active={draft.showOnSubscriptions}
                onClick={() => setDraft((s) => ({ ...s, showOnSubscriptions: !s.showOnSubscriptions }))}
              >
                подписка
              </Chip>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">ведёт на</div>
            <div className="flex flex-wrap gap-2">
              {targetPresets.map((item) => (
                <Chip key={item.type} active={draft.targetType === item.type} onClick={() => setTarget(item.type)}>
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">заголовок</span>
            <input
              className="w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[15px] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]"
              placeholder="например: Бизнес-ланч"
              value={draft.title}
              onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">подпись</span>
            <input
              className="w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[15px] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]"
              placeholder="короткая продающая строка"
              value={draft.description}
              onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))}
            />
          </label>

          <div>
            <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">формат</div>
            <Segmented
              value={draft.type}
              onChange={(v) => setDraft((s) => ({ ...s, type: v }))}
              options={[
                { value: 'chip', label: 'широкая' },
                { value: 'reel', label: 'вертикальная' },
              ]}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">кнопка</span>
            <input
              className="w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[15px] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]"
              placeholder="например: Открыть"
              value={draft.cta}
              onChange={(e) => setDraft((s) => ({ ...s, cta: e.target.value }))}
            />
          </label>

          {draft.targetType === 'custom' ? (
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">ссылка</span>
              <input
                className="w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[15px] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]"
                placeholder="/menu, /subscriptions/new или внешняя ссылка"
                value={draft.href}
                onChange={(e) => setDraft((s) => ({ ...s, href: e.target.value }))}
              />
            </label>
          ) : null}

          {draft.targetType === 'menu_category' ? (
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-semibold text-[color:var(--muted)]">категория меню</span>
              <select
                className="w-full rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-[15px] text-[color:var(--text)] outline-none"
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
            </label>
          ) : null}

          <div>
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
              <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'загружаю…' : draft.image ? 'заменить фото' : 'добавить фото'}
              </Btn>
              {draft.image ? (
                <Btn variant="danger" onClick={() => setDraft((s) => ({ ...s, image: '' }))}>
                  убрать фото
                </Btn>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-semibold text-[color:var(--muted)]">превью</div>
            <BannerPreviewCard
              type={draft.type}
              title={draft.title || 'Новый баннер'}
              description={draft.description}
              image={draft.image}
              cta={draft.cta || 'Открыть'}
              isActive
              onToggle={() => {}}
              showToggle={false}
              className="max-w-none"
            />
          </div>
        </div>
      </Sheet>
    </Screen>
  )
}
