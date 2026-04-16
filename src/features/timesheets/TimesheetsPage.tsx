import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'

type Week = { label: string; startDate: string; endDate: string }
type WeekEntry = { hours: number; ids: string[] }

type EmpLookup = { id: string; full_name: string; email: string | null; employee_type: string }
type ProjLookup = {
  id: string; employee_id: string | null; end_client_id: string; vendor_id: string | null
  name: string; start_date: string | null; end_date: string | null
  employee_project_rate: number; timesheet_frequency: string
}
type EcLookup = { id: string; name: string }
type VendLookup = { id: string; name: string; invoice_frequency: string; payment_terms: string }

type EarningLookup = { id: string; total_hours: number; hourly_rate: number; total_earnings: number }

type GridRow = {
  key: string
  employeeId: string
  employeeName: string
  employeeEmail: string | null
  employeeType: string
  projectId: string
  projectName: string
  startDate: string | null
  endDate: string | null
  endClientName: string
  vendorName: string | null
  invoiceFreq: string | null
  paymentTerms: string | null
  rate: number
  tsFreq: string
  invoiceNums: string[]
  weekData: Record<string, WeekEntry>
  earning: EarningLookup | null
}

const ENUM_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly', BI_WEEKLY: 'Bi-Weekly', MONTHLY: 'Monthly',
  NET_7: 'Net 7', NET_15: 'Net 15', NET_30: 'Net 30',
  NET_45: 'Net 45', NET_60: 'Net 60', NET_90: 'Net 90',
}

function fmtEnum(v: string | null): string {
  if (!v) return '—'
  return ENUM_LABELS[v] ?? v
}

function getMonthWeeks(ym: string): Week[] {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return []
  const dim = new Date(y, m, 0).getDate()
  const weeks: Week[] = []
  let d = 1
  while (d <= dim) {
    const dow = new Date(y, m - 1, d).getDay()
    const toSun = dow === 0 ? 0 : 7 - dow
    const end = Math.min(d + toSun, dim)
    const pad = (n: number) => String(n).padStart(2, '0')
    weeks.push({
      label: d === end ? `${d}` : `${d}-${end}`,
      startDate: `${y}-${pad(m)}-${pad(d)}`,
      endDate: `${y}-${pad(m)}-${pad(end)}`,
    })
    d = end + 1
  }
  return weeks
}

export function TimesheetsPage() {
  const { activeBusinessId } = useOwnerContext()
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [yearMonth, setYearMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  const [rows, setRows] = useState<GridRow[]>([])
  const [cellValues, setCellValues] = useState<Record<string, Record<string, string>>>({})
  const [emps, setEmps] = useState<EmpLookup[]>([])
  const [projs, setProjs] = useState<ProjLookup[]>([])
  const [ecs, setEcs] = useState<EcLookup[]>([])
  const [vends, setVends] = useState<VendLookup[]>([])

  const [addOpen, setAddOpen] = useState(false)
  const [addEmpId, setAddEmpId] = useState('')
  const [addProjId, setAddProjId] = useState('')

  const weeks = getMonthWeeks(yearMonth)

  async function loadData() {
    if (!activeBusinessId) return
    const wks = getMonthWeeks(yearMonth)
    if (!wks.length) return
    const ms = wks[0].startDate
    const me = wks[wks.length - 1].endDate

    const earningMonth = `${yearMonth}-01`
    const [eR, pR, ecR, vR, tR, iR, earnR] = await Promise.all([
      supabase.from('employees').select('id,full_name,email,employee_type').eq('business_id', activeBusinessId).order('full_name'),
      supabase.from('projects').select('id,employee_id,end_client_id,vendor_id,name,start_date,end_date,employee_project_rate,timesheet_frequency').eq('business_id', activeBusinessId),
      supabase.from('end_clients').select('id,name').eq('business_id', activeBusinessId),
      supabase.from('vendors').select('id,name,invoice_frequency,payment_terms').eq('business_id', activeBusinessId),
      supabase.from('timesheets').select('id,employee_id,project_id,work_date,hours').eq('business_id', activeBusinessId).gte('work_date', ms).lte('work_date', me),
      supabase.from('invoices').select('invoice_number,invoice_projects(project_id)').eq('business_id', activeBusinessId),
      supabase.from('employee_earnings').select('id,employee_id,project_id,total_hours,hourly_rate,total_earnings').eq('business_id', activeBusinessId).eq('earning_month', earningMonth),
    ])

    if (eR.error || pR.error || ecR.error || vR.error || tR.error || iR.error || earnR.error) {
      showError(eR.error?.message ?? pR.error?.message ?? ecR.error?.message ?? vR.error?.message ?? tR.error?.message ?? iR.error?.message ?? earnR.error?.message ?? 'Load failed')
      return
    }

    const employees = (eR.data ?? []) as EmpLookup[]
    const projects = (pR.data ?? []) as ProjLookup[]
    const endClients = (ecR.data ?? []) as EcLookup[]
    const vendors = (vR.data ?? []) as VendLookup[]
    setEmps(employees); setProjs(projects); setEcs(endClients); setVends(vendors)

    const empMap = new Map(employees.map(e => [e.id, e]))
    const projMap = new Map(projects.map(p => [p.id, p]))
    const ecMap = new Map(endClients.map(c => [c.id, c]))
    const vendMap = new Map(vendors.map(v => [v.id, v]))

    const invMap: Record<string, string[]> = {}
    for (const inv of (iR.data ?? []) as any[]) {
      for (const ip of (inv.invoice_projects ?? [])) {
        if (!invMap[ip.project_id]) invMap[ip.project_id] = []
        if (!invMap[ip.project_id].includes(inv.invoice_number))
          invMap[ip.project_id].push(inv.invoice_number)
      }
    }

    const earnMap = new Map<string, EarningLookup>()
    for (const e of (earnR.data ?? []) as any[]) {
      earnMap.set(`${e.employee_id}::${e.project_id}`, {
        id: e.id, total_hours: Number(e.total_hours),
        hourly_rate: Number(e.hourly_rate), total_earnings: Number(e.total_earnings),
      })
    }

    const tsMap: Record<string, Record<string, WeekEntry>> = {}
    for (const ts of (tR.data ?? []) as any[]) {
      const key = `${ts.employee_id}::${ts.project_id}`
      const wk = wks.find(w => ts.work_date >= w.startDate && ts.work_date <= w.endDate)
      if (!wk) continue
      if (!tsMap[key]) tsMap[key] = {}
      if (!tsMap[key][wk.startDate]) tsMap[key][wk.startDate] = { hours: 0, ids: [] }
      tsMap[key][wk.startDate].hours += Number(ts.hours)
      tsMap[key][wk.startDate].ids.push(ts.id)
    }

    function makeRow(empId: string, projId: string): GridRow | null {
      const emp = empMap.get(empId)
      const proj = projMap.get(projId)
      if (!emp || !proj) return null
      const key = `${empId}::${projId}`
      const ec = ecMap.get(proj.end_client_id)
      const vend = proj.vendor_id ? vendMap.get(proj.vendor_id) : null
      const wd: Record<string, WeekEntry> = {}
      for (const w of wks) wd[w.startDate] = tsMap[key]?.[w.startDate] ?? { hours: 0, ids: [] }
      return {
        key, employeeId: empId, employeeName: emp.full_name,
        employeeEmail: emp.email, employeeType: emp.employee_type,
        projectId: projId, projectName: proj.name,
        startDate: proj.start_date, endDate: proj.end_date,
        endClientName: ec?.name ?? '—',
        vendorName: vend?.name ?? null,
        invoiceFreq: vend?.invoice_frequency ?? null,
        paymentTerms: vend?.payment_terms ?? null,
        rate: proj.employee_project_rate, tsFreq: proj.timesheet_frequency,
        invoiceNums: invMap[projId] ?? [], weekData: wd,
        earning: earnMap.get(key) ?? null,
      }
    }

    const seen = new Set<string>()
    const grid: GridRow[] = []

    for (const p of projects) {
      if (!p.employee_id) continue
      const k = `${p.employee_id}::${p.id}`
      if (seen.has(k)) continue
      seen.add(k)
      const r = makeRow(p.employee_id, p.id)
      if (r) grid.push(r)
    }

    for (const k of Object.keys(tsMap)) {
      if (seen.has(k)) continue
      seen.add(k)
      const parts = k.split('::')
      const r = makeRow(parts[0], parts[1])
      if (r) grid.push(r)
    }

    setRows(grid)

    const cv: Record<string, Record<string, string>> = {}
    for (const row of grid) {
      cv[row.key] = {}
      for (const w of wks) {
        const h = row.weekData[w.startDate]?.hours ?? 0
        cv[row.key][w.startDate] = h > 0 ? String(h) : ''
      }
    }
    setCellValues(cv)
  }

  useEffect(() => { loadData() }, [activeBusinessId, yearMonth])

  async function syncEarning(employeeId: string, projectId: string, rate: number) {
    if (!activeBusinessId) return
    const wks = getMonthWeeks(yearMonth)
    if (!wks.length) return
    const ms = wks[0].startDate
    const me = wks[wks.length - 1].endDate
    const earningMonth = `${yearMonth}-01`

    const { data: tsRows, error: tsErr } = await supabase
      .from('timesheets').select('id,hours')
      .eq('business_id', activeBusinessId)
      .eq('employee_id', employeeId)
      .eq('project_id', projectId)
      .gte('work_date', ms).lte('work_date', me)

    if (tsErr) { showError(tsErr.message); return }

    const totalHours = (tsRows ?? []).reduce((s, r) => s + Number(r.hours), 0)
    const totalEarnings = Math.round(totalHours * rate * 100) / 100

    if (totalHours === 0) {
      await supabase.from('employee_earnings').delete()
        .eq('business_id', activeBusinessId)
        .eq('employee_id', employeeId)
        .eq('project_id', projectId)
        .eq('earning_month', earningMonth)
      return
    }

    const { data: upserted, error: earnErr } = await supabase
      .from('employee_earnings')
      .upsert({
        business_id: activeBusinessId,
        employee_id: employeeId,
        project_id: projectId,
        earning_month: earningMonth,
        total_hours: totalHours,
        hourly_rate: rate,
        total_earnings: totalEarnings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id,employee_id,project_id,earning_month' })
      .select('id')
      .single()

    if (earnErr) { showError(earnErr.message); return }

    if (upserted) {
      const tsIds = (tsRows ?? []).map(r => r.id)
      if (tsIds.length) {
        await supabase.from('timesheets')
          .update({ earning_id: upserted.id })
          .in('id', tsIds)
      }
    }
  }

  async function saveRow(row: GridRow) {
    clearNotice()
    if (!activeBusinessId) return
    for (const wk of weeks) {
      const newH = parseNumber(cellValues[row.key]?.[wk.startDate] ?? '0')
      const existing = row.weekData[wk.startDate]
      if (existing.ids.length) {
        const { error } = await supabase.from('timesheets').delete().in('id', existing.ids)
        if (error) { showError(error.message); return }
      }
      if (newH > 0) {
        const { error } = await supabase.from('timesheets').insert({
          business_id: activeBusinessId, employee_id: row.employeeId, project_id: row.projectId,
          work_date: wk.startDate, work_type: 'REGULAR', hours: newH, travel_hours: 0,
        })
        if (error) { showError(error.message); return }
      }
    }
    await syncEarning(row.employeeId, row.projectId, row.rate)
    await loadData()
    showSuccess('Timesheet saved.')
  }

  async function deleteRow(row: GridRow) {
    if (!confirmAction('Delete all timesheet entries for this employee/project this month?')) return
    const ids = Object.values(row.weekData).flatMap(w => w.ids)
    if (ids.length) {
      const { error } = await supabase.from('timesheets').delete().in('id', ids)
      if (error) { showError(error.message); return }
    }
    await syncEarning(row.employeeId, row.projectId, row.rate)
    await loadData()
    showSuccess('Entries deleted.')
  }

  function addRow() {
    if (!addEmpId || !addProjId) { showError('Select both employee and project.'); return }
    const key = `${addEmpId}::${addProjId}`
    if (rows.some(r => r.key === key)) { showError('This combination already exists in the grid.'); return }

    const emp = emps.find(e => e.id === addEmpId)
    const proj = projs.find(p => p.id === addProjId)
    if (!emp || !proj) return

    const ec = ecs.find(c => c.id === proj.end_client_id)
    const vend = proj.vendor_id ? vends.find(v => v.id === proj.vendor_id) : null
    const wd: Record<string, WeekEntry> = {}
    for (const w of weeks) wd[w.startDate] = { hours: 0, ids: [] }

    const nr: GridRow = {
      key, employeeId: addEmpId, employeeName: emp.full_name,
      employeeEmail: emp.email, employeeType: emp.employee_type,
      projectId: addProjId, projectName: proj.name,
      startDate: proj.start_date, endDate: proj.end_date,
      endClientName: ec?.name ?? '—',
      vendorName: vend?.name ?? null,
      invoiceFreq: vend?.invoice_frequency ?? null,
      paymentTerms: vend?.payment_terms ?? null,
      rate: proj.employee_project_rate, tsFreq: proj.timesheet_frequency,
      invoiceNums: [], weekData: wd,
      earning: null,
    }

    setRows(prev => [...prev, nr])
    setCellValues(prev => {
      const nv = { ...prev, [key]: {} as Record<string, string> }
      for (const w of weeks) nv[key][w.startDate] = ''
      return nv
    })
    setAddOpen(false)
    setAddEmpId('')
    setAddProjId('')
    clearNotice()
  }

  function setCell(rowKey: string, weekStart: string, value: string) {
    setCellValues(prev => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], [weekStart]: value },
    }))
  }

  const monthLabel = (() => {
    const [y, m] = yearMonth.split('-').map(Number)
    return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  })()

  return (
    <PageSection title={`Timesheets \u2014 ${monthLabel}`} actions={
      <button className={addOpen ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={() => setAddOpen(o => !o)}>
        {addOpen ? 'Cancel' : '+ Add row'}
      </button>
    }>
      <div className="flex-row gap-md" style={{ flexWrap: 'wrap' }}>
        <FormField label="Month">
          <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
        </FormField>
      </div>

      {addOpen && (
        <div className="form-grid" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--color-accent-light)', borderRadius: 'var(--radius-md)' }}>
          <FormField label="Employee">
            <select value={addEmpId} onChange={e => setAddEmpId(e.target.value)}>
              <option value="">Select</option>
              {emps.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </FormField>
          <FormField label="Project">
            <select value={addProjId} onChange={e => setAddProjId(e.target.value)}>
              <option value="">Select</option>
              {projs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary btn-sm" type="button" onClick={addRow}>Add</button>
          </div>
        </div>
      )}

      <NoticeBanner message={message} type={type} />

      <div className="tableWrap" style={{ marginTop: '1rem' }}>
        <table style={{ fontSize: '0.78rem' }}>
          <thead>
            <tr>
              <th style={{ minWidth: 36 }}>#</th>
              <th style={{ minWidth: 140 }}>Name</th>
              {weeks.map(w => (
                <th key={w.startDate} style={{ minWidth: 52, textAlign: 'center' }}>{w.label}</th>
              ))}
              <th style={{ minWidth: 50, textAlign: 'center' }}>Total</th>
              <th style={{ minWidth: 100, textAlign: 'right' }}>Earnings</th>
              <th style={{ minWidth: 120 }}>Project</th>
              <th style={{ minWidth: 140 }}>Start / End</th>
              <th style={{ minWidth: 90 }}>Invoice #</th>
              <th>Inv Freq</th>
              <th style={{ minWidth: 130 }}>End Client</th>
              <th style={{ minWidth: 110 }}>Vendor / Type</th>
              <th>Rate</th>
              <th>Net Terms</th>
              <th>TS Freq</th>
              <th style={{ minWidth: 160 }}>Email</th>
              <th style={{ minWidth: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const total = weeks.reduce(
                (s, w) => s + parseNumber(cellValues[row.key]?.[w.startDate] ?? '0'), 0,
              )
              return (
                <tr key={row.key}>
                  <td style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{row.employeeName}</td>
                  {weeks.map(w => (
                    <td key={w.startDate} style={{ padding: 0, background: '#fffef5' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={cellValues[row.key]?.[w.startDate] ?? ''}
                        onChange={e => setCell(row.key, w.startDate, e.target.value)}
                        style={cellInp}
                      />
                    </td>
                  ))}
                  <td style={{ fontWeight: 700, textAlign: 'center', background: total > 0 ? 'var(--color-success-bg)' : undefined }}>
                    {total || ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: row.earning ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                    {row.earning ? `$${row.earning.total_earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (total > 0 ? `~$${(total * row.rate).toFixed(2)}` : '—')}
                  </td>
                  <td>{row.projectName}</td>
                  <td style={{ fontSize: '0.72rem' }}>
                    {row.startDate ?? '—'} → {row.endDate ?? 'ongoing'}
                  </td>
                  <td>{row.invoiceNums.join(', ') || '—'}</td>
                  <td>{fmtEnum(row.invoiceFreq)}</td>
                  <td>{row.endClientName}</td>
                  <td>{row.vendorName ?? row.employeeType}</td>
                  <td>${row.rate}/hr</td>
                  <td>{fmtEnum(row.paymentTerms)}</td>
                  <td>{fmtEnum(row.tsFreq)}</td>
                  <td style={{ fontSize: '0.72rem' }}>{row.employeeEmail ?? '—'}</td>
                  <td>
                    <div className="flex-row gap-xs">
                      <button type="button" className="btn-primary btn-sm" onClick={() => saveRow(row)}>Save</button>
                      <button type="button" className="btn-danger btn-sm" onClick={() => deleteRow(row)}>Del</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={weeks.length + 16} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                  No timesheet data for this month. Use "+ Add row" to create entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}

const cellInp: React.CSSProperties = {
  width: '100%',
  minWidth: 48,
  border: 'none',
  background: 'transparent',
  textAlign: 'center',
  padding: '8px 2px',
  fontSize: 'inherit',
  boxSizing: 'border-box',
  borderRadius: 0,
}
