type EditSaveCancelButtonsProps = {
  onSave: () => void
  onCancel: () => void
}

export function EditSaveCancelButtons({ onSave, onCancel }: EditSaveCancelButtonsProps) {
  return (
    <div className="flex-row gap-xs" style={{ display: 'inline-flex', marginLeft: '0.5rem' }}>
      <button type="button" className="btn-primary btn-sm" onClick={onSave}>Save</button>
      <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
    </div>
  )
}
