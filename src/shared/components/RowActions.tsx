type RowActionsProps = {
  onEdit: () => void
  onDelete: () => void
}

export function RowActions({ onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex-row gap-xs" style={{ display: 'inline-flex', marginLeft: '0.5rem' }}>
      <button type="button" className="btn-secondary btn-sm" onClick={onEdit}>Edit</button>
      <button type="button" className="btn-danger btn-sm" onClick={onDelete}>Delete</button>
    </div>
  )
}
