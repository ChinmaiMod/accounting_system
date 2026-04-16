import { describe, expect, it } from 'vitest'
import { isNegative, isNonPositive, parseNumber } from './numberValidation'

describe('numberValidation', () => {
  it('parseNumber parses empty as 0', () => {
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('42.5')).toBe(42.5)
  })

  it('isNonPositive', () => {
    expect(isNonPositive(0)).toBe(true)
    expect(isNonPositive(-1)).toBe(true)
    expect(isNonPositive(0.01)).toBe(false)
  })

  it('isNegative', () => {
    expect(isNegative(-1)).toBe(true)
    expect(isNegative(0)).toBe(false)
  })
})
