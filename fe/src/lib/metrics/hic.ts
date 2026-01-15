/**
 * Calculates the Head Injury Criterion (HIC) over a sliding window.
 *
 * HIC is defined as the maximum value of the following integral over any time interval of duration up to `windowMs` milliseconds:
 *
 * HIC = max_{t1, t2} [ (t2 - t1) * (1/(t2 - t1) * integral[t1 to t2] a(t) dt )^exponent ]
 *
 * where a(t) is the acceleration in G's.
 *
 * @param accelValues - Array of acceleration values in G's.
 * @param windowMs - Window size in milliseconds for HIC calculation.
 * @param sampleRate - Sampling rate Fs in Hz.
 * @param exponent - Exponent for HIC calculation (default 2.5 for standard HIC, configurable 1.0-3.5).
 * @returns Array<number> - HIC values, same length as input (with zeros where HIC cannot be computed).
 */
export function calculateHIC(
  accelValues: Array<number>,
  windowMs: number,
  sampleRate: number,
  exponent: number = 2.5,
): Array<number> {
  if (windowMs <= 0) {
    throw new Error(`windowMs must be > 0, got ${windowMs}`)
  }

  if (accelValues.length === 0) {
    throw new Error('accelValues array is empty')
  }

  const samplesInWindow = Math.round((windowMs / 1000) * sampleRate)
  const n = accelValues.length
  const hicValues = new Array<number>(n).fill(0)

  for (let i = 0; i < n; i++) {
    let maxHIC = 0

    for (let j = Math.max(0, i - samplesInWindow + 1); j <= i; j++) {
      const t1 = j / sampleRate
      const t2 = i / sampleRate
      const deltaT = t2 - t1

      if (deltaT <= 0) continue

      let integral = 0
      for (let k = j; k <= i; k++) {
        integral += accelValues[k]
      }
      integral /= i - j + 1 // Average acceleration over the interval

      const hic = deltaT * Math.pow(integral, exponent)
      if (hic > maxHIC) {
        maxHIC = hic
      }
    }

    hicValues[i] = maxHIC
  }

  return hicValues
}
