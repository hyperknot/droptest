// @ts-expect-error
import Fili from 'fili'
import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../../types'

export function calculateCFC(
  samples: Array<SamplePoint>,
  cfcFreq: number,
  sampleRate: number,
): Array<number> {
  // CFC approximation: Cutoff = CFC * 1.667 (roughly)
  // Standard SAE J211
  const cutoff = cfcFreq * 1.667

  // Safety check for Nyquist
  // If cutoff is too close to sampleRate/2, Fili might explode or return NaNs.
  const nyquist = sampleRate / 2
  const safeCutoff = Math.min(cutoff, nyquist * 0.95)

  const iirCalculator = new Fili.CalcCascades()
  // Order 4 Butterworth (2nd order cascaded twice forward/backward effectively gives higher order falloff,
  // but SAE J211 specifies distinct phaseless implementation usually.
  // Here we stick to the standard implementation provided previously: Order 4 Butterworth)
  const coeffs = iirCalculator.lowpass({
    order: 4,
    characteristic: 'butterworth',
    Fs: sampleRate,
    Fc: safeCutoff,
    preGain: true,
  })

  const filter = new Fili.IirFilter(coeffs)
  const raw = samples.map((s) => s.accelRaw)

  // Forward-Backward for zero phase
  let data = filter.multiStep(raw)
  const filterBack = new Fili.IirFilter(coeffs)
  data = filterBack.multiStep(data.reverse()).reverse()

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
