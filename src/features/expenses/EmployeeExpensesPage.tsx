import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeExpense } from '../../types/domain'
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

export function EmployeeExpensesPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const [expenses, setExpenses] = useState<EmployeeExpense[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [expenseType, setExpenseType] = useState('')
  const [amount, setAmount] = useState('0')
  const [deductionMode, setDeductionMode] = useState<'PAYROLL_DEDUCTION' | 'WAGE_DEDUCTION' | 'REIMBURSEMENT'>('PAYROLL_DEDUCTION')
  const [borneBy, setBorneBy] = useState<'COMPANY' | 'EMPLOYEE'>('COMPANY')
  const [status, setStatus] = useState<'PENDING' | 'APPLIED' | 'WAIVED'>('PENDING')
  const [notes, setNotes] = useState('')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('0')
  const [editBorneBy, setEditBorneBy] = useState<'COMPANY' | 'EMPLOYEE'>('COMPANY')
  const [editStatus, setEditStatus] = useState<'PENDING' | 'APPLIED' | 'WAIVED'>('PENDING')

  async function loadData() {
    if (!activeBusinessId) return
    const [expenseResult, employeeResult] = await Promise.all([
      supabase
        .from('employee_expenses')
        .select('id,business_id,employee_id,expense_date,expense_type,amount,deduction_mode,borne_by,status,notes')
        .eq('business_id', activeBusinessId)
        .order('expense_date', { ascending: false })
        .limit(100),
      supabase
        .from('employees')
        .select('id,business_id,first_name,last_name,full_name,email,employee_type,overtime_pay_rate,holiday_pay_rate,holiday_ot_pay_rate,travel_reimbursement_rate,employer_tax_percent')
        .eq('business_id', activeBusinessId)
        .order('full_name'),
    ])
    if (expenseResult.error || employeeResult.error) {
      showError(expenseResult.error?.message ?? employeeResult.error?.message ?? 'Failed to load')
      return
    }
    setExpenses((expenseResult.data ?? []) as EmployeeExpense[])
    setEmployees((employeeResult.data ?? []) as Employee[])
  }

  useEffect(() => { loadData() }, [activeBusinessId])

  async function createExpense(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    const numericAmount = parseNumber(amount)
    if (isNonPositive(numericAmount)) { showError('Expense amount must be greater than 0.'); return }
    const { error: createError } = await supabase.from('employee_expenses').insert({
      business_id: activeBusinessId,
      employee_id: employeeId,
      expense_date: expenseDate,
      expense_type: expenseType,
      amount: numericAmount,
      deduction_mode: deductionMode,
      borne_by: borneBy,
      status,
      notes: notes || null,
    })
    if (createError) { showError(createError.message); return }
    setExpenseType(''); setAmount('0'); setNotes('')
    await loadData()
    showSuccess('Expense added.')
  }

  function startEditExpense(expense: EmployeeExpense) {
    setEditingExpenseId(expense.id)
    setEditAmount(String(expense.amount))
    setEditBorneBy(expense.borne_by)
    setEditStatus(expense.status)
    clearNotice()
  }

  async function saveEditExpense(expense: EmployeeExpense) {
    const numericAmount = parseNumber(editAmount)
    if (isNonPositive(numericAmount)) { showError('Expense amount must be greater than 0.'); return }
    const { error: updateError } = await supabase
      .from('employee_expenses')
      .update({ amount: numericAmount, borne_by: editBorneBy, status: editStatus })
      .eq('id', expense.id)
    if (updateError) { showError(updateError.message); return }
    setEditingExpenseId(null)
    await loadData()
    showSuccess('Expense updated.')
  }

  async function deleteExpense(expense: EmployeeExpense) {
    if (!confirmAction('Delete this expense record?')) return
    const { error: deleteError } = await supabase.from('employee_expenses').delete().eq('id', expense.id)
    if (deleteError) { showError(deleteError.message); return }
    await loadData()
    showSuccess('Expense deleted.')
  }

  function empName(id: string) {
    return employees.find(e => e.id === id)?.full_name ?? id
  }

  function statusBadge(s: string) {
    const cls = s === 'APPLIED' ? 'badge-success' : s === 'WAIVED' ? 'badge-warning' : 'badge-neutral'
    return <span className={`badge ${cls}`}>{s}</span>
  }

  return (
    <PageSection title="Employee Expenses">
      <form onSubmit={createExpense} className="form-grid">
        <FormField label="Employee">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
          </select>
        </FormField>
        <FormField label="Expense date">
          <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </FormField>
        <FormField label="Expense type">
          <input value={expenseType} onChange={(e) => setExpenseType(e.target.value)} required />
        </FormField>
        <FormField label="Amount">
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </FormField>
        <FormField label="Deduction mode">
          <select value={deductionMode} onChange={(e) => setDeductionMode(e.target.value as typeof deductionMode)}>
            {getOptions('expense_deduction_mode').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </FormField>
        <FormField label="Borne by">
          <select value={borneBy} onChange={(e) => setBorneBy(e.target.value as typeof borneBy)}>
            {getOptions('expense_borne_by').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {getOptions('expense_status').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </FormField>
        <FormField label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add expense</button>
        </div>
      </form>
      <NoticeBanner message={message} type={type} />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Borne By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                {editingExpenseId === exp.id ? (
                  <>
                    <td>{exp.expense_date}</td>
                    <td>{empName(exp.employee_id)}</td>
                    <td>{exp.expense_type}</td>
                    <td><InlineNumberEditor value={editAmount} onChange={setEditAmount} min="0.01" width="100px" /></td>
                    <td>{exp.deduction_mode.replace(/_/g, ' ')}</td>
                    <td>
                      <select value={editBorneBy} onChange={(e) => setEditBorneBy(e.target.value as typeof editBorneBy)} style={{ width: '100px' }}>
                        {getOptions('expense_borne_by').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as typeof editStatus)} style={{ width: '100px' }}>
                        {getOptions('expense_status').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                      </select>
                    </td>
                    <td><EditSaveCancelButtons onSave={() => saveEditExpense(exp)} onCancel={() => setEditingExpenseId(null)} /></td>
                  </>
                ) : (
                  <>
                    <td>{exp.expense_date}</td>
                    <td>{empName(exp.employee_id)}</td>
                    <td>{exp.expense_type}</td>
                    <td style={{ fontWeight: 600 }}>${exp.amount}</td>
                    <td><span className="badge badge-neutral">{exp.deduction_mode.replace(/_/g, ' ')}</span></td>
                    <td>
                      <span className={`badge ${exp.borne_by === 'COMPANY' ? 'badge-info' : 'badge-error'}`}>
                        {exp.borne_by === 'COMPANY' ? 'Company' : 'Employee'}
                      </span>
                    </td>
                    <td>{statusBadge(exp.status)}</td>
                    <td><RowActions onEdit={() => startEditExpense(exp)} onDelete={() => deleteExpense(exp)} /></td>
                  </>
                )}
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No expenses recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}
