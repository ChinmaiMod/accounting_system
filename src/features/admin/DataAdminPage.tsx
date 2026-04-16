import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { LookupValue } from '../../types/domain'
import { useOwnerContext } from '../owner/useOwnerContext'
import { useNotice } from '../../shared/useNotice'
import { confirmAction } from '../../shared/ui'
import { NoticeBanner } from '../../shared/components/NoticeBanner'
import { PageSection } from '../../shared/components/PageSection'
import { FormField } from '../../shared/components/FormField'
import { LOOKUP_CATEGORIES, LOOKUP_DEFAULTS } from '../../shared/lookupDefaults'

export function DataAdminPage() {
  const { activeBusinessId, refreshLookups } = useOwnerContext()
  const { message, type, showError, showSuccess, clearNotice } = useNotice()
  const [allValues, setAllValues] = useState<LookupValue[]>([])
  const [seeded, setSeeded] = useState(false)

  async function loadAll() {
    if (!activeBusinessId) return
    const { data, error } = await supabase
      .from('lookup_values')
      .select('id,business_id,category,code,label,sort_order,is_active')
      .eq('business_id', activeBusinessId)
      .order('category')
      .order('sort_order')
    if (error) { showError(error.message); return }
    setAllValues((data ?? []) as LookupValue[])
  }

  async function seedDefaults() {
    if (!activeBusinessId || seeded) return
    setSeeded(true)
    const existing = await supabase
      .from('lookup_values')
      .select('category,code')
      .eq('business_id', activeBusinessId)
    const existingSet = new Set(
      (existing.data ?? []).map(r => `${r.category}::${r.code}`)
    )
    const toInsert: { business_id: string; category: string; code: string; label: string; sort_order: number }[] = []
    for (const [category, defaults] of Object.entries(LOOKUP_DEFAULTS)) {
      defaults.forEach((d, i) => {
        if (!existingSet.has(`${category}::${d.code}`)) {
          toInsert.push({ business_id: activeBusinessId, category, code: d.code, label: d.label, sort_order: i })
        }
      })
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('lookup_values').insert(toInsert)
      if (error) { showError(error.message); return }
    }
    await loadAll()
    await refreshLookups()
  }

  useEffect(() => {
    setSeeded(false)
  }, [activeBusinessId])

  useEffect(() => {
    if (!activeBusinessId) return
    seedDefaults()
  }, [activeBusinessId, seeded])

  function valuesFor(category: string) {
    return allValues.filter(v => v.category === category)
  }

  return (
    <>
      <NoticeBanner message={message} type={type} />
      {LOOKUP_CATEGORIES.map(group => (
        <PageSection key={group.page} title={group.page}>
          {group.categories.map(cat => (
            <LookupEditor
              key={cat.key}
              categoryKey={cat.key}
              categoryLabel={cat.label}
              businessId={activeBusinessId}
              values={valuesFor(cat.key)}
              onRefresh={async () => { await loadAll(); await refreshLookups() }}
              showError={showError}
              showSuccess={showSuccess}
              clearNotice={clearNotice}
            />
          ))}
        </PageSection>
      ))}
    </>
  )
}

type LookupEditorProps = {
  categoryKey: string
  categoryLabel: string
  businessId: string | null
  values: LookupValue[]
  onRefresh: () => Promise<void>
  showError: (msg: string) => void
  showSuccess: (msg: string) => void
  clearNotice: () => void
}

function LookupEditor({ categoryKey, categoryLabel, businessId, values, onRefresh, showError, showSuccess, clearNotice }: LookupEditorProps) {
  const [addCode, setAddCode] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editOrder, setEditOrder] = useState('0')

  async function addValue(event: FormEvent) {
    event.preventDefault()
    if (!businessId) return
    clearNotice()
    const code = addCode.trim().toUpperCase().replace(/\s+/g, '_')
    if (!code) { showError('Code is required.'); return }
    if (values.some(v => v.code === code)) { showError(`Code "${code}" already exists.`); return }
    const { error } = await supabase.from('lookup_values').insert({
      business_id: businessId,
      category: categoryKey,
      code,
      label: addLabel.trim() || code,
      sort_order: values.length,
    })
    if (error) { showError(error.message); return }
    setAddCode(''); setAddLabel('')
    await onRefresh()
    showSuccess(`Value "${code}" added to ${categoryLabel}.`)
  }

  function startEdit(v: LookupValue) {
    setEditId(v.id); setEditCode(v.code); setEditLabel(v.label); setEditOrder(String(v.sort_order))
    clearNotice()
  }

  async function saveEdit(v: LookupValue) {
    const { error } = await supabase.from('lookup_values').update({
      code: editCode.trim().toUpperCase().replace(/\s+/g, '_'),
      label: editLabel.trim(),
      sort_order: parseInt(editOrder) || 0,
    }).eq('id', v.id)
    if (error) { showError(error.message); return }
    setEditId(null)
    await onRefresh()
    showSuccess('Value updated.')
  }

  async function toggleActive(v: LookupValue) {
    const { error } = await supabase.from('lookup_values').update({ is_active: !v.is_active }).eq('id', v.id)
    if (error) { showError(error.message); return }
    await onRefresh()
  }

  async function deleteValue(v: LookupValue) {
    if (!confirmAction(`Delete lookup value "${v.label}"? This may affect existing records using this value.`)) return
    const { error } = await supabase.from('lookup_values').delete().eq('id', v.id)
    if (error) { showError(error.message); return }
    await onRefresh()
    showSuccess('Value deleted.')
  }

  return (
    <div style={{ marginTop: values.length > 0 || true ? '1.25rem' : '0', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
      <h3 style={{ fontSize: '0.88rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>{categoryLabel}</h3>
      <form onSubmit={addValue} className="form-grid-compact" style={{ marginBottom: '0.5rem' }}>
        <FormField label="Code">
          <input value={addCode} onChange={e => setAddCode(e.target.value)} placeholder="e.g. NEW_VALUE" required style={{ fontSize: '0.82rem' }} />
        </FormField>
        <FormField label="Display Label">
          <input value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder="e.g. New Value" style={{ fontSize: '0.82rem' }} />
        </FormField>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary btn-sm" type="submit" disabled={!businessId}>Add</button>
        </div>
      </form>

      {values.length > 0 && (
        <div className="tableWrap">
          <table style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Order</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {values.map(v => (
                <tr key={v.id} style={{ opacity: v.is_active ? 1 : 0.5 }}>
                  {editId === v.id ? (
                    <>
                      <td><input value={editCode} onChange={e => setEditCode(e.target.value)} style={{ width: '120px', fontSize: '0.8rem' }} /></td>
                      <td><input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ width: '130px', fontSize: '0.8rem' }} /></td>
                      <td><input type="number" value={editOrder} onChange={e => setEditOrder(e.target.value)} style={{ width: '50px', fontSize: '0.8rem' }} /></td>
                      <td>{v.is_active ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="flex-row gap-xs">
                          <button className="btn-primary btn-sm" onClick={() => saveEdit(v)}>Save</button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{v.code}</td>
                      <td>{v.label}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{v.sort_order}</td>
                      <td>
                        <button className={`btn-sm ${v.is_active ? 'btn-success' : 'btn-secondary'}`} onClick={() => toggleActive(v)} style={{ minWidth: '48px' }}>
                          {v.is_active ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td>
                        <div className="flex-row gap-xs">
                          <button className="btn-secondary btn-sm" onClick={() => startEdit(v)}>Edit</button>
                          <button className="btn-danger btn-sm" onClick={() => deleteValue(v)}>Del</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
