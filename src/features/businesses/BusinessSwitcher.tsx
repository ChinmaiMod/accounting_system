import type { Business } from '../../types/domain'

type BusinessSwitcherProps = {
  businesses: Business[]
  activeBusinessId: string | null
  onSelectBusiness: (businessId: string) => void
}

export function BusinessSwitcher({
  businesses,
  activeBusinessId,
  onSelectBusiness,
}: BusinessSwitcherProps) {
  if (businesses.length === 0) {
    return <p className="muted">No businesses found. Create one in Supabase to begin.</p>
  }

  return (
    <label className="inline-field">
      Active business
      <select
        value={activeBusinessId ?? businesses[0].id}
        onChange={(event) => onSelectBusiness(event.target.value)}
      >
        {businesses.map((business) => (
          <option value={business.id} key={business.id}>
            {business.name}
          </option>
        ))}
      </select>
    </label>
  )
}
