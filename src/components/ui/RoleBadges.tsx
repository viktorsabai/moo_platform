import clsx from 'clsx'

type PlatformRole = 'NONE' | 'SUPERADMIN' | string | undefined | null
type MemberRole = 'OWNER' | 'ADMIN' | 'STAFF' | string | undefined | null

function platformBadge(platformRole: PlatformRole) {
  if (platformRole === 'SUPERADMIN') {
    return { label: 'superadmin платформы', dotClass: 'bg-[color:var(--accent)]/80' }
  }
  return null
}

function memberBadge(memberRole: MemberRole) {
  if (memberRole === 'OWNER') return { label: 'владелец', dotClass: 'bg-black/55' }
  if (memberRole === 'ADMIN') return { label: 'админ', dotClass: 'bg-black/55' }
  if (memberRole === 'STAFF') return { label: 'персонал', dotClass: 'bg-black/35' }
  return null
}

export function RolePill({
  label,
  dotClass,
  className,
}: {
  label: string
  dotClass: string
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[13px] font-semibold text-black/70',
        className
      )}
    >
      <span className={clsx('h-2 w-2 rounded-full', dotClass)} aria-hidden />
      {label}
    </span>
  )
}

export function RoleBadges({
  platformRole,
  memberRole,
  className,
}: {
  platformRole?: PlatformRole
  memberRole?: MemberRole
  className?: string
}) {
  const p = platformBadge(platformRole)
  const m = memberBadge(memberRole)

  if (!p && !m) {
    return <span className={clsx('text-[13px] font-semibold text-black/55', className)}>пользователь</span>
  }

  return (
    <span className={clsx('inline-flex flex-wrap items-center justify-end gap-2', className)}>
      {p ? <RolePill label={p.label} dotClass={p.dotClass} /> : null}
      {m ? <RolePill label={m.label} dotClass={m.dotClass} /> : null}
    </span>
  )
}

export function RoleDot({
  platformRole,
  memberRole,
  className,
  title,
}: {
  platformRole?: PlatformRole
  memberRole?: MemberRole
  className?: string
  title?: string
}) {
  const p = platformBadge(platformRole)
  const m = memberBadge(memberRole)
  const dotClass = p?.dotClass || m?.dotClass
  if (!dotClass) return null

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full border border-black/10 bg-white/90 p-1 shadow-[0_10px_22px_rgba(0,0,0,0.08)]',
        className
      )}
      title={title}
      aria-label={title}
    >
      <span className={clsx('h-2 w-2 rounded-full ring-2 ring-white', dotClass)} aria-hidden />
    </span>
  )
}

