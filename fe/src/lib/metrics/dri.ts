/**
 * Dynamic Response Index (DRI)
 * ----------------------------
 * 1-DOF biodynamic model used for spinal compression risk estimation.
 *
 * Model:
 *   x'' + 2*zeta*omega_n*x' + omega_n^2*x = -a(t)
 *
 * DRI:
 *   DRI = (omega_n^2 * max(|x|)) / g0
 *
 * This app's accel convention:
 * - ~0 G at rest
 * - ~-1 G in free fall
 *
 * Range detection:
 * 1) Find the peak acceleration within the visible window
 * 2) Search backward from peak until accel < -0.85 G (free fall threshold)
 * 3) Search forward from peak until accel < -0.85 G (back to free fall)
 * 4) Compute baseline from 200ms before the start
 * 5) Integrate within this detected range
 *
 * This uses the SAME series as displayed ("accelFiltered"), i.e. same CFC slider.
 */

import type { ProcessedSample } from '../../types'

export const G0 = 9.80665
export const DRI_OMEGA_N = 52.9 // rad/s
export const DRI_ZETA = 0.224 // damping ratio

export interface DRIResult {
  dri: number
  deltaMaxM: number
  deltaMaxMm: number
  omegaN: number
  zeta: number

  // Actual window used (may differ from requested if we searched backward for free fall)
  actualWindowMinMs: number
  actualWindowMaxMs: number

  // Debugging diagnostics (not shown in UI):
  baselineG: number
  baselineSamples: number
}

export function computeDRIForWindow(
  samples: Array<ProcessedSample>,
  window: { minMs: number; maxMs: number },
  sampleRateHz?: number,
): DRIResult | null {
  if (samples.length < 2) {
    console.log('[DRI] Too few samples:', samples.length)
    return null
  }
  if (!(window.maxMs > window.minMs)) {
    console.log('[DRI] Invalid window:', window)
    return null
  }

  // Find indices spanning the requested window.
  let windowStartIdx = -1
  let windowEndIdx = -1
  for (let i = 0; i < samples.length; i++) {
    const t = samples[i].timeMs
    if (windowStartIdx === -1 && t >= window.minMs) windowStartIdx = i
    if (t <= window.maxMs) windowEndIdx = i
  }

  if (windowStartIdx === -1 || windowEndIdx === -1 || windowEndIdx <= windowStartIdx) {
    console.log('[DRI] Window indices invalid:', { windowStartIdx, windowEndIdx, window })
    return null
  }

  // (1) Find the peak acceleration within the visible window
  let peakIdx = windowStartIdx
  let peakVal = samples[windowStartIdx].accelFiltered
  for (let i = windowStartIdx; i <= windowEndIdx; i++) {
    if (samples[i].accelFiltered > peakVal) {
      peakVal = samples[i].accelFiltered
      peakIdx = i
    }
  }

  // Need a significant peak (> 5G) to compute DRI
  if (peakVal < 5) {
    console.log('[DRI] Peak too low:', { peakVal, peakIdx })
    return null
  }

  const FREE_FALL_THRESHOLD = -0.85

  // (2) Search backward from peak until accel < -0.85 G (free fall)
  // If not found, use window start (plate-press case)
  let startIdx = windowStartIdx // default to window start
  let foundStartFreeFall = false
  for (let i = peakIdx - 1; i >= windowStartIdx; i--) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      startIdx = i
      foundStartFreeFall = true
      break
    }
  }

  // (3) Search forward from peak until accel < -0.85 G (back to free fall)
  // If not found, use window end (plate-press case)
  let endIdx = windowEndIdx // default to window end
  let foundEndFreeFall = false
  for (let i = peakIdx + 1; i <= windowEndIdx; i++) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      endIdx = i
      foundEndFreeFall = true
      break
    }
  }

  const isPlatePressCase = !foundStartFreeFall && !foundEndFreeFall

  console.log('[DRI] Range detection:', {
    peakIdx,
    peakVal: peakVal.toFixed(2),
    peakTimeMs: samples[peakIdx].timeMs.toFixed(1),
    foundStartFreeFall,
    foundEndFreeFall,
    isPlatePressCase,
    startIdx,
    endIdx,
    windowStartIdx,
    windowEndIdx,
  })

  if (endIdx <= startIdx) {
    console.log('[DRI] endIdx <= startIdx, returning null')
    return null
  }

  // (4) Baseline estimate
  // For plate-press: use first/last samples (similar to energy baseline)
  // For drop test: use 200ms before start
  let baselineG: number
  let baselineCount: number

  if (isPlatePressCase) {
    // Use first and last few samples as baseline (they should be at rest ~0G)
    const nEdge = Math.min(5, Math.floor((endIdx - startIdx) / 4))
    const startSamples = samples.slice(startIdx, startIdx + Math.max(1, nEdge))
    const endSamples = samples.slice(endIdx - Math.max(1, nEdge) + 1, endIdx + 1)

    const startMean =
      startSamples.reduce((sum, s) => sum + s.accelFiltered, 0) / startSamples.length
    const endMean = endSamples.reduce((sum, s) => sum + s.accelFiltered, 0) / endSamples.length

    baselineG = (startMean + endMean) / 2
    baselineCount = startSamples.length + endSamples.length

    console.log('[DRI] Plate-press baseline:', {
      nEdge,
      startMean: startMean.toFixed(3),
      endMean: endMean.toFixed(3),
      baselineG: baselineG.toFixed(3),
    })
  } else {
    // Original: 200ms before start
    const BASELINE_LOOKBACK_MS = 200
    const actualStartTimeMs = samples[startIdx].timeMs
    const baselineMinT = Math.max(samples[0].timeMs, actualStartTimeMs - BASELINE_LOOKBACK_MS)
    const baselineMaxT = actualStartTimeMs

    let baselineSum = 0
    baselineCount = 0
    for (let i = 0; i < samples.length; i++) {
      const t = samples[i].timeMs
      if (t >= baselineMinT && t <= baselineMaxT) {
        const aG = samples[i].accelFiltered
        if (Number.isFinite(aG)) {
          baselineSum += aG
          baselineCount++
        }
      }
    }

    if (baselineCount === 0) {
      console.log('[DRI] No baseline samples found')
      return null
    }
    baselineG = baselineSum / baselineCount

    console.log('[DRI] Drop-test baseline:', {
      baselineMinT: baselineMinT.toFixed(1),
      baselineMaxT: baselineMaxT.toFixed(1),
      baselineCount,
      baselineG: baselineG.toFixed(3),
    })
  }

  const omega = DRI_OMEGA_N
  const zeta = DRI_ZETA

  // State: x [m], v [m/s]
  let x = 0
  let v = 0
  let deltaMax = 0

  const deriv = (x0: number, v0: number, a: number) => {
    const dx = v0
    const dv = -2 * zeta * omega * v0 - omega * omega * x0 - a
    return { dx, dv }
  }

  const rk4Step = (dt: number, a0: number, aMid: number, a1: number) => {
    const k1 = deriv(x, v, a0)

    const x2 = x + (dt / 2) * k1.dx
    const v2 = v + (dt / 2) * k1.dv
    const k2 = deriv(x2, v2, aMid)

    const x3 = x + (dt / 2) * k2.dx
    const v3 = v + (dt / 2) * k2.dv
    const k3 = deriv(x3, v3, aMid)

    const x4 = x + dt * k3.dx
    const v4 = v + dt * k3.dv
    const k4 = deriv(x4, v4, a1)

    x += (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx)
    v += (dt / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv)
  }

  // (5) Integrate within the detected range (from free fall to free fall).
  // Calculate actual dt from timestamps in the integration range (more reliable than
  // the global sampleRateHz estimate, which may not match the actual spacing).
  const actualDurationMs = samples[endIdx].timeMs - samples[startIdx].timeMs
  const numSteps = endIdx - startIdx
  const actualDtFromTimestamps = actualDurationMs / 1000 / numSteps

  // Use the sampleRate-based dt only if it closely matches the actual timestamps
  // (within 5% tolerance). Otherwise fall back to timestamp-based dt.
  const fixedDtFromRate = sampleRateHz ? 1 / sampleRateHz : null
  const rateMatchesTimestamps =
    fixedDtFromRate !== null &&
    Math.abs(fixedDtFromRate - actualDtFromTimestamps) / actualDtFromTimestamps < 0.05

  const fixedDt = rateMatchesTimestamps ? fixedDtFromRate : actualDtFromTimestamps

  for (let i = startIdx; i < endIdx; i++) {
    const dt = fixedDt

    // Use the SAME filtered series, corrected by the baseline:
    // free fall (~-1 G) becomes ~0 G loading.
    const a0 = (samples[i].accelFiltered - baselineG) * G0
    const a1 = (samples[i + 1].accelFiltered - baselineG) * G0
    const aMid = 0.5 * (a0 + a1)

    rk4Step(dt, a0, aMid, a1)

    const ax = Math.abs(x)
    if (ax > deltaMax) deltaMax = ax
  }

  const dri = (omega * omega * deltaMax) / G0

  console.log('[DRI] Integration result:', {
    startIdx,
    endIdx,
    numSteps: endIdx - startIdx,
    fixedDt: (fixedDt * 1000).toFixed(3) + ' ms',
    deltaMax: deltaMax.toFixed(6) + ' m',
    deltaMaxMm: (deltaMax * 1000).toFixed(3) + ' mm',
    dri: dri.toFixed(2),
  })

  return {
    dri,
    deltaMaxM: deltaMax,
    deltaMaxMm: deltaMax * 1000,
    omegaN: omega,
    zeta,
    actualWindowMinMs: samples[startIdx].timeMs,
    actualWindowMaxMs: samples[endIdx].timeMs,
    baselineG,
    baselineSamples: baselineCount,
  }
}
