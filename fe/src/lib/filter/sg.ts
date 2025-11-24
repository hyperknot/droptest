import savitzkyGolay from 'ml-savitzky-golay'

/**
 * Savitzky-Golay filter for accelerometer data (JS/ml-savitzky-golay).
 *
 * Design choices in this implementation:
 * --------------------------------------
 * - Algorithm: Savitzky-Golay smoothing and differentiation filter.
 * - Goal: Calculate derivative of acceleration (e.g., Jerk when derivative=1).
 *
 * - Window Size (Time-based):
 *   - Input: windowMs [ms].
 *   - Conversion: windowSize = round((windowMs / 1000) * sampleRate).
 *   - Constraint: Must be ODD (SG requirement), minimum 5 points.
 *
 * - Edge Handling (Padding):
 *   - JS Config: pad: 'post', padValue: 'replicate'.
 *     - This calculates the filter for the valid internal range, then fills
 *       the start/end with the nearest calculated value.
 *     - Avoids calculating derivatives on "reflected" data which often
 *       creates massive, fake spikes at index 0.
 *
 * Cross-lab reproducibility:
 * --------------------------
 * Labs that use Python/SciPy should implement this filter as:
 *
 *     from scipy.signal import savgol_filter
 *
 *     window_samples = int(round((window_ms / 1000) * sample_rate))
 *     if window_samples % 2 == 0:
 *         window_samples += 1
 *     if window_samples < 5:
 *         window_samples = 5
 *
 *     jerk = savgol_filter(
 *         accel_array,
 *         window_length=window_samples,
 *         polyorder=poly_order,
 *         deriv=derivative,
 *         delta=1.0/sample_rate,
 *         mode='nearest'
 *     )
 *
 * Parameters:
 * -----------
 * @param accelValues - Array of acceleration values (must be filtered, not raw).
 * @param windowMs - Filter window size in milliseconds.
 * @param polyOrder - Order of the polynomial fit.
 * @param sampleRate - Sampling rate Fs in Hz.
 * @param derivative - Derivative order (0=smooth, 1=first derivative/jerk, etc.).
 *
 * @returns Array<number> - Calculated values, same length as input.
 */
export function sgFilter(
  accelValues: Array<number>,
  windowMs: number,
  polyOrder: number,
  sampleRate: number,
  derivative: number,
): Array<number> {
  if (windowMs <= 0) {
    throw new Error(`windowMs must be > 0, got ${windowMs}`)
  }

  if (accelValues.length === 0) {
    throw new Error('accelValues array is empty')
  }

  // Check for any null/undefined/NaN values
  for (let i = 0; i < accelValues.length; i++) {
    if (accelValues[i] == null || Number.isNaN(accelValues[i])) {
      throw new Error(`accelValues contains invalid value at index ${i}`)
    }
  }

  // Convert time window to sample window
  const samplesInWindow = (windowMs / 1000) * sampleRate
  let win = Math.round(samplesInWindow)

  // Enforce odd window size
  if (win % 2 === 0) win += 1

  // Enforce minimum window size
  if (win < 5) win = 5

  // Validate polynomial order constraint
  if (polyOrder >= win) {
    throw new Error(
      `polyOrder (${polyOrder}) must be less than window size (${win}). ` +
        `Increase windowMs (${windowMs}ms) or reduce polyOrder.`,
    )
  }

  const dt = 1 / sampleRate

  // Run filter with post-padding to avoid edge spikes
  return savitzkyGolay(accelValues, dt, {
    windowSize: win,
    polynomial: polyOrder,
    derivative,
    pad: 'post',
    padValue: 'replicate',
  })
}
