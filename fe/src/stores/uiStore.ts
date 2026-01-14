import { createStore, type SetStoreFunction } from 'solid-js/store'
import { parseRawCSV } from '../lib/csv-parser'
import { cfcFilter } from '../lib/filter/cfc'
import {
  detectOriginTime,
  estimateSampleRateHz,
  findFirstHitRange,
  logSampleRateDiagnostics,
} from '../lib/filter/range'
import { sgFilter } from '../lib/filter/sg'
import { computeDRIForWindow } from '../lib/metrics/dri'
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
  accelCfc: number // CFC class value
  jerkWindowMs: number // ms

  // Visible range and computed peaks
  visibleTimeRange: { min: number; max: number } | null
  peakAccel: number | null
  peakJerk: number | null

  // DRI and energy over the visible window
  dri: number | null
  driDeltaMaxMm: number | null
  energyJPerKg: number | null

  // The computed "hit range" for DRI calculation markers
  hitRange: { min: number; max: number } | null

  // UI state
  rangeRequest: { type: 'full' | 'firstHit'; id: number } | null
  isDragging: boolean
  error: string | null
}

function processRawSamples(
  rawSamples: Array<RawSample>,
  sampleRateHz: number,
  accelCfc: number,
  jerkWindowMs: number,
): Array<ProcessedSample> {
  if (rawSamples.length === 0) return []

  // Clamp CFC to safe range (design freq must be < 0.95 * Nyquist)
  const nyquist = sampleRateHz / 2
  const maxCfc = (nyquist * 0.94) / 2.0775
  const safeCfc = Math.min(accelCfc, maxCfc)

  const accelRawArray = rawSamples.map((s) => s.accelRaw)

  // 1) Filter acceleration using CFC filter
  const accelFilteredAll = cfcFilter(accelRawArray, sampleRateHz, safeCfc)

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

      accelCfc: 75,
      jerkWindowMs: 17,

      visibleTimeRange: null,
      peakAccel: null,
      peakJerk: null,

      dri: null,
      driDeltaMaxMm: null,
      energyJPerKg: null,

      hitRange: null,

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

    // IMPORTANT:
    // Chart zoom commands (setOption) do not always emit the 'datazoom' event.
    // The visible window used for peaks/DRI must be updated in the store as well,
    // otherwise DRI stays "—" until the user manually nudges the zoom slider.
    const samples = this.state.processedSamples
    if (samples.length === 0) return

    if (type === 'full') {
      this.setVisibleTimeRange(samples[0].timeMs, samples[samples.length - 1].timeMs)
      return
    }

    // findFirstHitRange now includes backward search for free fall start
    const range = findFirstHitRange(samples)
    if (range) {
      // Add 50ms padding to the end for UI display
      const dataEnd = samples[samples.length - 1].timeMs
      this.setVisibleTimeRange(range.min, Math.min(dataEnd, range.max + 50))
    } else {
      // Fallback: if no peak found, use full range
      this.setVisibleTimeRange(samples[0].timeMs, samples[samples.length - 1].timeMs)
    }
  }

  setVisibleTimeRange(min: number, max: number) {
    this.setState('visibleTimeRange', { min, max })
    this.recomputePeaks()
  }

  setAccelCfc(val: number) {
    const clamped = Math.max(5, Math.min(225, val))
    this.setState('accelCfc', clamped)
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
    this.setState('visibleTimeRange', null)
    this.setState('peakAccel', null)
    this.setState('peakJerk', null)
    this.setState('dri', null)
    this.setState('driDeltaMaxMm', null)
    this.setState('energyJPerKg', null)
    this.setState('hitRange', null)

    try {
      const text = await file.text()
      const rawData = parseRawCSV(text) // RawSample[]

      // Log comprehensive sample rate diagnostics
      logSampleRateDiagnostics(file.name, rawData)

      const rate = estimateSampleRateHz(rawData)

      // CFC filter for origin detection
      const accelForOrigin = rawData.map((s) => s.accelRaw)
      const filteredForOrigin = cfcFilter(accelForOrigin, rate, 75)

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

      // This will now also set visibleTimeRange in the store.
      this.setRangeRequest('firstHit')
    } catch (e: any) {
      console.error(e)
      this.setState('error', e?.message || 'Failed to parse file')
    }
  }

  private recomputeProcessedSamples() {
    const { rawSamples, sampleRateHz, accelCfc, jerkWindowMs } = this.state

    if (rawSamples.length === 0) {
      this.setState('processedSamples', [])
      this.setState('visibleTimeRange', null)
      this.setState('peakAccel', null)
      this.setState('peakJerk', null)
      this.setState('dri', null)
      this.setState('driDeltaMaxMm', null)
      this.setState('energyJPerKg', null)
      this.setState('hitRange', null)
      return
    }

    try {
      const processed = processRawSamples(rawSamples, sampleRateHz, accelCfc, jerkWindowMs)
      this.setState('processedSamples', processed)

      // Initialize visible range to full extent, then recompute peaks
      if (processed.length > 0) {
        const minT = processed[0].timeMs
        const maxT = processed[processed.length - 1].timeMs
        this.setState('visibleTimeRange', { min: minT, max: maxT })

        // Calculate and store the hit range for DRI markers
        const hitRange = findFirstHitRange(processed)
        this.setState('hitRange', hitRange)
      }

      this.recomputePeaks()
    } catch (err: any) {
      console.error('Filter calculation error', err)
      this.setState('error', err?.message || 'Filter calculation error')
      this.setState('processedSamples', [])
      this.setState('visibleTimeRange', null)
      this.setState('peakAccel', null)
      this.setState('peakJerk', null)
      this.setState('dri', null)
      this.setState('driDeltaMaxMm', null)
      this.setState('energyJPerKg', null)
      this.setState('hitRange', null)
    }
  }

  private recomputePeaks() {
    const { processedSamples, visibleTimeRange } = this.state

    if (processedSamples.length === 0 || !visibleTimeRange) {
      this.setState('peakAccel', null)
      this.setState('peakJerk', null)
      this.setState('dri', null)
      this.setState('driDeltaMaxMm', null)
      this.setState('energyJPerKg', null)
      return
    }

    let peakAccel = Number.NEGATIVE_INFINITY
    let peakJerk = 0

    for (const s of processedSamples) {
      if (s.timeMs >= visibleTimeRange.min && s.timeMs <= visibleTimeRange.max) {
        if (s.accelFiltered > peakAccel) {
          peakAccel = s.accelFiltered
        }
        if (s.jerkSG > peakJerk) {
          peakJerk = s.jerkSG
        }
      }
    }

    // DRI over the visible window (using filtered acceleration)
    const driRes = computeDRIForWindow(
      processedSamples,
      {
        minMs: visibleTimeRange.min,
        maxMs: visibleTimeRange.max,
      },
      this.state.sampleRateHz,
    )

    if (peakAccel === Number.NEGATIVE_INFINITY) {
      this.setState('peakAccel', null)
      this.setState('peakJerk', null)
      this.setState('dri', null)
      this.setState('driDeltaMaxMm', null)
      this.setState('energyJPerKg', null)
    } else {
      this.setState('peakAccel', peakAccel)
      this.setState('peakJerk', peakJerk)
      this.setState('dri', driRes?.dri ?? null)
      this.setState('driDeltaMaxMm', driRes?.deltaMaxMm ?? null)
      this.setState('energyJPerKg', driRes?.energyJPerKg ?? null)
    }
  }
}

export const uiStore = new UIStore()
