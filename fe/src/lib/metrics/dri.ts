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

  // Energy absorbed during impact (J/kg, i.e. per unit mass)
  // Computed as 0.5 * v_impact², where v_impact is the velocity at impact start
  energyJPerKg: number

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
  if (samples.length < 2) return null
  if (!(window.maxMs > window.minMs)) return null

  // Find indices spanning the requested window.
  let windowStartIdx = -1
  let windowEndIdx = -1
  for (let i = 0; i < samples.length; i++) {
    const t = samples[i].timeMs
    if (windowStartIdx === -1 && t >= window.minMs) windowStartIdx = i
    if (t <= window.maxMs) windowEndIdx = i
  }

  if (windowStartIdx === -1 || windowEndIdx === -1 || windowEndIdx <= windowStartIdx) return null

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
  if (peakVal < 5) return null

  const FREE_FALL_THRESHOLD = -0.85

  // (2) Search backward from peak until accel < -0.85 G (free fall)
  let startIdx = peakIdx
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      startIdx = i
      break
    }
  }

  // (3) Search forward from peak until accel < -0.85 G (back to free fall)
  let endIdx = peakIdx
  for (let i = peakIdx + 1; i < samples.length; i++) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      endIdx = i
      break
    }
  }

  if (endIdx <= startIdx) return null

  // (4) Baseline estimate from 200 ms immediately BEFORE the start.
  const BASELINE_LOOKBACK_MS = 200
  const actualStartTimeMs = samples[startIdx].timeMs
  const baselineMinT = Math.max(samples[0].timeMs, actualStartTimeMs - BASELINE_LOOKBACK_MS)
  const baselineMaxT = actualStartTimeMs

  let baselineSum = 0
  let baselineCount = 0
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

  if (baselineCount === 0) return null
  const baselineG = baselineSum / baselineCount

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
  // Use fixed dt from sample rate if provided (more reliable than timestamp differences,
  // which may have limited precision at high sample rates like 6000 Hz).
  const fixedDt = sampleRateHz ? 1 / sampleRateHz : null

  // For energy calculation: integrate corrected accel to get velocity change.
  // Since the object starts at impact velocity and ends ~stopped,
  // the integrated velocity change equals the impact velocity.
  let velocityIntegral = 0

  for (let i = startIdx; i < endIdx; i++) {
    let dt: number
    if (fixedDt !== null) {
      dt = fixedDt
    } else {
      const t0 = samples[i].timeMs
      const t1 = samples[i + 1].timeMs
      dt = (t1 - t0) / 1000
      if (!(dt > 0)) continue
    }

    // Use the SAME filtered series, corrected by the baseline:
    // free fall (~-1 G) becomes ~0 G loading.
    const a0 = (samples[i].accelFiltered - baselineG) * G0
    const a1 = (samples[i + 1].accelFiltered - baselineG) * G0
    const aMid = 0.5 * (a0 + a1)

    rk4Step(dt, a0, aMid, a1)

    // Trapezoidal integration for velocity
    velocityIntegral += aMid * dt

    const ax = Math.abs(x)
    if (ax > deltaMax) deltaMax = ax
  }

  const dri = (omega * omega * deltaMax) / G0

  // Impact velocity = velocity change during impact (object stops at end)
  // Energy per unit mass = 0.5 * v²
  const impactVelocity = Math.abs(velocityIntegral)
  const energyJPerKg = 0.5 * impactVelocity * impactVelocity

  return {
    dri,
    deltaMaxM: deltaMax,
    deltaMaxMm: deltaMax * 1000,
    omegaN: omega,
    zeta,
    energyJPerKg,
    actualWindowMinMs: samples[startIdx].timeMs,
    actualWindowMaxMs: samples[endIdx].timeMs,
    baselineG,
    baselineSamples: baselineCount,
  }
}
