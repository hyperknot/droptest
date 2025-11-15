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
 * - Runs analyzeImpact to estimate ringing frequency and recommend a *moderate*
 *   smoothing window (fraction of ringing period).
 * - Applies Savitzky–Golay with that window (or a fallback default).
 * - Also returns the full-period window length (for other filters to use).
 * - Logs configuration as JSON.
 *
 * Returns:
 *   smoothed: number[]   // smoothed accelG aligned with samples
 *   usedWindowSizeSamples: number
 *   polynomial: number
 *   analysis: ImpactAnalysis | null
 *   fullPeriodWindowSizeSamples: number | null
 */
export function applySavitzkyGolayAccelAuto(samples: Array<SamplePoint>): {
  smoothed: Array<number>
  usedWindowSizeSamples: number
  polynomial: number
  analysis: ImpactAnalysis | null
  fullPeriodWindowSizeSamples: number | null
} {
  const analysis = analyzeImpact(samples)

  // Fallback defaults if analysis failed
  let windowSizeSamples = 31
  let polynomial = 3
  let fullPeriodWindowSizeSamples: number | null = null

  if (
    analysis?.recommendedSavitzkyGolayWindowSizeSamples &&
    analysis.recommendedSavitzkyGolayWindowSizeSamples > 1
  ) {
    windowSizeSamples = analysis.recommendedSavitzkyGolayWindowSizeSamples
    if (analysis.recommendedSavitzkyGolayPolynomial) {
      polynomial = analysis.recommendedSavitzkyGolayPolynomial
    }
  }

  if (analysis?.ringingPeriodMs && analysis.ringingPeriodMs > 1) {
    const dtMs = samples.length >= 2 ? samples[1].timeMs - samples[0].timeMs : 1
    const approxSamples = analysis.ringingPeriodMs / dtMs
    let win = Math.round(approxSamples)
    if (win < 5) win = 5
    if (win % 2 === 0) win += 1
    if (win > samples.length - 2) {
      win = samples.length % 2 === 1 ? samples.length : samples.length - 1
    }
    fullPeriodWindowSizeSamples = win
  }

  const smoothed = applySavitzkyGolayAccel(samples, windowSizeSamples, polynomial)

  const logObj = {
    usedWindowSizeSamples: windowSizeSamples,
    polynomial,
    ringingFrequencyEstimateHz: analysis?.ringingFrequencyEstimateHz ?? null,
    ringingPeriodMs: analysis?.ringingPeriodMs ?? null,
    fullPeriodWindowSizeSamples,
  }

  console.log(`SavitzkyGolayConfig ${JSON.stringify(logObj, null, 2)}`)

  return {
    smoothed,
    usedWindowSizeSamples: windowSizeSamples,
    polynomial,
    analysis,
    fullPeriodWindowSizeSamples,
  }
}

/**
 * Savitzky–Golay smoothing with a window approximately equal to one ringing period.
 *
 * Uses the ImpactAnalysis object (if available) to select the window.
 */
export function applySavitzkyGolayAccelFullPeriod(
  samples: Array<SamplePoint>,
  analysis: ImpactAnalysis | null,
): { smoothed: Array<number> | null; windowSizeSamples: number | null } {
  if (!analysis?.ringingPeriodMs || analysis.ringingPeriodMs <= 1) {
    console.log(
      'SavitzkyGolayFullPeriodConfig ' +
        JSON.stringify({ message: 'No ringing period available' }, null, 2),
    )
    return { smoothed: null, windowSizeSamples: null }
  }

  const dtMs = samples.length >= 2 ? samples[1].timeMs - samples[0].timeMs : 1
  const approxSamples = analysis.ringingPeriodMs / dtMs

  let windowSize = Math.round(approxSamples)
  if (windowSize < 5) windowSize = 5
  if (windowSize % 2 === 0) windowSize += 1
  if (windowSize > samples.length - 2) {
    windowSize = samples.length % 2 === 1 ? samples.length : samples.length - 1
  }

  const poly = analysis.recommendedSavitzkyGolayPolynomial ?? 3
  const smoothed = applySavitzkyGolayAccel(samples, windowSize, poly)

  console.log(
    'SavitzkyGolayFullPeriodConfig ' +
      JSON.stringify(
        {
          windowSizeSamples: windowSize,
          polynomial: poly,
        },
        null,
        2,
      ),
  )

  return {
    smoothed,
    windowSizeSamples: windowSize,
  }
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
 *
 * - order: default 4
 * - zeroPhase: if true, applies filter forward and backward
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
 * For 1000 Hz sampling, a commonly used approximation is:
 *   Fc ≈ CFC * (10/6) Hz
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

/**
 * Adaptive low‑pass filters aimed at suppressing the ringing and revealing a
 * smoother "envelope" of the foam compression–rebound.
 *
 * We derive a base frequency from the estimated ringing frequency if available.
 * Otherwise, we fall back to a value relative to the sample rate (not hard‑coded).
 *
 * We then create several series with different fractions of this base frequency:
 *   - Light  (factor ~ 0.7)
 *   - Medium (factor ~ 0.5)
 *   - Strong (factor ~ 0.35)
 */
export interface AdaptiveLowpassSeries {
  envLight: Array<number> | null
  envMedium: Array<number> | null
  envStrong: Array<number> | null
}

export function applyAdaptiveLowpassAccel(
  samples: Array<SamplePoint>,
  analysis: ImpactAnalysis | null,
): AdaptiveLowpassSeries {
  const estimatedRate = estimateSampleRateHz(samples)
  const sampleRateHz = estimatedRate && estimatedRate > 0 ? estimatedRate : 1000

  let baseFreqHz: number
  if (analysis?.ringingFrequencyEstimateHz && analysis.ringingFrequencyEstimateHz > 0) {
    baseFreqHz = analysis.ringingFrequencyEstimateHz
  } else {
    // Fallback: choose a base frequency relative to the sample rate
    baseFreqHz = sampleRateHz / 20 // e.g. 50 Hz when Fs = 1000 Hz
  }

  const nyquist = sampleRateHz / 2
  const minCutoffHz = sampleRateHz / 200 // e.g. 5 Hz at 1000 Hz
  const maxCutoffHz = nyquist * 0.8

  const factorConfigs = [
    { key: 'envLight' as const, factor: 0.7 },
    { key: 'envMedium' as const, factor: 0.5 },
    { key: 'envStrong' as const, factor: 0.35 },
  ]

  const results: AdaptiveLowpassSeries = {
    envLight: null,
    envMedium: null,
    envStrong: null,
  }

  const filterConfigs: Array<{ series: string; cutoffHz: number; factor: number }> = []

  for (const cfg of factorConfigs) {
    let cutoff = baseFreqHz * cfg.factor
    if (!Number.isFinite(cutoff) || cutoff <= 0) {
      cutoff = minCutoffHz
    } else {
      cutoff = Math.min(Math.max(cutoff, minCutoffHz), maxCutoffHz)
    }

    const filtered = applyButterworthLowpassAccel(samples, cutoff, {
      order: 4,
      zeroPhase: true,
    })
    ;(results as any)[cfg.key] = filtered

    filterConfigs.push({
      series: cfg.key,
      cutoffHz: cutoff,
      factor: cfg.factor,
    })
  }

  console.log(
    'AdaptiveLowpassConfig ' +
      JSON.stringify(
        {
          sampleRateHz,
          baseFreqHz,
          filters: filterConfigs,
        },
        null,
        2,
      ),
  )

  return results
}
