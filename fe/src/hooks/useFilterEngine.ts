import { createEffect, createSignal } from 'solid-js'
import {
  applyBandstopAccel,
  applyButterworthLowpassAccel,
  applyCrashFilterCFCAccel,
  applySavitzkyGolayAccel,
  computeJerkSavitzkyGolay,
  computeMovingAverageAccel,
} from '../lib/accel-filter'
import { sanitizeOddWindow, sanitizePolynomial } from '../lib/filter-config'
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

    // Reset computed fields
    for (const s of samples) {
      s.accelSG = null
      s.accelMA = null
      s.accelButterworth = null
      s.accelNotch = null
      s.accelCFC = null
      s.jerk = null
    }

    // Track which filters are actively populated to determine source for Jerk
    const enabledAccelFilters: Array<{ key: keyof SamplePoint; name: string }> = []

    // 1. Savitzky-Golay Accel
    if (cfg.savitzkyGolay.enabled) {
      const win = sanitizeOddWindow(cfg.savitzkyGolay.windowSize, samples.length)
      const poly = sanitizePolynomial(cfg.savitzkyGolay.polynomial)
      if (win != null) {
        try {
          const y = applySavitzkyGolayAccel(samples, win, poly)
          for (let i = 0; i < samples.length; i++) samples[i].accelSG = y[i]
          enabledAccelFilters.push({ key: 'accelSG', name: 'Savitzky-Golay' })
        } catch {}
      }
    }

    // 2. Moving Average Accel
    if (cfg.movingAverage.enabled) {
      const win = sanitizeOddWindow(cfg.movingAverage.windowSize, samples.length)
      if (win != null) {
        try {
          const y = computeMovingAverageAccel(samples, win)
          for (let i = 0; i < samples.length; i++) samples[i].accelMA = y[i]
          enabledAccelFilters.push({ key: 'accelMA', name: 'Moving Average' })
        } catch {}
      }
    }

    // 3. Butterworth Accel
    if (cfg.butterworth.enabled) {
      try {
        const y = applyButterworthLowpassAccel(samples, cfg.butterworth.cutoffHz, {
          order: cfg.butterworth.order,
          zeroPhase: cfg.butterworth.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) samples[i].accelButterworth = y[i]
        enabledAccelFilters.push({ key: 'accelButterworth', name: 'Butterworth' })
      } catch {}
    }

    // 4. Notch/Bandstop Accel
    if (cfg.notch.enabled) {
      try {
        const y = applyBandstopAccel(samples, cfg.notch.centerHz, cfg.notch.bandwidthHz, {
          order: cfg.notch.order,
          zeroPhase: cfg.notch.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) samples[i].accelNotch = y[i]
        enabledAccelFilters.push({ key: 'accelNotch', name: 'Band-stop' })
      } catch {}
    }

    // 5. CFC Accel
    if (cfg.cfc.enabled) {
      try {
        const { filtered } = applyCrashFilterCFCAccel(samples, cfg.cfc.cfc, {
          order: cfg.cfc.order,
          zeroPhase: cfg.cfc.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) samples[i].accelCFC = filtered[i]
        enabledAccelFilters.push({ key: 'accelCFC', name: 'CFC' })
      } catch {}
    }

    // 6. JERK CALCULATION
    // Only calculate if exactly one clean acceleration signal is currently enabled
    if (cfg.jerk.enabled) {
      if (enabledAccelFilters.length === 1) {
        const sourceKey = enabledAccelFilters[0].key

        const win = sanitizeOddWindow(cfg.jerk.windowSize, samples.length)
        const poly = sanitizePolynomial(cfg.jerk.polynomial)

        if (win != null) {
          try {
            // Use specialized derivative calculator
            const jerkValues = computeJerkSavitzkyGolay(
              samples,
              (s) => s[sourceKey] as number | null,
              win,
              poly,
            )

            for (let i = 0; i < samples.length; i++) {
              samples[i].jerk = jerkValues[i]
            }
          } catch (e) {
            console.warn('Jerk calculation failed', e)
          }
        }
      } else {
        // We don't calculate jerk if 0 or >1 filters are active to avoid ambiguity
        // (The UI will show a warning)
      }
    }

    setDisplaySamples(samples)
  })

  return { displaySamples }
}
