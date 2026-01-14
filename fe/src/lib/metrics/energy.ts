import type { ProcessedSample } from '../../types'

export const G0 = 9.80665

export interface VelocityTimelineResult {
  baselineG: number
  velocityMps: Array<number> // same length as samples; v(t0)=0
}

export interface ImpactEnergyResult {
  // Contact window (ms)
  contactStartMs: number
  contactEndMs: number

  // Velocities (m/s)
  vBeforeMps: number
  vAfterMps: number
  deltaVMps: number

  // Energies per unit mass (J/kg)
  impactEnergyJPerKg: number
  reboundEnergyJPerKg: number
  absorbedEnergyJPerKg: number

  // Bounce metrics
  cor: number | null
  energyReturnPercent: number | null
  bounceHeightM: number | null
  bounceHeightCm: number | null

  // Diagnostics
  peakG: number
}

function mean(arr: Array<number>): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/**
 * Estimate accelerometer bias from the first baselineWindowMs.
 * We prefer samples close to 0G (rest) if available.
 */
export function estimateRestBaselineG(
  samples: Array<ProcessedSample>,
  baselineWindowMs = 200,
): number {
  const early = samples.filter((s) => s.timeMs <= baselineWindowMs)

  // Prefer “rest-like” samples near 0G if they exist.
  const nearZero = early.filter((s) => Math.abs(s.accelFiltered) <= 0.2)

  const m0 = mean(nearZero.map((s) => s.accelFiltered))
  if (m0 != null && nearZero.length >= 10) return m0

  const m1 = mean(early.map((s) => s.accelFiltered))
  if (m1 != null && early.length > 0) return m1

  // Fallback: first sample
  return samples.length > 0 ? samples[0].accelFiltered : 0
}

/**
 * Compute v(t) for the entire timeline by integrating filtered acceleration.
 *
 * Conventions assumed (matches your UI text):
 * - ~0 G at rest
 * - ~-1 G in free fall
 *
 * We remove a constant bias (baselineG) measured at rest near t0.
 * Then integrate: a_mps2 = (accelFiltered - baselineG) * G0
 */
export function computeVelocityTimeline(
  samples: Array<ProcessedSample>,
  opts?: { baselineWindowMs?: number },
): VelocityTimelineResult {
  const baselineWindowMs = opts?.baselineWindowMs ?? 200
  const baselineG = estimateRestBaselineG(samples, baselineWindowMs)

  const n = samples.length
  const v: Array<number> = new Array(n).fill(0)

  for (let i = 1; i < n; i++) {
    const t0 = samples[i - 1].timeMs
    const t1 = samples[i].timeMs
    const dt = (t1 - t0) / 1000
    if (!(dt > 0)) {
      v[i] = v[i - 1]
      continue
    }

    const a0 = (samples[i - 1].accelFiltered - baselineG) * G0
    const a1 = (samples[i].accelFiltered - baselineG) * G0
    const aMid = 0.5 * (a0 + a1)

    v[i] = v[i - 1] + aMid * dt
  }

  return { baselineG, velocityMps: v }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateSeriesAtTime(
  samples: Array<ProcessedSample>,
  values: Array<number>,
  timeMs: number,
): number | null {
  if (samples.length === 0 || values.length !== samples.length) return null
  if (timeMs <= samples[0].timeMs) return values[0]
  if (timeMs >= samples[samples.length - 1].timeMs) return values[values.length - 1]

  // Find bracket
  for (let i = 0; i < samples.length - 1; i++) {
    const t0 = samples[i].timeMs
    const t1 = samples[i + 1].timeMs
    if (timeMs >= t0 && timeMs <= t1) {
      const span = t1 - t0
      if (span <= 0) return values[i]
      const u = (timeMs - t0) / span
      return lerp(values[i], values[i + 1], u)
    }
  }

  return null
}

function findWindowIndices(
  samples: Array<ProcessedSample>,
  window: { minMs: number; maxMs: number },
): { startIdx: number; endIdx: number } | null {
  let startIdx = -1
  let endIdx = -1

  for (let i = 0; i < samples.length; i++) {
    const t = samples[i].timeMs
    if (startIdx === -1 && t >= window.minMs) startIdx = i
    if (t <= window.maxMs) endIdx = i
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null
  return { startIdx, endIdx }
}

/**
 * Find the contact (impact) window around the strongest peak in the given window.
 * Uses the same “free fall threshold” logic as your DRI code.
 */
export function computeImpactEnergyForWindow(
  samples: Array<ProcessedSample>,
  velocityTimelineMps: Array<number>,
  window: { minMs: number; maxMs: number },
  opts?: {
    freeFallThresholdG?: number
    minPeakG?: number
  },
): ImpactEnergyResult | null {
  if (samples.length < 2) return null
  if (velocityTimelineMps.length !== samples.length) return null
  if (!(window.maxMs > window.minMs)) return null

  const FREE_FALL_THRESHOLD = opts?.freeFallThresholdG ?? -0.85
  const MIN_PEAK_G = opts?.minPeakG ?? 5

  const idx = findWindowIndices(samples, window)
  if (!idx) return null

  // Peak within visible window
  let peakIdx = idx.startIdx
  let peakG = samples[idx.startIdx].accelFiltered
  for (let i = idx.startIdx; i <= idx.endIdx; i++) {
    const a = samples[i].accelFiltered
    if (a > peakG) {
      peakG = a
      peakIdx = i
    }
  }
  if (peakG < MIN_PEAK_G) return null

  // Find surrounding free-fall samples (search outward from peak)
  let preFreeFallIdx = peakIdx
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      preFreeFallIdx = i
      break
    }
  }

  let postFreeFallIdx = peakIdx
  for (let i = peakIdx + 1; i < samples.length; i++) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      postFreeFallIdx = i
      break
    }
  }

  if (postFreeFallIdx <= preFreeFallIdx) return null

  // Contact start: first sample after pre-free-fall where we leave free fall
  let contactStartIdx = preFreeFallIdx
  for (let i = preFreeFallIdx; i <= peakIdx; i++) {
    if (samples[i].accelFiltered >= FREE_FALL_THRESHOLD) {
      contactStartIdx = i
      break
    }
  }

  // Contact end: first sample after peak where we re-enter free fall
  const contactEndIdx = postFreeFallIdx

  const contactStartMs = samples[contactStartIdx].timeMs
  const contactEndMs = samples[contactEndIdx].timeMs

  const vBefore = interpolateSeriesAtTime(samples, velocityTimelineMps, contactStartMs)
  const vAfter = interpolateSeriesAtTime(samples, velocityTimelineMps, contactEndMs)
  if (vBefore == null || vAfter == null) return null

  const deltaV = vAfter - vBefore

  // Convention: in your data, free fall (~ -1G) integrates to negative velocity (downwards).
  // We treat "impact speed" as |vBefore|.
  const vImpact = Math.abs(vBefore)

  // "Rebound speed" is upward separation only.
  // If vAfter is still downward (<= 0), rebound is zero.
  const vRebound = Math.max(0, vAfter)

  const impactEnergy = 0.5 * vImpact * vImpact
  const reboundEnergy = 0.5 * vRebound * vRebound
  const absorbedEnergy = impactEnergy - reboundEnergy

  const EPS_V = 1e-6

  const cor = vImpact > EPS_V ? vRebound / vImpact : null
  const energyReturnPercent = impactEnergy > EPS_V ? (reboundEnergy / impactEnergy) * 100 : null

  const bounceHeightM = vRebound > EPS_V ? (vRebound * vRebound) / (2 * G0) : 0
  const bounceHeightCm = bounceHeightM != null ? bounceHeightM * 100 : null

  return {
    contactStartMs,
    contactEndMs,
    vBeforeMps: vBefore,
    vAfterMps: vAfter,
    deltaVMps: deltaV,
    impactEnergyJPerKg: impactEnergy,
    reboundEnergyJPerKg: reboundEnergy,
    absorbedEnergyJPerKg: absorbedEnergy,
    cor,
    energyReturnPercent,
    bounceHeightM,
    bounceHeightCm,
    peakG,
  }
}
