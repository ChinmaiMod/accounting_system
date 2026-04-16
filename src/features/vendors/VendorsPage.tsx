import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Vendor, VendorContact } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

const VENDOR_SELECT = 'id,business_id,name,invoice_frequency,payment_terms,address1,address2,city,state,zip'

type ContactType = VendorContact['contact_type']

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  INVOICING: 'Invoicing',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  RECRUITER: 'Recruiter',
  CEO: 'CEO',
}

export function VendorsPage() {
  const { activeBusinessId, getOptions } = useOwnerContext()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [name, setName] = useState('')
  const [invoiceFrequency, setInvoiceFrequency] = useState<Vendor['invoice_frequency']>('WEEKLY')
  const [paymentTerms, setPaymentTerms] = useState<Vendor['payment_terms']>('NET_30')
  const [addr1, setAddr1] = useState('')
  const [addr2, setAddr2] = useState('')
  const [city, setCity] = useState('')
  const [vendorState, setVendorState] = useState('')
  const [zip, setZip] = useState('')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editFreq, setEditFreq] = useState<Vendor['invoice_frequency']>('WEEKLY')
  const [editTerms, setEditTerms] = useState<Vendor['payment_terms']>('NET_30')
  const [editAddr1, setEditAddr1] = useState('')
  const [editAddr2, setEditAddr2] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editZip, setEditZip] = useState('')

  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [contacts, setContacts] = useState<VendorContact[]>([])
  const [contactType, setContactType] = useState<ContactType>('INVOICING')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  async function loadVendors() {
    if (!activeBusinessId) return
    const { data, error: loadError } = await supabase
      .from('vendors')
      .select(VENDOR_SELECT)
      .eq('business_id', activeBusinessId)
      .order('name')
    if (loadError) {
      showError(loadError.message)
      return
    }
    setVendors((data ?? []) as Vendor[])
  }

  async function loadContacts(vendorId: string) {
    const { data, error: loadError } = await supabase
      .from('vendor_contacts')
      .select('id,vendor_id,contact_type,contact_name,email,phone')
      .eq('vendor_id', vendorId)
      .order('contact_type')
    if (loadError) {
      showError(loadError.message)
      return
    }
    setContacts((data ?? []) as VendorContact[])
  }

  useEffect(() => {
    loadVendors()
  }, [activeBusinessId])

  useEffect(() => {
    if (!selectedVendorId) {
      setContacts([])
      return
    }
    loadContacts(selectedVendorId)
  }, [selectedVendorId])

  async function createVendor(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    if (vendors.some(v => v.name.toLowerCase() === name.trim().toLowerCase())) {
      showError(`A vendor named "${name.trim()}" already exists.`)
      return
    }
    const { error: createError } = await supabase.from('vendors').insert({
      business_id: activeBusinessId,
      name: name.trim(),
      invoice_frequency: invoiceFrequency,
      payment_terms: paymentTerms,
      address1: addr1 || null,
      address2: addr2 || null,
      city: city || null,
      state: vendorState || null,
      zip: zip || null,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setName('')
    setAddr1('')
    setAddr2('')
    setCity('')
    setVendorState('')
    setZip('')
    await loadVendors()
    showSuccess('Vendor added.')
  }

  function startEditVendor(v: Vendor) {
    setEditId(v.id)
    setEditName(v.name)
    setEditFreq(v.invoice_frequency)
    setEditTerms(v.payment_terms)
    setEditAddr1(v.address1 ?? '')
    setEditAddr2(v.address2 ?? '')
    setEditCity(v.city ?? '')
    setEditState(v.state ?? '')
    setEditZip(v.zip ?? '')
    clearNotice()
  }

  async function saveEditVendor(v: Vendor) {
    const { error: updateError } = await supabase
      .from('vendors')
      .update({
        name: editName,
        invoice_frequency: editFreq,
        payment_terms: editTerms,
        address1: editAddr1 || null,
        address2: editAddr2 || null,
        city: editCity || null,
        state: editState || null,
        zip: editZip || null,
      })
      .eq('id', v.id)
    if (updateError) {
      showError(updateError.message)
      return
    }
    setEditId(null)
    await loadVendors()
    showSuccess('Vendor updated.')
  }

  async function deleteVendor(v: Vendor) {
    if (!confirmAction('Delete this vendor? Projects and invoices referencing it may be affected.')) return
    const { error: deleteError } = await supabase.from('vendors').delete().eq('id', v.id)
    if (deleteError) {
      showError(deleteError.message)
      return
    }
    if (selectedVendorId === v.id) setSelectedVendorId('')
    await loadVendors()
    showSuccess('Vendor deleted.')
  }

  async function addContact(event: FormEvent) {
    event.preventDefault()
    if (!selectedVendorId) return
    clearNotice()
    if (!contactEmail && !contactPhone) {
      showError('At least an email or phone number is required.')
      return
    }
    if (contactEmail && contacts.some(c => c.email?.toLowerCase() === contactEmail.trim().toLowerCase())) {
      showError(`A contact with email "${contactEmail.trim()}" already exists for this vendor.`)
      return
    }
    const { error: createError } = await supabase.from('vendor_contacts').insert({
      vendor_id: selectedVendorId,
      contact_type: contactType,
      contact_name: contactName || null,
      email: contactEmail || null,
      phone: contactPhone || null,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    await loadContacts(selectedVendorId)
    showSuccess('Contact added.')
  }

  async function deleteContact(contact: VendorContact) {
    if (!confirmAction('Delete this contact?')) return
    const { error: deleteError } = await supabase.from('vendor_contacts').delete().eq('id', contact.id)
    if (deleteError) {
      showError(deleteError.message)
      return
    }
    await loadContacts(contact.vendor_id)
    showSuccess('Contact deleted.')
  }

  return (
    <>
      <PageSection title="Vendors">
        <form onSubmit={createVendor} className="form-grid">
          <FormField label="Vendor name">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Invoice frequency">
            <select value={invoiceFrequency} onChange={(e) => setInvoiceFrequency(e.target.value as typeof invoiceFrequency)}>
              {getOptions('vendor_invoice_frequency').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Payment terms">
            <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as typeof paymentTerms)}>
              {getOptions('vendor_payment_terms').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Address 1">
            <input value={addr1} onChange={(e) => setAddr1(e.target.value)} />
          </FormField>
          <FormField label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </FormField>
          <FormField label="State">
            <input value={vendorState} onChange={(e) => setVendorState(e.target.value)} />
          </FormField>
          <FormField label="Zip code">
            <input value={zip} onChange={(e) => setZip(e.target.value)} />
          </FormField>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add vendor</button>
          </div>
        </form>
        <NoticeBanner message={message} type={type} />
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Inv Frequency</th>
                <th>Payment Terms</th>
                <th>City</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  {editId === vendor.id ? (
                    <>
                      <td><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" /></td>
                      <td>
                        <select value={editFreq} onChange={(e) => setEditFreq(e.target.value as Vendor['invoice_frequency'])}>
                          {getOptions('vendor_invoice_frequency').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={editTerms} onChange={(e) => setEditTerms(e.target.value as Vendor['payment_terms'])}>
                          {getOptions('vendor_payment_terms').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                        </select>
                      </td>
                      <td><input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" /></td>
                      <td><input value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" /></td>
                      <td><EditSaveCancelButtons onSave={() => saveEditVendor(vendor)} onCancel={() => setEditId(null)} /></td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600 }}>{vendor.name}</td>
                      <td><span className="badge badge-neutral">{vendor.invoice_frequency.replace('_', '-')}</span></td>
                      <td><span className="badge badge-info">{vendor.payment_terms.replace('_', ' ')}</span></td>
                      <td>{vendor.city || '—'}</td>
                      <td>{vendor.state || '—'}</td>
                      <td><RowActions onEdit={() => startEditVendor(vendor)} onDelete={() => deleteVendor(vendor)} /></td>
                    </>
                  )}
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No vendors yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Vendor Contacts">
        <FormField label="Select vendor to manage contacts">
          <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} style={{ maxWidth: '320px' }}>
            <option value="">Select</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </FormField>

        {selectedVendorId ? (
          <>
            <form onSubmit={addContact} className="form-grid" style={{ marginTop: '0.75rem' }}>
              <FormField label="Contact type">
                <select value={contactType} onChange={(e) => setContactType(e.target.value as ContactType)}>
                  {getOptions('vendor_contact_type').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
              </FormField>
              <FormField label="Contact name">
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </FormField>
              <FormField label="Email">
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </FormField>
              <FormField label="Phone">
                <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
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
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td><span className="badge badge-neutral">{CONTACT_TYPE_LABELS[c.contact_type]}</span></td>
                        <td>{c.contact_name ?? '—'}</td>
                        <td>{c.email ?? '—'}</td>
                        <td>{c.phone ?? '—'}</td>
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
