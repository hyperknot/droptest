import type { FilterConfig } from '../types'

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  savitzkyGolay: {
    enabled: false,
    windowSize: 17,
    polynomial: 3,
  },
  movingAverage: {
    enabled: false,
    windowSize: 9,
  },
  butterworth: {
    enabled: false,
    cutoffHz: 50,
    order: 4,
    zeroPhase: true,
  },
  notch: {
    enabled: false,
    centerHz: 30,
    bandwidthHz: 10,
    order: 2,
    zeroPhase: true,
  },
  cfc: {
    enabled: false,
    cfc: 60,
    order: 4,
    zeroPhase: true,
  },
}

export function sanitizeOddWindow(value: number, maxLength: number): number | null {
  let maxWin = maxLength
  if (maxWin % 2 === 0) maxWin -= 1
  if (maxWin < 3) return null

  let w = Math.round(value)
  if (!Number.isFinite(w)) return null
  if (w < 3) w = 3
  if (w > maxWin) w = maxWin

  if (w % 2 === 0) {
    if (w + 1 <= maxWin) {
      w += 1
    } else if (w - 1 >= 3) {
      w -= 1
    } else {
      return null
    }
  }

  return w
}

export function sanitizePolynomial(value: number): number {
  let p = Math.round(value)
  if (!Number.isFinite(p) || p < 1) p = 1
  if (p > 7) p = 7
  return p
}
