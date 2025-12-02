import { createStore, type SetStoreFunction } from 'solid-js/store'
import { parseRawCSV } from '../lib/csv-parser'
import { butterworthFilter } from '../lib/filter/butterworth'
import { detectOriginTime, estimateSampleRateHz } from '../lib/filter/range'
import { sgFilter } from '../lib/filter/sg'
import type { ProcessedSample, RawSample } from '../types'

interface UIState {
  // File data
  filename: string | null
  sampleRateHz: number

  // Raw, origin-trimmed samples (unfiltered)
  rawSamples: Array<RawSample>

  // Final data series: all points have accelRaw, accelFiltered, jerkSG
  processedSamples: Array<ProcessedSample>

  // Config
  accelCutoffHz: number // Hz
  jerkWindowMs: number // ms

  // UI state
  rangeRequest: { type: 'full' | 'firstHit'; id: number } | null
  isDragging: boolean
  error: string | null
}

function processRawSamples(
  rawSamples: Array<RawSample>,
  sampleRateHz: number,
  accelCutoffHz: number,
  jerkWindowMs: number,
): Array<ProcessedSample> {
  if (rawSamples.length === 0) return []

  const nyquist = sampleRateHz / 2
  const safeCutoff = Math.min(accelCutoffHz, nyquist * 0.94)

  const accelRawArray = rawSamples.map((s) => s.accelRaw)

  // 1) Filter acceleration
  const accelFilteredAll = butterworthFilter(accelRawArray, safeCutoff, sampleRateHz, 1)

  // 2) Compute jerk from filtered acceleration
  const jerkAll = sgFilter(accelFilteredAll, jerkWindowMs, 3, sampleRateHz, 1)

  const n = rawSamples.length
  let start = 0
  let end = n - 1

  const isInvalid = (i: number) =>
    !Number.isFinite(accelFilteredAll[i]) || !Number.isFinite(jerkAll[i])

  // Trim invalid points from the left
  while (start <= end && isInvalid(start)) start++

  // Trim invalid points from the right
  while (end >= start && isInvalid(end)) end--

  if (start > end) {
    // No valid processed data
    return []
  }

  // Optional: ensure interior is valid; if not, you can throw or skip.
  // Here we just skip any weird interior points (should not happen in practice).
  const t0 = rawSamples[start].timeMs
  const out: Array<ProcessedSample> = []

  for (let i = start; i <= end; i++) {
    const af = accelFilteredAll[i]
    const j = jerkAll[i]
    if (!Number.isFinite(af) || !Number.isFinite(j)) continue

    out.push({
      timeMs: rawSamples[i].timeMs - t0, // rebase time to trimmed start
      accelRaw: rawSamples[i].accelRaw,
      accelFiltered: af,
      jerkSG: j,
    })
  }

  return out
}

class UIStore {
  state: UIState
  private readonly setState: SetStoreFunction<UIState>

  constructor() {
    const [state, setState] = createStore<UIState>({
      filename: null,
      sampleRateHz: 1000,

      rawSamples: [],
      processedSamples: [],

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
    const clamped = Math.max(10, Math.min(450, val))
    this.setState('accelCutoffHz', clamped)
    this.recomputeProcessedSamples()
  }

  setJerkWindowMs(val: number) {
    const clamped = Math.max(5, Math.min(50, val))
    this.setState('jerkWindowMs', clamped)
    this.recomputeProcessedSamples()
  }

  async loadFile(file: File) {
    this.setState('error', null)
    this.setState('filename', null)
    this.setState('rawSamples', [])
    this.setState('processedSamples', [])

    try {
      const text = await file.text()
      const rawData = parseRawCSV(text) // RawSample[]
      const rate = estimateSampleRateHz(rawData)

      // Quick Butterworth for origin detection (fixed cutoff)
      const accelForOrigin = rawData.map((s) => s.accelRaw)
      const filteredForOrigin = butterworthFilter(accelForOrigin, 160, rate, 1)

      const originTime = detectOriginTime(rawData, filteredForOrigin)

      // Trim raw samples to origin and rebase time
      const trimmedRaw: Array<RawSample> = rawData
        .filter((s) => s.timeMs >= originTime)
        .map((s) => ({
          timeMs: s.timeMs - originTime,
          accelRaw: s.accelRaw,
        }))

      this.setState('filename', file.name)
      this.setState('sampleRateHz', rate)
      this.setState('rawSamples', trimmedRaw)

      this.recomputeProcessedSamples()
      this.setRangeRequest('firstHit')
    } catch (e: any) {
      console.error(e)
      this.setState('error', e?.message || 'Failed to parse file')
    }
  }

  private recomputeProcessedSamples() {
    const { rawSamples, sampleRateHz, accelCutoffHz, jerkWindowMs } = this.state

    if (rawSamples.length === 0) {
      this.setState('processedSamples', [])
      return
    }

    try {
      const processed = processRawSamples(rawSamples, sampleRateHz, accelCutoffHz, jerkWindowMs)
      this.setState('processedSamples', processed)
    } catch (err: any) {
      console.error('Filter calculation error', err)
      this.setState('error', err?.message || 'Filter calculation error')
      this.setState('processedSamples', [])
    }
  }
}

export const uiStore = new UIStore()
