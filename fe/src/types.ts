export interface SamplePoint {
  timeMs: number // time in milliseconds (from time0 * 1000)
  accelG: number // acceleration in G (from accel)
  datetime?: string // original datetime string from CSV

  // Derived from datetime
  datetimeMsFromStart?: number // ms since first sample's datetime

  // Other raw columns
  time0?: number // original time0 in seconds (centered on peak)
  speed?: number | null
  pos?: number | null
  jerk?: number | null
  accelFiltered?: number | null // filtered acceleration, in G
}

export interface FileMetadata {
  info: Array<string>
  date?: string
}

export interface DropTestData {
  filename: string
  samples: Array<SamplePoint>
  metadata: FileMetadata
}
