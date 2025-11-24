export interface SamplePoint {
  timeMs: number
  accelRaw: number
  accelCFC: number | null
  jerkSG: number | null
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
  savitzkyGolay: {
    enabled: boolean
    windowSize: number
    polynomial: number
  }
  cfc: {
    enabled: boolean
    cfc: number
    order: number
    zeroPhase: boolean
  }
  jerk: {
    /**
     * Enable jerk computation and plotting.
     * Note: jerk is only computed when exactly one acceleration filter is enabled.
     */
    enabled: boolean
    windowSize: number
    polynomial: number
  }
}

export type AccelSeriesKey =
  | 'accelG'
  | 'accelSG'
  | 'accelMA'
  | 'accelButterworth'
  | 'accelNotch'
  | 'accelCFC'

export type RangeCommand = { type: 'full' } | { type: 'firstHit' } | null
