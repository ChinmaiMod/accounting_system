import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Business } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

export function BusinessesPage() {
  const { session, businesses, refreshBusinesses } = useOwnerContext()
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLegal, setEditLegal] = useState('')

  async function createBusiness(event: FormEvent) {
    event.preventDefault()
    clearNotice()
    if (businesses.some(b => b.name.toLowerCase() === name.trim().toLowerCase())) {
      showError(`A business named "${name.trim()}" already exists.`)
      return
    }
    const { error: createError } = await supabase.from('businesses').insert({
      owner_user_id: session.user.id,
      name: name.trim(),
      legal_name: legalName.trim() || null,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setName('')
    setLegalName('')
    await refreshBusinesses()
    showSuccess('Business added.')
  }

  function startEdit(b: Business) {
    setEditId(b.id)
    setEditName(b.name)
    setEditLegal(b.legal_name ?? '')
    clearNotice()
  }

  async function saveEdit(b: Business) {
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ name: editName.trim(), legal_name: editLegal.trim() || null })
      .eq('id', b.id)
    if (updateError) {
      showError(updateError.message)
      return
    }
    setEditId(null)
    await refreshBusinesses()
    showSuccess('Business updated.')
  }

  async function deleteBusiness(b: Business) {
    if (!confirmAction('Delete this business? All associated data will be removed.')) return
    const { error: deleteError } = await supabase.from('businesses').delete().eq('id', b.id)
    if (deleteError) {
      showError(deleteError.message)
      return
    }
    await refreshBusinesses()
    showSuccess('Business deleted.')
  }

  return (
    <PageSection title="Businesses">
      <form onSubmit={createBusiness} className="form-grid">
        <FormField label="Business name">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField label="Legal name">
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" type="submit">Add business</button>
        </div>
      </form>
      <NoticeBanner message={message} type={type} />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Legal Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business) => (
              <tr key={business.id}>
                {editId === business.id ? (
                  <>
                    <td><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" /></td>
                    <td><input value={editLegal} onChange={(e) => setEditLegal(e.target.value)} placeholder="Legal name" /></td>
                    <td><EditSaveCancelButtons onSave={() => saveEdit(business)} onCancel={() => setEditId(null)} /></td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{business.name}</td>
                    <td>{business.legal_name || '—'}</td>
                    <td><RowActions onEdit={() => startEdit(business)} onDelete={() => deleteBusiness(business)} /></td>
                  </>
                )}
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No businesses yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}
