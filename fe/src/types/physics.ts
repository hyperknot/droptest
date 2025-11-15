export const G_CONST = 9.81

export type ProfileType = 'triangular' | 'trapezoidal'

export interface PhysicsInput {
  v0: number // impact speed (m/s)
  jerkG: number // jerk limit (G/s)
  maxG: number // max allowed G
}

export interface SamplePoint {
  t: number // seconds
  aG: number // acceleration in G
  v: number // velocity in m/s
  x: number // displacement in meters
}

export interface PhysicsResult {
  ok: boolean
  reason?: string
  profileType: ProfileType | null
  v0: number
  jerkG: number
  maxG: number

  jerk: number // m/s^3
  peakG: number
  peakA: number // m/s^2

  t1: number // ramp time (s)
  t2: number // plateau time (s)
  totalTime: number // total stop time (s)
  stopDistance: number // m

  gLimitReached: boolean
  timeOver38G: number // time spent over 38G (s)
  timeOver20G: number // time spent over 20G (s)

  hic15: number // Head Injury Criterion (15 ms window)
  hic36: number // Head Injury Criterion (36 ms window)

  samples: Array<SamplePoint>
}
