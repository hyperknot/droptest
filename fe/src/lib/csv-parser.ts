/**
 * Pure CSV Parsing. Returns flat, raw data.
 * Does NOT perform offset calculation or filtering.
 */
export function parseRawCSV(text: string): Array<{ timeMs: number; accel: number }> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  // Find header
  const headerIdx = lines.findIndex(
    (l) => l.toLowerCase().includes('accel') && l.toLowerCase().includes('datetime'),
  )
  if (headerIdx === -1) throw new Error('Missing "accel" and "datetime" columns')

  const headers = lines[headerIdx].split(',').map((h) => h.trim().toLowerCase())
  const colAccel = headers.indexOf('accel')
  const colDate = headers.indexOf('datetime')

  const rawOut: Array<{ timeMs: number; accel: number }> = []

  // Parse data
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length <= Math.max(colAccel, colDate)) continue

    const a = Number.parseFloat(parts[colAccel])
    const dStr = parts[colDate]

    if (!Number.isFinite(a)) continue

    // Parse custom "YYYY-MM-DD HH:mm:ss.SSS" format
    // Simple approach: replace separation, standard parse, add ms manually if needed
    // Assuming the input format is strict based on previous patterns:
    const [ymd, hms] = dStr.trim().split(' ')
    if (!ymd || !hms) continue

    const [y, m, d] = ymd.split('-').map(Number)
    const [hr, min, secRest] = hms.split(':')
    const [sec, msStr] = secRest.split('.')

    // Construct UTC timestamp
    const ms = Number.parseInt((msStr || '0').padEnd(3, '0').slice(0, 3), 10)
    const ts = Date.UTC(
      y,
      m - 1,
      d,
      Number.parseInt(hr, 10),
      Number.parseInt(min, 10),
      Number.parseFloat(sec),
      ms,
    )

    if (Number.isNaN(ts)) continue

    rawOut.push({ timeMs: ts, accel: a })
  }

  if (rawOut.length === 0) throw new Error('No valid data rows found')

  // Ensure sorted
  rawOut.sort((a, b) => a.timeMs - b.timeMs)

  // Normalize time to start at 0 relative to file start (temp, will be re-zeroed by logic later)
  const start = rawOut[0].timeMs
  return rawOut.map((r) => ({
    timeMs: r.timeMs - start,
    accel: r.accel,
  }))
}
