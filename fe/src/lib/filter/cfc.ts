// @ts-expect-error
import Fili from 'fili'

/**
 * CFC (Channel Frequency Class) low-pass filter per SAE J211/1 standard.
 * Zero-phase implementation using forward-backward (filtfilt) filtering.
 *
 * @see [SAE J211/1](https://law.resource.org/pub/us/cfr/ibr/005/sae.j211-1.1995.pdf)
 */
export function cfcFilter(
  samples: Array<number>,
  sampleRateHz: number,
  cfc: number,
): Array<number> {
  // CFC -> design frequency (Hz) per SAE J211/1
  // SAE factor: 2.0775; ISO alternative: 25/12 ≈ 2.0833
  const fDesignHz = 2.0775 * cfc

  const iirCalculator = new Fili.CalcCascades()
  const coeffs = iirCalculator.lowpass({
    order: 1, // 1 biquad == 2nd-order per pass
    characteristic: 'butterworth',
    Fs: sampleRateHz,
    Fc: fDesignHz,
    preGain: false,
  })

  // Forward pass (fresh state)
  const fwd = new Fili.IirFilter(coeffs)
  fwd.reinit()
  const yForward = fwd.multiStep(samples.slice(), false)

  // Backward pass (fresh state)
  const bwd = new Fili.IirFilter(coeffs)
  bwd.reinit()
  const yBackwardReversed = bwd.multiStep(yForward.slice().reverse(), false)

  return yBackwardReversed.reverse()
}
