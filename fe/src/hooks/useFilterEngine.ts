import { createEffect, createSignal } from 'solid-js'
import { sanitizeOddWindow, sanitizePolynomial } from '../lib/filter-config'
import { applyButterworthLowpassAccel, applyCrashFilterCFCAccel } from '../lib/filters/butterworth'
import { applySavitzkyGolayAccel, computeJerkSavitzkyGolayFromAccel } from '../lib/filters/sg'
import type { DropTestData, FilterConfig, SamplePoint } from '../types'

export function useFilterEngine(
  testData: () => DropTestData | null,
  filterConfig: () => FilterConfig,
) {
  const [displaySamples, setDisplaySamples] = createSignal<Array<SamplePoint>>([])

  createEffect(() => {
    const data = testData()
    const cfg = filterConfig()

    if (!data || data.samples.length === 0) {
      setDisplaySamples([])
      return
    }

    const samples: Array<SamplePoint> = data.samples.map((s) => ({ ...s }))

    for (const s of samples) {
      s.accelSG = null
      s.accelMA = null
      s.accelButterworth = null
      s.accelNotch = null
      s.accelCFC = null
      s.jerk = null
    }

    // Track which acceleration filters are enabled
    const enabledAccelFilters: Array<
      'cfc' | 'butterworth' | 'savitzkyGolay' | 'movingAverage' | 'notch'
    > = []
    if (cfg.cfc.enabled) enabledAccelFilters.push('cfc')
    if (cfg.butterworth.enabled) enabledAccelFilters.push('butterworth')
    if (cfg.savitzkyGolay.enabled) enabledAccelFilters.push('savitzkyGolay')
    if (cfg.movingAverage.enabled) enabledAccelFilters.push('movingAverage')
    if (cfg.notch.enabled) enabledAccelFilters.push('notch')

    if (cfg.savitzkyGolay.enabled) {
      const win = sanitizeOddWindow(cfg.savitzkyGolay.windowSize, samples.length)
      const poly = sanitizePolynomial(cfg.savitzkyGolay.polynomial)
      if (win != null) {
        try {
          const y = applySavitzkyGolayAccel(samples, win, poly)
          for (let i = 0; i < samples.length; i++) {
            samples[i].accelSG = y[i]
          }
        } catch {}
      }
    }

    if (cfg.butterworth.enabled) {
      try {
        const y = applyButterworthLowpassAccel(samples, cfg.butterworth.cutoffHz, {
          order: cfg.butterworth.order,
          zeroPhase: cfg.butterworth.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelButterworth = y[i]
        }
      } catch {}
    }

    if (cfg.cfc.enabled) {
      try {
        const { filtered } = applyCrashFilterCFCAccel(samples, cfg.cfc.cfc, {
          order: cfg.cfc.order,
          zeroPhase: cfg.cfc.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelCFC = filtered[i]
        }
      } catch {}
    }

    // Jerk: only when exactly one accel filter is enabled
    if (cfg.jerk.enabled && enabledAccelFilters.length === 1) {
      const activeFilter = enabledAccelFilters[0]
      let accelKey:
        | 'accelCFC'
        | 'accelButterworth'
        | 'accelSG'
        | 'accelMA'
        | 'accelNotch'
        | undefined

      switch (activeFilter) {
        case 'cfc':
          accelKey = 'accelCFC'
          break
        case 'butterworth':
          accelKey = 'accelButterworth'
          break
        case 'savitzkyGolay':
          accelKey = 'accelSG'
          break
        case 'movingAverage':
          accelKey = 'accelMA'
          break
        case 'notch':
          accelKey = 'accelNotch'
          break
      }

      if (accelKey) {
        const hasData = samples.some((s) => {
          const v = s[accelKey!]
          return typeof v === 'number' && Number.isFinite(v)
        })

        if (hasData) {
          const win = sanitizeOddWindow(cfg.jerk.windowSize, samples.length)
          const poly = sanitizePolynomial(cfg.jerk.polynomial)
          if (win != null) {
            try {
              const jerk = computeJerkSavitzkyGolayFromAccel(samples, accelKey, win, poly)
              for (let i = 0; i < samples.length; i++) {
                samples[i].jerk = jerk[i]
              }
            } catch {}
          }
        }
      }
    }

    setDisplaySamples(samples)
  })

  return { displaySamples }
}
