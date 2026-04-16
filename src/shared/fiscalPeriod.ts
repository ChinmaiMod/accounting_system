/** Last calendar day of the month for a period stored as YYYY-MM-01 (local calendar, not UTC) */
export function lastDayOfMonthDate(periodYmd: string): string {
  const [y, m] = periodYmd.slice(0, 10).split('-').map(Number)
  const d = new Date(y, m, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** First day of the calendar month for a calendar date YYYY-MM-DD */
export function periodFromDate(d: string): string {
  const [y, m] = d.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}
