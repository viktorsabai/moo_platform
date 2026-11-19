'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Btn, Card, Segmented } from '@/components/kit'

/*
 * Меню через таблицу: выгрузить текущее, скачать пустой шаблон, загрузить CSV.
 * Загрузка добавляет категории и позиции, существующие не удаляет.
 */

type Kind = 'menu' | 'store'

async function download(url: string, filename: string) {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) throw new Error('не скачалось')
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export function MenuImport({ storeEnabled, onImported }: { storeEnabled: boolean; onImported: () => void }) {
  const [kind, setKind] = useState<Kind>('menu')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', kind)
      const res = await fetch('/api/admin/import/csv', { method: 'POST', body: form, credentials: 'include' })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) throw new Error(d?.error || 'не удалось загрузить')
      const msg =
        kind === 'menu'
          ? `добавлено: категорий ${d.createdCategories ?? 0}, блюд ${d.createdDishes ?? 0}`
          : `добавлено: категорий ${d.createdCategories ?? 0}, товаров ${d.createdProducts ?? 0}`
      setResult(msg)
      toast.success(msg)
      setFile(null)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ошибка')
    } finally {
      setBusy(false)
    }
  }

  const get = (data: boolean) =>
    download(`/api/admin/import/template?type=${kind}${data ? '&data=1' : ''}`, `${kind === 'menu' ? 'menu' : 'store'}-${data ? 'export' : 'template'}.csv`).catch((e) =>
      toast.error(e instanceof Error ? e.message : 'ошибка')
    )

  return (
    <div className="flex flex-col gap-3">
      {storeEnabled ? <Segmented value={kind} onChange={setKind} options={[{ value: 'menu', label: 'блюда' }, { value: 'store', label: 'товары' }]} /> : null}

      <Card>
        <div className="text-[15px] font-semibold text-[color:var(--text)]">выгрузить</div>
        <p className="mt-0.5 text-[13px] text-[color:var(--muted)]">таблица CSV — открывается в Google Таблицах и Excel</p>
        <div className="mt-2.5 flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => void get(true)}>
            текущее {kind === 'menu' ? 'меню' : 'наличие'}
          </Btn>
          <Btn variant="secondary" className="flex-1" onClick={() => void get(false)}>
            пустой шаблон
          </Btn>
        </div>
      </Card>

      <Card>
        <div className="text-[15px] font-semibold text-[color:var(--text)]">загрузить из таблицы</div>
        <p className="mt-0.5 text-[13px] text-[color:var(--muted)]">
          добавит новые категории и {kind === 'menu' ? 'блюда' : 'товары'}; то, что уже есть, не удаляется. колонки — как в шаблоне
        </p>
        <label className="mt-2.5 flex h-11 cursor-pointer items-center justify-center rounded-[14px] border border-dashed border-[color:var(--stroke-strong)] px-3 text-[14px] text-[color:var(--text)]">
          <span className="truncate">{file ? file.name : 'выбрать файл .csv'}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Btn full className="mt-2" disabled={!file || busy} onClick={() => void run()}>
          {busy ? 'загружаем…' : 'загрузить'}
        </Btn>
        {result ? <p className="mt-2 text-[13px] text-[color:var(--ok)]" role="status">{result}</p> : null}
      </Card>
    </div>
  )
}
