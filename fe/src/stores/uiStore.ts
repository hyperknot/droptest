import { createStore, type SetStoreFunction } from 'solid-js/store'
import { parseRawCSV } from '../lib/csv-parser'
import { butterworthFilter } from '../lib/filter/butterworth'
import { detectOriginTime, estimateSampleRateHz } from '../lib/filter/range'
import { sgFilter } from '../lib/filter/sg'
import type { SamplePoint } from '../types'

interface UIState {
  // File data (flattened from DropTestFile)
  filename: string | null
  sampleRateHz: number
  samples: Array<SamplePoint>

  // Config (flattened from AppConfig, renamed)
  accelCutoffHz: number // Hz
  jerkWindowMs: number // ms

  // UI state
  rangeRequest: { type: 'full' | 'firstHit'; id: number } | null
  isDragging: boolean
  error: string | null
}

class UIStore {
  state: UIState
  private readonly setState: SetStoreFunction<UIState>

  constructor() {
    const [state, setState] = createStore<UIState>({
      filename: null,
      sampleRateHz: 1000,
      samples: [],

      accelCutoffHz: 150,
      jerkWindowMs: 15,

      rangeRequest: null,
      isDragging: false,
      error: null,
    })

    // eslint-disable-next-line solid/reactivity
    this.state = state
    this.setState = setState
  }

  setIsDragging(v: boolean) {
    this.setState('isDragging', v)
  }

  setRangeRequest(type: 'full' | 'firstHit') {
    this.setState('rangeRequest', { type, id: Date.now() })
  }

  setAccelCutoffHz(val: number) {
    // Max based on 1000 Hz Nyquist (500 Hz) with safety buffer
    const clamped = Math.max(10, Math.min(450, val))
    this.setState('accelCutoffHz', clamped)
    this.applyFilters()
  }

  setJerkWindowMs(val: number) {
    const clamped = Math.max(5, Math.min(50, val))
    this.setState('jerkWindowMs', clamped)
    this.applyFilters()
  }

  async loadFile(file: File) {
    this.setState('error', null)
    this.setState('filename', null)
    this.setState('samples', [])

    try {
      const text = await file.text()
      const rawData = parseRawCSV(text)
      const rate = estimateSampleRateHz(rawData)

      // Apply butter filter to raw data for origin detection
      const rawAccel = rawData.map((r) => r.accel)
      const filteredForOrigin = butterworthFilter(rawAccel, 160, rate, 1)

      // Detect origin using filtered data
      const dataForOrigin = rawData.map((r, i) => ({
        timeMs: r.timeMs,
        accel: filteredForOrigin[i],
      }))
      const origin = detectOriginTime(dataForOrigin)

      // Create samples trimmed to origin
      const samples: Array<SamplePoint> = rawData
        .filter((r) => r.timeMs >= origin)
        .map((r) => ({
          timeMs: r.timeMs - origin,
          accelRaw: r.accel,
          accelFiltered: null,
          jerkSG: null,
        }))

      this.setState('filename', file.name)
      this.setState('sampleRateHz', rate)
      this.setState('samples', samples)

      this.applyFilters()
      this.setRangeRequest('firstHit')
    } catch (e: any) {
      console.error(e)
      this.setState('error', e.message || 'Failed to parse file')
    }
  }

  private applyFilters() {
    const samples = this.state.samples
    const sampleRate = this.state.sampleRateHz
    const cutoff = this.state.accelCutoffHz
    const windowMs = this.state.jerkWindowMs

    if (samples.length === 0) return

    try {
      // Prevent crash if cutoff is too close to Nyquist
      const safeCutoff = Math.min(cutoff, (sampleRate / 2) * 0.94)

      // Apply Butterworth filter (order=1 matches SciPy N=2)
      const rawAccel = samples.map((s) => s.accelRaw)
      const filteredData = butterworthFilter(rawAccel, safeCutoff, sampleRate, 1)

      // Apply SG filter for jerk (polyOrder=3, derivative=1)
      const jerkData = sgFilter(filteredData, windowMs, 3, sampleRate, 1)

      // Update samples with filtered values
      const updatedSamples = samples.map((s, i) => ({
        ...s,
        accelFiltered: filteredData[i],
        jerkSG: jerkData[i] ?? 0,
      }))

      this.setState('samples', updatedSamples)
    } catch (err) {
      console.error('Filter calculation error', err)
    }
  }
}

export const uiStore = new UIStore()
