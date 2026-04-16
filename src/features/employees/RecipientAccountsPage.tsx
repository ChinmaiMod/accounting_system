import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee, RecipientAccount } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { RowActions } from '../../shared/components/RowActions'

type AccountType = RecipientAccount['account_type']

const FALLBACK_ACCOUNT_TYPES = [
  { code: 'EMPLOYER', label: 'Employer' },
  { code: 'EMPLOYEE', label: 'Employee' },
  { code: 'INTERMEDIARY', label: 'Intermediary' },
  { code: 'CANDIDATE', label: 'Candidate' },
  { code: 'VENDOR', label: 'Vendor' },
  { code: 'OTHER', label: 'Other' },
]

export function RecipientAccountsPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const accountTypeOptions = getOptions('recipient_account_type').length
    ? getOptions('recipient_account_type')
    : FALLBACK_ACCOUNT_TYPES

  const [accounts, setAccounts] = useState<RecipientAccount[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('OTHER')
  const [employeeId, setEmployeeId] = useState('')
  const [paymentIdentifier, setPaymentIdentifier] = useState('')
  const [bankName, setBankName] = useState('')
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD')
  const [notes, setNotes] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<AccountType>('OTHER')
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editIdentifier, setEditIdentifier] = useState('')
  const [editBank, setEditBank] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editCurrency, setEditCurrency] = useState<'USD' | 'INR'>('USD')
  const [editNotes, setEditNotes] = useState('')

  async function loadData() {
    if (!activeBusinessId) return

    const [accR, empR] = await Promise.all([
      supabase
        .from('recipient_accounts')
        .select('id,business_id,employee_id,account_name,account_type,payment_identifier,bank_name,country,currency,notes,is_active,created_at,updated_at')
        .eq('business_id', activeBusinessId)
        .eq('is_active', true)
        .order('account_name'),
      supabase
        .from('employees')
        .select('id,business_id,first_name,last_name,full_name,email,employee_type,overtime_pay_rate,holiday_pay_rate,holiday_ot_pay_rate,travel_reimbursement_rate,employer_tax_percent')
        .eq('business_id', activeBusinessId)
        .order('full_name'),
    ])

    if (accR.error || empR.error) {
      showError(accR.error?.message ?? empR.error?.message ?? 'Failed to load recipient accounts.')
      return
    }

    setAccounts((accR.data ?? []) as RecipientAccount[])
    setEmployees((empR.data ?? []) as Employee[])
  }

  useEffect(() => {
    loadData()
  }, [activeBusinessId])

  async function createAccount(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()

    if (!accountName.trim()) {
      showError('Account name is required.')
      return
    }

    const { error } = await supabase.from('recipient_accounts').insert({
      business_id: activeBusinessId,
      employee_id: employeeId || null,
      account_name: accountName.trim(),
      account_type: accountType,
      payment_identifier: paymentIdentifier.trim() || null,
      bank_name: bankName.trim() || null,
      country: country.trim() || null,
      currency,
      notes: notes.trim() || null,
    })

    if (error) {
      showError(error.message)
      return
    }

    setAccountName('')
    setAccountType('OTHER')
    setEmployeeId('')
    setPaymentIdentifier('')
    setBankName('')
    setCountry('')
    setCurrency('USD')
    setNotes('')

    await loadData()
    showSuccess('Recipient account added.')
  }

  function startEdit(account: RecipientAccount) {
    setEditingId(account.id)
    setEditName(account.account_name)
    setEditType(account.account_type)
    setEditEmployeeId(account.employee_id ?? '')
    setEditIdentifier(account.payment_identifier ?? '')
    setEditBank(account.bank_name ?? '')
    setEditCountry(account.country ?? '')
    setEditCurrency(account.currency)
    setEditNotes(account.notes ?? '')
    clearNotice()
  }

  async function saveEdit(account: RecipientAccount) {
    if (!editName.trim()) {
      showError('Account name is required.')
      return
    }

    const { error } = await supabase
      .from('recipient_accounts')
      .update({
        account_name: editName.trim(),
        account_type: editType,
        employee_id: editEmployeeId || null,
        payment_identifier: editIdentifier.trim() || null,
        bank_name: editBank.trim() || null,
        country: editCountry.trim() || null,
        currency: editCurrency,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)

    if (error) {
      showError(error.message)
      return
    }

    setEditingId(null)
    await loadData()
    showSuccess('Recipient account updated.')
  }

  async function deleteAccount(account: RecipientAccount) {
    if (!confirmAction('Delete this recipient account?')) return

    const { error } = await supabase
      .from('recipient_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', account.id)

    if (error) {
      showError(error.message)
      return
    }

    if (editingId === account.id) setEditingId(null)
    await loadData()
    showSuccess('Recipient account deleted.')
  }

  function empName(id: string | null) {
    if (!id) return '—'
    return employees.find((e) => e.id === id)?.full_name ?? id
  }

  return (
    <PageSection title="Recipient Accounts">
      <form onSubmit={createAccount} className="form-grid">
        <FormField label="Account name">
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
        </FormField>
        <FormField label="Account type">
          <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
            {accountTypeOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>
        </FormField>
        <FormField label="Linked employee (optional)">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">None</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </FormField>
        <FormField label="Payment identifier">
          <input value={paymentIdentifier} onChange={(e) => setPaymentIdentifier(e.target.value)} placeholder="Zelle email / acct no / UPI / routing" />
        </FormField>
        <FormField label="Bank name">
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </FormField>
        <FormField label="Country">
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA / India" />
        </FormField>
        <FormField label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'INR')}>
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </FormField>
        <FormField label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary">Add account</button>
        </div>
      </form>

      <NoticeBanner message={message} type={type} />

      <div className="tableWrap" style={{ marginTop: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Employee</th>
              <th>Identifier</th>
              <th>Bank</th>
              <th>Country</th>
              <th>Currency</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                {editingId === account.id ? (
                  <>
                    <td><input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '160px' }} /></td>
                    <td>
                      <select value={editType} onChange={(e) => setEditType(e.target.value as AccountType)}>
                        {accountTypeOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)}>
                        <option value="">None</option>
                        {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                      </select>
                    </td>
                    <td><input value={editIdentifier} onChange={(e) => setEditIdentifier(e.target.value)} style={{ width: '160px' }} /></td>
                    <td><input value={editBank} onChange={(e) => setEditBank(e.target.value)} style={{ width: '140px' }} /></td>
                    <td><input value={editCountry} onChange={(e) => setEditCountry(e.target.value)} style={{ width: '90px' }} /></td>
                    <td>
                      <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value as 'USD' | 'INR')}>
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                      </select>
                    </td>
                    <td><input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} style={{ width: '160px' }} /></td>
                    <td>
                      <div className="flex-row gap-xs" style={{ display: 'inline-flex' }}>
                        <button className="btn-primary btn-sm" onClick={() => saveEdit(account)}>Save</button>
                        <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{account.account_name}</td>
                    <td><span className="badge badge-neutral">{account.account_type}</span></td>
                    <td>{empName(account.employee_id)}</td>
                    <td>{account.payment_identifier ?? '—'}</td>
                    <td>{account.bank_name ?? '—'}</td>
                    <td>{account.country ?? '—'}</td>
                    <td>{account.currency}</td>
                    <td>{account.notes ?? '—'}</td>
                    <td><RowActions onEdit={() => startEdit(account)} onDelete={() => deleteAccount(account)} /></td>
                  </>
                )}
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                  No recipient accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}
