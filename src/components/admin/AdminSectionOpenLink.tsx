'use client'

import Link from 'next/link'

/** Единая ссылка «открыть раздел» внизу раскрытия — без дублирования кнопок внутри. */
export function AdminSectionOpenLink({ href, label = 'Открыть раздел' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={href.includes('#')}
      className="mt-3 flex h-10 w-full items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
    >
      {label} →
    </Link>
  )
}
