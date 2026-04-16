import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Employee, EmployeeContact } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

const EMP_SELECT =
  'id,business_id,first_name,last_name,full_name,email,employee_type,overtime_pay_rate,holiday_pay_rate,holiday_ot_pay_rate,travel_reimbursement_rate,employer_tax_percent'

type ContactType = EmployeeContact['contact_type']

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  WHATSAPP: 'WhatsApp',
  CALLING: 'Calling',
  HOME: 'Home',
  WORK: 'Work',
  OTHER: 'Other',
}

export function EmployeesPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [employeeType, setEmployeeType] = useState<'W2' | 'C2C'>('W2')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editType, setEditType] = useState<'W2' | 'C2C'>('W2')

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [contacts, setContacts] = useState<EmployeeContact[]>([])
  const [contactType, setContactType] = useState<ContactType>('CALLING')
  const [contactPhone, setContactPhone] = useState('')
  const [contactLabel, setContactLabel] = useState('')

  async function loadEmployees() {
    if (!activeBusinessId) return
    const { data, error: loadError } = await supabase
      .from('employees')
      .select(EMP_SELECT)
      .eq('business_id', activeBusinessId)
      .order('full_name')
    if (loadError) {
      showError(loadError.message)
      return
    }
    setEmployees((data ?? []) as Employee[])
  }

  async function loadContacts(employeeId: string) {
    const { data, error: loadError } = await supabase
      .from('employee_contacts')
      .select('id,employee_id,contact_type,phone,label')
      .eq('employee_id', employeeId)
      .order('contact_type')
    if (loadError) {
      showError(loadError.message)
      return
    }
    setContacts((data ?? []) as EmployeeContact[])
  }

  useEffect(() => {
    loadEmployees()
  }, [activeBusinessId])

  useEffect(() => {
    if (!selectedEmployeeId) {
      setContacts([])
      return
    }
    loadContacts(selectedEmployeeId)
  }, [selectedEmployeeId])

  async function createEmployee(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    if (employees.some(e => e.first_name.toLowerCase() === firstName.trim().toLowerCase() && e.last_name.toLowerCase() === lastName.trim().toLowerCase())) {
      showError(`An employee named "${firstName.trim()} ${lastName.trim()}" already exists.`)
      return
    }
    const { error: createError } = await supabase.from('employees').insert({
      business_id: activeBusinessId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email || null,
      employee_type: employeeType,
      overtime_pay_rate: 0,
      holiday_pay_rate: 0,
      holiday_ot_pay_rate: 0,
      travel_reimbursement_rate: 0,
      employer_tax_percent: employeeType === 'W2' ? 7.65 : 0,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setFirstName('')
    setLastName('')
    setEmail('')
    await loadEmployees()
    showSuccess('Employee added.')
  }

  function startEditEmployee(employee: Employee) {
    setEditingEmployeeId(employee.id)
    setEditFirstName(employee.first_name)
    setEditLastName(employee.last_name)
    setEditEmail(employee.email ?? '')
    setEditType(employee.employee_type)
    clearNotice()
  }

  async function saveEditEmployee(employee: Employee) {
    const { error: updateError } = await supabase
      .from('employees')
      .update({ first_name: editFirstName, last_name: editLastName, email: editEmail || null, employee_type: editType })
      .eq('id', employee.id)
    if (updateError) {
      showError(updateError.message)
      return
    }
    setEditingEmployeeId(null)
    await loadEmployees()
    showSuccess('Employee updated.')
  }

  async function deleteEmployee(employee: Employee) {
    if (!confirmAction('Delete this employee? Related records may fail if references exist.')) return
    const { error: deleteError } = await supabase.from('employees').delete().eq('id', employee.id)
    if (deleteError) {
      showError(deleteError.message)
      return
    }
    if (selectedEmployeeId === employee.id) setSelectedEmployeeId('')
    await loadEmployees()
    showSuccess('Employee deleted.')
  }

  async function addContact(event: FormEvent) {
    event.preventDefault()
    if (!selectedEmployeeId) return
    clearNotice()
    if (!contactPhone.trim()) {
      showError('Phone number is required.')
      return
    }
    if (contacts.some(c => c.contact_type === contactType && c.phone === contactPhone.trim())) {
      showError(`A ${CONTACT_TYPE_LABELS[contactType]} number "${contactPhone.trim()}" already exists for this employee.`)
      return
    }
    const { error: createError } = await supabase.from('employee_contacts').insert({
      employee_id: selectedEmployeeId,
      contact_type: contactType,
      phone: contactPhone.trim(),
      label: contactLabel || null,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setContactPhone('')
    setContactLabel('')
    await loadContacts(selectedEmployeeId)
    showSuccess('Contact number added.')
  }

  async function deleteContact(contact: EmployeeContact) {
    if (!confirmAction('Delete this contact number?')) return
    const { error: deleteError } = await supabase.from('employee_contacts').delete().eq('id', contact.id)
    if (deleteError) {
      showError(deleteError.message)
      return
    }
    await loadContacts(contact.employee_id)
    showSuccess('Contact number deleted.')
  }

  return (
    <>
      <PageSection title="Employees">
        <form onSubmit={createEmployee} className="form-grid">
          <FormField label="First name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </FormField>
          <FormField label="Last name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </FormField>
          <FormField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </FormField>
          <FormField label="Type">
            <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value as 'W2' | 'C2C')}>
              {getOptions('employee_type').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </FormField>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add employee</button>
          </div>
        </form>
        <NoticeBanner message={message} type={type} />
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  {editingEmployeeId === employee.id ? (
                    <>
                      <td>
                        <div className="flex-row">
                          <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="First" style={{ width: '100px' }} />
                          <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Last" style={{ width: '100px' }} />
                        </div>
                      </td>
                      <td><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" style={{ width: '160px' }} /></td>
                      <td>
                        <select value={editType} onChange={(e) => setEditType(e.target.value as 'W2' | 'C2C')}>
                          {getOptions('employee_type').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                        </select>
                      </td>
                      <td><EditSaveCancelButtons onSave={() => saveEditEmployee(employee)} onCancel={() => setEditingEmployeeId(null)} /></td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600 }}>{employee.full_name}</td>
                      <td>{employee.email || '—'}</td>
                      <td><span className={`badge ${employee.employee_type === 'W2' ? 'badge-info' : 'badge-neutral'}`}>{employee.employee_type}</span></td>
                      <td><RowActions onEdit={() => startEditEmployee(employee)} onDelete={() => deleteEmployee(employee)} /></td>
                    </>
                  )}
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No employees yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Employee Contact Numbers">
        <FormField label="Select employee to manage contacts">
          <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} style={{ maxWidth: '320px' }}>
            <option value="">Select</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </FormField>

        {selectedEmployeeId ? (
          <>
            <form onSubmit={addContact} className="form-grid" style={{ marginTop: '0.75rem' }}>
              <FormField label="Contact type">
                <select value={contactType} onChange={(e) => setContactType(e.target.value as ContactType)}>
                  {getOptions('employee_contact_type').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
              </FormField>
              <FormField label="Phone number">
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
              </FormField>
              <FormField label="Label (optional)">
                <input value={contactLabel} onChange={(e) => setContactLabel(e.target.value)} placeholder="e.g. Primary, Backup" />
              </FormField>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn-primary" type="submit">Add contact</button>
              </div>
            </form>
            {contacts.length > 0 && (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Phone</th>
                      <th>Label</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td><span className="badge badge-neutral">{CONTACT_TYPE_LABELS[c.contact_type]}</span></td>
                        <td>{c.phone}</td>
                        <td>{c.label || '—'}</td>
                        <td>
                          <button className="btn-danger btn-sm" onClick={() => deleteContact(c)}>Delete</button>
                        </td>
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
