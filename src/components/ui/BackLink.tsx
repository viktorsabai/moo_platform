import Link from 'next/link'
import { cn } from '@/lib/utils'
import { IconChevronLeft } from '@/components/ui/icons'

export function BackLink({
  href,
  label,
  className,
}: {
  href: string
  label?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'inline-flex items-center gap-2 text-[color:var(--text)]',
        !label && 'ui-back-button',
        className
      )}
      aria-label={label || 'назад'}
      title={label || 'назад'}
    >
      <span className={cn(label && 'ui-back-button')}>
        <IconChevronLeft className="h-5 w-5" />
      </span>
      {label ? <span className="text-[14px] font-semibold text-[color:var(--muted)]">{label}</span> : null}
    </Link>
  )
}
