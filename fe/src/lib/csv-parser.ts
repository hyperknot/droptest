/**
 * Pure CSV Parsing. Returns flat, raw data.
 * Expects columns: time0 (seconds), accel (g)
 */
export function parseRawCSV(text: string): Array<{ timeMs: number; accel: number }> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  // Find header with required columns
  const headerIdx = lines.findIndex(
    (l) => l.toLowerCase().includes('accel') && l.toLowerCase().includes('time0'),
  )
  if (headerIdx === -1) throw new Error('Missing "accel" and "time0" columns')

  const headers = lines[headerIdx].split(',').map((h) => h.trim().toLowerCase())
  const colAccel = headers.indexOf('accel')
  const colTime = headers.indexOf('time0')

  const rawOut: Array<{ timeMs: number; accel: number }> = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length <= Math.max(colAccel, colTime)) continue

    const accel = Number.parseFloat(parts[colAccel])
    const timeSec = Number.parseFloat(parts[colTime])

    if (!Number.isFinite(accel) || !Number.isFinite(timeSec)) continue

    rawOut.push({ timeMs: timeSec * 1000, accel })
  }

  if (rawOut.length === 0) throw new Error('No valid data rows found')

  rawOut.sort((a, b) => a.timeMs - b.timeMs)

  return rawOut
}
