import { describe, expect, it } from 'vitest'
import { lastDayOfMonthDate, periodFromDate } from './fiscalPeriod'

describe('fiscalPeriod', () => {
  it('lastDayOfMonthDate returns last day for April', () => {
    expect(lastDayOfMonthDate('2026-04-01')).toBe('2026-04-30')
  })

  it('lastDayOfMonthDate handles January', () => {
    expect(lastDayOfMonthDate('2026-01-01')).toBe('2026-01-31')
  })

  it('periodFromDate normalizes to first of month', () => {
    expect(periodFromDate('2026-04-16')).toBe('2026-04-01')
  })
})
