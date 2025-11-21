import type { SamplePoint } from '../types'

export interface SeriesConfig {
  key: keyof SamplePoint
  displayName: string
  color: string
  accessor: (s: SamplePoint) => number | null | undefined
  group: 'accel' | 'speed' | 'position' | 'jerk'
}

export const BASE_SERIES_CONFIG: Array<SeriesConfig> = [
  {
    key: 'accelG',
    displayName: 'Accel raw',
    color: '#2563eb',
    accessor: (s) => s.accelG,
    group: 'accel',
  },
  {
    key: 'accelFactoryFiltered',
    displayName: 'Accel CSV filtered',
    color: '#6366f1',
    accessor: (s) => s.accelFactoryFiltered,
    group: 'accel',
  },
  {
    key: 'speed',
    displayName: 'Speed',
    color: '#16a34a',
    accessor: (s) => s.speed,
    group: 'speed',
  },
  {
    key: 'pos',
    displayName: 'Position',
    color: '#a855f7',
    accessor: (s) => s.pos,
    group: 'position',
  },
  {
    key: 'jerk',
    displayName: 'Jerk',
    color: '#f97316',
    accessor: (s) => s.jerk,
    group: 'jerk',
  },
  {
    key: 'accelFromSpeed',
    displayName: 'Accel from speed',
    color: '#db2777',
    accessor: (s) => s.accelFromSpeed,
    group: 'accel',
  },
  {
    key: 'accelFromPos',
    displayName: 'Accel from position',
    color: '#c026d3',
    accessor: (s) => s.accelFromPos,
    group: 'accel',
  },
]

export const FILTER_SERIES_CONFIG: Array<SeriesConfig> = [
  {
    key: 'accelSG',
    displayName: 'Savitzky-Golay',
    color: '#0ea5e9',
    accessor: (s) => s.accelSG,
    group: 'accel',
  },
  {
    key: 'accelMA',
    displayName: 'Moving average',
    color: '#facc15',
    accessor: (s) => s.accelMA,
    group: 'accel',
  },
  {
    key: 'accelButterworth',
    displayName: 'Butterworth LP',
    color: '#10b981',
    accessor: (s) => s.accelButterworth,
    group: 'accel',
  },
  {
    key: 'accelNotch',
    displayName: 'Band-stop',
    color: '#065f46',
    accessor: (s) => s.accelNotch,
    group: 'accel',
  },
  {
    key: 'accelCFC',
    displayName: 'CFC',
    color: '#ef4444',
    accessor: (s) => s.accelCFC,
    group: 'accel',
  },
]

export interface SeriesRange {
  min: number
  max: number
}

export function calculateSeriesRange(
  samples: Array<SamplePoint>,
  accessor: (s: SamplePoint) => number | null | undefined,
): SeriesRange | null {
  const values: Array<number> = []
  for (const s of samples) {
    const v = accessor(s)
    if (v != null && Number.isFinite(v)) {
      values.push(v)
    }
  }

  if (values.length === 0) return null

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

export interface TimeRange {
  min: number
  max: number
}

export function calculateTimeRange(samples: Array<SamplePoint>): TimeRange | null {
  if (samples.length === 0) return null

  const times = samples.map((s) => s.timeMs)
  return {
    min: Math.min(...times),
    max: Math.max(...times),
  }
}

export function addPadding(range: TimeRange, paddingFraction = 0.02): TimeRange {
  const span = range.max - range.min || 1
  const padding = span * paddingFraction
  return {
    min: range.min - padding,
    max: range.max + padding,
  }
}

export interface FirstHitRange {
  start: number
  end: number
}

export function findFirstHitRange(samples: Array<SamplePoint>): FirstHitRange | null {
  if (samples.length === 0) return null

  let peakIdx = -1
  let peakVal = Number.NEGATIVE_INFINITY

  for (let i = 0; i < samples.length; i++) {
    const a = samples[i].accelG
    if (a != null && Number.isFinite(a) && a > 10 && a > peakVal) {
      peakVal = a
      peakIdx = i
    }
  }

  if (peakIdx === -1) return null

  const peakTimeMs = samples[peakIdx].timeMs
  const startTimePadded = Math.max(0, peakTimeMs - 50)
  const endTimePadded = peakTimeMs + 100

  return {
    start: startTimePadded,
    end: endTimePadded,
  }
}

export function calculateZoomPercent(
  range: FirstHitRange,
  axisRange: TimeRange,
): { start: number; end: number } {
  const totalRange = axisRange.max - axisRange.min
  if (totalRange === 0) return { start: 0, end: 100 }

  const startPercent = ((range.start - axisRange.min) / totalRange) * 100
  const endPercent = ((range.end - axisRange.min) / totalRange) * 100

  return {
    start: Math.max(0, Math.min(100, startPercent)),
    end: Math.max(0, Math.min(100, endPercent)),
  }
}
