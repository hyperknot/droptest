import type { DropTestData, FileMetadata, SamplePoint } from '../types'

const G_CONST = 9.81 // m/s^2

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

    // Convert acceleration from m/s^2 to G
    const accelG = accel / G_CONST

    // Convert time from seconds to milliseconds
    const timeMs = time0 * 1000

    samples.push({
      timeMs,
      accelG,
      datetime,
    })

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

  return {
    filename,
    samples,
    metadata,
  }
}
