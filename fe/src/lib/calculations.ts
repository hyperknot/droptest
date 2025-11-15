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
    key: 'accelFactoryFiltered',
    displayName: 'Accel factory filtered (G)',
    color: '#6366f1',
    accessor: (s) => s.accelFactoryFiltered ?? null,
    group: 'accel',
  },
  {
    key: 'accelFiltered',
    displayName: 'Accel SG main (G)',
    color: '#0ea5e9',
    accessor: (s) => s.accelFiltered ?? null,
    group: 'accel',
  },
  {
    key: 'accelSGFull',
    displayName: 'Accel SG strong (G)',
    color: '#14b8a6',
    accessor: (s) => s.accelSGFull ?? null,
    group: 'accel',
  },
  {
    key: 'accelMA9',
    displayName: 'Accel moving avg (G)',
    color: '#facc15',
    accessor: (s) => s.accelMA9 ?? null,
    group: 'accel',
  },
  {
    key: 'accelLPEnvLight',
    displayName: 'Accel Butterworth LP #1 (G)',
    color: '#0f766e',
    accessor: (s) => s.accelLPEnvLight ?? null,
    group: 'accel',
  },
  {
    key: 'accelLPEnvMedium',
    displayName: 'Accel Butterworth LP #2 (G)',
    color: '#10b981',
    accessor: (s) => s.accelLPEnvMedium ?? null,
    group: 'accel',
  },
  {
    key: 'accelLPEnvStrong',
    displayName: 'Accel Notch/Band-stop (G)',
    color: '#065f46',
    accessor: (s) => s.accelLPEnvStrong ?? null,
    group: 'accel',
  },
  {
    key: 'accelCFC60',
    displayName: 'Accel CFC 60 (G)',
    color: '#ef4444',
    accessor: (s) => s.accelCFC60 ?? null,
    group: 'accel',
  },
  {
    key: 'accelCFC180',
    displayName: 'Accel CFC 180 (G)',
    color: '#b91c1c',
    accessor: (s) => s.accelCFC180 ?? null,
    group: 'accel',
  },
  {
    key: 'accelFromSpeed',
    displayName: 'Accel from speed (G)',
    color: '#db2777',
    accessor: (s) => s.accelFromSpeed ?? null,
    group: 'accel',
  },
  {
    key: 'accelFromPos',
    displayName: 'Accel from position (G)',
    color: '#c026d3',
    accessor: (s) => s.accelFromPos ?? null,
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
 * Simplified first-hit range detector: find first peak above 10 G, add padding.
 */
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

  if (peakIdx === -1) {
    console.log(
      `FirstHitRange ${JSON.stringify({ message: 'No significant peak found' }, null, 2)}`,
    )
    return null
  }

  const peakTimeMs = samples[peakIdx].timeMs

  const startTimePadded = Math.max(0, peakTimeMs - 50)
  const endTimePadded = peakTimeMs + 100

  console.log(
    'FirstHitRange ' +
      JSON.stringify(
        {
          peakIdx,
          peakTimeMs,
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
