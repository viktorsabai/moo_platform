'use client'

/**
 * Единый набор деталей для гостя и кабинета. Всё остальное собирается из этих семи вещей.
 * Цвета только через токены из globals.css: --bg --surface-strong --stroke --text --muted --primary --on-primary
 * и состояния --ok/--ok-bg --warn/--warn-bg --danger/--danger-bg.
 */

import Link from 'next/link'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ---------- Screen ---------- */

export function Screen({
  title,
  subtitle,
  back,
  right,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  /** href для стрелки назад; без него шапка без стрелки */
  back?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <main className={cn('mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-3', className)}>
      {title !== undefined ? (
        <header className="mb-3 flex items-center gap-1">
          {back ? (
            <Link
              href={back}
              prefetch={false}
              aria-label="назад"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--text)]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className={cn('truncate font-bold tracking-tight text-[color:var(--text)]', back ? 'text-[18px]' : 'text-[22px]')}>{title}</h1>
            {subtitle ? <div className="mt-0.5 text-[12.5px] text-[color:var(--muted)]">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      ) : null}
      {children}
    </main>
  )
}

/* ---------- Card ---------- */

export function Card({ children, className, tone = 'surface' }: { children: ReactNode; className?: string; tone?: 'surface' | 'muted' }) {
  return (
    <section
      className={cn(
        'rounded-[20px] p-4',
        tone === 'surface' ? 'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]' : 'bg-[color:var(--surface)]',
        className
      )}
    >
      {children}
    </section>
  )
}

/* ---------- Row (строка списка) ---------- */

export function Row({
  href,
  onClick,
  label,
  hint,
  right,
  first,
}: {
  href?: string
  onClick?: () => void
  label: ReactNode
  hint?: ReactNode
  right?: ReactNode
  first?: boolean
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-[color:var(--text)]">{label}</span>
        {hint ? <span className="block truncate text-[12.5px] text-[color:var(--muted)]">{hint}</span> : null}
      </span>
      {right !== undefined ? <span className="shrink-0 text-[13px] text-[color:var(--muted)]">{right}</span> : null}
      {href || onClick ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[color:var(--muted)]" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      ) : null}
    </>
  )
  const cls = cn('flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left', !first && 'border-t border-[color:var(--stroke)]')
  if (href) return <Link href={href} prefetch={false} className={cls}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

export function RowGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title ? <div className="mb-1.5 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">{title}</div> : null}
      <div className="overflow-hidden rounded-[20px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]">{children}</div>
    </section>
  )
}

/* ---------- Button ---------- */

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'text'

export function Btn({
  variant = 'primary',
  size = 'md',
  full,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'md' | 'lg'; full?: boolean }) {
  const v =
    variant === 'primary'
      ? 'bg-[color:var(--primary)] text-[color:var(--on-primary)]'
      : variant === 'secondary'
        ? 'border border-[color:var(--stroke)] bg-transparent text-[color:var(--text)]'
        : variant === 'danger'
          ? 'bg-transparent text-[color:var(--danger)]'
          : 'bg-transparent text-[color:var(--text)]'
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] px-4 font-semibold transition active:opacity-80 disabled:opacity-50',
        size === 'lg' ? 'h-[52px] rounded-[16px] text-[16px]' : 'h-11 text-[14px]',
        v,
        full && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ---------- Chip / Badge ---------- */

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium transition',
        active ? 'bg-[color:var(--primary)] font-semibold text-[color:var(--on-primary)]' : 'border border-[color:var(--stroke)] text-[color:var(--text)]',
        className
      )}
    >
      {children}
    </button>
  )
}

export function Badge({ tone = 'ok', children }: { tone?: 'ok' | 'warn' | 'danger' | 'muted' | 'solid'; children: ReactNode }) {
  const t =
    tone === 'ok'
      ? 'bg-[color:var(--ok-bg)] text-[color:var(--ok)]'
      : tone === 'warn'
        ? 'bg-[color:var(--warn-bg)] text-[color:var(--warn)]'
        : tone === 'danger'
          ? 'bg-[color:var(--danger-bg)] text-[color:var(--danger)]'
          : tone === 'solid'
            ? 'bg-[color:var(--primary)] text-[color:var(--on-primary)]'
            : 'bg-[color:var(--surface)] text-[color:var(--muted)]'
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold', t)}>{children}</span>
}

/* ---------- Stepper ---------- */

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex h-11 items-center justify-between rounded-[14px] bg-[color:var(--surface)] px-1">
      <button type="button" aria-label="меньше" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-10 w-10 text-[20px] text-[color:var(--text)] disabled:opacity-40">
        −
      </button>
      <span className="min-w-[24px] text-center text-[15px] font-semibold text-[color:var(--text)]">{value}</span>
      <button type="button" aria-label="больше" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-10 w-10 text-[20px] text-[color:var(--text)] disabled:opacity-40">
        +
      </button>
    </div>
  )
}

/* ---------- Segmented ---------- */

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[14px] bg-[color:var(--surface)] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn(
            'h-9 flex-1 rounded-[11px] text-[13px] transition',
            o.value === value ? 'bg-[color:var(--surface-strong)] font-semibold text-[color:var(--text)] shadow-[var(--shadow-soft)]' : 'text-[color:var(--muted)]'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Sheet (нижняя шторка) ---------- */

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true">
      <button type="button" aria-label="закрыть" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[24px] bg-[color:var(--bg)] shadow-[var(--shadow-card)]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[color:var(--stroke-strong)]" aria-hidden />
        {title ? <div className="px-4 pb-2 pt-3 text-[18px] font-bold text-[color:var(--text)]">{title}</div> : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? <div className="border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">{footer}</div> : null}
      </div>
    </div>
  )
}

/* ---------- Empty ---------- */

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-[color:var(--stroke-strong)] px-6 py-10 text-center">
      <div className="text-[15px] font-semibold text-[color:var(--text)]">{title}</div>
      {hint ? <div className="text-[13px] text-[color:var(--muted)]">{hint}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/* ---------- Bottom bar (липкая кнопка внизу экрана) ---------- */

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[250] mx-auto w-full max-w-md border-t border-[color:var(--stroke)] bg-[color:var(--bottom-bg)] px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
      {children}
    </div>
  )
}

/* ---------- Toggle ---------- */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('flex h-7 w-11 shrink-0 items-center rounded-full px-[3px] transition', checked ? 'justify-end bg-[color:var(--ok)]' : 'justify-start bg-[color:var(--stroke-strong)]')}
    >
      <span className="h-[22px] w-[22px] rounded-full bg-[color:var(--surface-strong)]" />
    </button>
  )
}

export const fmtThb = (n: number) => `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} ฿`
