import { createEffect, createSignal } from 'solid-js'
import {
  applyBandstopAccel,
  applyButterworthLowpassAccel,
  applyCrashFilterCFCAccel,
  applySavitzkyGolayAccel,
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

    for (const s of samples) {
      s.accelSG = null
      s.accelMA = null
      s.accelButterworth = null
      s.accelNotch = null
      s.accelCFC = null
    }

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

    if (cfg.movingAverage.enabled) {
      const win = sanitizeOddWindow(cfg.movingAverage.windowSize, samples.length)
      if (win != null) {
        try {
          const y = computeMovingAverageAccel(samples, win)
          for (let i = 0; i < samples.length; i++) {
            samples[i].accelMA = y[i]
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

    if (cfg.notch.enabled) {
      try {
        const y = applyBandstopAccel(samples, cfg.notch.centerHz, cfg.notch.bandwidthHz, {
          order: cfg.notch.order,
          zeroPhase: cfg.notch.zeroPhase,
        })
        for (let i = 0; i < samples.length; i++) {
          samples[i].accelNotch = y[i]
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

    setDisplaySamples(samples)
  })

  return { displaySamples }
}
