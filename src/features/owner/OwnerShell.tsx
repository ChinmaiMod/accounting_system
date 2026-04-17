import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Business, Profile } from '../../types/domain'
import { LOOKUP_DEFAULTS, type LookupOption } from '../../shared/lookupDefaults'

type OwnerShellProps = {
  session: Session
}

export type OwnerContextValue = {
  session: Session
  profile: Profile | null
  businesses: Business[]
  activeBusinessId: string | null
  refreshBusinesses: () => Promise<void>
  getOptions: (category: string) => LookupOption[]
  refreshLookups: () => Promise<void>
}

export function OwnerShell({ session }: OwnerShellProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lookupMap, setLookupMap] = useState<Record<string, LookupOption[]>>({})
  const navigate = useNavigate()
  const location = useLocation()

  const projectsMenuRef = useRef<HTMLDetailsElement>(null)
  const employeesMenuRef = useRef<HTMLDetailsElement>(null)

  const projectRelatedPaths = ['/end-clients', '/vendors', '/projects', '/invoices', '/invoice-payments']
  const employeeRelatedPaths = ['/employees', '/timesheets', '/recipient-accounts', '/employee-transactions', '/employee-dashboard']

  const projectsGroupActive = projectRelatedPaths.includes(location.pathname)
  const employeesGroupActive = employeeRelatedPaths.includes(location.pathname)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (projectsMenuRef.current && !projectsMenuRef.current.contains(e.target as Node)) {
        projectsMenuRef.current.open = false
      }
      if (employeesMenuRef.current && !employeesMenuRef.current.contains(e.target as Node)) {
        employeesMenuRef.current.open = false
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Close dropdowns on navigation
  useEffect(() => {
    if (projectsMenuRef.current) projectsMenuRef.current.open = false
    if (employeesMenuRef.current) employeesMenuRef.current.open = false
  }, [location.pathname])

  async function refreshBusinesses() {
    const { data, error: businessesError } = await supabase
      .from('businesses')
      .select('id, owner_user_id, name, legal_name, created_at')
      .eq('owner_user_id', session.user.id)
      .order('name')

    if (businessesError) {
      setError(businessesError.message)
      return
    }

    setBusinesses(data ?? [])
  }

  async function refreshLookups() {
    if (!activeBusinessId) return
    const { data } = await supabase
      .from('lookup_values')
      .select('category,code,label,employee_balance_effect,employer_profitability_effect')
      .eq('business_id', activeBusinessId)
      .eq('is_active', true)
      .order('sort_order')
    if (!data) return
    const map: Record<string, LookupOption[]> = {}
    for (const row of data) {
      if (!map[row.category]) map[row.category] = []
      map[row.category].push({
        code: row.code,
        label: row.label,
        employee_balance_effect: row.employee_balance_effect ?? null,
        employer_profitability_effect: row.employer_profitability_effect ?? null,
      })
    }
    setLookupMap(map)
  }

  function getOptions(category: string): LookupOption[] {
    return lookupMap[category] ?? LOOKUP_DEFAULTS[category] ?? []
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      const profileResult = await supabase
        .from('profiles')
        .select('id, full_name, default_business_id')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileResult.error) {
        setError(profileResult.error.message)
      } else if (!profileResult.data) {
        const inserted = await supabase
          .from('profiles')
          .upsert({ id: session.user.id, full_name: session.user.email ?? null }, { onConflict: 'id' })
          .select('id, full_name, default_business_id')
          .single()
        if (inserted.error) {
          setError(inserted.error.message)
        } else {
          setProfile(inserted.data)
        }
      } else {
        setProfile(profileResult.data)
      }

      await refreshBusinesses()
      setLoading(false)
    }

    load()
  }, [session.user.id])

  useEffect(() => {
    if (activeBusinessId) return
    if (profile?.default_business_id) {
      setActiveBusinessId(profile.default_business_id)
      return
    }
    if (businesses[0]) {
      setActiveBusinessId(businesses[0].id)
    }
  }, [activeBusinessId, businesses, profile?.default_business_id])

  useEffect(() => {
    refreshLookups()
  }, [activeBusinessId])

  async function onSelectBusiness(businessId: string) {
    setActiveBusinessId(businessId)
    if (!profile) return
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ default_business_id: businessId })
      .eq('id', profile.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      setProfile({ ...profile, default_business_id: businessId })
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const ctx = useMemo<OwnerContextValue>(
    () => ({ session, profile, businesses, activeBusinessId, refreshBusinesses, getOptions, refreshLookups }),
    [session, profile, businesses, activeBusinessId, lookupMap],
  )

  if (loading) return <div className="centered">Loading...</div>

  return (
    <>
      <header className="app-topbar">
        <div className="app-topbar-left">
          <span className="app-logo">Profitability Hub</span>
          {businesses.length > 0 && (
            <select
              className="business-select"
              value={activeBusinessId ?? businesses[0]?.id ?? ''}
              onChange={(e) => onSelectBusiness(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex-row">
          <span className="app-user">{profile?.full_name ?? session.user.email}</span>
          <button className="btn-sign-out" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav className="nav-bar">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/businesses">Businesses</NavLink>
        <details ref={projectsMenuRef} className="nav-dropdown">
          <summary className={`nav-dropdown-trigger ${projectsGroupActive ? 'active' : ''}`}>
            Project Related
          </summary>
          <div className="nav-dropdown-menu" role="menu">
            <NavLink to="/end-clients" role="menuitem">End Clients</NavLink>
            <NavLink to="/vendors" role="menuitem">Vendors</NavLink>
            <NavLink to="/projects" role="menuitem">Projects</NavLink>
            <NavLink to="/invoices" role="menuitem">Invoices</NavLink>
            <NavLink to="/invoice-payments" role="menuitem">Invoice Payments</NavLink>
          </div>
        </details>
        <details ref={employeesMenuRef} className="nav-dropdown">
          <summary className={`nav-dropdown-trigger ${employeesGroupActive ? 'active' : ''}`}>
            Employee Related
          </summary>
          <div className="nav-dropdown-menu" role="menu">
            <NavLink to="/employees" role="menuitem">Employees</NavLink>
            <NavLink to="/timesheets" role="menuitem">Timesheets</NavLink>
            <NavLink to="/recipient-accounts" role="menuitem">Recipient Accounts</NavLink>
            <NavLink to="/employee-transactions" role="menuitem">Employee Transactions</NavLink>
            <NavLink to="/employee-dashboard" role="menuitem">Employee Dashboard</NavLink>
          </div>
        </details>
        <NavLink to="/reports">Reports</NavLink>
        <NavLink to="/data-admin">Data Admin</NavLink>
      </nav>

      {error && <div className="page-container"><p className="toast error">{error}</p></div>}

      <div className="page-container">
        <Outlet context={ctx} />
      </div>
    </>
  )
}
