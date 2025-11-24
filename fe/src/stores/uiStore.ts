import { createStore, produce } from 'solid-js/store'
import { parseRawCSV } from '../lib/csv-parser'
import { calculateCFC, calculateJerkSG } from '../lib/filter/compute'
import { detectOriginTime, estimateSampleRateHz, findFirstHitRange } from '../lib/filter/range'
import type { AppConfig, DropTestFile, SamplePoint } from '../types'

interface UIState {
  file: DropTestFile | null
  config: AppConfig
  // Use a counter or unique ID for commands to ensure same-button clicks trigger effects
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
        cfc: 100,
        jerkWindow: 15,
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
      // simple bounds
      if (key === 'cfc') s.config.cfc = Math.max(10, Math.min(1000, val))
      if (key === 'jerkWindow') s.config.jerkWindow = Math.max(5, Math.min(101, val))
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

      // 1. Detect Sample Rate
      const rate = estimateSampleRateHz(rawData)

      // 2. Detect Origin
      const origin = detectOriginTime(rawData)

      // 3. Create Init Samples
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

      // 5. Set default range
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

      // Temp samples for Jerk calc (avoids store churn)
      const tempSamples = f.samples.map((s, i) => ({ ...s, accelCFC: cfcData[i] }))

      // Jerk SG
      const jerkData = calculateJerkSG(tempSamples, c.jerkWindow, f.sampleRateHz)

      // Update Store
      this.setState((s) => {
        if (!s.file) return
        // We mutate the array directly for performance in the store
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
