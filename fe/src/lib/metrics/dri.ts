/**
 * Dynamic Response Index (DRI)
 * ----------------------------
 * Implements the classic 1-DOF biodynamic model used for spinal compression risk
 * estimation in ejection seat / +Gz shock literature (von Gierke / Griffin).
 *
 * Model:
 *   x'' + 2*zeta*omega_n*x' + omega_n^2*x = -a(t)
 *
 * DRI:
 *   DRI = (omega_n^2 * max(|x|)) / g0
 *
 * IMPORTANT ABOUT INPUT ACCEL UNITS / CONVENTION:
 * ----------------------------------------------
 * This app assumes your CSV "accel" channel is in Gs and uses this convention:
 *
 *   - approximately 0 G at rest (stationary)
 *   - approximately -1 G during free fall
 *
 * That implies your exported signal is effectively "1 g removed" compared to a
 * typical raw accelerometer (+1 G at rest, 0 G in free fall).
 *
 * If your logger exports +1 G at rest, you should subtract 1.0 before feeding
 * the data into this DRI calculation (or adjust in the parser).
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
}

/**
 * Compute DRI over a window [minMs, maxMs] using accelFiltered as input.
 *
 * Notes:
 * - Integration starts at window start with x(0)=0, x'(0)=0 (windowed DRI).
 * - If you want the oscillator state to include earlier history, extend the
 *   window earlier (e.g. include pre-impact time).
 */
export function computeDRIForWindow(
  samples: Array<ProcessedSample>,
  window: { minMs: number; maxMs: number },
): DRIResult | null {
  if (samples.length < 2) return null
  if (!(window.maxMs > window.minMs)) return null

  // Find start/end indices inside the requested window.
  let startIdx = -1
  let endIdx = -1

  for (let i = 0; i < samples.length; i++) {
    const t = samples[i].timeMs
    if (startIdx === -1 && t >= window.minMs) startIdx = i
    if (t <= window.maxMs) endIdx = i
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const omega = DRI_OMEGA_N
  const zeta = DRI_ZETA

  // State: x = displacement [m], v = velocity [m/s]
  let x = 0
  let v = 0
  let deltaMax = 0

  // ODE derivative
  const deriv = (x0: number, v0: number, a: number) => {
    const dx = v0
    const dv = -2 * zeta * omega * v0 - omega * omega * x0 - a
    return { dx, dv }
  }

  // RK4 step with (optionally) varying input acceleration across the step.
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

  // Integrate across the window.
  for (let i = startIdx; i < endIdx; i++) {
    const t0 = samples[i].timeMs
    const t1 = samples[i + 1].timeMs
    const dt = (t1 - t0) / 1000

    if (!(dt > 0)) continue

    // Convert from G to m/s^2.
    const a0 = samples[i].accelFiltered * G0
    const a1 = samples[i + 1].accelFiltered * G0
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
  }
}
