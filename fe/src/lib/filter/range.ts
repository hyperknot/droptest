import type { ProcessedSample, RawSample } from '../../types'

export interface TimeRange {
  min: number
  max: number
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

  const dataEnd = samples[samples.length - 1].timeMs

  return {
    min: samples[startIdx].timeMs,
    max: Math.min(dataEnd, peakTimeMs + 100),
  }
}
