// @ts-expect-error
import Fili from 'fili'
import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../types'
import type { ImpactAnalysis } from './signal-analysis'
import { analyzeImpact, estimateSampleRateHz } from './signal-analysis'

/**
 * npm dependencies:
 *   npm install ml-savitzky-golay fft.js fili
 */

/**
 * Apply Savitzky–Golay smoothing to accelG.
 *
 * - samples: your full time series (dt ~ 1 ms).
 * - windowSizeSamples: must be odd, e.g. 11, 21, 33, 41.
 * - polynomial: small integer, usually 2 or 3.
 *
 * Returns an array of smoothed accel values aligned with samples[i].
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

  // Sampling interval in seconds (for you, dt ≈ 1 ms => 0.001 s)
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
 * Auto mode:
 * - Runs analyzeImpact to estimate ringing frequency and recommend a window size.
 * - Applies Savitzky–Golay with that window (or a fallback default).
 * - Logs configuration as JSON.
 *
 * Returns:
 *   smoothed: number[]   // smoothed accelG aligned with samples
 *   usedWindowSizeSamples: number
 *   polynomial: number
 *   analysis: ImpactAnalysis | null
 */
export function applySavitzkyGolayAccelAuto(samples: Array<SamplePoint>): {
  smoothed: Array<number>
  usedWindowSizeSamples: number
  polynomial: number
  analysis: ImpactAnalysis | null
} {
  const analysis = analyzeImpact(samples) // also logs ImpactAnalysis JSON

  // Fallback defaults if analysis failed
  let windowSizeSamples = 31
  let polynomial = 3

  if (
    analysis?.recommendedSavitzkyGolayWindowSizeSamples &&
    analysis.recommendedSavitzkyGolayWindowSizeSamples > 1
  ) {
    windowSizeSamples = analysis.recommendedSavitzkyGolayWindowSizeSamples
    if (analysis.recommendedSavitzkyGolayPolynomial) {
      polynomial = analysis.recommendedSavitzkyGolayPolynomial
    }
  }

  const smoothed = applySavitzkyGolayAccel(samples, windowSizeSamples, polynomial)

  const logObj = {
    usedWindowSizeSamples: windowSizeSamples,
    polynomial,
    ringingFrequencyEstimateHz: analysis?.ringingFrequencyEstimateHz ?? null,
    ringingPeriodMs: analysis?.ringingPeriodMs ?? null,
  }

  console.log(`SavitzkyGolayConfig ${JSON.stringify(logObj, null, 2)}`)

  return {
    smoothed,
    usedWindowSizeSamples: windowSizeSamples,
    polynomial,
    analysis,
  }
}

/**
 * Centered moving average of accelG, with a symmetric window.
 *
 * For each index i, we average samples[i - h ... i + h], where
 * h = (windowSizeSamples - 1) / 2, clamping at the ends of the array.
 *
 * This preserves array length and aligns with the original time axis.
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
 *
 * - order: default 4 (like SAE J211 / ISO 6487 crash filters)
 * - zeroPhase: if true, applies filter forward and backward (filtfilt‑style)
 *   to remove phase lag, at the cost of extra computation.
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
  // Clamp cutoff to a safe range
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

  console.log(
    'ButterworthLowpassConfig ' +
      JSON.stringify(
        {
          sampleRateHz,
          cutoffHz: fc,
          requestedCutoffHz: cutoffHz,
          order,
          zeroPhase,
        },
        null,
        2,
      ),
  )

  return filtered
}

/**
 * Crash‑test style "Channel Frequency Class" (CFC) filter on accelG.
 *
 * This approximates SAE J211 / ISO 6487: a 4th‑order Butterworth low‑pass
 * with a cutoff frequency proportional to the CFC value.
 *
 * Common classes in crash / biomechanical testing:
 *   - CFC 60  (soft / global accelerations, e.g. head/chest)
 *   - CFC 180 (stiffer measurements)
 *
 * For 1000 Hz sampling, a commonly used approximation is:
 *   Fc ≈ CFC * 1.67 Hz
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

  const approxCutoffHz = cfc * 1.67 // widely used approximation: Fc ≈ CFC * 10/6

  const filtered = applyButterworthLowpassAccel(samples, approxCutoffHz, options)

  console.log(
    'CrashFilterCFC ' +
      JSON.stringify(
        {
          cfc,
          sampleRateHz,
          approxCutoffHz,
          order: options.order ?? 4,
          zeroPhase: options.zeroPhase ?? true,
        },
        null,
        2,
      ),
  )

  return {
    filtered,
    usedCutoffHz: approxCutoffHz,
    sampleRateHz,
  }
}
