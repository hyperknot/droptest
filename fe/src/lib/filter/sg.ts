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
 *   - Reason: Standardizes smoothing strength across different sample rates.
 *   - Conversion: windowSize = round((windowMs / 1000) * sampleRate).
 *   - Constraint: Must be ODD. We automatically increment if even.
 *   - Constraint: Must be > polyOrder.
 *
 * - Derivative:
 *   - We calculate the 1st derivative of the Acceleration, which is Jerk.
 *   - Units: result is in [InputUnit]/s (e.g., g/s or m/s^3).
 *
 * - Edge Handling (Padding):
 *   - SciPy default: mode='interp' (polynomial extrapolation at edges).
 *   - JS Lib default: No padding (returns shorter array).
 *   - This impl: uses pad='post' with padValue='replicate'.
 *     - This preserves the array length (matching SciPy shape).
 *     - Effectively mimics SciPy's mode='nearest' at the edges.
 *     - We choose 'replicate' over 'symmetric' to avoid ringing artefacts
 *       at the start/end of motion events.
 *
 * Cross-lab reproducibility:
 * --------------------------
 * Labs that use Python/SciPy should implement this filter as:
 *
 *     from scipy.signal import savgol_filter
 *     import numpy as np
 *
 *     # 1. Convert ms to samples, ensuring odd length
 *     window_samples = int(round((window_ms / 1000) * sample_rate))
 *     if window_samples % 2 == 0:
 *         window_samples += 1
 *
 *     # 2. Calculate Jerk (deriv=1) with valid delta (dt)
 *     dt = 1.0 / sample_rate
 *
 *     jerk = savgol_filter(
 *         accel_array,
 *         window_length=window_samples,
 *         polyorder=poly_order,
 *         deriv=1,
 *         delta=dt,
 *         mode='nearest'  # Matches JS 'replicate' padding
 *     )
 *
 * Parameters:
 * -----------
 * @param samples
 *   Array of sample objects.
 *
 * @param windowMs
 *   The filter window size in milliseconds.
 *   Larger windows = smoother data but less time resolution.
 *
 * @param polyOrder
 *   The order of the polynomial to fit (e.g., 2 or 3).
 *   Must be less than the calculated window sample size.
 *
 * @param sampleRate
 *   Sampling rate Fs in Hz.
 *
 * Returns:
 * --------
 * @returns Array<number>
 *   Calculated Jerk values, same length as `samples`.
 */
export function calculateJerkSG(
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

  // 2. Enforce odd window size (SG requirement)
  if (win % 2 === 0) {
    win += 1
  }

  // 3. Enforce library constraints (ml-savitzky-golay requires >= 5 usually)
  // We clamp low values to 5 to prevent library crashes on very short windows,
  // provided polyOrder fits.
  if (win < 5) win = 5

  // 4. Validate constraints against Polynomial
  if (polyOrder >= win) {
    throw new Error(
      `PolyOrder (${polyOrder}) must be less than effective window size (${win} samples). ` +
        `Given windowMs=${windowMs}ms @ ${sampleRate}Hz resulted in too few samples. ` +
        'Increase windowMs or decrease polyOrder.',
    )
  }

  const dt = 1 / sampleRate

  // Use filtered data if available (cascading filters), otherwise raw
  const values = samples.map((s) => s.accelFiltered ?? s.accelRaw)

  // 5. Execute Filter
  // mapped to: savgol_filter(x, win, poly, deriv=1, delta=dt, mode='nearest')
  const deriv = savitzkyGolay(values, dt, {
    windowSize: win,
    polynomial: polyOrder,
    derivative: 1, // Calculate Jerk
    pad: 'post', // Pad output to match input length
    padValue: 'replicate', // Nearest neighbor padding (closest to SciPy 'nearest')
  })

  return deriv
}
