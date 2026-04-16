import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeExpense, EmployeeTransaction } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { isNonPositive, parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { RowActions } from '../../shared/components/RowActions'
import { lastDayOfMonthDate, periodFromDate } from '../../shared/fiscalPeriod'

const MANUAL_KINDS: EmployeeTransaction['entry_kind'][] = ['MANUAL_CREDIT', 'MANUAL_DEBIT', 'PAYMENT_TO_EMPLOYEE']

function kindLabel(kind: string, getOptions: (c: string) => { code: string; label: string }[]) {
  return getOptions('employee_transaction_kind').find((o) => o.code === kind)?.label ?? kind.replace(/_/g, ' ')
}

function sourceLabel(row: EmployeeTransaction): string {
  if (row.source_earning_id) return 'Timesheet earning'
  if (row.source_expense_id) return 'Expense'
  return 'Manual'
}

export function EmployeeTransactionsPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [yearMonth, setYearMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterEmployeeId, setFilterEmployeeId] = useState('')
  const [rows, setRows] = useState<EmployeeTransaction[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formKind, setFormKind] = useState<typeof MANUAL_KINDS[number]>('MANUAL_CREDIT')
  const [formTxnDate, setFormTxnDate] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const periodMonthFilter = `${yearMonth}-01`

  const loadData = useCallback(async () => {
    if (!activeBusinessId) return
    let txQ = supabase
      .from('employee_transactions')
      .select(
        'id,business_id,employee_id,project_id,txn_date,period_month,entry_kind,amount,description,notes,is_system_generated,source_earning_id,source_expense_id,created_at,updated_at',
      )
      .eq('business_id', activeBusinessId)
      .eq('period_month', periodMonthFilter)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)
    if (filterEmployeeId) txQ = txQ.eq('employee_id', filterEmployeeId)

    const [empR, projR, txR] = await Promise.all([
      supabase
        .from('employees')
        .select('id,business_id,first_name,last_name,full_name,email,employee_type,overtime_pay_rate,holiday_pay_rate,holiday_ot_pay_rate,travel_reimbursement_rate,employer_tax_percent')
        .eq('business_id', activeBusinessId)
        .order('full_name'),
      supabase.from('projects').select('id,name').eq('business_id', activeBusinessId),
      txQ,
    ])

    if (empR.error || projR.error || txR.error) {
      showError(empR.error?.message ?? projR.error?.message ?? txR.error?.message ?? 'Load failed')
      return
    }

    setEmployees((empR.data ?? []) as Employee[])
    const pm: Record<string, string> = {}
    for (const p of projR.data ?? []) pm[(p as { id: string }).id] = (p as { name: string }).name
    setProjectNames(pm)

    setRows((txR.data ?? []) as EmployeeTransaction[])
  }, [activeBusinessId, periodMonthFilter, filterEmployeeId, showError])

  useEffect(() => {
    loadData()
  }, [loadData])

  const netTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows])

  async function syncFromLedger() {
    if (!activeBusinessId) return
    clearNotice()

    const { error: delErr } = await supabase
      .from('employee_transactions')
      .delete()
      .eq('business_id', activeBusinessId)
      .eq('is_system_generated', true)

    if (delErr) {
      showError(delErr.message)
      return
    }

    const { data: earnings, error: eErr } = await supabase
      .from('employee_earnings')
      .select('id,business_id,employee_id,project_id,earning_month,total_hours,hourly_rate,total_earnings')
      .eq('business_id', activeBusinessId)

    if (eErr) {
      showError(eErr.message)
      return
    }

    const earningRows: Record<string, unknown>[] = []
    for (const e of earnings ?? []) {
      const te = Number(e.total_earnings)
      if (te === 0) continue
      earningRows.push({
        business_id: activeBusinessId,
        employee_id: e.employee_id,
        project_id: e.project_id,
        txn_date: lastDayOfMonthDate(e.earning_month),
        period_month: e.earning_month,
        entry_kind: 'EARNING_FROM_TIMESHEET',
        amount: te,
        description: `Timesheet earnings (${e.total_hours} hrs @ $${Number(e.hourly_rate).toFixed(2)}/hr)`,
        notes: null,
        is_system_generated: true,
        source_earning_id: e.id,
        source_expense_id: null,
      })
    }
    if (earningRows.length) {
      const { error } = await supabase.from('employee_transactions').insert(earningRows)
      if (error) {
        showError(error.message)
        return
      }
    }

    const { data: expenses, error: xErr } = await supabase
      .from('employee_expenses')
      .select('*')
      .eq('business_id', activeBusinessId)
      .eq('status', 'APPLIED')

    if (xErr) {
      showError(xErr.message)
      return
    }

    const expenseRows: Record<string, unknown>[] = []
    for (const x of (expenses ?? []) as EmployeeExpense[]) {
      let entryKind: 'EXPENSE_DEDUCTION' | 'EXPENSE_REIMBURSEMENT'
      let signed: number
      if (x.deduction_mode === 'REIMBURSEMENT') {
        entryKind = 'EXPENSE_REIMBURSEMENT'
        signed = Number(x.amount)
      } else if (x.borne_by === 'EMPLOYEE') {
        entryKind = 'EXPENSE_DEDUCTION'
        signed = -Number(x.amount)
      } else {
        continue
      }
      expenseRows.push({
        business_id: activeBusinessId,
        employee_id: x.employee_id,
        project_id: null,
        txn_date: x.expense_date,
        period_month: periodFromDate(x.expense_date),
        entry_kind: entryKind,
        amount: signed,
        description: `${x.expense_type} (${x.expense_date})`,
        notes: x.notes,
        is_system_generated: true,
        source_earning_id: null,
        source_expense_id: x.id,
      })
    }
    if (expenseRows.length) {
      const { error } = await supabase.from('employee_transactions').insert(expenseRows)
      if (error) {
        showError(error.message)
        return
      }
    }

    await loadData()
    showSuccess('Ledger synced from timesheet earnings and applied employee expenses.')
  }

  function resetForm() {
    setEditingId(null)
    setFormEmployeeId('')
    setFormKind('MANUAL_CREDIT')
    setFormTxnDate('')
    setFormAmount('')
    setFormDescription('')
    setFormNotes('')
  }

  function startEdit(row: EmployeeTransaction) {
    setEditingId(row.id)
    setFormEmployeeId(row.employee_id)
    setFormKind(row.entry_kind as typeof MANUAL_KINDS[number])
    setFormTxnDate(row.txn_date)
    setFormAmount(String(Math.abs(Number(row.amount))))
    setFormDescription(row.description)
    setFormNotes(row.notes ?? '')
  }

  async function saveManual(e: FormEvent) {
    e.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    if (!formEmployeeId) {
      showError('Select an employee.')
      return
    }
    const abs = parseNumber(formAmount)
    if (isNonPositive(abs)) {
      showError('Enter an amount greater than 0.')
      return
    }
    let signed = abs
    if (formKind === 'MANUAL_DEBIT' || formKind === 'PAYMENT_TO_EMPLOYEE') signed = -abs

    const txnDate = formTxnDate || `${yearMonth}-15`
    const period_month = periodFromDate(txnDate)

    const payload = {
      business_id: activeBusinessId,
      employee_id: formEmployeeId,
      project_id: null,
      txn_date: txnDate,
      period_month,
      entry_kind: formKind,
      amount: signed,
      description: formDescription.trim() || 'Manual entry',
      notes: formNotes.trim() || null,
      is_system_generated: false,
      source_earning_id: null,
      source_expense_id: null,
      updated_at: new Date().toISOString(),
    }

    if (editingId) {
      const { error } = await supabase.from('employee_transactions').update(payload).eq('id', editingId).eq('is_system_generated', false)
      if (error) {
        showError(error.message)
        return
      }
      showSuccess('Transaction updated.')
    } else {
      const { error } = await supabase.from('employee_transactions').insert(payload)
      if (error) {
        showError(error.message)
        return
      }
      showSuccess('Transaction added.')
    }
    resetForm()
    await loadData()
  }

  async function deleteRow(row: EmployeeTransaction) {
    if (row.is_system_generated) return
    if (!confirmAction('Delete this transaction?')) return
    const { error } = await supabase.from('employee_transactions').delete().eq('id', row.id).eq('is_system_generated', false)
    if (error) {
      showError(error.message)
      return
    }
    if (editingId === row.id) resetForm()
    await loadData()
    showSuccess('Transaction deleted.')
  }

  function empName(id: string) {
    return employees.find((x) => x.id === id)?.full_name ?? id
  }

  if (!activeBusinessId) {
    return <p className="text-muted">Select a business first.</p>
  }

  return (
    <PageSection
      title="Employee Transactions"
      actions={
        <button type="button" className="btn-secondary btn-sm" onClick={() => syncFromLedger()}>
          Sync from earnings &amp; expenses
        </button>
      }
    >
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        Phase 2 ledger: positive amounts increase the employee&rsquo;s net position (earnings, reimbursements, credits); negative amounts
        reduce it (deductions, payments). System rows are rebuilt when you sync; manual entries stay unless you delete them.
      </p>

      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <FormField label="Period (month)">
          <input type="month" value={yearMonth} onChange={(ev) => setYearMonth(ev.target.value)} />
        </FormField>
        <FormField label="Employee filter">
          <select value={filterEmployeeId} onChange={(ev) => setFilterEmployeeId(ev.target.value)}>
            <option value="">All employees</option>
            {employees.map((em) => (
              <option key={em.id} value={em.id}>{em.full_name}</option>
            ))}
          </select>
        </FormField>
      </div>

      <form onSubmit={saveManual} className="form-grid" style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--color-accent-light)', borderRadius: 'var(--radius-md)' }}>
        <h3 style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.95rem' }}>{editingId ? 'Edit manual transaction' : 'Add manual transaction'}</h3>
        <FormField label="Employee">
          <select value={formEmployeeId} onChange={(ev) => setFormEmployeeId(ev.target.value)} required>
            <option value="">Select</option>
            {employees.map((em) => (
              <option key={em.id} value={em.id}>{em.full_name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Kind">
          <select value={formKind} onChange={(ev) => setFormKind(ev.target.value as (typeof MANUAL_KINDS)[number])}>
            {MANUAL_KINDS.map((k) => (
              <option key={k} value={k}>{kindLabel(k, getOptions)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Transaction date">
          <input type="date" value={formTxnDate} onChange={(ev) => setFormTxnDate(ev.target.value)} />
        </FormField>
        <FormField label="Amount (positive number)">
          <input type="number" min="0.01" step="0.01" value={formAmount} onChange={(ev) => setFormAmount(ev.target.value)} required />
        </FormField>
        <FormField label="Description">
          <input value={formDescription} onChange={(ev) => setFormDescription(ev.target.value)} required />
        </FormField>
        <FormField label="Notes">
          <input value={formNotes} onChange={(ev) => setFormNotes(ev.target.value)} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end', alignItems: 'flex-end', gap: '0.5rem' }}>
          {editingId && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => resetForm()}>
              Cancel edit
            </button>
          )}
          <button type="submit" className="btn-primary">{editingId ? 'Save changes' : 'Add transaction'}</button>
        </div>
      </form>

      <NoticeBanner message={message} type={type} />

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Kind</th>
              <th>Source</th>
              <th>Project</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.txn_date}</td>
                <td style={{ fontWeight: 600 }}>{empName(row.employee_id)}</td>
                <td><span className="badge badge-neutral">{kindLabel(row.entry_kind, getOptions)}</span></td>
                <td>{sourceLabel(row)}</td>
                <td>{row.project_id ? projectNames[row.project_id] ?? '—' : '—'}</td>
                <td style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: Number(row.amount) >= 0 ? '#0d6b3d' : '#b42318',
                }}
                >
                  {Number(row.amount) >= 0 ? '+' : ''}{Number(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ fontSize: '0.8rem' }}>{row.description}</td>
                <td>
                  {!row.is_system_generated ? (
                    <RowActions onEdit={() => startEdit(row)} onDelete={() => deleteRow(row)} />
                  ) : (
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Synced</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                  No transactions for this period{filterEmployeeId ? ' and employee' : ''}. Sync from earnings &amp; expenses or add manual entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)' }}>
          <strong>Net for visible rows: </strong>
          <span style={{ fontWeight: 700, color: netTotal >= 0 ? 'var(--color-primary)' : '#b42318' }}>
            {netTotal >= 0 ? '+' : ''}{netTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </span>
        </div>
      )}
    </PageSection>
  )
}
