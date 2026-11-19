'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Btn, Card, Screen } from '@/components/kit'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

/** Оформление главной гостя: обложка и логотип. Фото сохраняется сразу после загрузки. */
export default function AdminBrandPage() {
  const [rid, setRid] = useState<string | null>(null)
  const [cover, setCover] = useState<string | null>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/restaurant', { cache: 'no-store', credentials: 'include' })
      .then((x) => x.json())
      .then((r) => {
        if (r?.ok && r.restaurant) {
          setRid(r.restaurant.id)
          setCover(r.restaurant.coverImage ?? null)
          setLogo(r.restaurant.logoImage ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const saveImage = async (key: 'coverImage' | 'logoImage', url: string | null) => {
    if (!rid) return false
    const res = await fetch(`/api/restaurant/${encodeURIComponent(rid)}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: url }) })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast.error(data?.error || 'не сохранилось')
      return false
    }
    if (key === 'coverImage') setCover(url)
    else setLogo(url)
    toast.success(url ? 'фото обновлено' : 'фото убрано')
    return true
  }

  return (
    <Screen title="оформление" subtitle="что гость видит первым на главной" back="/admin/more">
      {!loaded ? (
        <div className="h-60 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy />
      ) : (
        <Card>
          <ImagePicker label="обложка" hint="широкое фото зала или блюд, 16:9" value={cover} shape="wide" onChange={(url) => saveImage('coverImage', url)} />
          <ImagePicker className="mt-4" label="логотип" hint="квадратный, лучше на однотонном фоне" value={logo} shape="round" onChange={(url) => saveImage('logoImage', url)} />
        </Card>
      )}
    </Screen>
  )
}

function ImagePicker({ label, hint, value, shape, onChange, className }: { label: string; hint: string; value: string | null; shape: 'wide' | 'round'; onChange: (url: string | null) => Promise<boolean>; className?: string }) {
  const [busy, setBusy] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/uploads/menu-image', { method: 'POST', credentials: 'include', body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        toast.error(data?.error || 'не загрузилось')
        return
      }
      await onChange(String(data.url))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={className}>
      <div className="mb-1 text-[12.5px] font-semibold text-[color:var(--muted)]">{label}</div>
      <div className={shape === 'wide' ? 'flex flex-col gap-2' : 'flex items-center gap-3'}>
        <div
          className={
            shape === 'wide'
              ? 'relative aspect-[16/9] w-full overflow-hidden rounded-[16px] bg-[color:var(--surface)]'
              : 'relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[color:var(--surface)]'
          }
        >
          {value ? <OptimizedImage src={value} alt="" sizes={shape === 'wide' ? '420px' : '64px'} className="object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-[color:var(--muted)]">{hint}</div>
          <div className="mt-2 flex gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-[color:var(--on-primary)]">
              {busy ? 'загружаем…' : value ? 'заменить' : 'загрузить'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {value ? <Btn variant="secondary" onClick={() => void onChange(null)}>убрать</Btn> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
