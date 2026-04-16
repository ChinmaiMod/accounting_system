import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { EndClient } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { RowActions } from '../../shared/components/RowActions'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { EditSaveCancelButtons } from '../../shared/components/EditSaveCancelButtons'

const EC_SELECT = 'id,business_id,name,address1,address2,city,state,zip'

export function EndClientsPage() {
  const { activeBusinessId } = useOwnerContext()
  const [endClients, setEndClients] = useState<EndClient[]>([])
  const [name, setName] = useState('')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const { message, type, showError, showSuccess, clearNotice } = useNotice()

  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddr1, setEditAddr1] = useState('')
  const [editAddr2, setEditAddr2] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editZip, setEditZip] = useState('')

  async function loadEndClients() {
    if (!activeBusinessId) return
    const { data, error: loadError } = await supabase
      .from('end_clients')
      .select(EC_SELECT)
      .eq('business_id', activeBusinessId)
      .order('name')
    if (loadError) {
      showError(loadError.message)
      return
    }
    setEndClients((data ?? []) as EndClient[])
  }

  useEffect(() => {
    loadEndClients()
  }, [activeBusinessId])

  async function createEndClient(event: FormEvent) {
    event.preventDefault()
    if (!activeBusinessId) return
    clearNotice()
    if (endClients.some(ec => ec.name.toLowerCase() === name.trim().toLowerCase())) {
      showError(`An end client named "${name.trim()}" already exists.`)
      return
    }
    const { error: createError } = await supabase.from('end_clients').insert({
      business_id: activeBusinessId,
      name: name.trim(),
      address1: address1 || null,
      address2: address2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
    })
    if (createError) {
      showError(createError.message)
      return
    }
    setName('')
    setAddress1('')
    setAddress2('')
    setCity('')
    setState('')
    setZip('')
    await loadEndClients()
    showSuccess('End client added.')
  }

  function startEdit(ec: EndClient) {
    setEditId(ec.id)
    setEditName(ec.name)
    setEditAddr1(ec.address1 ?? '')
    setEditAddr2(ec.address2 ?? '')
    setEditCity(ec.city ?? '')
    setEditState(ec.state ?? '')
    setEditZip(ec.zip ?? '')
    clearNotice()
  }

  async function saveEdit(ec: EndClient) {
    const { error: updateError } = await supabase
      .from('end_clients')
      .update({
        name: editName,
        address1: editAddr1 || null,
        address2: editAddr2 || null,
        city: editCity || null,
        state: editState || null,
        zip: editZip || null,
      })
      .eq('id', ec.id)
    if (updateError) {
      showError(updateError.message)
      return
    }
    setEditId(null)
    await loadEndClients()
    showSuccess('End client updated.')
  }

  async function deleteEndClient(ec: EndClient) {
    if (!confirmAction('Delete this end client? Projects referencing it may be affected.')) return
    const { error: deleteError } = await supabase.from('end_clients').delete().eq('id', ec.id)
    if (deleteError) {
      showError(deleteError.message)
      return
    }
    await loadEndClients()
    showSuccess('End client deleted.')
  }

  return (
    <PageSection title="End Clients">
      <form onSubmit={createEndClient} className="form-grid">
        <FormField label="End client name">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField label="Address 1">
          <input value={address1} onChange={(e) => setAddress1(e.target.value)} />
        </FormField>
        <FormField label="Address 2">
          <input value={address2} onChange={(e) => setAddress2(e.target.value)} />
        </FormField>
        <FormField label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </FormField>
        <FormField label="State">
          <input value={state} onChange={(e) => setState(e.target.value)} />
        </FormField>
        <FormField label="Zip code">
          <input value={zip} onChange={(e) => setZip(e.target.value)} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" type="submit" disabled={!activeBusinessId}>Add end client</button>
        </div>
      </form>
      <NoticeBanner message={message} type={type} />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>State</th>
              <th>Zip</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {endClients.map((ec) => (
              <tr key={ec.id}>
                {editId === ec.id ? (
                  <>
                    <td><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" /></td>
                    <td><input value={editCity} onChange={(e) => setEditCity(e.target.value)} placeholder="City" /></td>
                    <td><input value={editState} onChange={(e) => setEditState(e.target.value)} placeholder="State" /></td>
                    <td><input value={editZip} onChange={(e) => setEditZip(e.target.value)} placeholder="Zip" /></td>
                    <td><EditSaveCancelButtons onSave={() => saveEdit(ec)} onCancel={() => setEditId(null)} /></td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{ec.name}</td>
                    <td>{ec.city || '—'}</td>
                    <td>{ec.state || '—'}</td>
                    <td>{ec.zip || '—'}</td>
                    <td><RowActions onEdit={() => startEdit(ec)} onDelete={() => deleteEndClient(ec)} /></td>
                  </>
                )}
              </tr>
            ))}
            {endClients.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>No end clients yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageSection>
  )
}
