import FFT from 'fft.js'
import type { SamplePoint } from '../types'

/**
 * npm dependency:
 *   npm install fft.js
 */

export interface ImpactWindowInfo {
  peakIdx: number
  peakTimeMs: number
  peakAccelG: number
  startIdx: number
  endIdx: number
  windowStartMs: number
  windowEndMs: number
}

export interface ImpactTimeMetrics {
  peakAccelG: number
  peakTimeMs: number

  minAccelG: number
  minTimeMs: number

  peakToValleyG: number // peakAccelG - minAccelG
  meanG: number
  rmsG: number
  durationMs: number

  numZeroCrossings: number
}

export interface SpectralPeak {
  freqHz: number
  amplitude: number
}

export interface ImpactSpectrumAnalysis {
  sampleRateHz: number
  windowDurationMs: number
  numPoints: number
  fftSize: number
  peaks: Array<SpectralPeak>
}

export interface ImpactAnalysis {
  impactWindow: ImpactWindowInfo
  timeMetrics: ImpactTimeMetrics
  spectrum: ImpactSpectrumAnalysis | null
  ringingFrequencyEstimateHz: number | null
  ringingPeriodMs: number | null
  // Recommended Savitzky–Golay smoothing window (in samples) for a *moderate*
  // level of smoothing (roughly a fraction of the ringing period).
  recommendedSavitzkyGolayWindowSizeSamples: number | null
  recommendedSavitzkyGolayPolynomial: number | null
}

/**
 * First‑hit specific detection information.
 */
export interface FirstHitWindowInfo {
  startIdx: number
  endIdx: number
  peakIdx: number
  startTimeMs: number
  endTimeMs: number
  peakTimeMs: number
  peakAccelG: number
}

export interface FirstHitDetection {
  window: FirstHitWindowInfo
  baselineMeanG: number
  baselineStdG: number
  onsetFraction: number
  settleFraction: number
  onsetThresholdG: number
  settleThresholdG: number
  maxHitDurationMs: number
  settleDurationMs: number
}

export interface FirstHitAnalysis {
  detection: FirstHitDetection
  timeMetrics: ImpactTimeMetrics
  spectrum: ImpactSpectrumAnalysis | null
}

/**
 * Estimate sample rate from timeMs (assumes mostly uniform sampling).
 */
export function estimateSampleRateHz(samples: Array<SamplePoint>): number | null {
  if (samples.length < 2) return null
  const dt = samples[1].timeMs - samples[0].timeMs
  if (!Number.isFinite(dt) || dt <= 0) return null
  return 1000 / dt
}

/**
 * Find the largest positive peak in accelG and return an index-based window around it.
 * (Used for general impact analysis; not necessarily the "first hit" window.)
 */
function findImpactWindow(
  samples: Array<SamplePoint>,
  windowHalfWidthMs = 80,
  minPeakG = 5,
): ImpactWindowInfo | null {
  if (samples.length === 0) return null

  let peakIdx = -1
  let peakValue = Number.NEGATIVE_INFINITY

  for (let i = 0; i < samples.length; i++) {
    const a = samples[i].accelG
    if (a == null || !Number.isFinite(a)) continue
    if (a > minPeakG && a > peakValue) {
      peakValue = a
      peakIdx = i
    }
  }

  if (peakIdx === -1) {
    return null
  }

  const peakTimeMs = samples[peakIdx].timeMs
  const windowStartMs = peakTimeMs - windowHalfWidthMs
  const windowEndMs = peakTimeMs + windowHalfWidthMs

  let startIdx = peakIdx
  let endIdx = peakIdx

  for (let i = peakIdx; i >= 0; i--) {
    if (samples[i].timeMs < windowStartMs) break
    startIdx = i
  }

  for (let i = peakIdx; i < samples.length; i++) {
    if (samples[i].timeMs > windowEndMs) break
    endIdx = i
  }

  return {
    peakIdx,
    peakTimeMs,
    peakAccelG: peakValue,
    startIdx,
    endIdx,
    windowStartMs,
    windowEndMs,
  }
}

/**
 * Basic time-domain metrics of accelG in the given window.
 */
function computeTimeMetricsInWindow(
  samples: Array<SamplePoint>,
  window: ImpactWindowInfo,
): ImpactTimeMetrics {
  const { startIdx, endIdx } = window
  const n = endIdx - startIdx + 1

  let peakAccelG = Number.NEGATIVE_INFINITY
  let peakTimeMs = 0
  let minAccelG = Number.POSITIVE_INFINITY
  let minTimeMs = 0
  let sum = 0
  let sumSq = 0
  let numZeroCrossings = 0

  let prev = samples[startIdx].accelG ?? 0

  for (let i = startIdx; i <= endIdx; i++) {
    const s = samples[i]
    const a = s.accelG ?? 0

    if (a > peakAccelG) {
      peakAccelG = a
      peakTimeMs = s.timeMs
    }
    if (a < minAccelG) {
      minAccelG = a
      minTimeMs = s.timeMs
    }

    sum += a
    sumSq += a * a

    if ((prev <= 0 && a > 0) || (prev >= 0 && a < 0)) {
      numZeroCrossings++
    }
    prev = a
  }

  const meanG = sum / n
  const rmsG = Math.sqrt(sumSq / n)
  const durationMs = samples[endIdx].timeMs - samples[startIdx].timeMs
  const peakToValleyG = peakAccelG - minAccelG

  return {
    peakAccelG,
    peakTimeMs,
    minAccelG,
    minTimeMs,
    peakToValleyG,
    meanG,
    rmsG,
    durationMs,
    numZeroCrossings,
  }
}

/**
 * Hann window (for FFT).
 */
function hann(i: number, N: number): number {
  if (N <= 1) return 1
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
}

/**
 * Spectral analysis of accelG in the given window.
 */
function computeSpectrumInWindow(
  samples: Array<SamplePoint>,
  window: ImpactWindowInfo,
  options: {
    minFreqHz?: number
    maxFreqHz?: number
  } = {},
): ImpactSpectrumAnalysis | null {
  const { minFreqHz = 5, maxFreqHz = 300 } = options

  const sampleRateHz = estimateSampleRateHz(samples)
  if (!sampleRateHz) return null

  const { startIdx, endIdx } = window
  const windowSamples = samples.slice(startIdx, endIdx + 1)
  const n = windowSamples.length

  if (n < 8) return null

  const raw: Array<number> = windowSamples.map((s) => s.accelG ?? 0)
  const mean = raw.reduce((sum, v) => sum + v, 0) / n
  const detrended = raw.map((v) => v - mean)

  const fftSize = 1 << Math.ceil(Math.log2(n))

  const fft = new FFT(fftSize)
  const input = fft.createComplexArray()
  const output = fft.createComplexArray()

  for (let i = 0; i < fftSize; i++) {
    const re = i < n ? detrended[i] * hann(i, n) : 0
    input[2 * i] = re
    input[2 * i + 1] = 0
  }

  fft.transform(output, input)

  const half = Math.floor(fftSize / 2)
  const peaks: Array<SpectralPeak> = []

  for (let k = 1; k <= half; k++) {
    const freqHz = (k * sampleRateHz) / fftSize
    if (freqHz < minFreqHz || freqHz > maxFreqHz) continue

    const re = output[2 * k]
    const im = output[2 * k + 1]
    const amp = (2 * Math.sqrt(re * re + im * im)) / n

    peaks.push({ freqHz, amplitude: amp })
  }

  if (peaks.length === 0) return null

  peaks.sort((a, b) => b.amplitude - a.amplitude)
  const numPeaks = 5
  const top = peaks.slice(0, numPeaks).sort((a, b) => a.freqHz - b.freqHz)

  return {
    sampleRateHz,
    windowDurationMs: windowSamples[windowSamples.length - 1].timeMs - windowSamples[0].timeMs,
    numPoints: n,
    fftSize,
    peaks: top,
  }
}

/**
 * Estimate ringing frequency from zero crossings.
 * For a roughly sinusoidal signal, each cycle has 2 zero crossings.
 */
function estimateRingingFrequencyFromZeroCrossings(
  metrics: ImpactTimeMetrics,
): { freqHz: number; periodMs: number } | null {
  const { numZeroCrossings, durationMs } = metrics
  if (numZeroCrossings < 4 || durationMs <= 0) return null

  const durationSec = durationMs / 1000
  const cyclesApprox = numZeroCrossings / 2
  const freqHz = cyclesApprox / durationSec
  if (!Number.isFinite(freqHz) || freqHz <= 0) return null

  const periodMs = 1000 / freqHz
  return { freqHz, periodMs }
}

/**
 * High-level analysis of the first impact in raw accelG (global).
 *
 * Logs one JSON blob that you can copy from Chrome devtools:
 *   ImpactAnalysis { ... }
 */
export function analyzeImpact(
  samples: Array<SamplePoint>,
  options: { windowHalfWidthMs?: number; minPeakG?: number } = {},
): ImpactAnalysis | null {
  const { windowHalfWidthMs = 80, minPeakG = 5 } = options

  const window = findImpactWindow(samples, windowHalfWidthMs, minPeakG)
  if (!window) {
    console.log(`ImpactAnalysis ${JSON.stringify({ error: 'No peak found' }, null, 2)}`)
    return null
  }

  const timeMetrics = computeTimeMetricsInWindow(samples, window)
  const spectrum = computeSpectrumInWindow(samples, window)

  const ringingEstimate = estimateRingingFrequencyFromZeroCrossings(timeMetrics)
  let ringingFrequencyEstimateHz: number | null = null
  let ringingPeriodMs: number | null = null
  let recommendedWindowSizeSamples: number | null = null
  const recommendedPolynomial = 3

  if (ringingEstimate) {
    ringingFrequencyEstimateHz = ringingEstimate.freqHz
    ringingPeriodMs = ringingEstimate.periodMs

    // Choose window as a fraction of the ringing period (moderate smoothing),
    // then clamp to a reasonable range to avoid extreme smearing.
    const targetFractionOfPeriod = 0.5

    let win = Math.round(ringingEstimate.periodMs * targetFractionOfPeriod)
    if (win < 7) win = 7
    if (win > 41) win = 41
    if (win % 2 === 0) win += 1

    recommendedWindowSizeSamples = win
  }

  const analysis: ImpactAnalysis = {
    impactWindow: window,
    timeMetrics,
    spectrum,
    ringingFrequencyEstimateHz,
    ringingPeriodMs,
    recommendedSavitzkyGolayWindowSizeSamples: recommendedWindowSizeSamples,
    recommendedSavitzkyGolayPolynomial: recommendedWindowSizeSamples ? recommendedPolynomial : null,
  }

  console.log(`ImpactAnalysis ${JSON.stringify(analysis, null, 2)}`)
  return analysis
}

/**
 * Detect the "first hit" window:
 *  - Estimate a baseline from early samples.
 *  - Find the first significant local maximum above baseline.
 *  - Walk backwards to the onset where the deviation from baseline becomes small.
 *  - Walk forwards to where the signal has settled back close to baseline for a while.
 *
 * Uses whatever acceleration series is available, preferring smoothed series if present.
 */
export function detectFirstHitWindow(samples: Array<SamplePoint>): FirstHitDetection | null {
  const n = samples.length
  if (n < 10) {
    console.log(
      'FirstHitDetection ' +
        JSON.stringify({ error: 'Not enough samples', sampleCount: n }, null, 2),
    )
    return null
  }

  const sampleRateHz = estimateSampleRateHz(samples) ?? 1000

  const values: Array<number> = samples.map((s) => {
    if (s.accelSGShort != null && Number.isFinite(s.accelSGShort)) return s.accelSGShort
    if (s.accelFiltered != null && Number.isFinite(s.accelFiltered)) return s.accelFiltered
    return s.accelG ?? 0
  })

  // 1) Baseline from early portion (e.g. first 200 ms or up to 10% of data)
  const baselineDurationMs = 200
  const maxBaselineFraction = 0.1

  const baselineEndTimeMs =
    samples[0].timeMs +
    Math.min(baselineDurationMs, (samples[n - 1].timeMs - samples[0].timeMs) * maxBaselineFraction)

  const baselineIndices: Array<number> = []
  for (let i = 0; i < n; i++) {
    if (samples[i].timeMs <= baselineEndTimeMs) {
      baselineIndices.push(i)
    } else {
      break
    }
  }
  if (baselineIndices.length < 5) {
    // Fallback: just use the first few samples
    const count = Math.min(20, n)
    for (let i = 0; i < count; i++) baselineIndices.push(i)
  }

  let baselineSum = 0
  for (const idx of baselineIndices) {
    baselineSum += values[idx]
  }
  const baselineMeanG = baselineSum / baselineIndices.length

  let baselineVar = 0
  for (const idx of baselineIndices) {
    const d = values[idx] - baselineMeanG
    baselineVar += d * d
  }
  baselineVar /= baselineIndices.length
  const baselineStdG = Math.sqrt(baselineVar)

  // 2) Find the first significant local maximum above baseline+margin
  const minPeakDeltaG = Math.max(5, 4 * baselineStdG)
  let peakIdx = -1
  let peakVal = Number.NEGATIVE_INFINITY

  for (let i = 1; i < n - 1; i++) {
    const v = values[i]
    const dv = v - baselineMeanG
    const isLocalMax = v >= values[i - 1] && v >= values[i + 1]
    if (isLocalMax && dv >= minPeakDeltaG) {
      peakIdx = i
      peakVal = v
      break
    }
  }

  if (peakIdx === -1) {
    // Fallback: global maximum above baseline+minPeakDelta
    for (let i = 0; i < n; i++) {
      const dv = values[i] - baselineMeanG
      if (dv >= minPeakDeltaG && values[i] > peakVal) {
        peakVal = values[i]
        peakIdx = i
      }
    }
  }

  if (peakIdx === -1) {
    console.log(
      'FirstHitDetection ' +
        JSON.stringify(
          {
            error: 'No significant peak found',
            baselineMeanG,
            baselineStdG,
            minPeakDeltaG,
          },
          null,
          2,
        ),
    )
    return null
  }

  const peakTimeMs = samples[peakIdx].timeMs
  const peakAccelG = peakVal
  const deltaPeak = peakAccelG - baselineMeanG

  // 3) Onset: walk backwards until deviation becomes small
  const onsetFraction = 0.05 // 5% of peak-baseline deviation
  const onsetThresholdAbs = Math.abs(deltaPeak * onsetFraction)

  let startIdx = peakIdx
  for (let i = peakIdx; i >= 0; i--) {
    const dev = Math.abs(values[i] - baselineMeanG)
    if (dev <= onsetThresholdAbs) {
      startIdx = i
      break
    }
  }

  // Add a small padding before onset
  const paddingBeforeMs = 10
  const paddingBeforeSamples = Math.max(1, Math.round((paddingBeforeMs / 1000) * sampleRateHz))
  startIdx = Math.max(0, startIdx - paddingBeforeSamples)

  // 4) End-of-hit: look for sustained near-baseline segment after peak
  const settleFraction = 0.1 // 10% of peak-baseline deviation
  const settleThresholdAbs = Math.abs(deltaPeak * settleFraction)

  const settleDurationMs = 40
  const settleSamples = Math.max(2, Math.round((settleDurationMs / 1000) * sampleRateHz))

  const maxHitDurationMs = 200
  const maxHitSamples = Math.max(
    settleSamples + 1,
    Math.round((maxHitDurationMs / 1000) * sampleRateHz),
  )

  let endIdx = n - 1

  for (let i = peakIdx + 1; i < n; i++) {
    // Check a candidate run from i to i + settleSamples - 1
    let allSmall = true
    for (let j = i; j < n && j < i + settleSamples; j++) {
      const dev = Math.abs(values[j] - baselineMeanG)
      if (dev > settleThresholdAbs) {
        allSmall = false
        break
      }
    }
    if (allSmall) {
      endIdx = Math.max(peakIdx + 1, i - 1)
      break
    }
  }

  // If we never found a stable region, cap the window length
  if (endIdx <= startIdx || endIdx - startIdx > maxHitSamples) {
    endIdx = Math.min(startIdx + maxHitSamples, n - 1)
  }

  const startTimeMs = samples[startIdx].timeMs
  const endTimeMs = samples[endIdx].timeMs

  const detection: FirstHitDetection = {
    window: {
      startIdx,
      endIdx,
      peakIdx,
      startTimeMs,
      endTimeMs,
      peakTimeMs,
      peakAccelG,
    },
    baselineMeanG,
    baselineStdG,
    onsetFraction,
    settleFraction,
    onsetThresholdG: baselineMeanG + Math.sign(deltaPeak) * onsetThresholdAbs,
    settleThresholdG: baselineMeanG + Math.sign(deltaPeak) * settleThresholdAbs,
    maxHitDurationMs,
    settleDurationMs,
  }

  console.log(`FirstHitDetection ${JSON.stringify(detection, null, 2)}`)
  return detection
}

/**
 * Analyze the first-hit window only:
 *  - Uses detectFirstHitWindow for the window.
 *  - Computes time-domain metrics and spectrum in that window.
 */
export function analyzeFirstHit(samples: Array<SamplePoint>): FirstHitAnalysis | null {
  const detection = detectFirstHitWindow(samples)
  if (!detection) {
    console.log('FirstHitAnalysis ' + JSON.stringify({ error: 'No first hit detected' }, null, 2))
    return null
  }

  const w = detection.window
  const window: ImpactWindowInfo = {
    peakIdx: w.peakIdx,
    peakTimeMs: w.peakTimeMs,
    peakAccelG: w.peakAccelG,
    startIdx: w.startIdx,
    endIdx: w.endIdx,
    windowStartMs: w.startTimeMs,
    windowEndMs: w.endTimeMs,
  }

  const timeMetrics = computeTimeMetricsInWindow(samples, window)
  const spectrum = computeSpectrumInWindow(samples, window)

  const analysis: FirstHitAnalysis = {
    detection,
    timeMetrics,
    spectrum,
  }

  console.log(`FirstHitAnalysis ${JSON.stringify(analysis, null, 2)}`)
  return analysis
}
