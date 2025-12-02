import type { SamplePoint } from '../../types'

export interface TimeRange {
  min: number
  max: number
}

/**
 * Estimate sample rate from time series data.
 * @throws Error if fewer than 10 points or zero time delta.
 */
export function estimateSampleRateHz(points: Array<{ timeMs: number }>): number {
  if (points.length < 10) {
    throw new Error(`Need at least 10 points to estimate sample rate, got ${points.length}`)
  }

  // Average the first few deltas for stability
  const limit = Math.min(points.length - 1, 10)
  let sumDt = 0
  for (let i = 0; i < limit; i++) {
    sumDt += points[i + 1].timeMs - points[i].timeMs
  }
  const avgDt = sumDt / limit

  if (avgDt === 0) {
    throw new Error('Average time delta is zero - cannot estimate sample rate')
  }

  return Math.round(1000 / avgDt)
}

/**
 * Detects where the "event" starts (origin time) based on free-fall logic.
 * Uses filtered acceleration for reliable detection.
 * Looks for first point with accel < -0.5g (freefall indicator).
 */
export function detectOriginTime(data: Array<{ timeMs: number; accel: number }>): number {
  if (data.length === 0) return 0

  const threshold = -0.5
  const preEventBufferMs = 200

  // With filtered data, first crossing is reliable - no sustained check needed
  const triggerIdx = data.findIndex((d) => d.accel < threshold)
  if (triggerIdx === -1) return data[0].timeMs

  return Math.max(data[0].timeMs, data[triggerIdx].timeMs - preEventBufferMs)
}

/**
 * Find the time range around the first impact peak.
 * Uses filtered acceleration data.
 * @throws Error if filtered data is not available.
 */
export function findFirstHitRange(samples: Array<SamplePoint>): TimeRange | null {
  if (samples.length === 0) return null

  for (let i = 0; i < samples.length; i++) {
    if (samples[i].accelFiltered == null) {
      throw new Error(`Sample at index ${i} is missing filtered acceleration data`)
    }
  }

  let peakVal = Number.NEGATIVE_INFINITY
  let peakIdx = -1

  // Find peak (> 10G threshold)
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i].accelFiltered!
    if (v > 10 && v > peakVal) {
      peakVal = v
      peakIdx = i
    }
  }

  // No significant peak found - data may not contain an impact event
  if (peakIdx === -1) return null

  const t = samples[peakIdx].timeMs
  const dataStart = samples[0].timeMs
  const dataEnd = samples[samples.length - 1].timeMs

  return {
    min: Math.max(dataStart, t - 50),
    max: Math.min(dataEnd, t + 100),
  }
}
