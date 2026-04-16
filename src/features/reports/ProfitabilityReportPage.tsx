import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { DailyProfitability, TimesheetProfitabilityRow } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'

type EmployeeNameRow = { id: string; full_name: string }
type ProjectNameRow = { id: string; name: string }

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)
}

export function ProfitabilityReportPage() {
  const { activeBusinessId } = useOwnerContext()
  const [dailyRows, setDailyRows] = useState<DailyProfitability[]>([])
  const [detailRows, setDetailRows] = useState<TimesheetProfitabilityRow[]>([])
  const [employeeNames, setEmployeeNames] = useState<Record<string, string>>({})
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!activeBusinessId) return
      setError('')
      let dailyQuery = supabase
        .from('v_business_profitability_daily')
        .select('business_id,work_date,revenue_amount,direct_cost_amount,employer_tax_amount,gross_profit_amount')
        .eq('business_id', activeBusinessId).order('work_date', { ascending: false }).limit(120)
      let detailQuery = supabase
        .from('v_timesheet_profitability')
        .select('timesheet_id,business_id,employee_id,project_id,work_date,work_type,hours,employee_type,revenue_amount,direct_cost_amount,employer_tax_amount')
        .eq('business_id', activeBusinessId).order('work_date', { ascending: false }).limit(300)
      if (fromDate) { dailyQuery = dailyQuery.gte('work_date', fromDate); detailQuery = detailQuery.gte('work_date', fromDate) }
      if (toDate) { dailyQuery = dailyQuery.lte('work_date', toDate); detailQuery = detailQuery.lte('work_date', toDate) }

      const [dailyResult, detailResult, employeeResult, projectResult] = await Promise.all([
        dailyQuery, detailQuery,
        supabase.from('employees').select('id,full_name').eq('business_id', activeBusinessId),
        supabase.from('projects').select('id,name').eq('business_id', activeBusinessId),
      ])
      if (dailyResult.error || detailResult.error || employeeResult.error || projectResult.error) {
        setError(dailyResult.error?.message ?? detailResult.error?.message ?? employeeResult.error?.message ?? projectResult.error?.message ?? 'Failed to load')
        return
      }
      setDailyRows((dailyResult.data ?? []) as DailyProfitability[])
      setDetailRows((detailResult.data ?? []) as TimesheetProfitabilityRow[])
      const empMap: Record<string, string> = {}
      ;((employeeResult.data ?? []) as EmployeeNameRow[]).forEach(e => { empMap[e.id] = e.full_name })
      setEmployeeNames(empMap)
      const projMap: Record<string, string> = {}
      ;((projectResult.data ?? []) as ProjectNameRow[]).forEach(p => { projMap[p.id] = p.name })
      setProjectNames(projMap)
    }
    load()
  }, [activeBusinessId, fromDate, toDate])

  const totals = useMemo(() => {
    return detailRows.reduce(
      (acc, row) => { acc.revenue += row.revenue_amount ?? 0; acc.cost += row.direct_cost_amount ?? 0; acc.tax += row.employer_tax_amount ?? 0; return acc },
      { revenue: 0, cost: 0, tax: 0 },
    )
  }, [detailRows])

  const grossProfit = totals.revenue - totals.cost - totals.tax

  return (
    <>
      <PageSection title="Profitability Reports">
        <NoticeBanner message={error} type="error" />
        <div className="form-grid">
          <FormField label="From date">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </FormField>
          <FormField label="To date">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </FormField>
        </div>

        <div className="summary-grid mt-md">
          <div className="stat-card">
            <h3>Total Revenue</h3>
            <div className="stat-value">{currency(totals.revenue)}</div>
          </div>
          <div className="stat-card">
            <h3>Direct Cost</h3>
            <div className="stat-value">{currency(totals.cost)}</div>
          </div>
          <div className="stat-card">
            <h3>Employer Tax</h3>
            <div className="stat-value">{currency(totals.tax)}</div>
          </div>
          <div className="stat-card">
            <h3>Gross Profit</h3>
            <div className="stat-value" style={{ color: grossProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
              {currency(grossProfit)}
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection title="Daily Summary">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Revenue</th>
                <th>Direct Cost</th>
                <th>Tax</th>
                <th>Gross Profit</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={`${row.business_id}-${row.work_date}`}>
                  <td>{row.work_date}</td>
                  <td>{currency(row.revenue_amount)}</td>
                  <td>{currency(row.direct_cost_amount)}</td>
                  <td>{currency(row.employer_tax_amount)}</td>
                  <td style={{ fontWeight: 600, color: row.gross_profit_amount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {currency(row.gross_profit_amount)}
                  </td>
                </tr>
              ))}
              {dailyRows.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No data for selected period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Timesheet Detail">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Project</th>
                <th>Type</th>
                <th>Hours</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Tax</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr key={row.timesheet_id}>
                  <td>{row.work_date}</td>
                  <td>{employeeNames[row.employee_id] ?? row.employee_id}</td>
                  <td>{projectNames[row.project_id] ?? row.project_id}</td>
                  <td><span className="badge badge-neutral">{row.work_type}</span></td>
                  <td>{row.hours}</td>
                  <td>{currency(row.revenue_amount)}</td>
                  <td>{currency(row.direct_cost_amount)}</td>
                  <td>{currency(row.employer_tax_amount)}</td>
                </tr>
              ))}
              {detailRows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No data for selected period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </>
  )
}
