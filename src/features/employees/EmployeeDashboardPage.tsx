import { useOwnerContext } from '../owner/useOwnerContext'

export function EmployeeDashboardPage() {
  const { activeBusinessId } = useOwnerContext()

  if (!activeBusinessId) {
    return <p className="text-muted">Select a business first.</p>
  }

  return (
    <div>
      <h1>Employee Dashboard</h1>
      <p className="text-muted">Employee dashboard coming soon.</p>
    </div>
  )
}
