import type { SamplePoint } from '../types'
import { detectFirstHitWindow } from './signal-analysis'

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
    displayName: 'Accel SG auto (moderate, G)',
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
    key: 'accelSGFull',
    displayName: 'Accel SG full period (strong, G)',
    color: '#14b8a6',
    accessor: (s) => s.accelSGFull ?? null,
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
    key: 'accelLPEnvLight',
    displayName: 'Accel LP env light (adaptive, G)',
    color: '#0f766e',
    accessor: (s) => s.accelLPEnvLight ?? null,
    group: 'accel',
  },
  {
    key: 'accelLPEnvMedium',
    displayName: 'Accel LP env medium (adaptive, G)',
    color: '#10b981',
    accessor: (s) => s.accelLPEnvMedium ?? null,
    group: 'accel',
  },
  {
    key: 'accelLPEnvStrong',
    displayName: 'Accel LP env strong (adaptive, G)',
    color: '#065f46',
    accessor: (s) => s.accelLPEnvStrong ?? null,
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

/**
 * Use detectFirstHitWindow (signal-analysis) to determine the first-hit time range,
 * then add a small padding before/after for nicer zooming.
 */
export function findFirstHitRange(samples: Array<SamplePoint>): FirstHitRange | null {
  if (samples.length === 0) return null

  const detection = detectFirstHitWindow(samples)
  if (!detection) {
    console.log('FirstHitRange ' + JSON.stringify({ message: 'No first hit detected' }, null, 2))
    return null
  }

  const { startTimeMs, endTimeMs, startIdx, endIdx, peakIdx } = detection.window

  const startTimePadded = Math.max(0, startTimeMs - 10)
  const endTimePadded = endTimeMs + 10

  console.log(
    'FirstHitRange ' +
      JSON.stringify(
        {
          startIdx,
          endIdx,
          peakIdx,
          startTimeMs,
          endTimeMs,
          paddedStartTime: startTimePadded,
          paddedEndTime: endTimePadded,
        },
        null,
        2,
      ),
  )

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
