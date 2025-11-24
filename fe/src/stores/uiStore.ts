import { createStore, produce } from 'solid-js/store'
import { parseRawCSV } from '../lib/csv-parser'
import { butterworth } from '../lib/filter/butterworth'
import { calculateJerkSG } from '../lib/filter/compute'
import { detectOriginTime, estimateSampleRateHz } from '../lib/filter/range'
import type { AppConfig, DropTestFile, SamplePoint } from '../types'

interface UIState {
  file: DropTestFile | null
  config: AppConfig
  // Using an object with ID ensures consecutive clicks on the same button trigger the effect
  rangeRequest: { type: 'full' | 'firstHit'; id: number } | null
  isDragging: boolean
  error: string | null
}

class UIStore {
  state: UIState
  private setState: (fn: (min: UIState) => void) => void

  constructor() {
    const [state, setState] = createStore<UIState>({
      file: null,
      config: {
        cutoffHz: 100,
        jerkWindow: 15,
        jerkPoly: 3,
      },
      rangeRequest: null,
      isDragging: false,
      error: null,
    })

    this.state = state
    this.setState = (fn) => setState(produce(fn))
  }

  setIsDragging(v: boolean) {
    this.setState((s) => {
      s.isDragging = v
    })
  }

  setRangeRequest(type: 'full' | 'firstHit') {
    this.setState((s) => {
      s.rangeRequest = { type, id: Date.now() }
    })
  }

  updateConfig(key: keyof AppConfig, val: number) {
    this.setState((s) => {
      if (key === 'cutoffHz') s.config.cutoffHz = Math.max(1, Math.min(5000, val))
      if (key === 'jerkWindow') s.config.jerkWindow = Math.max(5, Math.min(51, val))
      if (key === 'jerkPoly') s.config.jerkPoly = Math.max(1, Math.min(7, val))
    })
    this.applyFilters()
  }

  async loadFile(file: File) {
    this.setState((s) => {
      s.error = null
      s.file = null
    })

    try {
      const text = await file.text()
      const rawData = parseRawCSV(text)
      const rate = estimateSampleRateHz(rawData)
      const origin = detectOriginTime(rawData)

      const samples: Array<SamplePoint> = rawData
        .filter((r) => r.timeMs >= origin)
        .map((r) => ({
          timeMs: r.timeMs - origin,
          accelRaw: r.accel,
          accelFiltered: null,
          jerkSG: null,
        }))

      this.setState((s) => {
        s.file = {
          filename: file.name,
          sampleRateHz: rate,
          samples: samples,
        }
      })

      this.applyFilters()

      // Trigger the zoom effect
      this.setRangeRequest('firstHit')
    } catch (e: any) {
      console.error(e)
      this.setState((s) => {
        s.error = e.message || 'Failed to parse file'
      })
    }
  }

  private applyFilters() {
    const f = this.state.file
    const c = this.state.config
    if (!f) return

    try {
      // Prevent crash if cutoff is too close to Nyquist
      // We silently clamp here only to prevent app crash, keeping the UI value active
      const safeCutoff = Math.min(c.cutoffHz, (f.sampleRateHz / 2) * 0.94)

      const filteredData = butterworth(f.samples, safeCutoff, f.sampleRateHz)

      // Create temp array for Jerk calculation
      const tempSamples = f.samples.map((s, i) => ({ ...s, accelFiltered: filteredData[i] }))

      const jerkData = calculateJerkSG(tempSamples, c.jerkWindow, c.jerkPoly, f.sampleRateHz)

      this.setState((s) => {
        if (!s.file) return
        for (let i = 0; i < s.file.samples.length; i++) {
          s.file.samples[i].accelFiltered = filteredData[i]
          s.file.samples[i].jerkSG = jerkData[i] ?? 0
        }
      })
    } catch (err) {
      console.error('Filter calc error', err)
    }
  }
}

export const uiStore = new UIStore()
