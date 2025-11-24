// @ts-expect-error
import Fili from 'fili'

/**
 * Zero-phase Butterworth low-pass filter for accelerometer data (JS/Fili).
 *
 * Design choices in this JS/Fili implementation:
 * ----------------------------------------------
 * - Family: Butterworth IIR, low-pass
 * - Digital order per pass: Configurable via `order` parameter.
 *   - order=1 → one biquad → 2nd-order per pass (matches SciPy N=2).
 *   - After forward + backward (filtfilt), effective magnitude order is doubled.
 *
 * - Cutoff frequency:
 *   - Input: cutoffHz [Hz], with 0 < cutoffHz < sampleRate/2.
 *   - Fili: we pass Fc = cutoffHz, Fs = sampleRate (same physical meaning as SciPy).
 *
 * - Nyquist safety:
 *   - Mathematically, the requirement is cutoffHz < sampleRate/2.
 *   - Fili's bilinear-style design can become numerically unstable very close
 *     to Nyquist, so we add a small safety margin:
 *
 *       cutoffHz must satisfy:
 *         0 < cutoffHz < 0.95 * (sampleRate / 2)
 *
 *   - If this condition is violated, we THROW an Error.
 *
 * - preGain:
 *   - We use preGain: true in CalcCascades().lowpass(...).
 *   - For lowpass Butterworth filters, this is purely an internal normalization choice.
 *
 * - Zero-phase:
 *   - We call Fili's IirFilter.filtfilt(raw), which applies the filter
 *     forward and backward to achieve approximate zero-phase.
 *
 * Cross-lab reproducibility:
 * --------------------------
 * Labs that use Python/SciPy should implement this filter exactly as:
 *
 *     from scipy.signal import butter, filtfilt
 *
 *     b, a = butter(N=2, Wn=cutoff_hz, btype="low", fs=sample_rate)
 *     filtered = filtfilt(b, a, accel_array)
 *
 * Parameters:
 * -----------
 * @param accelValues - Array of raw acceleration values.
 * @param cutoffHz - Digital design cutoff frequency Fc in Hz.
 * @param sampleRate - Sampling rate Fs in Hz.
 * @param order - Fili cascade order (1 = one biquad = 2nd-order, matching SciPy N=2).
 *
 * @returns Array<number> - Filtered acceleration values, same length as input.
 */
export function butterworthFilter(
  accelValues: Array<number>,
  cutoffHz: number,
  sampleRate: number,
  order: number,
): Array<number> {
  if (cutoffHz <= 0) {
    throw new Error(`cutoffHz must be > 0 Hz, got ${cutoffHz}`)
  }

  const nyquist = sampleRate / 2
  const maxCutoff = nyquist * 0.95

  if (cutoffHz >= maxCutoff) {
    throw new Error(
      `cutoffHz (${cutoffHz}) is too close to Nyquist (${nyquist} Hz). ` +
        `It must be < 0.95 * Nyquist = ${maxCutoff.toFixed(1)} Hz.`,
    )
  }

  if (order < 1) {
    throw new Error(`order must be >= 1, got ${order}`)
  }

  const iirCalculator = new Fili.CalcCascades()

  const coeffs = iirCalculator.lowpass({
    order,
    characteristic: 'butterworth',
    Fs: sampleRate,
    Fc: cutoffHz,
    preGain: true,
  })

  const filter = new Fili.IirFilter(coeffs)

  // Zero-phase: forward + backward (Fili's filtfilt)
  return filter.filtfilt(accelValues)
}
