import { createStore, produce } from 'solid-js/store'
import { parseRawCSV } from '../lib/csv-parser'
import { calculateCFC, calculateJerkSG } from '../lib/filter/compute'
import { detectOriginTime, estimateSampleRateHz, findFirstHitRange } from '../lib/filter/range'
import type { AppConfig, DropTestFile, SamplePoint } from '../types'

interface UIState {
  file: DropTestFile | null
  config: AppConfig
  rangeRequest: 'full' | 'firstHit' | null
  isDragging: boolean
  error: string | null
}

class UIStore {
  state: UIState
  private readonly setState: (fn: (min: UIState) => void) => void

  constructor() {
    const [state, setState] = createStore<UIState>({
      file: null,
      config: {
        cfc: 100,
        jerkWindow: 15,
      },
      rangeRequest: null,
      isDragging: false,
      error: null,
    })

    this.state = state
    // wrapper to allow class method updates
    this.setState = (fn) => setState(produce(fn))
  }

  setIsDragging(v: boolean) {
    this.setState((s) => {
      s.isDragging = v
    })
  }

  setRangeRequest(type: 'full' | 'firstHit') {
    this.setState((s) => {
      s.rangeRequest = type
    })
  }

  updateConfig(key: keyof AppConfig, val: number) {
    this.setState((s) => {
      // simple bounds to prevent crash
      if (key === 'cfc') s.config.cfc = Math.max(10, Math.min(1000, val))
      if (key === 'jerkWindow') s.config.jerkWindow = Math.max(5, Math.min(101, val))
    })
    // Re-run filters instantly
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

      // 1. Detect Sample Rate
      const rate = estimateSampleRateHz(rawData)

      // 2. Detect Origin
      const origin = detectOriginTime(rawData)

      // 3. Create Init Samples (Shift Time)
      // Filter out pre-buffer noise if desired, or just keep everything shifted
      const samples: Array<SamplePoint> = rawData
        .filter((r) => r.timeMs >= origin)
        .map((r) => ({
          timeMs: r.timeMs - origin,
          accelRaw: r.accel,
          accelCFC: null,
          jerkSG: null,
        }))

      this.setState((s) => {
        s.file = {
          filename: file.name,
          sampleRateHz: rate,
          samples: samples,
        }
      })

      // 4. Run Filters
      this.applyFilters()

      // 5. Set default range to first hit
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
      // Accel CFC
      const cfcData = calculateCFC(f.samples, c.cfc, f.sampleRateHz)

      // Update samples temporarily to compute Jerk
      // We do this in a mutable way on a copy to avoid excessive store triggers during calc
      const tempSamples = f.samples.map((s, i) => ({ ...s, accelCFC: cfcData[i] }))

      // Jerk SG (uses accelCFC)
      const jerkData = calculateJerkSG(tempSamples, c.jerkWindow, f.sampleRateHz)

      // Commit back to store
      this.setState((s) => {
        if (!s.file) return
        for (let i = 0; i < s.file.samples.length; i++) {
          s.file.samples[i].accelCFC = cfcData[i]
          s.file.samples[i].jerkSG = jerkData[i] ?? 0
        }
      })
    } catch (err) {
      console.error('Filter calc error', err)
    }
  }
}

export const uiStore = new UIStore()
