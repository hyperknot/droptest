import type { FilterConfig } from '../types'

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  cfc: {
    enabled: true,
    cfc: 100,
    order: 4,
    zeroPhase: true,
  },
  butterworth: {
    enabled: false,
    cutoffHz: 50,
    order: 4,
    zeroPhase: true,
  },
  savitzkyGolay: {
    enabled: false,
    windowSize: 17,
    polynomial: 3,
  },
  movingAverage: {
    enabled: false,
    windowSize: 9,
  },
  notch: {
    enabled: false,
    centerHz: 30,
    bandwidthHz: 10,
    order: 2,
    zeroPhase: true,
  },
  jerk: {
    enabled: true,
    // 15 samples ≈ 15 ms at 1 kHz: short enough to preserve impact, long enough to reduce noise
    windowSize: 15,
    polynomial: 3,
  },
}

export function sanitizePolynomial(value: number): number {
  let p = Math.round(value)
  if (!Number.isFinite(p) || p < 1) p = 1
  if (p > 7) p = 7
  return p
}
