import type { Component } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { AccelerationProfileChart } from './components/AccelerationProfileChart'
import { FileInfoPanel } from './components/FileInfo'
import { ControlPanel } from './components/ControlPanel'
import { parseDropTestFile } from './lib/csv-parser'
import {
  applyBandstopAccel,
  applyButterworthLowpassAccel,
  applyCrashFilterCFCAccel,
  applySavitzkyGolayAccel,
  computeMovingAverageAccel,
} from './lib/accel-filter'
import type { DropTestData, FilterConfig, SamplePoint } from './types'

export type RangeCommand = { type: 'full' } | { type: 'firstHit' } | null

const DEFAULT_FILTER_CONFIG: FilterConfig = {
  sg: {
    enabled: true,
    windowSize: 17,
    polynomial: 3,
  },
  sgFull: {
    enabled: false,
    windowSize: 33,
    polynomial: 3,
  },
  movingAverage: {
    enabled: false,
    windowSize: 9,
  },
  butterworth1: {
    enabled: false,
    cutoffHz: 100,
    order: 4,
    zeroPhase: true,
  },
  butterworth2: {
    enabled: false,
    cutoffHz: 300,
    order: 4,
    zeroPhase: true,
  },
  notch: {
    enabled: false,
    centerHz: 30,
    bandwidthHz: 10,
    order: 2,
    zeroPhase: true,
  },
  cfc60: {
    enabled: false,
    cfc: 60,
    order: 4,
    zeroPhase: true,
  },
  cfc180: {
    enabled: false,
    cfc: 180,
    order: 4,
    zeroPhase: true,
  },
}

function sanitizeOddWindow(value: number, maxLength: number): number | null {
  let maxWin = maxLength
  if (maxWin % 2 === 0) maxWin -= 1
  if (maxWin < 3) return null

  let w = Math.round(value)
  if (!Number.isFinite(w)) return null
  if (w < 3) w = 3
  if (w > maxWin) w = maxWin

  if (w % 2 === 0) {
    if (w + 1 <= maxWin) {
      w += 1
    } else if (w - 1 >= 3) {
      w -= 1
    } else {
      return null
    }
  }

  return w
}

function sanitizePolynomial(value: number): number {
  let p = Math.round(value)
  if (!Number.isFinite(p) || p < 1) p = 1
  if (p > 7) p = 7
  return p
}

export const AppUI: Component = () => {
  const [testData, setTestData] = createSignal<DropTestData | null>(null)
  const [displaySamples, setDisplaySamples] = createSignal<Array<SamplePoint>>([])
  const [error, setError] = createSignal<string>('')
  const [isDragging, setIsDragging] = createSignal(false)

  const [filterConfig, setFilterConfig] = createSignal<FilterConfig>(DEFAULT_FILTER_CONFIG)

  const [visibleSeries, setVisibleSeries] = createSignal<Record<string, boolean>>({
    accelG: true,
    accelFactoryFiltered: true,

    accelFiltered: true,
    accelSGFull: false,
    accelMA9: false,

    accelLPEnvLight: false,
    accelLPEnvMedium: false,
    accelLPEnvStrong: false,

    accelCFC60: false,
    accelCFC180: false,

    accelFromSpeed: false,
    accelFromPos: false,

    speed: true,
    pos: true,
    jerk: true,
  })

  const [rangeCommand, setRangeCommand] = createSignal<RangeCommand>(null)

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError('')

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) {
      setError('No file dropped')
      return
    }

    const file = files[0]
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please drop a .csv file')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseDropTestFile(text, file.name)
      setTestData(parsed)
      setError('')
    } catch (err) {
      setError(`Error parsing file: ${err}`)
      console.error(err)
      setTestData(null)
      setDisplaySamples([])
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const hasData = () => testData() !== null

  const handleFullRange = () => {
    setRangeCommand({ type: 'full' })
  }

  const handleFirstHit = () => {
    setRangeCommand({ type: 'firstHit' })
  }

  createEffect(() => {
    const data = testData()
    const cfg = filterConfig()

    if (!data || data.samples.length === 0) {
      setDisplaySamples([])
      return
    }

    const samples: SamplePoint[] = data.samples.map((s) => ({ ...s }))

    for (const s of samples) {
      s.accelFiltered = null
      s.accelSGFull = null
      s.accelMA9 = null
      s.accelCFC60 = null
      s.accelCFC180 = null
      s.accelLPEnvLight = null
      s.accelLPEnvMedium = null
      s.accelLPEnvStrong = null
    }

    if (cfg.sg.enabled) {
      const win = sanitizeOddWindow(cfg.sg.windowSize, samples.length)
      const poly = sanitizePolynomial(cfg.sg.polynomial)
      if (win != null) {
        try {
          const y = applySavitzkyGolayAccel(samples, win, poly)
          for (let i = 0; i < samples.length; i++) {
            samples[i].accelFiltered = y[i]
          }
        } catch (err) {
          console.warn('Savitzky–Golay main filter error:', err)
        }
      }
    }

    if (cfg.sgFull.enabled) {
      const win = sanitizeOddWindow(cfg.sgFull.windowSize, samples.length)
      const poly = sanitizePolynomial(cfg.sgFull.polynomial)
      if (win != null) {
        try {
          const y = applySavitzkyGolayAccel(samples, win, poly)
          for (let i = 0; i < samples.length; i++) {
            samples[i].accelSGFull = y[i]
          }
        } catch (err) {
          console.warn('Savitzky–Golay strong filter error:', err)
        }
      }
    }

    if (cfg.movingAverage.enabled) {
      const win = sanitizeOddWindow(cfg.movingAverage.windowSize, samples.length)
      if (win != null) {
        try {
          const y = computeMovingAverageAccel(samples, win)
          for (let i = 0; i < samples.length; i++) {
            samples[i].accelMA9 = y[i]
          }
        } catch (err) {
          console.warn('Moving average filter error:', err)
        }
      }
    }

    if (cfg.butterworth1.enabled) {
      try {
        const y = applyButterworthLowpassAccel(samples, cfg.butterworth1.cutoffHz, {
          order: cfg.butterworth1.order,
          zeroPhase: cfg.butterworth1.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelLPEnvLight = y[i]
        }
      } catch (err) {
        console.warn('Butterworth LP #1 error:', err)
      }
    }

    if (cfg.butterworth2.enabled) {
      try {
        const y = applyButterworthLowpassAccel(samples, cfg.butterworth2.cutoffHz, {
          order: cfg.butterworth2.order,
          zeroPhase: cfg.butterworth2.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelLPEnvMedium = y[i]
        }
      } catch (err) {
        console.warn('Butterworth LP #2 error:', err)
      }
    }

    if (cfg.notch.enabled) {
      try {
        const y = applyBandstopAccel(samples, cfg.notch.centerHz, cfg.notch.bandwidthHz, {
          order: cfg.notch.order,
          zeroPhase: cfg.notch.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelLPEnvStrong = y[i]
        }
      } catch (err) {
        console.warn('Band‑stop (notch) filter error:', err)
      }
    }

    if (cfg.cfc60.enabled) {
      try {
        const { filtered } = applyCrashFilterCFCAccel(samples, cfg.cfc60.cfc, {
          order: cfg.cfc60.order,
          zeroPhase: cfg.cfc60.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelCFC60 = filtered[i]
        }
      } catch (err) {
        console.warn('CFC 60 filter error:', err)
      }
    }

    if (cfg.cfc180.enabled) {
      try {
        const { filtered } = applyCrashFilterCFCAccel(samples, cfg.cfc180.cfc, {
          order: cfg.cfc180.order,
          zeroPhase: cfg.cfc180.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelCFC180 = filtered[i]
        }
      } catch (err) {
        console.warn('CFC 180 filter error:', err)
      }
    }

    setDisplaySamples(samples)
  })

  return (
    <div
      class="min-h-screen bg-slate-50 text-gray-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Landing page: centered introduction */}
      <Show when={!hasData()}>
        <div class="max-w-4xl mx-auto py-16 px-6 space-y-8">
          <header class="space-y-4">
            <h1 class="text-4xl font-bold tracking-tight">
              Harness Drop Test Data Visualizer
            </h1>
            <p class="text-lg text-gray-600">
              Visualize and analyze real-world drop test data from harness back protectors.
            </p>
            <p class="text-gray-600">
              This is an{' '}
              <a
                href="https://github.com/hyperknot/droptest-viz"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline font-medium"
              >
                open source
              </a>{' '}
              project by Zsolt Ero.
            </p>
          </header>

          <div
            class={`border-2 border-dashed rounded-lg p-16 text-center transition-colors ${
              isDragging() ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <p class="text-xl font-medium mb-3">Drop a CSV drop test file here</p>
            <p class="text-sm text-gray-500">
              Expected format: CSV with accel, time0, datetime columns
            </p>
          </div>

          <Show when={error()}>
            <div class="text-red-600 bg-red-50 p-4 rounded border border-red-200">
              {error()}
            </div>
          </Show>
        </div>
      </Show>

      {/* Fullscreen dense layout: graph + sidebar */}
      <Show when={hasData()}>
        <div class="h-screen flex overflow-hidden">
          {/* Main chart area - takes all available space */}
          <div class="flex-1">
            <AccelerationProfileChart
              samples={displaySamples()}
              visibleSeries={visibleSeries()}
              rangeCommand={rangeCommand()}
            />
          </div>

          {/* Right sidebar - filter controls */}
          <div class="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div class="flex-1 overflow-y-auto p-2 space-y-2">
              <ControlPanel
                samples={displaySamples()}
                visibleSeries={visibleSeries()}
                setVisibleSeries={setVisibleSeries}
                filterConfig={filterConfig()}
                setFilterConfig={setFilterConfig}
                onFullRange={handleFullRange}
                onFirstHit={handleFirstHit}
              />
              <FileInfoPanel data={testData()!} />
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}