'use client'

import { cn } from '@/lib/utils'

type Props = {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}

/** Строка вкл/выкл в стиле MOO — для быстрых действий в раскрытии раздела ЛК. */
export function AdminQuickToggle({ label, hint, checked, disabled, onChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[color:var(--text)]">{label}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-45',
          checked ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--stroke-strong)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  )
}
