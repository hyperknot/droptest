import type { DropTestData, FileMetadata, SamplePoint } from '../types'

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

  let msFraction = fractionStr
  if (msFraction.length > 3) {
    msFraction = msFraction.slice(0, 3)
  } else if (msFraction.length < 3) {
    msFraction = msFraction.padEnd(3, '0')
  }

  const millis = Number.parseInt(msFraction, 10)
  if (!Number.isFinite(millis)) return null

  return Date.UTC(year, month - 1, day, hour, minute, second, millis)
}

/**
 * Detect origin time (time0) using only datetime-derived timeMs and accelG.
 * We look for sustained free-fall (accel < -0.5 g) for 100 ms,
 * then set origin 200 ms before that.
 */
function detectOriginTime(samples: Array<SamplePoint>): number {
  const threshold = -0.5
  const durationMs = 100
  const lookbackMs = 200

  for (let i = 0; i < samples.length; i++) {
    if (samples[i].accelG >= threshold) {
      continue
    }

    const triggerTime = samples[i].timeMs
    const durationEnd = triggerTime + durationMs

    const lastSampleTime = samples[samples.length - 1].timeMs
    if (lastSampleTime < durationEnd) {
      continue
    }

    let staysBelow = true

    for (let j = i; j < samples.length; j++) {
      if (samples[j].timeMs > durationEnd) {
        break
      }

      if (samples[j].accelG >= threshold) {
        staysBelow = false
        break
      }
    }

    if (staysBelow) {
      const originTime = triggerTime - lookbackMs
      return Math.max(0, originTime)
    }
  }

  return 0
}

export function parseDropTestFile(
  text: string,
  filename: string,
): Omit<DropTestData, 'statistics'> {
  const lines = text.split('\n').map((line) => line.trim())

  const metadata: FileMetadata = {
    info: [],
  }

  let headerColumns: Array<string> | null = null
  let dataStartIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    if (line.startsWith('#')) {
      const content = line.substring(1).trim()
      if (content && !content.startsWith('INFO:') && !content.startsWith('---')) {
        metadata.info.push(content)
      }
      continue
    }

    const lower = line.toLowerCase()
    if (lower.includes('accel') && lower.includes('datetime')) {
      headerColumns = line.split(',').map((s) => s.trim())
      dataStartIndex = i + 1
      break
    }
  }

  if (!headerColumns || dataStartIndex === -1) {
    throw new Error('Could not find header line with "accel" and "datetime" columns')
  }

  const normalizedHeaders = headerColumns.map((h) => h.toLowerCase())
  const accelIndex = normalizedHeaders.indexOf('accel')
  const datetimeIndex = normalizedHeaders.indexOf('datetime')

  if (accelIndex === -1 || datetimeIndex === -1) {
    throw new Error('Header must contain "accel" and "datetime" columns')
  }

  const rawSamples: Array<{
    accel: number
    datetime: string
    datetimeAbsMs: number
  }> = []

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('#') || line.startsWith('---')) continue

    const parts = line.split(',').map((s) => s.trim())
    if (parts.length <= Math.max(accelIndex, datetimeIndex)) continue

    const accelStr = parts[accelIndex]
    const datetime = parts[datetimeIndex]

    const accel = Number.parseFloat(accelStr)
    if (!Number.isFinite(accel)) continue

    const datetimeAbsMs = parseLabDatetimeToMs(datetime)
    if (datetimeAbsMs === null) {
      throw new Error(`Invalid datetime format at line ${i + 1}: "${datetime}"`)
    }

    rawSamples.push({
      accel,
      datetime,
      datetimeAbsMs,
    })
  }

  if (rawSamples.length === 0) {
    throw new Error('No valid data samples found in file')
  }

  for (let i = 1; i < rawSamples.length; i++) {
    if (rawSamples[i].datetimeAbsMs < rawSamples[i - 1].datetimeAbsMs) {
      throw new Error(
        `Data is not sorted by datetime. Sample ${i} (${rawSamples[i].datetime}) comes before sample ${i - 1} (${rawSamples[i - 1].datetime})`,
      )
    }
  }

  const firstDateTimeMs = rawSamples[0].datetimeAbsMs
  const firstDateTime = rawSamples[0].datetime

  const samples: Array<SamplePoint> = rawSamples.map((raw) => ({
    timeMs: raw.datetimeAbsMs - firstDateTimeMs,
    accelG: raw.accel,
    accelSG: null,
    accelMA: null,
    accelButterworth: null,
    accelNotch: null,
    accelCFC: null,
    jerk: null,
  }))

  const originTimeMs = detectOriginTime(samples)
  const filteredSamples = samples.filter((s) => s.timeMs >= originTimeMs)

  const adjustedSamples: Array<SamplePoint> = filteredSamples.map((s) => ({
    ...s,
    timeMs: s.timeMs - originTimeMs,
  }))

  if (firstDateTime) {
    const datePart = firstDateTime.split(' ')[0]
    if (datePart) {
      metadata.date = datePart
    }
  }

  return {
    filename,
    samples: adjustedSamples,
    metadata,
  }
}
