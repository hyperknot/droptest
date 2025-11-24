// @ts-expect-error
import Fili from 'fili'
import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../../types'

export function calculateCFC(
  samples: Array<SamplePoint>,
  cfcFreq: number, // CFC class, e.g. 60, 180, 600
  sampleRate: number,
): Array<number> {
  const raw = samples.map((s) => s.accelRaw)

  // SAE J211 analog mapping:
  const analogFc = 1.667 * cfcFreq

  // Correction for two-pass 2nd-order Butterworth
  const twoPassCorrection = 1.0 / 0.8023 // ≈ 1.246
  let singlePassFc = analogFc * twoPassCorrection // ≈ 2.08 * CFC

  // Nyquist safety
  const nyquist = sampleRate / 2
  singlePassFc = Math.min(singlePassFc, nyquist * 0.95)

  const iirCalculator = new Fili.CalcCascades()
  const coeffs = iirCalculator.lowpass({
    order: 1, // 2nd order per pass
    characteristic: 'butterworth',
    Fs: sampleRate,
    Fc: singlePassFc,
    preGain: true,
  })

  // Manual forward-backward zero-phase
  const filterFwd = new Fili.IirFilter(coeffs)
  let data = filterFwd.multiStep(raw)

  const filterBwd = new Fili.IirFilter(coeffs)
  data = filterBwd.multiStep(data.reverse()).reverse()

  return data
}

export function calculateJerkSG(
  samples: Array<SamplePoint>,
  windowSize: number,
  poly: number,
  sampleRate: number,
): Array<number | null> {
  let win = Math.round(windowSize)
  if (win % 2 === 0) win += 1
  if (win < 5) win = 5

  // Constraint: Polynomial order must be less than window size
  let p = Math.round(poly)
  if (p >= win) p = win - 1

  const values = samples.map((s) => s.accelCFC ?? s.accelRaw)
  const dt = 1 / sampleRate

  // Derivative 1 gives unit/second (e.g. g/s)
  const deriv = savitzkyGolay(values, dt, {
    windowSize: win,
    polynomial: p,
    derivative: 1,
  })

  return deriv
}
