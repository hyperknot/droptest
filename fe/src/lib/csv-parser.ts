import type { DropTestData, FileMetadata, SamplePoint } from '../types'
import {
  applyCrashFilterCFCAccel,
  applySavitzkyGolayAccel,
  applySavitzkyGolayAccelAuto,
  computeMovingAverageAccel,
} from './accel-filter'

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

// Parse "YYYY-MM-DD hh:mm:ss.ffffff" -> ms since epoch (UTC)
function parseLabDatetimeToMs(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const [datePart, timePart] = trimmed.split(' ')
  if (!datePart || !timePart) return null

  const [yearStr, monthStr, dayStr] = datePart.split('-')
  const [hourStr, minuteStr, secondPart] = timePart.split(':')

  if (!yearStr || !monthStr || !dayStr || !hourStr || !minuteStr || !secondPart) return null

  const [secStr, fractionStr = '0'] = secondPart.split('.')

  const year = Number.parseInt(yearStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const day = Number.parseInt(dayStr, 10)
  const hour = Number.parseInt(hourStr, 10)
  const minute = Number.parseInt(minuteStr, 10)
  const second = Number.parseInt(secStr, 10)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null
  }

  // Only need millisecond resolution; trim/pad fractional part to 3 digits
  let msFraction = fractionStr
  if (msFraction.length > 3) {
    msFraction = msFraction.slice(0, 3)
  } else if (msFraction.length < 3) {
    msFraction = msFraction.padEnd(3, '0')
  }

  const millis = Number.parseInt(msFraction, 10)
  if (!Number.isFinite(millis)) return null

  // Treat as UTC to get a stable numeric timeline
  return Date.UTC(year, month - 1, day, hour, minute, second, millis)
}

/**
 * Detect the origin point by finding when acceleration first goes
 * below -0.5 G and stays there for 100ms, then calculating back 200ms
 */
function detectOriginTime(samples: Array<SamplePoint>): number {
  const threshold = -0.5 // G
  const durationMs = 100 // ms - must stay below threshold for this long
  const lookbackMs = 200 // ms - origin is this far before trigger point

  for (let i = 0; i < samples.length; i++) {
    if (samples[i].accelG >= threshold) {
      continue // Not below threshold yet
    }

    const triggerTime = samples[i].timeMs
    const durationEnd = triggerTime + durationMs

    // Check if we have enough data to verify 100ms duration
    const lastSampleTime = samples[samples.length - 1].timeMs
    if (lastSampleTime < durationEnd) {
      // Not enough data to verify full duration
      continue
    }

    // Check if acceleration stays below threshold for the next 100ms
    let staysBelow = true

    for (let j = i; j < samples.length; j++) {
      if (samples[j].timeMs > durationEnd) {
        // Successfully verified full 100ms period
        break
      }

      if (samples[j].accelG >= threshold) {
        // Went back above threshold during the 100ms period
        staysBelow = false
        break
      }
    }

    if (staysBelow) {
      // Found the trigger point! Origin is 200ms before this
      const originTime = triggerTime - lookbackMs
      console.log(
        'OriginDetection ' +
          JSON.stringify(
            {
              triggerTime,
              originTime: Math.max(0, originTime),
              triggerAccel: samples[i].accelG,
            },
            null,
            2,
          ),
      )
      return Math.max(0, originTime)
    }
  }

  // No valid trigger found, use 0 as origin
  console.log(`OriginDetection ${JSON.stringify({ originTime: 0 }, null, 2)}`)
  return 0
}

export function parseDropTestFile(
  text: string,
  filename: string,
): Omit<DropTestData, 'statistics'> {
  const lines = text.split('\n').map((line) => line.trim())

  // Extract metadata from comment lines
  const metadata: FileMetadata = {
    info: [],
  }

  let dataStartIndex = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('#')) {
      const content = line.substring(1).trim()
      if (content && !content.startsWith('INFO:') && !content.startsWith('---')) {
        metadata.info.push(content)
      }
    } else if (line.includes('accel') && line.includes('datetime')) {
      dataStartIndex = i + 1
      break
    }
  }

  // First pass: collect all datetime values and check they exist
  const rawSamples: Array<{
    accel: number
    datetime: string
    datetimeAbsMs: number
    speed: number | null
    pos: number | null
    jerk: number | null
    accelFiltered: number | null
  }> = []

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('#') || line.startsWith('---')) continue

    const parts = line.split(',').map((s) => s.trim())
    if (parts.length < 3) continue

    const accel = Number.parseFloat(parts[0])
    const datetime = parts[2]

    if (!Number.isFinite(accel)) continue

    const datetimeAbsMs = parseLabDatetimeToMs(datetime)
    if (datetimeAbsMs === null) {
      throw new Error(`Invalid datetime format at line ${i + 1}: "${datetime}"`)
    }

    const speed = parseOptionalNumber(parts[3])
    const pos = parseOptionalNumber(parts[4])
    const jerk = parseOptionalNumber(parts[5])
    const accelFiltered = parseOptionalNumber(parts[6])

    rawSamples.push({
      accel,
      datetime,
      datetimeAbsMs,
      speed,
      pos,
      jerk,
      accelFiltered,
    })
  }

  if (rawSamples.length === 0) {
    throw new Error('No valid data samples found in file')
  }

  // Check if datetime values are sorted (monotonically increasing)
  for (let i = 1; i < rawSamples.length; i++) {
    if (rawSamples[i].datetimeAbsMs < rawSamples[i - 1].datetimeAbsMs) {
      throw new Error(
        `Data is not sorted by datetime. Sample ${i} (${rawSamples[i].datetime}) comes before sample ${i - 1} (${rawSamples[i - 1].datetime})`,
      )
    }
  }

  // Calculate relative time from first sample (first sample = 0 ms)
  const firstDateTimeMs = rawSamples[0].datetimeAbsMs
  const firstDateTime = rawSamples[0].datetime

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

  // Extract date from first datetime
  if (firstDateTime) {
    const datePart = firstDateTime.split(' ')[0]
    if (datePart) {
      metadata.date = datePart
    }
  }

  console.log(
    'TimeRangeAfterOrigin ' +
      JSON.stringify(
        {
          originalSamples: samples.length,
          filteredSamples: adjustedSamples.length,
          originTimeMs,
          newDuration:
            adjustedSamples.length > 0 ? adjustedSamples[adjustedSamples.length - 1].timeMs : 0,
        },
        null,
        2,
      ),
  )

  return {
    filename,
    samples: adjustedSamples,
    metadata,
  }
}
