import type { SamplePoint } from '../../types'

export function estimateSampleRateHz(samples: Array<SamplePoint>): number | null {
  if (samples.length < 2) return null
  const dt = samples[1].timeMs - samples[0].timeMs
  if (!Number.isFinite(dt) || dt <= 0) return null
  return 1000 / dt
}
