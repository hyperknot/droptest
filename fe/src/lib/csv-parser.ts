import type { DropTestData, FileMetadata, SamplePoint } from '../types'
import {
  applyCrashFilterCFCAccel,
  applySavitzkyGolayAccel,
  applySavitzkyGolayAccelAuto,
  computeMovingAverageAccel,
} from './accel-filter'

// ... (rest of helpers unchanged)

export function parseDropTestFile(
  text: string,
  filename: string,
): Omit<DropTestData, 'statistics'> {
  const lines = text.split('\n').map((line) => line.trim())

  // Extract metadata from comment lines
  const metadata: FileMetadata = {
    info: [],
  }

  // ... (parsing logic unchanged until SamplePoint construction)

  const samples: Array<SamplePoint> = rawSamples.map((raw) => ({
    timeMs: raw.datetimeAbsMs - firstDateTimeMs,
    accelG: raw.accel, // Raw data is already in G

    speed: raw.speed,
    pos: raw.pos,
    jerk: raw.jerk,

    // Main filtered series (we will fill this later with Savitzky–Golay "auto")
    accelFiltered: null,

    // Factory / logger-provided filtered column from CSV
    accelFactoryFiltered: raw.accelFiltered,

    // Additional series (filled later)
    accelSGShort: null,
    accelMA9: null,

    // Crash‑style filters (filled later)
    accelCFC60: null,
    accelCFC180: null,
  }))

  // Detect origin point based on acceleration threshold (on raw accelG)
  const originTimeMs = detectOriginTime(samples)

  // Filter samples to only include those at or after origin
  const filteredSamples = samples.filter((s) => s.timeMs >= originTimeMs)

  // Adjust timeMs to be relative to new origin
  const adjustedSamples: Array<SamplePoint> = filteredSamples.map((s) => ({
    ...s,
    timeMs: s.timeMs - originTimeMs,
  }))

  // Apply various filters to accelG and populate multiple derived series
  if (adjustedSamples.length >= 5) {
    try {
      // 1) Savitzky–Golay auto (window ≈ one ringing period)
      const { smoothed: sgAuto } = applySavitzkyGolayAccelAuto(adjustedSamples)

      // 2) Savitzky–Golay short window (more detail, less smoothing)
      //    Fixed window size 11 samples (~11 ms at 1 kHz)
      const sgShort = applySavitzkyGolayAccel(adjustedSamples, 11, 3)

      // 3) Simple centered moving average with window size 9 samples (~9 ms)
      const ma9 = computeMovingAverageAccel(adjustedSamples, 9)

      // 4) Crash‑test style Butterworth filters (CFC 60 and CFC 180)
      const { filtered: cfc60 } = applyCrashFilterCFCAccel(adjustedSamples, 60)
      const { filtered: cfc180 } = applyCrashFilterCFCAccel(adjustedSamples, 180)

      const n = adjustedSamples.length
      for (let i = 0; i < n; i++) {
        adjustedSamples[i].accelFiltered = sgAuto[i]
        adjustedSamples[i].accelSGShort = sgShort[i]
        adjustedSamples[i].accelMA9 = ma9[i]
        adjustedSamples[i].accelCFC60 = cfc60[i]
        adjustedSamples[i].accelCFC180 = cfc180[i]
      }
    } catch (err) {
      console.warn(
        'AccelFilterError ' +
          JSON.stringify(
            {
              message: err instanceof Error ? err.message : String(err),
            },
            null,
            2,
          ),
      )
    }
  }

  // ... (metadata date extraction and logging unchanged)

  return {
    filename,
    samples: adjustedSamples,
    metadata,
  }
}
