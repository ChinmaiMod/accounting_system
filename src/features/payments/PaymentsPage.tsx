import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { isNonPositive, parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { InlineNumberEditor } from '../../shared/components/InlineNumberEditor'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

type InvoiceOption = { id: string; invoice_number: string; total_amount: number }
type PaymentRow = {
  id: string; invoice_id: string; payment_date: string; amount: number; payment_method: string | null
}

export function PaymentsPage() {
  const { activeBusinessId } = useOwnerContext()
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [invoiceId, setInvoiceId] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [amount, setAmount] = useState('0')
  const [method, setMethod] = useState('Bank Transfer')
  const [invoicePaidMap, setInvoicePaidMap] = useState<Record<string, number>>({})
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('0')
  const [editMethod, setEditMethod] = useState('')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const selectedOutstanding = invoiceId
    ? Math.max(0, Number(invoices.find((inv) => inv.id === invoiceId)?.total_amount ?? 0) - (invoicePaidMap[invoiceId] ?? 0))
    : 0

  async function loadData() {
    if (!activeBusinessId) return
    const [invoiceResult, paymentResult] = await Promise.all([
      supabase.from('invoices').select('id,invoice_number,total_amount').eq('business_id', activeBusinessId).order('invoice_date', { ascending: false }),
      supabase.from('payments').select('id,invoice_id,payment_date,amount,payment_method').eq('business_id', activeBusinessId).order('payment_date', { ascending: false }).limit(50),
    ])
    if (invoiceResult.error || paymentResult.error) { showError(invoiceResult.error?.message ?? paymentResult.error?.message ?? 'Failed to load'); return }
    setInvoices((invoiceResult.data ?? []) as InvoiceOption[])
    const paymentRows = (paymentResult.data ?? []) as PaymentRow[]
    setPayments(paymentRows)
    const paidMap: Record<string, number> = {}
    paymentRows.forEach((p) => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] ?? 0) + Number(p.amount ?? 0) })
    setInvoicePaidMap(paidMap)
  }

  async function refreshInvoiceStatus(targetInvoiceId: string) {
    const [invoiceResult, paymentSumResult] = await Promise.all([
      supabase.from('invoices').select('total_amount').eq('id', targetInvoiceId).single(),
      supabase.from('payments').select('amount').eq('invoice_id', targetInvoiceId),
    ])
    if (invoiceResult.error || paymentSumResult.error || !invoiceResult.data) return
    const totalAmount = Number(invoiceResult.data.total_amount ?? 0)
    const paidAmount = (paymentSumResult.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
    const dueDateResult = await supabase.from('invoices').select('due_date').eq('id', targetInvoiceId).single()
    const dueDateObj = dueDateResult.data?.due_date ? new Date(dueDateResult.data.due_date) : null
    let status: 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' = 'SENT'
    if (paidAmount >= totalAmount && totalAmount > 0) status = 'PAID'
    else if (paidAmount > 0) status = 'PARTIALLY_PAID'
    else if (dueDateObj && dueDateObj < new Date()) status = 'OVERDUE'
    await supabase.from('invoices').update({ status }).eq('id', targetInvoiceId)
  }

  useEffect(() => { loadData() }, [activeBusinessId])

  async function createPayment(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    const numericAmount = parseNumber(amount)
    if (isNonPositive(numericAmount)) { showError('Payment amount must be greater than 0.'); return }
    if (selectedOutstanding > 0 && numericAmount > selectedOutstanding) {
      if (!confirmAction(`Payment amount (${numericAmount}) exceeds outstanding (${selectedOutstanding}). Continue?`)) return
    }
    const { error: createError } = await supabase.from('payments').insert({
      business_id: activeBusinessId, invoice_id: invoiceId, payment_date: paymentDate,
      amount: numericAmount, payment_method: method,
    })
    if (createError) { showError(createError.message); return }
    await refreshInvoiceStatus(invoiceId)
    await loadData()
    showSuccess('Payment recorded.')
  }

  function startEditPayment(payment: PaymentRow) {
    setEditingPaymentId(payment.id); setEditAmount(String(payment.amount)); setEditMethod(payment.payment_method ?? ''); clearNotice()
  }

  async function saveEditPayment(payment: PaymentRow) {
    const numericAmount = parseNumber(editAmount)
    if (isNonPositive(numericAmount)) { showError('Payment amount must be greater than 0.'); return }
    const invoiceTotal = Number(invoices.find((inv) => inv.id === payment.invoice_id)?.total_amount ?? 0)
    const otherPaid = (invoicePaidMap[payment.invoice_id] ?? 0) - Number(payment.amount ?? 0)
    const projectedOutstanding = Math.max(0, invoiceTotal - otherPaid)
    if (projectedOutstanding > 0 && numericAmount > projectedOutstanding) {
      if (!confirmAction(`Updated amount (${numericAmount}) exceeds outstanding (${projectedOutstanding}). Continue?`)) return
    }
    const { error: updateError } = await supabase.from('payments').update({ amount: numericAmount, payment_method: editMethod || null }).eq('id', payment.id)
    if (updateError) { showError(updateError.message); return }
    setEditingPaymentId(null)
    await refreshInvoiceStatus(payment.invoice_id)
    await loadData()
    showSuccess('Payment updated.')
  }

  async function deletePayment(payment: PaymentRow) {
    if (!confirmAction('Delete this payment record?')) return
    const { error: deleteError } = await supabase.from('payments').delete().eq('id', payment.id)
    if (deleteError) { showError(deleteError.message); return }
    await refreshInvoiceStatus(payment.invoice_id)
    await loadData()
    showSuccess('Payment deleted.')
  }

  function invoiceNumById(id: string) { return invoices.find(i => i.id === id)?.invoice_number ?? id }

  return (
    <PageSection title="Invoice Payments">
      <form onSubmit={createPayment} className="form-grid">
        <FormField label="Invoice">
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
            <option value="">Select</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} (Outstanding: ${Math.max(0, Number(inv.total_amount) - (invoicePaidMap[inv.id] ?? 0))})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Payment date">
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </FormField>
        <FormField label="Amount">
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </FormField>
        <FormField label="Method">
          <input value={method} onChange={(e) => setMethod(e.target.value)} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add payment</button>
        </div>
      </form>
      {invoiceId ? <p className="text-muted text-sm mt-sm">Selected invoice outstanding: ${selectedOutstanding}</p> : null}
      <NoticeBanner message={message} type={type} />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                {editingPaymentId === payment.id ? (
                  <>
                    <td>{payment.payment_date}</td>
                    <td>{invoiceNumById(payment.invoice_id)}</td>
                    <td><InlineNumberEditor value={editAmount} onChange={setEditAmount} min="0.01" width="100px" /></td>
                    <td><input value={editMethod} onChange={(e) => setEditMethod(e.target.value)} style={{ width: '140px' }} /></td>
                    <td><EditSaveCancelButtons onSave={() => saveEditPayment(payment)} onCancel={() => setEditingPaymentId(null)} /></td>
                  </>
                ) : (
                  <>
                    <td>{payment.payment_date}</td>
                    <td>{invoiceNumById(payment.invoice_id)}</td>
                    <td style={{ fontWeight: 600 }}>${payment.amount}</td>
                    <td>{payment.payment_method ?? 'N/A'}</td>
                    <td><RowActions onEdit={() => startEditPayment(payment)} onDelete={() => deletePayment(payment)} /></td>
                  </>
                )}
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No payments recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}
