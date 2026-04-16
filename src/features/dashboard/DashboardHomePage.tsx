import { useMemo } from 'react'
import { useOwnerContext } from '../owner/useOwnerContext'

export function DashboardHomePage() {
  const { businesses, activeBusinessId } = useOwnerContext()

  const activeBusiness = useMemo(
    () => businesses.find((business) => business.id === activeBusinessId) ?? null,
    [businesses, activeBusinessId],
  )

  return (
    <div className="summary-grid">
      <div className="stat-card">
        <h3>Active Business</h3>
        <div className="stat-value" style={{ fontSize: '1.15rem' }}>
          {activeBusiness?.name ?? 'No business selected'}
        </div>
      </div>
      <div className="stat-card">
        <h3>Phase 1 Modules</h3>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          <li>Employees, end clients, vendors, projects</li>
          <li>Weekly timesheets (W2/C2C work types)</li>
          <li>Employee expenses and deductions</li>
          <li>Invoices, invoice-project linking, payments</li>
        </ul>
      </div>
      <div className="stat-card">
        <h3>Note</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Multi-layer transactions are deferred to Phase 2 by design.
        </p>
      </div>
    </div>
  )
}
