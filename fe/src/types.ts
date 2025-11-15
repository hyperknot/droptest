export interface SamplePoint {
  timeMs: number // time in milliseconds
  accelG: number // acceleration in G
  datetime?: string // optional datetime string
}

export interface Statistics {
  peakG: number
  totalTime: number // ms
  timeOver38G: number // ms
  timeOver20G: number // ms
  hic15: number
  hic36: number
}

export interface FileMetadata {
  info: Array<string>
  date?: string
}

export interface DropTestData {
  filename: string
  samples: Array<SamplePoint>
  metadata: FileMetadata
  statistics: Statistics
}
