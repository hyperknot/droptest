import type { DropTestData, FileMetadata, SamplePoint } from '../types'

const G_CONST = 9.81 // m/s^2

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
      // Extract info lines (skip empty comment lines)
      const content = line.substring(1).trim()
      if (content && !content.startsWith('INFO:') && !content.startsWith('---')) {
        metadata.info.push(content)
      }
    } else if (line.includes('accel') && line.includes('time')) {
      // Found the header row
      dataStartIndex = i + 1
      break
    }
  }

  // Parse data rows
  const samples: Array<SamplePoint> = []
  let firstDateTime: string | undefined
  let firstDateTimeMs: number | undefined

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('#') || line.startsWith('---')) continue

    const parts = line.split(',').map((s) => s.trim())
    if (parts.length < 3) continue

    // Columns: accel, time0, datetime, speed, pos, jerk, accel_filtered
    const accel = Number.parseFloat(parts[0])
    const time0 = Number.parseFloat(parts[1])
    const datetime = parts[2]

    if (!Number.isFinite(accel) || !Number.isFinite(time0)) continue

    const speed = parseOptionalNumber(parts[3])
    const pos = parseOptionalNumber(parts[4])
    const jerk = parseOptionalNumber(parts[5])
    const accelFilteredRaw = parseOptionalNumber(parts[6])

    // Convert acceleration from m/s^2 to G
    const accelG = accel / G_CONST
    const accelFiltered = accelFilteredRaw != null ? accelFilteredRaw / G_CONST : null

    // Convert time0 (seconds) to milliseconds
    const timeMs = time0 * 1000

    // Convert datetime string to ms since first sample
    const datetimeAbsMs = parseLabDatetimeToMs(datetime)
    let datetimeMsFromStart: number | undefined
    if (datetimeAbsMs != null) {
      if (firstDateTimeMs === undefined) {
        firstDateTimeMs = datetimeAbsMs
      }
      datetimeMsFromStart = datetimeAbsMs - firstDateTimeMs
    }

    const sample: SamplePoint = {
      timeMs,
      accelG,
      datetime,
      datetimeMsFromStart,
      time0,
      speed,
      pos,
      jerk,
      accelFiltered,
    }

    samples.push(sample)

    if (!firstDateTime && datetime) {
      firstDateTime = datetime
    }
  }

  // Extract date from first datetime
  if (firstDateTime) {
    const datePart = firstDateTime.split(' ')[0]
    if (datePart) {
      metadata.date = datePart
    }
  }

  // ---- Time alignment diagnostics: time0 vs datetime ----
  if (samples.length > 1) {
    const usable = samples.filter(
      (s) => typeof s.time0 === 'number' && typeof s.datetimeMsFromStart === 'number',
    )

    if (usable.length > 1) {
      const time0Ms = usable.map((s) => (s.time0 as number) * 1000)
      const datetimeMs = usable.map((s) => s.datetimeMsFromStart as number)

      const time0Min = Math.min(...time0Ms)
      const time0Max = Math.max(...time0Ms)
      const datetimeMin = Math.min(...datetimeMs)
      const datetimeMax = Math.max(...datetimeMs)

      const time0Range = time0Max - time0Min
      const datetimeRange = datetimeMax - datetimeMin

      // Test if datetime and time0 differ only by a constant:
      // diff_i = datetime_i - time0_i (in ms); if diffs are all ~equal, it's a constant
      const diffs = usable.map(
        (s) => (s.datetimeMsFromStart as number) - (s.time0 as number) * 1000,
      )
      const diffMin = Math.min(...diffs)
      const diffMax = Math.max(...diffs)
      const diffAvg = diffs.reduce((sum, d) => sum + d, 0) / diffs.length
      const maxDeviation = diffMax - diffMin

      const approxConstant = maxDeviation < 0.5 // <= 0.5 ms spread

      console.groupCollapsed('Time alignment diagnostics (time0 vs datetime)')
      console.log('time0 range (ms):', { min: time0Min, max: time0Max, range: time0Range })
      console.log('datetime range (ms since first sample):', {
        min: datetimeMin,
        max: datetimeMax,
        range: datetimeRange,
      })
      console.log('datetime - time0 offset (ms):', {
        approxConstant,
        averageOffsetMs: diffAvg,
        minOffsetMs: diffMin,
        maxOffsetMs: diffMax,
        maxDeviationMs: maxDeviation,
      })
      console.groupEnd()
    }
  }

  return {
    filename,
    samples,
    metadata,
  }
}
