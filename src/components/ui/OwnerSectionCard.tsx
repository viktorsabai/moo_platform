import type { ReactNode } from 'react'

export function OwnerSectionCard({
  title,
  subtitle,
  quick,
  details,
}: {
  title: ReactNode
  subtitle?: ReactNode
  quick?: ReactNode
  details: ReactNode
}) {
  return (
    <section className="ui-surface-card p-4">
      <div className="mb-3">
        <h2 className="ui-h2 text-[14px]">{title}</h2>
        {subtitle ? <p className="ui-muted mt-1 text-[12px]">{subtitle}</p> : null}
      </div>
      {quick ? <div className="mb-3">{quick}</div> : null}
      <div>{details}</div>
    </section>
  )
}
