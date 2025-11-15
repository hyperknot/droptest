export interface SamplePoint {
  timeMs: number // milliseconds from detected origin (first sample = 0)
  accelG: number // acceleration in G
  // datetime: string // original datetime string from CSV - NOT USED
  speed: number | null
  pos: number | null
  jerk: number | null
  accelFiltered: number | null
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
