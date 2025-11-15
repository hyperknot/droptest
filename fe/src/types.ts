export interface SamplePoint {
  timeMs: number // milliseconds from detected origin (first sample after origin = 0)

  // Raw acceleration from CSV (already in G units)
  accelG: number

  // Kinematic quantities from CSV (if present)
  speed: number | null
  pos: number | null
  jerk: number | null

  // Original factory/logger-provided filtered acceleration from CSV
  accelFactoryFiltered: number | null

  // User-configurable filtered series
  accelFiltered: number | null // Savitzky–Golay main
  accelSGShort: number | null // (unused in new UI)
  accelSGFull: number | null // Savitzky–Golay strong
  accelMA9: number | null // Moving average

  // Butterworth filters (repurposed slots)
  accelLPEnvLight: number | null // Butterworth LP #1
  accelLPEnvMedium: number | null // Butterworth LP #2
  accelLPEnvStrong: number | null // Notch / band-stop

  // Crash filters
  accelCFC60: number | null
  accelCFC180: number | null

  // Derived acceleration from kinematic quantities
  accelFromSpeed: number | null // dv/dt
  accelFromPos: number | null // d²x/dt²
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

export interface FilterConfig {
  sg: {
    enabled: boolean
    windowSize: number
    polynomial: number
  }
  sgFull: {
    enabled: boolean
    windowSize: number
    polynomial: number
  }
  movingAverage: {
    enabled: boolean
    windowSize: number
  }
  butterworth1: {
    enabled: boolean
    cutoffHz: number
    order: number
    zeroPhase: boolean
  }
  butterworth2: {
    enabled: boolean
    cutoffHz: number
    order: number
    zeroPhase: boolean
  }
  notch: {
    enabled: boolean
    centerHz: number
    bandwidthHz: number
    order: number
    zeroPhase: boolean
  }
  cfc60: {
    enabled: boolean
    cfc: number
    order: number
    zeroPhase: boolean
  }
  cfc180: {
    enabled: boolean
    cfc: number
    order: number
    zeroPhase: boolean
  }
}

export type RangeCommand = { type: 'full' } | { type: 'firstHit' } | null
