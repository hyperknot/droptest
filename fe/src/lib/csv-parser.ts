import type { RawSample } from '../types'

/**
 * Detects delimiter by counting occurrences in header
 */
function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length
  const commas = (headerLine.match(/,/g) || []).length

  return semicolons >= commas && semicolons > 0 ? ';' : ','
}

/**
 * Parses a number, normalizing comma decimal separators to dots
 */
function parseNumber(value: string): number {
  return Number.parseFloat(value.trim().replace(',', '.'))
}

/**
 * Detects if time values are in seconds or milliseconds.
 * Heuristic: if max value > 100, assume milliseconds.
 */
function isTimeInMilliseconds(maxTime: number): boolean {
  return maxTime > 100
}

/**
 * Pure CSV Parsing. Returns flat, raw data.
 * Expects columns: time0, accel (g)
 * Auto-detects: delimiter, decimal format, time unit (sec vs ms)
 */
export function parseRawCSV(text: string): Array<RawSample> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  // Find header with required columns
  const headerIdx = lines.findIndex(
    (l) => l.toLowerCase().includes('accel') && l.toLowerCase().includes('time0'),
  )
  if (headerIdx === -1) throw new Error('Missing "accel" and "time0" columns')

  const headerLine = lines[headerIdx]
  const delimiter = detectDelimiter(headerLine)

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h)

  const colAccel = headers.indexOf('accel')
  const colTime = headers.indexOf('time0')

  if (colAccel === -1 || colTime === -1) {
    throw new Error('Missing "accel" and "time0" columns')
  }

  // First pass: collect raw values
  const rawValues: Array<{ accel: number; time: number }> = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter)
    if (parts.length <= Math.max(colAccel, colTime)) continue

    const accel = parseNumber(parts[colAccel])
    const time = parseNumber(parts[colTime])

    if (!Number.isFinite(accel) || !Number.isFinite(time)) continue

    rawValues.push({ accel, time })
  }

  if (rawValues.length === 0) throw new Error('No valid data rows found')

  // Detect time unit based on max value
  const maxTime = Math.max(...rawValues.map((v) => v.time))
  const isMsFormat = isTimeInMilliseconds(maxTime)

  // Convert to output format (always store as ms)
  const rawOut: Array<RawSample> = rawValues.map(({ accel, time }) => ({
    timeMs: isMsFormat ? time : time * 1000,
    accelRaw: accel,
  }))

  rawOut.sort((a, b) => a.timeMs - b.timeMs)

  return rawOut
}
