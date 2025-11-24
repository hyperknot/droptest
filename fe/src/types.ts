export interface SamplePoint {
  timeMs: number
  accelRaw: number
  accelCFC: number | null
  jerkSG: number | null
}

export interface DropTestFile {
  filename: string
  sampleRateHz: number
  samples: Array<SamplePoint>
}

export interface AppConfig {
  cfc: number // Hz
  jerkWindow: number // samples (odd)
  jerkPoly: number // polynomial order
}
