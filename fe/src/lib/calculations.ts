import type { SamplePoint } from '../types'

export interface SeriesConfig {
  key: keyof SamplePoint
  displayName: string
  color: string
  accessor: (s: SamplePoint) => number | null | undefined
  group: 'accel' | 'speed' | 'position' | 'jerk' | 'other'
}

export const SERIES_CONFIG: Array<SeriesConfig> = [
  {
    key: 'accelG',
    displayName: 'Accel raw (G)',
    color: '#2563eb',
    accessor: (s) => s.accelG,
    group: 'accel',
  },
  {
    key: 'accelFiltered',
    displayName: 'Accel SG auto (G)',
    color: '#0ea5e9',
    accessor: (s) => s.accelFiltered ?? null,
    group: 'accel',
  },
  {
    key: 'accelFactoryFiltered',
    displayName: 'Accel factory filtered (G)',
    color: '#6366f1',
    accessor: (s) => s.accelFactoryFiltered ?? null,
    group: 'accel',
  },
  {
    key: 'accelSGShort',
    displayName: 'Accel SG short window (G)',
    color: '#22c55e',
    accessor: (s) => s.accelSGShort ?? null,
    group: 'accel',
  },
  {
    key: 'accelMA9',
    displayName: 'Accel moving avg 9 (G)',
    color: '#facc15',
    accessor: (s) => s.accelMA9 ?? null,
    group: 'accel',
  },
  {
    key: 'accelCFC60',
    displayName: 'Accel CFC 60 (Butterworth crash filter, G)',
    color: '#ef4444',
    accessor: (s) => s.accelCFC60 ?? null,
    group: 'accel',
  },
  {
    key: 'accelCFC180',
    displayName: 'Accel CFC 180 (Butterworth crash filter, G)',
    color: '#b91c1c',
    accessor: (s) => s.accelCFC180 ?? null,
    group: 'accel',
  },
  {
    key: 'speed',
    displayName: 'Speed',
    color: '#16a34a',
    accessor: (s) => s.speed ?? null,
    group: 'speed',
  },
  {
    key: 'pos',
    displayName: 'Position',
    color: '#a855f7',
    accessor: (s) => s.pos ?? null,
    group: 'position',
  },
  {
    key: 'jerk',
    displayName: 'Jerk',
    color: '#f97316',
    accessor: (s) => s.jerk ?? null,
    group: 'jerk',
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
  const threshold = 1.0 // +1 G

  // Find first point where accelFiltered > threshold
  let startIdx = -1
  for (let i = 0; i < samples.length; i++) {
    const accel = samples[i].accelFiltered
    if (accel != null && accel > threshold) {
      startIdx = i
      break
    }
  }

  if (startIdx === -1) {
    console.log('No first hit found (accelFiltered never exceeded +1 G)')
    return null
  }

  // Find when it goes back under threshold
  let endIdx = startIdx
  for (let i = startIdx + 1; i < samples.length; i++) {
    const accel = samples[i].accelFiltered
    if (accel != null && accel <= threshold) {
      endIdx = i
      break
    }
    endIdx = i
  }

  const startTime = samples[startIdx].timeMs - 10 // 10ms padding before
  const endTime = samples[endIdx].timeMs + 10 // 10ms padding after

  console.log('First hit range detected:', {
    startIdx,
    endIdx,
    startTime: Math.max(0, startTime),
    endTime,
  })

  return {
    start: Math.max(0, startTime),
    end: endTime,
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
