import { useOwnerContext } from '../owner/useOwnerContext'

export function EmployeeTransactionsPage() {
  const { activeBusinessId } = useOwnerContext()

  if (!activeBusinessId) {
    return <p className="text-muted">Select a business first.</p>
  }

  return (
    <div>
      <h1>Employee Transactions</h1>
      <p className="text-muted">Employee transactions management coming soon.</p>
    </div>
  )
}
