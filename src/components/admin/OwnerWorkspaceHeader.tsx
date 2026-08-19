import Link from 'next/link'

export function OwnerWorkspaceHeader({ title, subtitle, backHref = '/admin', backLabel = 'сегодня', primaryHref, primaryLabel }: { title: string; subtitle: string; backHref?: string; backLabel?: string; primaryHref?: string; primaryLabel?: string }) {
  return (
    <header className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} prefetch={false} className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-extrabold text-[color:var(--muted)] transition hover:text-[color:var(--text)]">
          <span aria-hidden className="text-[18px] leading-none">‹</span>
          <span>{backLabel}</span>
        </Link>
        {primaryHref && primaryLabel ? <Link href={primaryHref} prefetch={false} className="shrink-0 rounded-full bg-[color:var(--primary)] px-3.5 py-2 text-[11px] font-extrabold text-white">{primaryLabel}</Link> : null}
      </div>
      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[color:var(--muted)]">рабочее пространство</p>
      <h1 className="mt-1 max-w-[680px] text-[28px] font-black tracking-[-0.05em] text-[color:var(--text)]">{title}</h1>
      <p className="mt-1 max-w-[640px] text-[13px] font-medium leading-relaxed text-[color:var(--muted)]">{subtitle}</p>
    </header>
  )
}
