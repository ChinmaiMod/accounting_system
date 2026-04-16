import type { ReactNode } from 'react'

type PageSectionProps = {
  title: string
  actions?: ReactNode
  children: ReactNode
}

export function PageSection({ title, actions, children }: PageSectionProps) {
  return (
    <section className="card section-gap">
      <div className="card-header">
        <h2>{title}</h2>
        {actions && <div className="flex-row">{actions}</div>}
      </div>
      <div className="card-body">
        {children}
      </div>
    </section>
  )
}
