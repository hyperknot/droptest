export interface RawSample {
  timeMs: number
  accelRaw: number
}

export interface ProcessedSample {
  timeMs: number
  accelRaw: number
  accelFiltered: number
  jerkSG: number
}
