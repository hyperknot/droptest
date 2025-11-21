// @ts-expect-error
import Fili from 'fili'
import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../types'

/**
 * Estimate sample rate from timeMs (assumes mostly uniform sampling).
 */
function estimateSampleRateHz(samples: Array<SamplePoint>): number | null {
  if (samples.length < 2) return null
  const dt = samples[1].timeMs - samples[0].timeMs
  if (!Number.isFinite(dt) || dt <= 0) return null
  return 1000 / dt
}

/**
 * Apply Savitzky–Golay smoothing to accelG.
 */
export function applySavitzkyGolayAccel(
  samples: Array<SamplePoint>,
  windowSizeSamples: number,
  polynomial = 3,
): Array<number> {
  if (!Number.isInteger(windowSizeSamples) || windowSizeSamples <= 1) {
    throw new Error(`windowSizeSamples must be an integer > 1, got ${windowSizeSamples}`)
  }
  if (windowSizeSamples % 2 === 0) {
    throw new Error(`Savitzky–Golay windowSizeSamples must be odd, got ${windowSizeSamples}`)
  }
  if (samples.length < windowSizeSamples) {
    throw new Error(
      `Not enough samples (${samples.length}) for windowSizeSamples ${windowSizeSamples}`,
    )
  }

  const y = samples.map((s) => s.accelG ?? 0)

  const dtMs = samples.length >= 2 ? samples[1].timeMs - samples[0].timeMs : 1
  const h = dtMs / 1000

  const options = {
    windowSize: windowSizeSamples,
    polynomial,
    derivative: 0,
  }

  const smoothed: Array<number> = savitzkyGolay(y, h, options)
  return smoothed
}

/**
 * Centered moving average of accelG, with a symmetric window.
 */
export function computeMovingAverageAccel(
  samples: Array<SamplePoint>,
  windowSizeSamples: number,
): Array<number> {
  if (!Number.isInteger(windowSizeSamples) || windowSizeSamples <= 1) {
    throw new Error(`windowSizeSamples must be an integer > 1, got ${windowSizeSamples}`)
  }
  if (windowSizeSamples % 2 === 0) {
    throw new Error(`Moving average windowSizeSamples must be odd, got ${windowSizeSamples}`)
  }

  const n = samples.length
  const result = new Array<number>(n)
  const half = (windowSizeSamples - 1) / 2

  const values = samples.map((s) => s.accelG ?? 0)

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half)
    const end = Math.min(n - 1, i + half)

    let sum = 0
    let count = 0
    for (let j = start; j <= end; j++) {
      sum += values[j]
      count++
    }
    result[i] = count > 0 ? sum / count : values[i]
  }

  return result
}

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
 * Band‑stop (notch) Butterworth filter on accelG.
 */
export function applyBandstopAccel(
  samples: Array<SamplePoint>,
  centerHz: number,
  bandwidthHz: number,
  options: { order?: number; zeroPhase?: boolean } = {},
): Array<number> {
  if (samples.length < 4) {
    throw new Error(`Not enough samples (${samples.length}) for band-stop filtering`)
  }

  const order = options.order ?? 2
  const zeroPhase = options.zeroPhase ?? true

  const estimatedRate = estimateSampleRateHz(samples)
  const sampleRateHz = estimatedRate && estimatedRate > 0 ? estimatedRate : 1000

  const nyquist = sampleRateHz / 2

  const halfBand = bandwidthHz / 2
  let Fc1 = centerHz - halfBand
  let Fc2 = centerHz + halfBand

  Fc1 = Math.max(0.001, Math.min(Fc1, nyquist * 0.99))
  Fc2 = Math.max(0.001, Math.min(Fc2, nyquist * 0.99))

  if (Fc1 >= Fc2) {
    Fc2 = Fc1 + 1
    if (Fc2 > nyquist * 0.99) {
      Fc1 = nyquist * 0.99 - 1
      Fc2 = nyquist * 0.99
    }
  }

  const values = samples.map((s) => s.accelG ?? 0)

  const iirCalculator = new Fili.CalcCascades()

  const coeffs = iirCalculator.bandstop({
    order,
    characteristic: 'butterworth',
    Fs: sampleRateHz,
    Fc: Fc1,
    Fc2: Fc2,
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
