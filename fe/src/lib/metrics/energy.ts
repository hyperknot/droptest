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
 * Estimate accelerometer bias (rest state).
 *
 * Strategy:
 * 1. For short data (<200ms) that looks like a single impulse (starts/ends near same value),
 *    use the first/last few samples as baseline (they represent rest state)
 * 2. For longer data, use first baselineWindowMs and prefer samples near 0G
 */
export function estimateRestBaselineG(
  samples: Array<ProcessedSample>,
  baselineWindowMs = 200,
): number {
  if (samples.length < 2) {
    const fallback = samples.length > 0 ? samples[0].accelFiltered : 0
    console.log('[baseline] Too few samples, using:', { baselineG: fallback })
    return fallback
  }

  const totalDurationMs = samples[samples.length - 1].timeMs - samples[0].timeMs
  const isShortData = totalDurationMs < baselineWindowMs

  // For short data: check if it's a single impulse (start and end near same value)
  // This handles plate-press case where data is just the impulse
  if (isShortData) {
    const nEdge = Math.min(5, Math.floor(samples.length / 4))
    const startSamples = samples.slice(0, Math.max(1, nEdge))
    const endSamples = samples.slice(-Math.max(1, nEdge))

    const startMean = mean(startSamples.map((s) => s.accelFiltered)) ?? samples[0].accelFiltered
    const endMean = mean(endSamples.map((s) => s.accelFiltered)) ?? samples[samples.length - 1].accelFiltered

    // If start and end are similar (both at rest), use their average as baseline
    const startEndDiff = Math.abs(startMean - endMean)
    const avgStartEnd = (startMean + endMean) / 2

    console.log('[baseline] Short data detected:', {
      totalDurationMs: totalDurationMs.toFixed(1),
      nEdgeSamples: nEdge,
      startMean: startMean.toFixed(3),
      endMean: endMean.toFixed(3),
      startEndDiff: startEndDiff.toFixed(3),
    })

    // If start/end are within 2G of each other, they're likely both "rest"
    if (startEndDiff < 2) {
      console.log('[baseline] Using start/end average:', { baselineG: avgStartEnd.toFixed(3) })
      return avgStartEnd
    }

    // Otherwise use start samples (assume data starts at rest)
    console.log('[baseline] Using start samples:', { baselineG: startMean.toFixed(3) })
    return startMean
  }

  // For longer data: original logic
  const early = samples.filter((s) => s.timeMs <= baselineWindowMs)

  // Prefer "rest-like" samples near 0G if they exist.
  const nearZero = early.filter((s) => Math.abs(s.accelFiltered) <= 0.2)

  const m0 = mean(nearZero.map((s) => s.accelFiltered))
  if (m0 != null && nearZero.length >= 10) {
    console.log('[baseline] Using nearZero mean:', {
      baselineG: m0,
      nearZeroCount: nearZero.length,
      earlyCount: early.length,
      firstFewEarly: early.slice(0, 5).map((s) => s.accelFiltered.toFixed(3)),
    })
    return m0
  }

  const m1 = mean(early.map((s) => s.accelFiltered))
  if (m1 != null && early.length > 0) {
    console.log('[baseline] Using early mean:', {
      baselineG: m1,
      earlyCount: early.length,
      firstFewEarly: early.slice(0, 5).map((s) => s.accelFiltered.toFixed(3)),
    })
    return m1
  }

  // Fallback: first sample
  const fallback = samples[0].accelFiltered
  console.log('[baseline] Using fallback:', { baselineG: fallback })
  return fallback
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

  // Debug: collect stats
  let minAccelRaw = Infinity
  let maxAccelRaw = -Infinity
  let minAccelCorrected = Infinity
  let maxAccelCorrected = -Infinity

  for (let i = 1; i < n; i++) {
    const t0 = samples[i - 1].timeMs
    const t1 = samples[i].timeMs
    const dt = (t1 - t0) / 1000
    if (!(dt > 0)) {
      v[i] = v[i - 1]
      continue
    }

    const accelRawG = samples[i].accelFiltered
    const accelCorrectedG = accelRawG - baselineG
    const a0 = (samples[i - 1].accelFiltered - baselineG) * G0
    const a1 = (samples[i].accelFiltered - baselineG) * G0
    const aMid = 0.5 * (a0 + a1)

    v[i] = v[i - 1] + aMid * dt

    // Track stats
    if (accelRawG < minAccelRaw) minAccelRaw = accelRawG
    if (accelRawG > maxAccelRaw) maxAccelRaw = accelRawG
    if (accelCorrectedG < minAccelCorrected) minAccelCorrected = accelCorrectedG
    if (accelCorrectedG > maxAccelCorrected) maxAccelCorrected = accelCorrectedG
  }

  // Debug output
  const vMin = Math.min(...v)
  const vMax = Math.max(...v)
  console.log('[velocity] Timeline computed:', {
    baselineG: baselineG.toFixed(3),
    accelRawRange: `${minAccelRaw.toFixed(2)} to ${maxAccelRaw.toFixed(2)} G`,
    accelCorrectedRange: `${minAccelCorrected.toFixed(2)} to ${maxAccelCorrected.toFixed(2)} G`,
    velocityRange: `${vMin.toFixed(3)} to ${vMax.toFixed(3)} m/s`,
    sampleCount: n,
    firstAccel: samples[0]?.accelFiltered.toFixed(3),
    lastAccel: samples[n - 1]?.accelFiltered.toFixed(3),
  })

  // Log a few sample points
  const sampleIndices = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]
  console.log(
    '[velocity] Sample points:',
    sampleIndices.map((i) => ({
      idx: i,
      timeMs: samples[i]?.timeMs.toFixed(1),
      accelG: samples[i]?.accelFiltered.toFixed(2),
      vMps: v[i]?.toFixed(3),
    })),
  )

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
 *
 * Handles two cases:
 * 1. Drop test with free-fall: finds -0.85G before/after the peak
 * 2. Plate-press test: if no free-fall found, uses window boundaries
 *
 * For plate-press tests (no free-fall):
 * - Data starts at ~0G, ends at ~0G
 * - v starts at 0, peaks during compression, returns to 0
 * - "Impact energy" = 0.5 * v_peak^2 (max KE during event)
 * - "Absorbed energy" = same (all energy absorbed, no bounce)
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

  // Try to find surrounding free-fall samples (search outward from peak)
  // If not found, use window boundaries (plate-press case)
  let preFreeFallIdx = idx.startIdx // default to window start
  let foundPreFreeFall = false
  for (let i = peakIdx - 1; i >= idx.startIdx; i--) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      preFreeFallIdx = i
      foundPreFreeFall = true
      break
    }
  }

  let postFreeFallIdx = idx.endIdx // default to window end
  let foundPostFreeFall = false
  for (let i = peakIdx + 1; i <= idx.endIdx; i++) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      postFreeFallIdx = i
      foundPostFreeFall = true
      break
    }
  }

  // Determine if this is a plate-press scenario (no free-fall found)
  const isPlatePressCase = !foundPreFreeFall && !foundPostFreeFall

  console.log('[energy] Detection:', {
    peakIdx,
    peakG: peakG.toFixed(2),
    peakTimeMs: samples[peakIdx].timeMs.toFixed(1),
    foundPreFreeFall,
    foundPostFreeFall,
    isPlatePressCase,
    preFreeFallIdx,
    postFreeFallIdx,
    windowStart: idx.startIdx,
    windowEnd: idx.endIdx,
  })

  // Contact boundaries
  let contactStartIdx = preFreeFallIdx
  let contactEndIdx = postFreeFallIdx

  // For drop tests with free-fall, find where we leave free-fall
  if (foundPreFreeFall) {
    for (let i = preFreeFallIdx; i <= peakIdx; i++) {
      if (samples[i].accelFiltered >= FREE_FALL_THRESHOLD) {
        contactStartIdx = i
        break
      }
    }
  }

  const contactStartMs = samples[contactStartIdx].timeMs
  const contactEndMs = samples[contactEndIdx].timeMs

  // Find min and max velocity in the contact window
  let vMin = Number.POSITIVE_INFINITY
  let vMax = Number.NEGATIVE_INFINITY
  let vMinIdx = contactStartIdx
  let vMaxIdx = contactStartIdx
  for (let i = contactStartIdx; i <= contactEndIdx; i++) {
    const v = velocityTimelineMps[i]
    if (v < vMin) {
      vMin = v
      vMinIdx = i
    }
    if (v > vMax) {
      vMax = v
      vMaxIdx = i
    }
  }

  console.log('[energy] Contact window:', {
    contactStartIdx,
    contactEndIdx,
    contactStartMs: contactStartMs.toFixed(1),
    contactEndMs: contactEndMs.toFixed(1),
    vMin: vMin.toFixed(3),
    vMax: vMax.toFixed(3),
    vMinIdx,
    vMaxIdx,
    vAtStart: velocityTimelineMps[contactStartIdx]?.toFixed(3),
    vAtEnd: velocityTimelineMps[contactEndIdx]?.toFixed(3),
    accelAtStart: samples[contactStartIdx]?.accelFiltered.toFixed(2),
    accelAtEnd: samples[contactEndIdx]?.accelFiltered.toFixed(2),
  })

  if (!Number.isFinite(vMin) || !Number.isFinite(vMax)) return null

  const deltaV = vMax - vMin

  // Different energy calculation depending on scenario
  let vBefore: number
  let vAfter: number
  let impactEnergy: number
  let reboundEnergy: number
  let absorbedEnergy: number

  if (isPlatePressCase) {
    // Plate-press: starts at rest, compresses, returns to rest
    // v should go: ~0 → peak → ~0
    // Energy is simply 0.5 * v_peak^2 (all absorbed)
    vBefore = vMin // should be ~0 at start
    vAfter = velocityTimelineMps[contactEndIdx] // should be ~0 at end
    const vPeak = Math.max(Math.abs(vMin), Math.abs(vMax))
    impactEnergy = 0.5 * vPeak * vPeak
    reboundEnergy = 0 // no rebound in plate-press
    absorbedEnergy = impactEnergy
  } else {
    // Drop test: free-fall before, impact, possible bounce
    vBefore = vMin // lowest velocity (most negative = fastest downward)
    vAfter = vMax // highest velocity (most positive = rebound)

    // Convention: free fall (~ -1G) integrates to negative velocity (downwards).
    const vImpact = Math.abs(vBefore)
    const vRebound = Math.max(0, vAfter) // upward only

    impactEnergy = 0.5 * vImpact * vImpact
    reboundEnergy = 0.5 * vRebound * vRebound
    absorbedEnergy = impactEnergy - reboundEnergy
  }

  const EPS_V = 1e-6

  // COR and energy return only make sense for drop tests
  let cor: number | null = null
  let energyReturnPercent: number | null = null
  let bounceHeightM: number | null = null
  let bounceHeightCm: number | null = null

  if (!isPlatePressCase) {
    const vImpact = Math.abs(vBefore)
    const vRebound = Math.max(0, vAfter)
    cor = vImpact > EPS_V ? vRebound / vImpact : null
    energyReturnPercent = impactEnergy > EPS_V ? (reboundEnergy / impactEnergy) * 100 : null
    bounceHeightM = vRebound > EPS_V ? (vRebound * vRebound) / (2 * G0) : 0
    bounceHeightCm = bounceHeightM != null ? bounceHeightM * 100 : null
  }

  console.log('[energy] Final results:', {
    isPlatePressCase,
    vBefore: vBefore.toFixed(3),
    vAfter: vAfter.toFixed(3),
    deltaV: deltaV.toFixed(3),
    impactEnergy: impactEnergy.toFixed(3),
    reboundEnergy: reboundEnergy.toFixed(3),
    absorbedEnergy: absorbedEnergy.toFixed(3),
    cor: cor?.toFixed(3) ?? 'null',
  })

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
