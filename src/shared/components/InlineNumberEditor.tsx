type InlineNumberEditorProps = {
  value: string
  onChange: (value: string) => void
  min?: string
  step?: string
  width?: string
}

export function InlineNumberEditor({
  value,
  onChange,
  min = '0',
  step = '0.01',
  width = '110px',
}: InlineNumberEditorProps) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width }}
    />
  )
}
