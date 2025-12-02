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
 * Pure CSV Parsing. Returns flat, raw data.
 * Expects columns: time0 (seconds), accel (g)
 * Auto-detects delimiter (comma vs semicolon)
 * Auto-handles decimal format (dot or comma)
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

  const rawOut: Array<RawSample> = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter)
    if (parts.length <= Math.max(colAccel, colTime)) continue

    const accel = parseNumber(parts[colAccel])
    const timeSec = parseNumber(parts[colTime])

    if (!Number.isFinite(accel) || !Number.isFinite(timeSec)) continue

    rawOut.push({ timeMs: timeSec * 1000, accelRaw: accel })
  }

  if (rawOut.length === 0) throw new Error('No valid data rows found')

  rawOut.sort((a, b) => a.timeMs - b.timeMs)

  return rawOut
}
