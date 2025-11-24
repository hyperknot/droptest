import type { SamplePoint } from '../../types'

export interface TimeRange {
  min: number
  max: number
}

export function estimateSampleRateHz(points: Array<{ timeMs: number }>): number {
  if (points.length < 2) return 1000
  // Average the first few deltas for stability
  const limit = Math.min(points.length - 1, 10)
  let sumDt = 0
  for (let i = 0; i < limit; i++) {
    sumDt += points[i + 1].timeMs - points[i].timeMs
  }
  const avgDt = sumDt / limit
  return avgDt > 0 ? Math.round(1000 / avgDt) : 1000
}

/**
 * Detects where the "event" starts (origin time) based on free-fall logic.
 * Looks for sustained < -0.5g.
 */
export function detectOriginTime(raw: Array<{ timeMs: number; accel: number }>): number {
  const threshold = -0.5
  const durationMs = 100
  const preEventBufferMs = 200

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].accel >= threshold) continue

    // Potential trigger, check if sustained
    const startT = raw[i].timeMs
    const endT = startT + durationMs

    // Quick look ahead
    let sustained = true
    for (let k = i; k < raw.length; k++) {
      if (raw[k].timeMs > endT) break
      if (raw[k].accel >= threshold) {
        sustained = false
        break
      }
    }

    if (sustained) {
      return Math.max(0, startT - preEventBufferMs)
    }
  }
  return 0
}

export function findFirstHitRange(samples: Array<SamplePoint>): TimeRange | null {
  // Use filtered accel for detection if available, otherwise raw
  const data = samples.map((s) => ({
    t: s.timeMs,
    v: s.accelFiltered ?? s.accelRaw,
  }))

  let peakVal = Number.NEGATIVE_INFINITY
  let peakIdx = -1

  // Find peak (> 10G)
  for (let i = 0; i < data.length; i++) {
    if (data[i].v > 10 && data[i].v > peakVal) {
      peakVal = data[i].v
      peakIdx = i
    }
  }

  if (peakIdx === -1) return null

  const t = data[peakIdx].t
  return {
    min: Math.max(0, t - 50),
    max: t + 100,
  }
}
