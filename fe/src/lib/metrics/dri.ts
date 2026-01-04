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
 * "One-bounce" windowed approach implemented here (per your requirements):
 * 1) Require the window start sample to be in free fall (< -0.9 G), else refuse.
 * 2) If OK, compute baseline average over the 200 ms interval immediately BEFORE window start,
 *    and use that as the subtraction value (typically ~-1 G).
 * 3) Integrate only inside the window (stop exactly at window end).
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

  // Debugging diagnostics (not shown in UI):
  baselineG: number
  baselineSamples: number
}

export function computeDRIForWindow(
  samples: Array<ProcessedSample>,
  window: { minMs: number; maxMs: number },
): DRIResult | null {
  if (samples.length < 2) return null
  if (!(window.maxMs > window.minMs)) return null

  // Find indices spanning the requested window.
  let startIdx = -1
  let endIdx = -1
  for (let i = 0; i < samples.length; i++) {
    const t = samples[i].timeMs
    if (startIdx === -1 && t >= window.minMs) startIdx = i
    if (t <= window.maxMs) endIdx = i
  }
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  // (1) Require: start-of-window must be in free fall.
  const FREE_FALL_REQUIRED_G = -0.9
  const aStartG = samples[startIdx].accelFiltered
  if (!(aStartG < FREE_FALL_REQUIRED_G)) {
    return null
  }

  // (2) Baseline estimate from 200 ms immediately BEFORE window start.
  const BASELINE_LOOKBACK_MS = 200
  const baselineMinT = Math.max(samples[0].timeMs, window.minMs - BASELINE_LOOKBACK_MS)
  const baselineMaxT = window.minMs

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

  // (3) Integrate only inside the window and stop at window end.
  for (let i = startIdx; i < endIdx; i++) {
    const t0 = samples[i].timeMs
    const t1 = samples[i + 1].timeMs
    const dt = (t1 - t0) / 1000
    if (!(dt > 0)) continue

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

  return {
    dri,
    deltaMaxM: deltaMax,
    deltaMaxMm: deltaMax * 1000,
    omegaN: omega,
    zeta,
    baselineG,
    baselineSamples: baselineCount,
  }
}
