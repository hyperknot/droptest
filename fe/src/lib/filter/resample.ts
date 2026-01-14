import type { RawSample } from '../../types'

/**
 * Computes the median of an array of numbers.
 */
function median(arr: Array<number>): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Linear interpolation between two points.
 */
function lerp(t: number, t0: number, t1: number, v0: number, v1: number): number {
  const alpha = (t - t0) / (t1 - t0)
  return v0 + alpha * (v1 - v0)
}

export interface ResampleResult {
  samples: Array<RawSample>
  sampleRateHz: number
  medianDtMs: number
}

/**
 * Resample variable-rate RawSample[] to uniform time grid using linear interpolation.
 *
 * - Uses median dt from input data to determine sample rate
 * - Creates uniform time grid from first to last timestamp
 * - Linear interpolates acceleration values onto uniform grid
 * - Output contains exactly uniform dt between all samples (no gaps, no duplicates)
 */
export function resampleToUniform(samples: Array<RawSample>): ResampleResult {
  if (samples.length < 2) {
    return {
      samples: [...samples],
      sampleRateHz: 1000,
      medianDtMs: 1,
    }
  }

  // Sort by time (should already be sorted, but ensure)
  const sorted = [...samples].sort((a, b) => a.timeMs - b.timeMs)

  // Compute all positive time deltas
  const deltas: Array<number> = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const dt = sorted[i + 1].timeMs - sorted[i].timeMs
    if (dt > 0) {
      deltas.push(dt)
    }
  }

  if (deltas.length === 0) {
    // All samples have identical timestamps
    return {
      samples: [sorted[0]],
      sampleRateHz: 1000,
      medianDtMs: 1,
    }
  }

  // Use median dt for uniform sample rate
  const medianDtMs = median(deltas)
  const sampleRateHz = 1000 / medianDtMs

  // Build uniform time grid
  const t0 = sorted[0].timeMs
  const tEnd = sorted[sorted.length - 1].timeMs
  const totalDuration = tEnd - t0

  // Number of samples in output (round to ensure we cover the full range)
  const numSamples = Math.round(totalDuration / medianDtMs) + 1

  const resampled: Array<RawSample> = []

  // Track position in original sorted array for interpolation
  let srcIdx = 0

  for (let i = 0; i < numSamples; i++) {
    const targetTime = t0 + i * medianDtMs

    // Advance srcIdx to find the interval containing targetTime
    while (srcIdx < sorted.length - 1 && sorted[srcIdx + 1].timeMs < targetTime) {
      srcIdx++
    }

    let accelValue: number

    if (srcIdx >= sorted.length - 1) {
      // Beyond last point - use last value
      accelValue = sorted[sorted.length - 1].accelRaw
    } else if (targetTime <= sorted[0].timeMs) {
      // Before first point - use first value
      accelValue = sorted[0].accelRaw
    } else {
      // Linear interpolation between sorted[srcIdx] and sorted[srcIdx + 1]
      const p0 = sorted[srcIdx]
      const p1 = sorted[srcIdx + 1]

      if (p0.timeMs === p1.timeMs) {
        // Duplicate timestamps - use average
        accelValue = (p0.accelRaw + p1.accelRaw) / 2
      } else {
        accelValue = lerp(targetTime, p0.timeMs, p1.timeMs, p0.accelRaw, p1.accelRaw)
      }
    }

    resampled.push({
      timeMs: targetTime,
      accelRaw: accelValue,
    })
  }

  return {
    samples: resampled,
    sampleRateHz,
    medianDtMs,
  }
}
