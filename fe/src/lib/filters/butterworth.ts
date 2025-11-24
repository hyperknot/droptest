// @ts-expect-error
import Fili from 'fili'
import type { SamplePoint } from '../../types'
import { estimateSampleRateHz } from './utils'

/**
 * Generic Butterworth low‑pass on accelG using Fili.
 */
export function applyButterworthLowpassAccel(
  samples: Array<SamplePoint>,
  cutoffHz: number,
  options: { order?: number; zeroPhase?: boolean } = {},
): Array<number> {
  if (samples.length < 4) {
    throw new Error(`Not enough samples (${samples.length}) for Butterworth filtering`)
  }

  const order = options.order ?? 4
  const zeroPhase = options.zeroPhase ?? true

  const estimatedRate = estimateSampleRateHz(samples)
  const sampleRateHz = estimatedRate && estimatedRate > 0 ? estimatedRate : 1000

  const nyquist = sampleRateHz / 2
  const fc = Math.min(Math.max(cutoffHz, 0.001), nyquist * 0.99)

  const values = samples.map((s) => s.accelG ?? 0)

  const iirCalculator = new Fili.CalcCascades()

  const coeffs = iirCalculator.lowpass({
    order,
    characteristic: 'butterworth',
    Fs: sampleRateHz,
    Fc: fc,
    preGain: true,
  })

  const forwardFilter = new Fili.IirFilter(coeffs)
  let filtered = forwardFilter.multiStep(values)

  if (zeroPhase) {
    const reverseFilter = new Fili.IirFilter(coeffs)
    filtered = reverseFilter.multiStep(filtered.slice().reverse()).reverse()
  }

  return filtered
}

/**
 * Crash‑test style CFC filter on accelG.
 */
export function applyCrashFilterCFCAccel(
  samples: Array<SamplePoint>,
  cfc: number,
  options: { order?: number; zeroPhase?: boolean } = {},
): {
  filtered: Array<number>
  usedCutoffHz: number
  sampleRateHz: number
} {
  const estimatedRate = estimateSampleRateHz(samples)
  const sampleRateHz = estimatedRate && estimatedRate > 0 ? estimatedRate : 1000

  const approxCutoffHz = cfc * (10 / 6)

  const filtered = applyButterworthLowpassAccel(samples, approxCutoffHz, options)

  return {
    filtered,
    usedCutoffHz: approxCutoffHz,
    sampleRateHz,
  }
}
