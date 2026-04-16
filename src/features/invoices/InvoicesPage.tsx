import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Invoice, InvoiceProject } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { isNegative, isNonPositive, parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { InlineNumberEditor } from '../../shared/components/InlineNumberEditor'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

type VendorOption = { id: string; name: string }
type ProjectOption = {
  id: string; name: string; end_client_actual_bill_rate: number
  tenure_discount_percent: number; volume_discount_percent: number
  vms_discount_percent: number; early_payment_discount_percent: number
}
type EmployeeOption = { id: string; full_name: string }
type PaymentAmountRow = { invoice_id: string; amount: number }

function calcExpectedBillRate(project: ProjectOption): number {
  const discountSum = (project.tenure_discount_percent || 0) + (project.volume_discount_percent || 0) + (project.vms_discount_percent || 0)
  if (discountSum === 0) return 0
  return Math.round(project.end_client_actual_bill_rate * (1 - discountSum / 100) * 100) / 100
}

function statusBadge(s: string) {
  const cls = s === 'PAID' ? 'badge-success' : s === 'OVERDUE' ? 'badge-error' : s === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-neutral'
  return <span className={`badge ${cls}`}>{s.replace(/_/g, ' ')}</span>
}

export function InvoicesPage() {
  const { activeBusinessId } = useOwnerContext()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [invoiceProjects, setInvoiceProjects] = useState<InvoiceProject[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('0')
  const [linkProjectId, setLinkProjectId] = useState('')
  const [linkEmployeeId, setLinkEmployeeId] = useState('')
  const [linkHours, setLinkHours] = useState('0')
  const [linkBillRate, setLinkBillRate] = useState('0')
  const [invoicePaidMap, setInvoicePaidMap] = useState<Record<string, number>>({})
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('0')
  const [editBillRate, setEditBillRate] = useState('0')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  async function loadData() {
    if (!activeBusinessId) return
    const [invoiceResult, vendorResult, projectResult, employeeResult, paymentResult] = await Promise.all([
      supabase.from('invoices').select('id,business_id,vendor_id,invoice_number,invoice_date,period_start,period_end,payment_terms,due_date,total_amount,status').eq('business_id', activeBusinessId).order('invoice_date', { ascending: false }).limit(50),
      supabase.from('vendors').select('id,name').eq('business_id', activeBusinessId).order('name'),
      supabase.from('projects').select('id,name,end_client_actual_bill_rate,tenure_discount_percent,volume_discount_percent,vms_discount_percent,early_payment_discount_percent').eq('business_id', activeBusinessId).order('name'),
      supabase.from('employees').select('id,full_name').eq('business_id', activeBusinessId).order('full_name'),
      supabase.from('payments').select('invoice_id,amount').eq('business_id', activeBusinessId),
    ])

    if (invoiceResult.error || vendorResult.error || projectResult.error || employeeResult.error || paymentResult.error) {
      showError(invoiceResult.error?.message ?? vendorResult.error?.message ?? projectResult.error?.message ?? employeeResult.error?.message ?? paymentResult.error?.message ?? 'Failed to load')
      return
    }
    setInvoices((invoiceResult.data ?? []) as Invoice[])
    setVendors(vendorResult.data ?? [])
    setProjects(projectResult.data ?? [])
    setEmployees((employeeResult.data ?? []) as EmployeeOption[])

    const paidMap: Record<string, number> = {}
    ;((paymentResult.data ?? []) as PaymentAmountRow[]).forEach((row) => {
      paidMap[row.invoice_id] = (paidMap[row.invoice_id] ?? 0) + Number(row.amount ?? 0)
    })
    setInvoicePaidMap(paidMap)
  }

  async function loadInvoiceProjects(invoiceId: string) {
    const { data, error: linkError } = await supabase
      .from('invoice_projects')
      .select('id,invoice_id,project_id,employee_id,hours,bill_rate,amount')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
    if (linkError) { showError(linkError.message); return }
    setInvoiceProjects((data ?? []) as InvoiceProject[])
  }

  useEffect(() => { loadData() }, [activeBusinessId])
  useEffect(() => {
    if (!selectedInvoiceId) { setInvoiceProjects([]); return }
    loadInvoiceProjects(selectedInvoiceId)
  }, [selectedInvoiceId])

  async function createInvoice(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    if (isNegative(parseNumber(totalAmount))) { showError('Invoice total amount cannot be negative.'); return }
    const { error: createError } = await supabase.from('invoices').insert({
      business_id: activeBusinessId, vendor_id: vendorId, invoice_number: invoiceNumber,
      invoice_date: invoiceDate, period_start: periodStart, period_end: periodEnd,
      payment_terms: 'NET_30', due_date: dueDate, total_amount: parseNumber(totalAmount), status: 'DRAFT',
    })
    if (createError) { showError(createError.message); return }
    await loadData()
    showSuccess('Invoice added.')
  }

  async function deleteInvoice(invoice: Invoice) {
    if (!confirmAction('Delete this invoice and all linked projects/payments?')) return
    const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoice.id)
    if (deleteError) { showError(deleteError.message); return }
    if (selectedInvoiceId === invoice.id) setSelectedInvoiceId('')
    await loadData()
    showSuccess('Invoice deleted.')
  }

  async function linkInvoiceProject(event: FormEvent) {
    event.preventDefault()
    if (!selectedInvoiceId) return
    clearNotice()
    const hoursValue = parseNumber(linkHours)
    const billRateValue = parseNumber(linkBillRate)
    if (isNonPositive(hoursValue) || isNegative(billRateValue)) { showError('Hours must be greater than 0 and bill rate cannot be negative.'); return }

    const selectedProject = projects.find((p) => p.id === linkProjectId)
    if (selectedProject) {
      const expected = calcExpectedBillRate(selectedProject)
      if (expected > 0 && Math.abs(billRateValue - expected) > 0.01) {
        showError(`Bill rate ($${billRateValue}) does not match expected rate ($${expected}).`)
        return
      }
    }

    if (invoiceProjects.some(ip => ip.project_id === linkProjectId)) { showError('This project is already linked.'); return }
    const { error: linkError } = await supabase.from('invoice_projects').insert({
      invoice_id: selectedInvoiceId, project_id: linkProjectId, employee_id: linkEmployeeId || null,
      hours: hoursValue, bill_rate: billRateValue, amount: hoursValue * billRateValue,
    })
    if (linkError) { showError(linkError.message); return }
    await syncInvoiceTotalsAndStatus(selectedInvoiceId)
    await loadInvoiceProjects(selectedInvoiceId)
    await loadData()
    showSuccess('Project linked to invoice.')
  }

  async function syncInvoiceTotalsAndStatus(invoiceId: string) {
    const [linksResult, paymentsResult, invoiceResult] = await Promise.all([
      supabase.from('invoice_projects').select('amount').eq('invoice_id', invoiceId),
      supabase.from('payments').select('amount').eq('invoice_id', invoiceId),
      supabase.from('invoices').select('due_date').eq('id', invoiceId).single(),
    ])
    if (linksResult.error || paymentsResult.error || invoiceResult.error || !invoiceResult.data) return
    const newTotal = (linksResult.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
    const paidAmount = (paymentsResult.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
    const dueDateObj = new Date(invoiceResult.data.due_date)
    let nextStatus: Invoice['status'] = 'SENT'
    if (newTotal > 0 && paidAmount >= newTotal) nextStatus = 'PAID'
    else if (paidAmount > 0 && paidAmount < newTotal) nextStatus = 'PARTIALLY_PAID'
    else if (paidAmount === 0 && dueDateObj < new Date()) nextStatus = 'OVERDUE'
    await supabase.from('invoices').update({ total_amount: newTotal, status: nextStatus }).eq('id', invoiceId)
  }

  function startEditLink(item: InvoiceProject) {
    setEditingLinkId(item.id); setEditHours(String(item.hours)); setEditBillRate(String(item.bill_rate)); clearNotice()
  }

  async function saveEditLink(item: InvoiceProject) {
    const nextHours = parseNumber(editHours)
    const nextRate = parseNumber(editBillRate)
    if (isNonPositive(nextHours) || isNegative(nextRate)) { showError('Hours must be greater than 0.'); return }
    const { error: updateError } = await supabase.from('invoice_projects').update({ hours: nextHours, bill_rate: nextRate, amount: nextHours * nextRate }).eq('id', item.id)
    if (updateError) { showError(updateError.message); return }
    setEditingLinkId(null)
    await syncInvoiceTotalsAndStatus(item.invoice_id)
    await loadInvoiceProjects(item.invoice_id)
    await loadData()
    showSuccess('Invoice project updated.')
  }

  async function deleteLink(item: InvoiceProject) {
    if (!confirmAction('Delete this linked invoice project row?')) return
    const { error: deleteError } = await supabase.from('invoice_projects').delete().eq('id', item.id)
    if (deleteError) { showError(deleteError.message); return }
    await syncInvoiceTotalsAndStatus(item.invoice_id)
    await loadInvoiceProjects(item.invoice_id)
    await loadData()
    showSuccess('Invoice project removed.')
  }

  function vendorNameById(id: string) { return vendors.find(v => v.id === id)?.name ?? id }
  function projNameById(id: string) { return projects.find(p => p.id === id)?.name ?? id }

  return (
    <>
      <PageSection title="Invoices">
        <form onSubmit={createInvoice} className="form-grid">
          <FormField label="Vendor">
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              <option value="">Select</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </FormField>
          <FormField label="Invoice number">
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
          </FormField>
          <FormField label="Invoice date">
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
          </FormField>
          <FormField label="Period start">
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
          </FormField>
          <FormField label="Period end">
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
          </FormField>
          <FormField label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </FormField>
          <FormField label="Total amount">
            <input type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
          </FormField>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add invoice</button>
          </div>
        </form>
        <NoticeBanner message={message} type={type} />

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td>{vendorNameById(inv.vendor_id)}</td>
                  <td>{inv.invoice_date}</td>
                  <td>{statusBadge(inv.status)}</td>
                  <td>${inv.total_amount}</td>
                  <td>${invoicePaidMap[inv.id] ?? 0}</td>
                  <td style={{ fontWeight: 600 }}>${Math.max(0, Number(inv.total_amount) - (invoicePaidMap[inv.id] ?? 0))}</td>
                  <td><RowActions onEdit={() => {}} onDelete={() => deleteInvoice(inv)} /></td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Link Projects to Invoice">
        <FormField label="Select invoice">
          <select value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)} style={{ maxWidth: '320px' }}>
            <option value="">Select</option>
            {invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>)}
          </select>
        </FormField>
        {selectedInvoiceId ? (
          <>
            <form onSubmit={linkInvoiceProject} className="form-grid" style={{ marginTop: '0.75rem' }}>
              <FormField label="Project">
                <select value={linkProjectId} onChange={(e) => {
                  setLinkProjectId(e.target.value)
                  const proj = projects.find((p) => p.id === e.target.value)
                  if (proj) {
                    const expected = calcExpectedBillRate(proj)
                    if (expected > 0) setLinkBillRate(String(expected))
                  }
                }} required>
                  <option value="">Select</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
              <FormField label="Employee (optional)">
                <select value={linkEmployeeId} onChange={(e) => setLinkEmployeeId(e.target.value)}>
                  <option value="">None</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </FormField>
              <FormField label="Hours">
                <input type="number" min="0" step="0.25" value={linkHours} onChange={(e) => setLinkHours(e.target.value)} required />
              </FormField>
              <FormField label="Bill rate">
                <input type="number" min="0" step="0.01" value={linkBillRate} onChange={(e) => setLinkBillRate(e.target.value)} required />
              </FormField>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn-primary" type="submit">Link project</button>
              </div>
            </form>

            {invoiceProjects.length > 0 && (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Hours</th>
                      <th>Bill Rate</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceProjects.map((item) => (
                      <tr key={item.id}>
                        {editingLinkId === item.id ? (
                          <>
                            <td>{projNameById(item.project_id)}</td>
                            <td><InlineNumberEditor value={editHours} onChange={setEditHours} step="0.25" width="80px" /></td>
                            <td><InlineNumberEditor value={editBillRate} onChange={setEditBillRate} width="90px" /></td>
                            <td>${parseNumber(editHours) * parseNumber(editBillRate)}</td>
                            <td><EditSaveCancelButtons onSave={() => saveEditLink(item)} onCancel={() => setEditingLinkId(null)} /></td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 600 }}>{projNameById(item.project_id)}</td>
                            <td>{item.hours}h</td>
                            <td>${item.bill_rate}</td>
                            <td style={{ fontWeight: 600 }}>${item.amount}</td>
                            <td><RowActions onEdit={() => startEditLink(item)} onDelete={() => deleteLink(item)} /></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </PageSection>
    </>
  )
}
