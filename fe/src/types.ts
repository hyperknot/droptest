export interface SamplePoint {
  timeMs: number
  accelRaw: number
  accelFiltered: number | null
  jerkSG: number | null
}
