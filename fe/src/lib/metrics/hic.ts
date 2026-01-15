/**
 * Calculates the Head Injury Criterion (HIC) over a sliding window and returns a single value.
 *
 * Continuous definition:
 *   HIC = max_{t1,t2 : 0 < (t2-t1) <= T} (t2 - t1) * ( (1/(t2-t1)) * ∫[t1..t2] a(t) dt )^exponent
 *
 * Discrete-time approximation used here (piecewise-constant per sample):
 * - Sampling period: dt = 1 / Fs.
 * - For an interval of N samples [start..end] (inclusive):
 *     duration Δt = N * dt
 *     mean accel   = (1/N) * Σ a[k]
 *     HIC interval = Δt * (mean accel)^exponent
 *
 * IMPORTANT about input:
 * - Standard HIC uses acceleration magnitude (resultant) in G (non-negative).
 * - If you only have a signed single-axis signal (e.g., vertical axis that may be negative
 *   depending on sensor orientation), convert it to a magnitude first (e.g., abs or resultant)
 *   BEFORE calling this function.
 *
 * @param accelValues - Array of acceleration values in G's (typically non-negative magnitude).
 * @param windowMs - Max window duration in milliseconds (e.g. 15 for HIC15, 36 for HIC36).
 * @param sampleRate - Sampling rate Fs in Hz (constant sample rate).
 * @param exponent - Exponent for HIC calculation (default 2.5).
 * @returns HIC scalar (single maximum over the entire signal).
 */
export function calculateHIC(
  accelValues: Array<number>,
  windowMs: number,
  sampleRate: number,
  exponent = 2.5,
): number {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(`windowMs must be a finite number > 0, got ${windowMs}`)
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`sampleRate must be a finite number > 0, got ${sampleRate}`)
  }
  if (!Number.isFinite(exponent) || exponent <= 0) {
    throw new Error(`exponent must be a finite number > 0, got ${exponent}`)
  }
  if (accelValues.length === 0) {
    throw new Error('accelValues array is empty')
  }

  const n = accelValues.length
  const dt = 1 / sampleRate

  // Max samples allowed in an interval. Use floor so we never exceed windowMs.
  // Ensure at least 1 sample so we can compute something.
  const maxN = Math.max(1, Math.floor((windowMs / 1000) * sampleRate))

  // Prefix sums for O(1) interval sum queries.
  // prefix[i] = sum of accelValues[0..i-1]
  const prefix = new Array<number>(n + 1)
  prefix[0] = 0
  for (let i = 0; i < n; i++) {
    const aSigned = accelValues[i]
    if (!Number.isFinite(aSigned)) {
      throw new Error(`accelValues contains non-finite value at index ${i}: ${aSigned}`)
    }

    // HIC uses acceleration magnitude (non-negative).
    // If caller provides a signed 1-axis signal, convert to magnitude here.
    const aMag = Math.abs(aSigned)
    prefix[i + 1] = prefix[i] + aMag
  }

  let globalMaxHIC = 0

  // O(n * maxN)
  for (let end = 0; end < n; end++) {
    const startMin = Math.max(0, end - maxN + 1)

    for (let start = startMin; start <= end; start++) {
      const N = end - start + 1
      const sum = prefix[end + 1] - prefix[start]
      const mean = sum / N
      const deltaT = N * dt

      const hic = deltaT * mean ** exponent
      if (hic > globalMaxHIC) globalMaxHIC = hic
    }
  }

  return globalMaxHIC
}
