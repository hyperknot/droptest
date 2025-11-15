export interface SamplePoint {
  timeMs: number
  accelG: number
  speed: number | null
  pos: number | null
  jerk: number | null
  accelFactoryFiltered: number | null
  accelFromSpeed: number | null
  accelFromPos: number | null

  accelSG: number | null
  accelMA: number | null
  accelButterworth: number | null
  accelNotch: number | null
  accelCFC: number | null
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
  movingAverage: {
    enabled: boolean
    windowSize: number
  }
  butterworth: {
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
  cfc: {
    enabled: boolean
    cfc: number
    order: number
    zeroPhase: boolean
  }
}

export type RangeCommand = { type: 'full' } | { type: 'firstHit' } | null
