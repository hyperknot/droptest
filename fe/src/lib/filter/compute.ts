// @ts-expect-error
import Fili from 'fili'
import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../../types'

/*
 * Simple implementations. No over-engineering.
 */

export function calculateCFC(
  samples: Array<SamplePoint>,
  cfcFreq: number,
  sampleRate: number,
): Array<number> {
  // CFC standard is approx corner freq * 1.55 (or 10/6 ~ 1.67 depending on norm).
  // We use the standard crash test approximation.
  const cutoff = (cfcFreq * 10) / 6

  const iirCalculator = new Fili.CalcCascades()
  // Order 4 Butterworth
  const coeffs = iirCalculator.lowpass({
    order: 4,
    characteristic: 'butterworth',
    Fs: sampleRate,
    Fc: cutoff,
    preGain: true,
  })

  const filter = new Fili.IirFilter(coeffs)
  const raw = samples.map((s) => s.accelRaw)

  // Forward-Backward for zero phase
  let data = filter.multiStep(raw)
  // Create new instance for backward pass
  const filterBack = new Fili.IirFilter(coeffs)
  data = filterBack.multiStep(data.reverse()).reverse()

  return data
}

export function calculateJerkSG(
  samples: Array<SamplePoint>,
  windowSize: number,
  sampleRate: number,
): Array<number | null> {
  // SG requires odd window
  let win = Math.round(windowSize)
  if (win % 2 === 0) win += 1
  if (win < 5) win = 5

  const values = samples.map((s) => s.accelCFC ?? s.accelRaw)
  const dt = 1 / sampleRate

  // Derivative 1 gives unit/second
  const deriv = savitzkyGolay(values, dt, {
    windowSize: win,
    polynomial: 3,
    derivative: 1,
  })

  return deriv
}
