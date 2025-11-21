import type { SamplePoint } from '../types'

export interface SeriesConfig {
  key: keyof SamplePoint
  displayName: string
  color: string
  accessor: (s: SamplePoint) => number | null | undefined
  group: 'accel' | 'jerk'
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
    key: 'jerk',
    displayName: 'Jerk (g/s)',
    color: '#a855f7',
    accessor: (s) => s.jerk,
    group: 'jerk',
  },
]

export const FILTER_SERIES_CONFIG: Array<SeriesConfig> = [
  {
    key: 'accelCFC',
    displayName: 'CFC',
    color: '#ef4444',
    accessor: (s) => s.accelCFC,
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
    key: 'accelNotch',
    displayName: 'Band-stop',
    color: '#065f46',
    accessor: (s) => s.accelNotch,
    group: 'accel',
  },
]

// ... rest of file unchanged ...
