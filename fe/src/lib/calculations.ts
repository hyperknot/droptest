import type { SamplePoint, Statistics } from '../types'

/**
 * Calculate statistics from sample points
 */
export function calculateStatistics(samples: Array<SamplePoint>): Statistics {
  if (samples.length === 0) {
    return {
      peakG: 0,
      totalTime: 0,
      timeOver38G: 0,
      timeOver20G: 0,
      hic15: 0,
      hic36: 0,
    }
  }

  // Find peak G
  const peakG = Math.max(...samples.map((s) => s.accelG))

  // Total time (from first to last sample)
  const totalTime = samples[samples.length - 1].timeMs - samples[0].timeMs

  // Calculate time over thresholds using trapezoidal integration
  const timeOver38G = calculateTimeOverThreshold(samples, 38)
  const timeOver20G = calculateTimeOverThreshold(samples, 20)

  // Calculate HIC
  const hic15 = computeHICWindow(samples, 15) // 15 ms
  const hic36 = computeHICWindow(samples, 36) // 36 ms

  return {
    peakG,
    totalTime,
    timeOver38G,
    timeOver20G,
    hic15,
    hic36,
  }
}

/**
 * Calculate time spent over a threshold using trapezoidal integration
 */
function calculateTimeOverThreshold(samples: Array<SamplePoint>, threshold: number): number {
  let totalTime = 0

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]
    const curr = samples[i]

    const dt = curr.timeMs - prev.timeMs
    if (dt <= 0) continue

    // Both points over threshold - count full interval
    if (prev.accelG >= threshold && curr.accelG >= threshold) {
      totalTime += dt
    }
    // One point over, one under - interpolate the crossing point
    else if (prev.accelG >= threshold || curr.accelG >= threshold) {
      const ratio = Math.abs(threshold - prev.accelG) / Math.abs(curr.accelG - prev.accelG)
      const partialTime = dt * (prev.accelG >= threshold ? 1 - ratio : ratio)
      totalTime += partialTime
    }
  }

  return totalTime
}

/**
 * Compute HIC over a given time window (in milliseconds)
 *
 * Uses the standard formula:
 *   HIC = max_{t1,t2} [ (t2 - t1) * (avg_a)^(2.5) ]
 * where avg_a is the average acceleration in G over [t1, t2].
 */
function computeHICWindow(samples: Array<SamplePoint>, windowMs: number): number {
  if (samples.length < 2 || windowMs <= 0) return 0

  const n = samples.length
  const times = samples.map((s) => s.timeMs)
  const accG = samples.map((s) => Math.max(s.accelG, 0)) // ensure non-negative

  // Build cumulative area under a(t) in G·ms using trapezoidal rule
  const areaPrefix = new Array<number>(n)
  areaPrefix[0] = 0

  for (let i = 1; i < n; i++) {
    const dt = times[i] - times[i - 1]
    if (dt <= 0) {
      areaPrefix[i] = areaPrefix[i - 1]
      continue
    }
    const avgA = 0.5 * (accG[i - 1] + accG[i])
    areaPrefix[i] = areaPrefix[i - 1] + avgA * dt
  }

  let maxHic = 0

  // Brute-force all windows [i, j] with duration <= windowMs
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dt = times[j] - times[i]
      if (dt <= 0) continue

      // If we've exceeded the window, break since times[] is increasing
      if (dt > windowMs) break

      const area = areaPrefix[j] - areaPrefix[i] // ∫ a(t) dt over [i, j] in G·ms
      if (area <= 0) continue

      const aAvg = area / dt // average acceleration in G over this window
      const hic = (dt / 1000) * aAvg ** 2.5 // convert dt to seconds for HIC formula

      if (hic > maxHic) maxHic = hic
    }
  }

  return maxHic
}
