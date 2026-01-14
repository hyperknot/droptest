import type { ProcessedSample, RawSample } from '../../types'

export interface TimeRange {
  min: number
  max: number
}

export interface SampleRateDiagnostics {
  totalSamples: number
  totalDurationMs: number

  // Basic statistics
  estimatedRateHz: number
  meanDtMs: number
  medianDtMs: number
  minDtMs: number
  maxDtMs: number
  stdDevDtMs: number

  // Issues detected
  duplicateTimestamps: number
  nonMonotonicCount: number
  gapCount: number // gaps > 2x median dt
  largestGapMs: number
  largestGapIndex: number

  // Rate variation across file segments
  segmentRates: Array<{ startIdx: number; endIdx: number; rateHz: number }>
  rateVariationPercent: number // max deviation from mean rate
}

/**
 * Comprehensive sample rate diagnostics for the entire file.
 * Detects missing samples, variable rates, gaps, etc.
 */
export function diagnoseSampleRate(samples: Array<RawSample>): SampleRateDiagnostics | null {
  if (samples.length < 10) return null

  const n = samples.length
  const deltas: number[] = []
  let duplicateTimestamps = 0
  let nonMonotonicCount = 0
  let largestGapMs = 0
  let largestGapIndex = 0

  // Collect all time deltas
  for (let i = 0; i < n - 1; i++) {
    const dt = samples[i + 1].timeMs - samples[i].timeMs
    deltas.push(dt)

    if (dt === 0) {
      duplicateTimestamps++
    } else if (dt < 0) {
      nonMonotonicCount++
    }

    if (dt > largestGapMs) {
      largestGapMs = dt
      largestGapIndex = i
    }
  }

  // Filter to positive deltas for statistics
  const positiveDeltas = deltas.filter((d) => d > 0)
  if (positiveDeltas.length === 0) return null

  // Basic statistics
  const sum = positiveDeltas.reduce((a, b) => a + b, 0)
  const meanDtMs = sum / positiveDeltas.length

  const sorted = [...positiveDeltas].sort((a, b) => a - b)
  const medianDtMs = sorted[Math.floor(sorted.length / 2)]
  const minDtMs = sorted[0]
  const maxDtMs = sorted[sorted.length - 1]

  // Standard deviation
  const squaredDiffs = positiveDeltas.map((d) => (d - meanDtMs) ** 2)
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / positiveDeltas.length
  const stdDevDtMs = Math.sqrt(variance)

  // Count gaps (> 2x median)
  const gapThreshold = medianDtMs * 2
  let gapCount = 0
  for (const dt of positiveDeltas) {
    if (dt > gapThreshold) gapCount++
  }

  // Analyze rate in segments (divide file into ~10 segments)
  const segmentSize = Math.max(100, Math.floor(n / 10))
  const segmentRates: Array<{ startIdx: number; endIdx: number; rateHz: number }> = []

  for (let start = 0; start < n - segmentSize; start += segmentSize) {
    const end = Math.min(start + segmentSize, n - 1)
    const segmentDuration = samples[end].timeMs - samples[start].timeMs
    if (segmentDuration > 0) {
      const segmentSamples = end - start
      const rateHz = (segmentSamples / segmentDuration) * 1000
      segmentRates.push({ startIdx: start, endIdx: end, rateHz: Math.round(rateHz) })
    }
  }

  // Calculate rate variation
  const meanRate = 1000 / meanDtMs
  let maxDeviation = 0
  for (const seg of segmentRates) {
    const deviation = Math.abs(seg.rateHz - meanRate) / meanRate
    if (deviation > maxDeviation) maxDeviation = deviation
  }

  const totalDurationMs = samples[n - 1].timeMs - samples[0].timeMs

  return {
    totalSamples: n,
    totalDurationMs,
    estimatedRateHz: Math.round(1000 / meanDtMs),
    meanDtMs,
    medianDtMs,
    minDtMs,
    maxDtMs,
    stdDevDtMs,
    duplicateTimestamps,
    nonMonotonicCount,
    gapCount,
    largestGapMs,
    largestGapIndex,
    segmentRates,
    rateVariationPercent: maxDeviation * 100,
  }
}

/**
 * Log comprehensive sample rate diagnostics to console.
 */
export function logSampleRateDiagnostics(filename: string, samples: Array<RawSample>): void {
  const diag = diagnoseSampleRate(samples)
  if (!diag) {
    console.warn('Sample rate diagnostics: insufficient samples')
    return
  }

  console.group(`=== Sample Rate Diagnostics: ${filename} ===`)

  console.log('File overview:', {
    totalSamples: diag.totalSamples,
    totalDurationMs: diag.totalDurationMs.toFixed(2),
    totalDurationSec: (diag.totalDurationMs / 1000).toFixed(2),
  })

  console.log('Sample rate statistics:', {
    estimatedRateHz: diag.estimatedRateHz,
    meanDtMs: diag.meanDtMs.toFixed(4),
    medianDtMs: diag.medianDtMs.toFixed(4),
    minDtMs: diag.minDtMs.toFixed(4),
    maxDtMs: diag.maxDtMs.toFixed(4),
    stdDevDtMs: diag.stdDevDtMs.toFixed(4),
  })

  // Issues summary
  const issues: string[] = []
  if (diag.duplicateTimestamps > 0) issues.push(`${diag.duplicateTimestamps} duplicate timestamps`)
  if (diag.nonMonotonicCount > 0) issues.push(`${diag.nonMonotonicCount} non-monotonic timestamps`)
  if (diag.gapCount > 0) issues.push(`${diag.gapCount} gaps (>2x median dt)`)
  if (diag.rateVariationPercent > 10) issues.push(`${diag.rateVariationPercent.toFixed(1)}% rate variation`)

  if (issues.length > 0) {
    console.warn('Issues detected:', issues.join(', '))
  } else {
    console.log('Issues detected: none')
  }

  console.log('Gap analysis:', {
    gapCount: diag.gapCount,
    gapThreshold: (diag.medianDtMs * 2).toFixed(4) + ' ms',
    largestGapMs: diag.largestGapMs.toFixed(4),
    largestGapIndex: diag.largestGapIndex,
  })

  console.log('Rate by segment (detects variable sample rate):')
  console.table(
    diag.segmentRates.map((s) => ({
      'Start Index': s.startIdx,
      'End Index': s.endIdx,
      'Rate (Hz)': s.rateHz,
    })),
  )

  // Histogram of dt values (10 buckets)
  const dtRange = diag.maxDtMs - diag.minDtMs
  const isUniform = dtRange < diag.medianDtMs * 0.001 // less than 0.1% variation

  if (isUniform) {
    console.log(`Delta-time: uniform at ${diag.medianDtMs.toFixed(4)} ms (${positiveDeltas.length} samples)`)
  } else {
    const bucketCount = 10
    const bucketSize = dtRange / bucketCount
    const histogram: Array<{ range: string; count: number }> = []
    const buckets = new Array(bucketCount).fill(0)

    const deltas: number[] = []
    for (let i = 0; i < samples.length - 1; i++) {
      const dt = samples[i + 1].timeMs - samples[i].timeMs
      if (dt > 0) deltas.push(dt)
    }

    for (const dt of deltas) {
      const bucket = Math.min(Math.floor((dt - diag.minDtMs) / bucketSize), bucketCount - 1)
      buckets[bucket]++
    }

    for (let i = 0; i < bucketCount; i++) {
      const low = diag.minDtMs + i * bucketSize
      const high = low + bucketSize
      histogram.push({
        range: `${low.toFixed(3)}-${high.toFixed(3)} ms`,
        count: buckets[i],
      })
    }

    console.log('Delta-time histogram:')
    console.table(histogram)
  }

  console.groupEnd()
}

/**
 * Estimate sample rate from RawSample data.
 */
export function estimateSampleRateHz(samples: Array<RawSample>): number {
  if (samples.length < 10) {
    throw new Error(`Need at least 10 points to estimate sample rate, got ${samples.length}`)
  }

  const limit = Math.min(samples.length - 1, 10)
  let sumDt = 0
  for (let i = 0; i < limit; i++) {
    sumDt += samples[i + 1].timeMs - samples[i].timeMs
  }
  const avgDt = sumDt / limit

  if (avgDt === 0) {
    throw new Error('Average time delta is zero - cannot estimate sample rate')
  }

  return Math.round(1000 / avgDt)
}

/**
 * Detects where the "event" starts (origin time) based on free-fall logic.
 *
 * - Uses a separate, precomputed filtered acceleration just for this purpose.
 * - Both arrays must be the same length.
 */
export function detectOriginTime(
  rawSamples: Array<RawSample>,
  filteredAccel: Array<number>,
): number {
  if (rawSamples.length === 0) return 0
  if (rawSamples.length !== filteredAccel.length) {
    throw new Error('rawSamples and filteredAccel must have the same length')
  }

  const threshold = -0.5
  const preEventBufferMs = 200

  let triggerIdx = -1
  for (let i = 0; i < rawSamples.length; i++) {
    if (filteredAccel[i] < threshold) {
      triggerIdx = i
      break
    }
  }

  if (triggerIdx === -1) return rawSamples[0].timeMs

  const triggerTime = rawSamples[triggerIdx].timeMs
  return Math.max(rawSamples[0].timeMs, triggerTime - preEventBufferMs)
}

/**
 * Find the time range around the first impact peak, starting from free fall.
 * Searches backward from the peak to find where free fall begins.
 * Uses ProcessedSample (requires accelFiltered).
 */
export function findFirstHitRange(samples: Array<ProcessedSample>): TimeRange | null {
  if (samples.length === 0) return null

  let peakVal = Number.NEGATIVE_INFINITY
  let peakIdx = -1

  // Find peak (> 10G threshold)
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i].accelFiltered
    if (v > 10 && v > peakVal) {
      peakVal = v
      peakIdx = i
    }
  }

  // No significant peak found - data may not contain an impact event
  if (peakIdx === -1) return null

  // Search backward from peak to find free fall start
  const FREE_FALL_THRESHOLD = -0.85
  const MAX_SEARCH_BACK_MS = 500
  const peakTimeMs = samples[peakIdx].timeMs
  const searchMinTime = peakTimeMs - MAX_SEARCH_BACK_MS

  let startIdx = peakIdx
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (samples[i].timeMs < searchMinTime) break
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      startIdx = i
      break
    }
  }

  // Search forward from peak until accel drops below -0.85 G (back to free fall)
  let endIdx = peakIdx
  for (let i = peakIdx + 1; i < samples.length; i++) {
    if (samples[i].accelFiltered < FREE_FALL_THRESHOLD) {
      endIdx = i
      break
    }
  }

  return {
    min: samples[startIdx].timeMs,
    max: samples[endIdx].timeMs,
  }
}
