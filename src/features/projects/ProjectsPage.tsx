import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { EndClient, Employee, Project, Vendor } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { isNegative, parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

const PROJECT_SELECT_COLS =
  'id,business_id,end_client_id,vendor_id,employee_id,name,start_date,end_date,work_mode,work_location_address1,work_location_address2,work_location_city,work_location_state,work_location_zip,end_client_actual_bill_rate,end_client_informed_bill_rate,employee_agreed_percent,employee_project_rate,tenure_discount_percent,volume_discount_percent,vms_discount_percent,early_payment_discount_percent,lca_hourly_rate,timesheet_frequency'

function calcProjectRate(agreedPct: number, actualRate: number, informedRate: number): number {
  const base = Math.min(actualRate, informedRate)
  return Math.round(base * (agreedPct / 100) * 100) / 100
}

export function ProjectsPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const [projects, setProjects] = useState<Project[]>([])
  const [endClients, setEndClients] = useState<EndClient[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [name, setName] = useState('')
  const [endClientId, setEndClientId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [workMode, setWorkMode] = useState<'REMOTE' | 'HYBRID' | 'ONSITE'>('REMOTE')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [actualRate, setActualRate] = useState('0')
  const [informedRate, setInformedRate] = useState('0')
  const [agreedPercent, setAgreedPercent] = useState('0')
  const [projectRate, setProjectRate] = useState('0')
  const projectRateManual = useRef(false)
  const [tenureDiscount, setTenureDiscount] = useState('0')
  const [volumeDiscount, setVolumeDiscount] = useState('0')
  const [vmsDiscount, setVmsDiscount] = useState('0')
  const [earlyPaymentDiscount, setEarlyPaymentDiscount] = useState('0')
  const [lcaRate, setLcaRate] = useState('')
  const [tsFrequency, setTsFrequency] = useState<'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'>('WEEKLY')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  useEffect(() => {
    if (projectRateManual.current) return
    const calc = calcProjectRate(parseNumber(agreedPercent), parseNumber(actualRate), parseNumber(informedRate))
    setProjectRate(String(calc))
  }, [agreedPercent, actualRate, informedRate])

  async function loadData() {
    if (!activeBusinessId) return
    const [projectResult, endClientResult, vendorResult, employeeResult] = await Promise.all([
      supabase.from('projects').select(PROJECT_SELECT_COLS).eq('business_id', activeBusinessId).order('name'),
      supabase.from('end_clients').select('id,business_id,name').eq('business_id', activeBusinessId).order('name'),
      supabase.from('vendors').select('id,business_id,name,invoice_frequency,payment_terms,address1,address2,city,state,zip').eq('business_id', activeBusinessId).order('name'),
      supabase.from('employees').select('id,business_id,first_name,last_name,full_name,email,employee_type,overtime_pay_rate,holiday_pay_rate,holiday_ot_pay_rate,travel_reimbursement_rate,employer_tax_percent').eq('business_id', activeBusinessId).order('full_name'),
    ])

    if (projectResult.error || endClientResult.error || vendorResult.error || employeeResult.error) {
      showError(projectResult.error?.message ?? endClientResult.error?.message ?? vendorResult.error?.message ?? employeeResult.error?.message ?? 'Failed to load')
      return
    }
    setProjects((projectResult.data ?? []) as Project[])
    setEndClients((endClientResult.data ?? []) as EndClient[])
    setVendors((vendorResult.data ?? []) as Vendor[])
    setEmployees((employeeResult.data ?? []) as Employee[])
  }

  useEffect(() => { loadData() }, [activeBusinessId])

  async function createProject(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    if (projects.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      showError(`A project named "${name.trim()}" already exists.`)
      return
    }
    const actual = parseNumber(actualRate)
    const informed = parseNumber(informedRate)
    const percent = parseNumber(agreedPercent)
    const rate = parseNumber(projectRate)
    const tenure = parseNumber(tenureDiscount)
    const volume = parseNumber(volumeDiscount)
    const vms = parseNumber(vmsDiscount)
    const earlyPay = parseNumber(earlyPaymentDiscount)
    if (isNegative(actual) || isNegative(informed) || isNegative(rate)) {
      showError('Bill rates cannot be negative.')
      return
    }
    if (percent < 0 || percent > 100) {
      showError('Employee agreed % must be between 0 and 100.')
      return
    }
    const discountFields = [tenure, volume, vms, earlyPay]
    if (discountFields.some((d) => d < 0 || d > 100)) {
      showError('Discount percentages must be between 0 and 100.')
      return
    }
    const lcaValue = lcaRate.trim() ? parseNumber(lcaRate) : null
    if (lcaValue !== null && isNegative(lcaValue)) {
      showError('LCA hourly rate cannot be negative.')
      return
    }
    const { error: createError } = await supabase.from('projects').insert({
      business_id: activeBusinessId,
      end_client_id: endClientId,
      vendor_id: vendorId || null,
      employee_id: employeeId || null,
      name,
      start_date: startDate || null,
      end_date: endDate || null,
      work_mode: workMode,
      work_location_address1: address1 || null,
      work_location_address2: address2 || null,
      work_location_city: city || null,
      work_location_state: state || null,
      work_location_zip: zip || null,
      end_client_actual_bill_rate: actual,
      end_client_informed_bill_rate: informed,
      employee_agreed_percent: percent,
      employee_project_rate: rate,
      tenure_discount_percent: tenure,
      volume_discount_percent: volume,
      vms_discount_percent: vms,
      early_payment_discount_percent: earlyPay,
      lca_hourly_rate: lcaValue,
      timesheet_frequency: tsFrequency,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setName(''); setStartDate(''); setEndDate('')
    setAddress1(''); setAddress2(''); setCity(''); setState(''); setZip('')
    setActualRate('0'); setInformedRate('0'); setAgreedPercent('0'); setProjectRate('0')
    projectRateManual.current = false
    setTenureDiscount('0'); setVolumeDiscount('0'); setVmsDiscount('0'); setEarlyPaymentDiscount('0')
    setLcaRate(''); setTsFrequency('WEEKLY')
    await loadData()
    showSuccess('Project added.')
  }

  async function deleteProject(project: Project) {
    if (!confirmAction('Delete this project? Related timesheets/invoices may be affected.')) return
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id)
    if (deleteError) { showError(deleteError.message); return }
    await loadData()
    showSuccess('Project deleted.')
  }

  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editEndClientId, setEditEndClientId] = useState('')
  const [editVendorId, setEditVendorId] = useState('')
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editWorkMode, setEditWorkMode] = useState<'REMOTE' | 'HYBRID' | 'ONSITE'>('REMOTE')
  const [editActualRate, setEditActualRate] = useState('0')
  const [editInformedRate, setEditInformedRate] = useState('0')
  const [editAgreedPct, setEditAgreedPct] = useState('0')
  const [editProjectRate, setEditProjectRate] = useState('0')
  const [editLcaRate, setEditLcaRate] = useState('')
  const [editTsFreq, setEditTsFreq] = useState<'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY'>('WEEKLY')

  function startEditProject(p: Project) {
    setEditProjectId(p.id); setEditProjectName(p.name)
    setEditEndClientId(p.end_client_id); setEditVendorId(p.vendor_id ?? '')
    setEditEmployeeId(p.employee_id ?? ''); setEditWorkMode(p.work_mode)
    setEditActualRate(String(p.end_client_actual_bill_rate)); setEditInformedRate(String(p.end_client_informed_bill_rate))
    setEditAgreedPct(String(p.employee_agreed_percent)); setEditProjectRate(String(p.employee_project_rate))
    setEditLcaRate(p.lca_hourly_rate != null ? String(p.lca_hourly_rate) : '')
    setEditTsFreq(p.timesheet_frequency)
    clearNotice()
  }

  async function saveEditProject(p: Project) {
    const actual = parseNumber(editActualRate)
    const informed = parseNumber(editInformedRate)
    const percent = parseNumber(editAgreedPct)
    const rate = parseNumber(editProjectRate)
    if (isNegative(actual) || isNegative(informed) || isNegative(rate)) { showError('Bill rates cannot be negative.'); return }
    if (percent < 0 || percent > 100) { showError('Employee agreed % must be between 0 and 100.'); return }
    const editLcaValue = editLcaRate.trim() ? parseNumber(editLcaRate) : null
    if (editLcaValue !== null && isNegative(editLcaValue)) { showError('LCA hourly rate cannot be negative.'); return }
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        name: editProjectName, end_client_id: editEndClientId, vendor_id: editVendorId || null,
        employee_id: editEmployeeId || null, work_mode: editWorkMode,
        end_client_actual_bill_rate: actual, end_client_informed_bill_rate: informed,
        employee_agreed_percent: percent, employee_project_rate: rate,
        lca_hourly_rate: editLcaValue, timesheet_frequency: editTsFreq,
      })
      .eq('id', p.id)
    if (updateError) { showError(updateError.message); return }
    setEditProjectId(null)
    await loadData()
    showSuccess('Project updated.')
  }

  function employeeName(id: string | null) {
    if (!id) return 'Unassigned'
    return employees.find((e) => e.id === id)?.full_name ?? id
  }
  function endClientName(id: string) {
    return endClients.find((c) => c.id === id)?.name ?? id
  }
  function vendorName(id: string | null) {
    if (!id) return 'End client is vendor'
    return vendors.find((v) => v.id === id)?.name ?? id
  }

  const [showForm, setShowForm] = useState(false)

  return (
    <PageSection title="Projects" actions={
      <button className="btn-primary btn-sm" onClick={() => setShowForm(o => !o)}>
        {showForm ? 'Hide form' : '+ Add project'}
      </button>
    }>
      {showForm && (
        <form onSubmit={createProject} className="form-grid" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)', marginBottom: '1rem' }}>
          <FormField label="Project name">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="End Client">
            <select value={endClientId} onChange={(e) => setEndClientId(e.target.value)} required>
              <option value="">Select</option>
              {endClients.map((ec) => <option key={ec.id} value={ec.id}>{ec.name}</option>)}
            </select>
          </FormField>
          <FormField label="Vendor (optional)">
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">None (end client is vendor)</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </FormField>
          <FormField label="Employee">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">None</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
          </FormField>
          <FormField label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="End date">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
          <FormField label="Work mode">
            <select value={workMode} onChange={(e) => setWorkMode(e.target.value as typeof workMode)}>
              {getOptions('project_work_mode').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Actual bill rate">
            <input type="number" min="0" step="0.01" value={actualRate} onChange={(e) => setActualRate(e.target.value)} />
          </FormField>
          <FormField label="Informed bill rate">
            <input type="number" min="0" step="0.01" value={informedRate} onChange={(e) => setInformedRate(e.target.value)} />
          </FormField>
          <FormField label="Employee agreed %">
            <input type="number" min="0" max="100" step="0.01" value={agreedPercent} onChange={(e) => setAgreedPercent(e.target.value)} />
          </FormField>
          <FormField label="Project rate (auto or manual)">
            <div className="flex-row">
              <input type="number" min="0" step="0.01" value={projectRate} onChange={(e) => { setProjectRate(e.target.value); projectRateManual.current = true }} />
              {projectRateManual.current && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => {
                  projectRateManual.current = false
                  const calc = calcProjectRate(parseNumber(agreedPercent), parseNumber(actualRate), parseNumber(informedRate))
                  setProjectRate(String(calc))
                }}>Auto</button>
              )}
            </div>
          </FormField>
          <FormField label="Tenure discount %">
            <input type="number" min="0" max="100" step="0.01" value={tenureDiscount} onChange={(e) => setTenureDiscount(e.target.value)} />
          </FormField>
          <FormField label="Volume discount %">
            <input type="number" min="0" max="100" step="0.01" value={volumeDiscount} onChange={(e) => setVolumeDiscount(e.target.value)} />
          </FormField>
          <FormField label="VMS discount %">
            <input type="number" min="0" max="100" step="0.01" value={vmsDiscount} onChange={(e) => setVmsDiscount(e.target.value)} />
          </FormField>
          <FormField label="Early pay discount %">
            <input type="number" min="0" max="100" step="0.01" value={earlyPaymentDiscount} onChange={(e) => setEarlyPaymentDiscount(e.target.value)} />
          </FormField>
          <FormField label="LCA hourly rate">
            <input type="number" min="0" step="0.01" value={lcaRate} onChange={(e) => setLcaRate(e.target.value)} placeholder="Optional" />
          </FormField>
          <FormField label="Timesheet frequency">
            <select value={tsFrequency} onChange={(e) => setTsFrequency(e.target.value as typeof tsFrequency)}>
              {getOptions('project_timesheet_frequency').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </FormField>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add project</button>
          </div>
        </form>
      )}
      <NoticeBanner message={message} type={type} />

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Employee</th>
              <th>End Client</th>
              <th>Vendor</th>
              <th>Mode</th>
              <th>Dates</th>
              <th>Actual Rate</th>
              <th>Informed Rate</th>
              <th>Emp %</th>
              <th>Project Rate</th>
              <th>LCA Rate</th>
              <th>TS Freq</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                {editProjectId === project.id ? (
                  <>
                    <td><input value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} style={{ width: '120px' }} /></td>
                    <td>
                      <select value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)} style={{ width: '120px' }}>
                        <option value="">None</option>
                        {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editEndClientId} onChange={(e) => setEditEndClientId(e.target.value)} style={{ width: '120px' }}>
                        {endClients.map((ec) => <option key={ec.id} value={ec.id}>{ec.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editVendorId} onChange={(e) => setEditVendorId(e.target.value)} style={{ width: '120px' }}>
                        <option value="">None</option>
                        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editWorkMode} onChange={(e) => setEditWorkMode(e.target.value as typeof editWorkMode)} style={{ width: '100px' }}>
                        {getOptions('project_work_mode').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{project.start_date ?? '—'} → {project.end_date ?? 'ongoing'}</td>
                    <td><input type="number" value={editActualRate} onChange={(e) => setEditActualRate(e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input type="number" value={editInformedRate} onChange={(e) => setEditInformedRate(e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input type="number" value={editAgreedPct} onChange={(e) => setEditAgreedPct(e.target.value)} style={{ width: '60px' }} /></td>
                    <td><input type="number" value={editProjectRate} onChange={(e) => setEditProjectRate(e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input type="number" value={editLcaRate} onChange={(e) => setEditLcaRate(e.target.value)} style={{ width: '80px' }} placeholder="—" /></td>
                    <td>
                      <select value={editTsFreq} onChange={(e) => setEditTsFreq(e.target.value as typeof editTsFreq)} style={{ width: '100px' }}>
                        {getOptions('project_timesheet_frequency').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                      </select>
                    </td>
                    <td><EditSaveCancelButtons onSave={() => saveEditProject(project)} onCancel={() => setEditProjectId(null)} /></td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{project.name}</td>
                    <td>{employeeName(project.employee_id)}</td>
                    <td>{endClientName(project.end_client_id)}</td>
                    <td>{vendorName(project.vendor_id)}</td>
                    <td><span className="badge badge-neutral">{project.work_mode}</span></td>
                    <td style={{ fontSize: '0.75rem' }}>{project.start_date ?? '—'} → {project.end_date ?? 'ongoing'}</td>
                    <td>${project.end_client_actual_bill_rate}</td>
                    <td>${project.end_client_informed_bill_rate}</td>
                    <td>{project.employee_agreed_percent}%</td>
                    <td>${project.employee_project_rate}</td>
                    <td>{project.lca_hourly_rate != null ? `$${project.lca_hourly_rate}` : '—'}</td>
                    <td>{project.timesheet_frequency.replace('_', '-')}</td>
                    <td><RowActions onEdit={() => startEditProject(project)} onDelete={() => deleteProject(project)} /></td>
                  </>
                )}
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}
