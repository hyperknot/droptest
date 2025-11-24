export interface SamplePoint {
  timeMs: number
  accelRaw: number
  accelFiltered: number | null
  jerkSG: number | null
}

export interface DropTestFile {
  filename: string
  sampleRateHz: number
  samples: Array<SamplePoint>
}

export interface AppConfig {
  cutoffHz: number // Hz
  jerkWindow: number // samples (odd)
  jerkPoly: number // polynomial order
}
