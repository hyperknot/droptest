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

    // Initialize all filtered fields to null
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

    // Apply Savitzky-Golay main
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

    // Apply Savitzky-Golay strong
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

    // Apply moving average
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

    // Apply Butterworth LP #1
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

    // Apply Butterworth LP #2
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

    // Apply band-stop (notch)
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

    // Apply CFC 60
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

    // Apply CFC 180
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

  return { displaySamples }
}
