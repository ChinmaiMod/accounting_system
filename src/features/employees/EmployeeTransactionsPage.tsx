import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeExpense, EmployeeTransaction } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { isNonPositive, parseNumber } from '../../shared/numberValidation'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { periodFromDate } from '../../shared/fiscalPeriod'

const MANUAL_KINDS: EmployeeTransaction['entry_kind'][] = ['MANUAL_CREDIT', 'MANUAL_DEBIT', 'PAYMENT_TO_EMPLOYEE']

type ManualDraft = {
  employee_id: string
  entry_kind: (typeof MANUAL_KINDS)[number]
  txn_date: string
  amount: string
  description: string
  notes: string
}

function emptyDraft(yearMonth: string): ManualDraft {
  return {
    employee_id: '',
    entry_kind: 'MANUAL_CREDIT',
    txn_date: `${yearMonth}-15`,
    amount: '',
    description: '',
    notes: '',
  }
}

function kindLabel(kind: string, getOptions: (c: string) => { code: string; label: string }[]) {
  return getOptions('employee_transaction_kind').find((o) => o.code === kind)?.label ?? kind.replace(/_/g, ' ')
}

function sourceLabel(row: EmployeeTransaction): string {
  if (row.entry_kind === 'EMPLOYEE_EARNINGS') return 'Timesheet'
  if (row.source_expense_id) return 'Expense'
  return 'Manual'
}

function normalizeManualDraft(yearMonth: string, draft: ManualDraft, showError: (msg: string) => void) {
  if (!draft.employee_id) {
    showError('Select an employee.')
    return null
  }

  const abs = parseNumber(draft.amount)
  if (isNonPositive(abs)) {
    showError('Enter an amount greater than 0.')
    return null
  }

  const txnDate = draft.txn_date || `${yearMonth}-15`
  const periodMonth = periodFromDate(txnDate)
  const signedAmount = draft.entry_kind === 'MANUAL_DEBIT' || draft.entry_kind === 'PAYMENT_TO_EMPLOYEE' ? -abs : abs

  return {
    txnDate,
    periodMonth,
    signedAmount,
    description: draft.description.trim() || 'Manual entry',
    notes: draft.notes.trim() || null,
  }
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

  const [isAdding, setIsAdding] = useState(false)
  const [addDraft, setAddDraft] = useState<ManualDraft>(() => emptyDraft(yearMonth))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ManualDraft>(() => emptyDraft(yearMonth))

  const periodMonthFilter = `${yearMonth}-01`

  const loadData = useCallback(async () => {
    if (!activeBusinessId) return
    let txQ = supabase
      .from('employee_transactions')
      .select(
        'id,business_id,employee_id,project_id,txn_date,period_month,entry_kind,amount,description,notes,is_system_generated,source_expense_id,created_at,updated_at',
      )
      .eq('business_id', activeBusinessId)
      .eq('period_month', periodMonthFilter)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(700)
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

  useEffect(() => {
    if (!isAdding) setAddDraft(emptyDraft(yearMonth))
  }, [yearMonth, isAdding])

  const netTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.amount), 0), [rows])

  async function syncAppliedExpenses() {
    if (!activeBusinessId) return
    clearNotice()

    const { error: delErr } = await supabase
      .from('employee_transactions')
      .delete()
      .eq('business_id', activeBusinessId)
      .eq('is_system_generated', true)
      .in('entry_kind', ['EXPENSE_DEDUCTION', 'EXPENSE_REIMBURSEMENT'])

    if (delErr) {
      showError(delErr.message)
      return
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
    showSuccess('Expense transactions synced from applied employee expenses.')
  }

  function startAdd() {
    clearNotice()
    setIsAdding(true)
    setAddDraft(emptyDraft(yearMonth))
  }

  function cancelAdd() {
    setIsAdding(false)
    setAddDraft(emptyDraft(yearMonth))
  }

  async function saveAdd() {
    if (!activeBusinessId) return
    clearNotice()

    const normalized = normalizeManualDraft(yearMonth, addDraft, showError)
    if (!normalized) return

    const payload = {
      business_id: activeBusinessId,
      employee_id: addDraft.employee_id,
      project_id: null,
      txn_date: normalized.txnDate,
      period_month: normalized.periodMonth,
      entry_kind: addDraft.entry_kind,
      amount: normalized.signedAmount,
      description: normalized.description,
      notes: normalized.notes,
      is_system_generated: false,
      source_expense_id: null,
    }

    const { error } = await supabase.from('employee_transactions').insert(payload)
    if (error) {
      showError(error.message)
      return
    }

    setIsAdding(false)
    setAddDraft(emptyDraft(yearMonth))
    await loadData()
    showSuccess('Transaction added.')
  }

  function startEdit(row: EmployeeTransaction) {
    if (row.is_system_generated) return
    const kind = MANUAL_KINDS.includes(row.entry_kind as (typeof MANUAL_KINDS)[number])
      ? (row.entry_kind as (typeof MANUAL_KINDS)[number])
      : 'MANUAL_CREDIT'

    setEditingId(row.id)
    setEditDraft({
      employee_id: row.employee_id,
      entry_kind: kind,
      txn_date: row.txn_date,
      amount: String(Math.abs(Number(row.amount))),
      description: row.description,
      notes: row.notes ?? '',
    })
    clearNotice()
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(emptyDraft(yearMonth))
  }

  async function saveEdit(rowId: string) {
    if (!activeBusinessId) return
    clearNotice()

    const normalized = normalizeManualDraft(yearMonth, editDraft, showError)
    if (!normalized) return

    const payload = {
      employee_id: editDraft.employee_id,
      project_id: null,
      txn_date: normalized.txnDate,
      period_month: normalized.periodMonth,
      entry_kind: editDraft.entry_kind,
      amount: normalized.signedAmount,
      description: normalized.description,
      notes: normalized.notes,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('employee_transactions')
      .update(payload)
      .eq('id', rowId)
      .eq('business_id', activeBusinessId)
      .eq('is_system_generated', false)

    if (error) {
      showError(error.message)
      return
    }

    setEditingId(null)
    setEditDraft(emptyDraft(yearMonth))
    await loadData()
    showSuccess('Transaction updated.')
  }

  async function deleteRow(row: EmployeeTransaction) {
    if (row.is_system_generated) return
    if (!confirmAction('Delete this transaction?')) return

    const { error } = await supabase
      .from('employee_transactions')
      .delete()
      .eq('id', row.id)
      .eq('is_system_generated', false)

    if (error) {
      showError(error.message)
      return
    }

    if (editingId === row.id) cancelEdit()
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
        <div className="flex-row gap-xs">
          <button type="button" className="btn-secondary btn-sm" onClick={() => syncAppliedExpenses()}>
            Sync applied expenses
          </button>
          {!isAdding ? (
            <button type="button" className="btn-primary btn-sm" onClick={() => startAdd()}>
              + Add row
            </button>
          ) : (
            <button type="button" className="btn-secondary btn-sm" onClick={() => cancelAdd()}>
              Cancel add
            </button>
          )}
        </div>
      }
    >
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        Spreadsheet view: all entries for the selected month are shown below. Timesheet earnings are system-generated as
        <strong> EMPLOYEE_EARNINGS</strong>; manual rows can be added and edited inline.
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

      <NoticeBanner message={message} type={type} />

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Kind</th>
              <th>Project</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Description</th>
              <th>Notes</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ background: '#fffef5' }}>
                <td>
                  <input type="date" value={addDraft.txn_date} onChange={(ev) => setAddDraft((d) => ({ ...d, txn_date: ev.target.value }))} />
                </td>
                <td>
                  <select value={addDraft.employee_id} onChange={(ev) => setAddDraft((d) => ({ ...d, employee_id: ev.target.value }))}>
                    <option value="">Select</option>
                    {employees.map((em) => (
                      <option key={em.id} value={em.id}>{em.full_name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={addDraft.entry_kind} onChange={(ev) => setAddDraft((d) => ({ ...d, entry_kind: ev.target.value as (typeof MANUAL_KINDS)[number] }))}>
                    {MANUAL_KINDS.map((kind) => (
                      <option key={kind} value={kind}>{kindLabel(kind, getOptions)}</option>
                    ))}
                  </select>
                </td>
                <td>—</td>
                <td>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={addDraft.amount}
                    onChange={(ev) => setAddDraft((d) => ({ ...d, amount: ev.target.value }))}
                    style={{ width: '120px', textAlign: 'right' }}
                  />
                </td>
                <td>
                  <input value={addDraft.description} onChange={(ev) => setAddDraft((d) => ({ ...d, description: ev.target.value }))} />
                </td>
                <td>
                  <input value={addDraft.notes} onChange={(ev) => setAddDraft((d) => ({ ...d, notes: ev.target.value }))} />
                </td>
                <td>Manual</td>
                <td>
                  <div className="flex-row gap-xs" style={{ display: 'inline-flex' }}>
                    <button type="button" className="btn-primary btn-sm" onClick={() => saveAdd()}>Save</button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => cancelAdd()}>Cancel</button>
                  </div>
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const isEditing = editingId === row.id && !row.is_system_generated
              if (isEditing) {
                return (
                  <tr key={row.id} style={{ background: '#fffef5' }}>
                    <td>
                      <input type="date" value={editDraft.txn_date} onChange={(ev) => setEditDraft((d) => ({ ...d, txn_date: ev.target.value }))} />
                    </td>
                    <td>
                      <select value={editDraft.employee_id} onChange={(ev) => setEditDraft((d) => ({ ...d, employee_id: ev.target.value }))}>
                        <option value="">Select</option>
                        {employees.map((em) => (
                          <option key={em.id} value={em.id}>{em.full_name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={editDraft.entry_kind} onChange={(ev) => setEditDraft((d) => ({ ...d, entry_kind: ev.target.value as (typeof MANUAL_KINDS)[number] }))}>
                        {MANUAL_KINDS.map((kind) => (
                          <option key={kind} value={kind}>{kindLabel(kind, getOptions)}</option>
                        ))}
                      </select>
                    </td>
                    <td>—</td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editDraft.amount}
                        onChange={(ev) => setEditDraft((d) => ({ ...d, amount: ev.target.value }))}
                        style={{ width: '120px', textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <input value={editDraft.description} onChange={(ev) => setEditDraft((d) => ({ ...d, description: ev.target.value }))} />
                    </td>
                    <td>
                      <input value={editDraft.notes} onChange={(ev) => setEditDraft((d) => ({ ...d, notes: ev.target.value }))} />
                    </td>
                    <td>Manual</td>
                    <td>
                      <div className="flex-row gap-xs" style={{ display: 'inline-flex' }}>
                        <button type="button" className="btn-primary btn-sm" onClick={() => saveEdit(row.id)}>Save</button>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => cancelEdit()}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={row.id}>
                  <td>{row.txn_date}</td>
                  <td style={{ fontWeight: 600 }}>{empName(row.employee_id)}</td>
                  <td><span className="badge badge-neutral">{kindLabel(row.entry_kind, getOptions)}</span></td>
                  <td>{row.project_id ? projectNames[row.project_id] ?? '—' : '—'}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: Number(row.amount) >= 0 ? '#0d6b3d' : '#b42318',
                    }}
                  >
                    {Number(row.amount) >= 0 ? '+' : ''}
                    {Number(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{row.description}</td>
                  <td style={{ fontSize: '0.8rem' }}>{row.notes ?? '—'}</td>
                  <td>{sourceLabel(row)}</td>
                  <td>
                    {!row.is_system_generated ? (
                      <div className="flex-row gap-xs" style={{ display: 'inline-flex' }}>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => startEdit(row)}>Edit</button>
                        <button type="button" className="btn-danger btn-sm" onClick={() => deleteRow(row)}>Delete</button>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>Synced</span>
                    )}
                  </td>
                </tr>
              )
            })}

            {!isAdding && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                  No transactions for this period{filterEmployeeId ? ' and employee' : ''}. Add a row or sync applied expenses.
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
            {netTotal >= 0 ? '+' : ''}
            {netTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </span>
        </div>
      )}
    </PageSection>
  )
}
