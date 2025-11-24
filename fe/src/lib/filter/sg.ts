import savitzkyGolay from 'ml-savitzky-golay'
import type { SamplePoint } from '../../types'

/**
 * Savitzky-Golay differentiator (Jerk) for accelerometer data (JS/ml-savitzky-golay).
 *
 * Design choices in this implementation:
 * --------------------------------------
 * - Algorithm: Savitzky-Golay smoothing and differentiation filter.
 * - Goal: Calculate Jerk (derivative=1 of acceleration).
 *
 * - Window Size (Time-based):
 *   - Input: windowMs [ms].
 *   - Conversion: windowSize = round((windowMs / 1000) * sampleRate).
 *   - Constraint: Must be ODD (SG requirement).
 *
 * - Edge Handling (Padding):
 *   - Goal: Keep output array length equal to input length (alignment).
 *   - Goal: Minimize artifacts at t=0 that mess up chart auto-scaling.
 *   - JS Config: pad: 'post', padValue: 'replicate'.
 *     - This calculates the filter for the valid internal range, then fills
 *       the start/end with the nearest calculated value.
 *     - This avoids calculating derivatives on "reflected" data which often
 *       creates massive, fake spikes at index 0.
 *
 * Cross-lab reproducibility:
 * --------------------------
 * Labs that use Python/SciPy should implement this filter as:
 *
 *     from scipy.signal import savgol_filter
 *
 *     # 1. Calculate window size (must be odd)
 *     window_samples = int(round((window_ms / 1000) * sample_rate))
 *     if window_samples % 2 == 0:
 *         window_samples += 1
 *
 *     # 2. Calculate Jerk
 *     # mode='nearest' matches JS 'replicate' behavior
 *     jerk = savgol_filter(
 *         accel_array,
 *         window_length=window_samples,
 *         polyorder=poly_order,
 *         deriv=1,
 *         delta=1.0/sample_rate,
 *         mode='nearest'
 *     )
 *
 * Parameters:
 * -----------
 * @param samples
 *   Array of sample objects.
 *
 * @param windowMs
 *   The filter window size in milliseconds.
 *
 * @param polyOrder
 *   The order of the polynomial fit (typically 3).
 *
 * @param sampleRate
 *   Sampling rate Fs in Hz.
 *
 * Returns:
 * --------
 * @returns Array<number>
 *   Calculated Jerk values, same length as `samples`.
 */
export function sgFilter(
  samples: Array<SamplePoint>,
  windowMs: number,
  polyOrder: number,
  sampleRate: number,
): Array<number> {
  // 1. Convert Time window to Sample window
  if (windowMs <= 0) {
    throw new Error(`windowMs must be > 0, got ${windowMs}`)
  }

  const samplesInWindow = (windowMs / 1000) * sampleRate
  let win = Math.round(samplesInWindow)

  // 2. Enforce odd window size
  if (win % 2 === 0) win += 1

  // 3. Enforce library constraints
  if (win < 5) win = 5

  // 4. Validate constraints against Polynomial
  if (polyOrder >= win) {
    throw new Error(
      `PolyOrder (${polyOrder}) must be less than window size (${win}). ` +
        `Increase windowMs (${windowMs}ms) or reduce polyOrder.`,
    )
  }

  const dt = 1 / sampleRate

  // Use filtered data if available (cascading filters), otherwise raw
  const values = samples.map((s) => s.accelFiltered ?? s.accelRaw)

  // 4. Run Filter
  // pad: 'post' combined with 'replicate' ensures sample 0 matches sample n
  // where n is the first valid calculation, avoiding start-up spikes.
  const deriv = savitzkyGolay(values, dt, {
    windowSize: win,
    polynomial: polyOrder,
    derivative: 1,
    pad: 'post',
    padValue: 'replicate',
  })

  return deriv
}
