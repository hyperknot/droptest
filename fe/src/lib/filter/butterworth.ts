// @ts-expect-error
import Fili from 'fili'

import type { SamplePoint } from '../../types'

/**
 * Zero-phase Butterworth low-pass filter for accelerometer data (JS/Fili).
 *
 * Design choices in this JS/Fili implementation:
 * ----------------------------------------------
 * - Family: Butterworth IIR, low-pass
 * - Digital order per pass: 2nd-order (one biquad in Fili).
 *   - SciPy: butter(N=2, ...)  → 2nd-order filter.
 *   - Fili:  CalcCascades().lowpass({ order: 1, ... }) → one biquad → 2nd order.
 *   - After forward + backward (filtfilt), effective magnitude order is 4th.
 *
 * - Cutoff frequency:
 *   - Input: cutoffHz [Hz], with 0 < cutoffHz < sampleRate/2.
 *   - SciPy: uses Wn=cutoff_hz, fs=sample_rate (no CFC or analog scaling).
 *   - Fili:  we pass Fc = cutoffHz, Fs = sampleRate (same physical meaning).
 *
 * - Nyquist safety:
 *   - Mathematically, the requirement is cutoffHz < sampleRate/2.
 *   - Fili’s bilinear-style design can become numerically unstable very close
 *     to Nyquist, so we add a small safety margin:
 *
 *       cutoffHz must satisfy:
 *         0 < cutoffHz < 0.95 * (sampleRate / 2)
 *
 *   - If this condition is violated, we THROW an Error instead of silently
 *     clamping the cutoff.
 *
 * - preGain:
 *   - We use preGain: true in CalcCascades().lowpass(...).
 *   - For lowpass/highpass Butterworth filters, this does NOT change the
 *     transfer function; it only splits the overall gain between:
 *       - stage.k   (scalar gain per biquad)
 *       - stage.b[] (normalized numerator coefficients)
 *   - In other words, it’s purely an internal normalization choice, kept
 *     for numerical convenience and consistency with Fili’s tests.
 *
 * - Zero-phase:
 *   - We call Fili’s IirFilter.filtfilt(raw), which applies the same
 *     2nd-order Butterworth section forward and then backward to achieve
 *     approximate zero-phase and a 4th-order magnitude roll-off.
 *   - SciPy’s filtfilt uses extra padding + special initial conditions;
 *     Fili’s filtfilt is simpler (no padding), so the interior of long
 *     signals matches SciPy very closely, while the first/last few samples
 *     may differ slightly.
 *
 * Cross-lab reproducibility:
 * --------------------------
 * Labs that use Python/SciPy should implement this filter exactly as:
 *
 *     from scipy.signal import butter, filtfilt
 *
 *     b, a = butter(
 *         N=2,
 *         Wn=cutoff_hz,
 *         btype="low",
 *         fs=sample_rate,
 *     )
 *
 *     filtered = filtfilt(b, a, accel_array)
 *
 * Parameters:
 * -----------
 * @param samples
 *   Array of sample objects. Each must have:
 *     - accelRaw: number   // raw acceleration at this time step
 *
 * @param cutoffHz
 *   The digital design cutoff frequency Fc in Hz.
 *   Must satisfy:
 *     0 < cutoffHz < 0.95 * (sampleRate / 2)
 *
 * @param sampleRate
 *   Sampling rate Fs in Hz.
 *
 * Returns:
 * --------
 * @returns Array<number>
 *   Filtered acceleration values, same length as `samples`, zero-phase
 *   (forward + backward), suitable to overlay directly on the raw curve.
 *
 */

export function butterworthZeroPhaseAccel(
  samples: Array<SamplePoint>,
  cutoffHz: number,
  sampleRate: number,
): Array<number> {
  if (cutoffHz <= 0) {
    throw new Error(`cutoffHz must be > 0 Hz, got ${cutoffHz}`)
  }

  const nyquist = sampleRate / 2
  const maxCutoff = nyquist * 0.95

  if (cutoffHz >= maxCutoff) {
    throw new Error(
      `cutoffHz (${cutoffHz}) is too close to Nyquist (${nyquist} Hz). ` +
        `It must be < 0.95 * Nyquist = ${maxCutoff} Hz.`,
    )
  }

  const iirCalculator = new Fili.CalcCascades()

  // order: 1 => one biquad => 2nd-order per pass, matching SciPy N=2
  const coeffs = iirCalculator.lowpass({
    order: 1,
    characteristic: 'butterworth',
    Fs: sampleRate,
    Fc: cutoffHz,
    preGain: true,
  })

  const raw = samples.map((s) => s.accelRaw)

  const filter = new Fili.IirFilter(coeffs)

  // Zero-phase: forward + backward (Fili’s filtfilt)
  const filtered = filter.filtfilt(raw)

  return filtered
}
