import savitzkyGolay from 'ml-savitzky-golay'
import type { AccelSeriesKey, SamplePoint } from '../../types'
import { estimateSampleRateHz } from './utils'

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
 * Compute jerk (time derivative of acceleration) from a single acceleration
 * series using a Savitzky–Golay differentiating filter.
 *
 * Result is in g / s (accel in g, time in seconds).
 */
export function computeJerkSavitzkyGolayFromAccel(
  samples: Array<SamplePoint>,
  accelKey: AccelSeriesKey,
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

  const sampleRateHz = estimateSampleRateHz(samples) ?? 1000
  const h = 1 / sampleRateHz // seconds per sample

  const values = samples.map((s) => {
    const v = s[accelKey]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  })

  const options = {
    windowSize: windowSizeSamples,
    polynomial,
    derivative: 1,
  }

  const jerk: Array<number> = savitzkyGolay(values, h, options)
  return jerk
}
