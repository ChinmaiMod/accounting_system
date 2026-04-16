export function parseNumber(value: string) {
  return Number(value || '0')
}

export function isNegative(value: number) {
  return value < 0
}

export function isNonPositive(value: number) {
  return value <= 0
}
