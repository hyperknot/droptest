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
  recommendedSavitzkyGolayWindowSizeSamples: number | null
  recommendedSavitzkyGolayPolynomial: number | null
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
 * Find the first large positive peak in accelG and return an index-based window around it.
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

  // Find start/end indices for that time range
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

  // Build detrended, windowed signal
  const raw: Array<number> = windowSamples.map((s) => s.accelG ?? 0)
  const mean = raw.reduce((sum, v) => sum + v, 0) / n
  const detrended = raw.map((v) => v - mean)

  // Zero-pad to next power of 2 for FFT
  const fftSize = 1 << Math.ceil(Math.log2(n))

  const fft = new FFT(fftSize)
  const input = fft.createComplexArray()
  const output = fft.createComplexArray()

  for (let i = 0; i < fftSize; i++) {
    const re = i < n ? detrended[i] * hann(i, n) : 0
    input[2 * i] = re
    input[2 * i + 1] = 0 // imag
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
 * High-level analysis of the first impact in raw accelG.
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
  const spectrum = computeSpectrumInWindow(samples, window) // may be null

  const ringingEstimate = estimateRingingFrequencyFromZeroCrossings(timeMetrics)
  let ringingFrequencyEstimateHz: number | null = null
  let ringingPeriodMs: number | null = null
  let recommendedWindowSizeSamples: number | null = null
  const recommendedPolynomial = 3

  if (ringingEstimate) {
    ringingFrequencyEstimateHz = ringingEstimate.freqHz
    ringingPeriodMs = ringingEstimate.periodMs

    // Choose window ≈ one period, rounded to nearest odd integer
    let win = Math.round(ringingEstimate.periodMs)
    if (win < 5) win = 5
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
