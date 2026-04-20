import type { RawSample } from '../types'

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value

  const text = String(value ?? '').trim()
  if (!text) return Number.NaN

  const match = text.match(/[-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?/)
  if (!match) return Number.NaN

  return Number.parseFloat(match[0].replace(',', '.'))
}

function isTimeInMilliseconds(maxTime: number, medianStep: number): boolean {
  if (Number.isFinite(medianStep)) {
    if (medianStep < 0.1) return false
    if (medianStep >= 0.1) return true
  }

  return maxTime > 100
}

function inferMedianTimeStep(values: Array<{ time: number; accel: number }>): number {
  const positiveSteps: Array<number> = []

  for (let i = 1; i < values.length && positiveSteps.length < 2048; i++) {
    const step = values[i].time - values[i - 1].time
    if (step > 0) positiveSteps.push(step)
  }

  return median(positiveSteps)
}

function toRawSamples(values: Array<{ time: number; accel: number }>): Array<RawSample> {
  if (values.length === 0) throw new Error('No valid data rows found')

  let maxTime = Number.NEGATIVE_INFINITY
  for (const { time } of values) {
    if (time > maxTime) maxTime = time
  }

  const medianStep = inferMedianTimeStep(values)
  const isMsFormat = isTimeInMilliseconds(maxTime, medianStep)

  return values
    .map(({ time, accel }) => ({
      timeMs: isMsFormat ? time : time * 1000,
      accelRaw: accel,
    }))
    .sort((a, b) => a.timeMs - b.timeMs)
}

function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t'

  const semicolons = (line.match(/;/g) || []).length
  const commas = (line.match(/,/g) || []).length

  return semicolons >= commas && semicolons > 0 ? ';' : ','
}

function extractRowsFromText(text: string): Array<Array<string>> {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(detectDelimiter(line)).map((part) => part.trim()))
}

function findHeaderColumn(headers: Array<string>, patterns: Array<string>): number {
  return headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)))
}

function toDenseStringRow(row: Array<unknown>): Array<string> {
  return Array.from({ length: row.length }, (_, i) => String(row[i] ?? ''))
}

function findTimeHeaderColumns(headers: Array<string>): Array<number> {
  const preferredPatterns = ['toffset', 'time0', 'x_value', 'zeit', 'time', 'ttotal']
  const out: Array<number> = []

  for (const pattern of preferredPatterns) {
    const idx = headers.indexOf(pattern)
    if (idx !== -1 && !out.includes(idx)) out.push(idx)
  }

  for (const pattern of preferredPatterns) {
    const idx = headers.findIndex(
      (header) =>
        !['datetime', 'timestamp', 'date', 'date_time'].includes(header) &&
        header.includes(pattern),
    )
    if (idx !== -1 && !out.includes(idx)) out.push(idx)
  }

  return out
}

function findAccelHeaderColumn(headers: Array<string>, timeCol: number): number {
  const specificPatterns = ['accel', 'acceleration', 'acc', 'a raw', 'araw', 'g-sensor']
  const specificCol = headers.findIndex(
    (header, idx) =>
      idx !== timeCol && specificPatterns.some((pattern) => header.includes(pattern)),
  )
  if (specificCol !== -1) return specificCol

  return headers.findIndex(
    (header, idx) =>
      idx !== timeCol && ['measured value', 'value'].some((pattern) => header === pattern),
  )
}

function parseDelimitedRows(rows: Array<Array<string>>): Array<RawSample> | null {
  for (let headerIdx = 0; headerIdx < Math.min(rows.length, 50); headerIdx++) {
    const headers = Array.from({ length: rows[headerIdx].length }, (_, i) =>
      normalizeText(rows[headerIdx][i]),
    )
    const timeCols = findTimeHeaderColumns(headers)

    for (const timeCol of timeCols) {
      const accelCol = findAccelHeaderColumn(headers, timeCol)
      if (accelCol === -1) continue

      const values: Array<{ time: number; accel: number }> = []
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i]
        if (row.length <= Math.max(timeCol, accelCol)) continue

        const time = parseNumber(row[timeCol])
        const accel = parseNumber(row[accelCol])
        if (!Number.isFinite(time) || !Number.isFinite(accel)) continue

        values.push({ time, accel })
      }

      if (values.length > 0) return toRawSamples(values)
    }
  }

  return null
}

function median(values: Array<number>): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function parseRowsHeuristically(rows: Array<Array<unknown>>): Array<RawSample> | null {
  const numericRows = rows
    .map((row) => row.map((cell) => parseNumber(cell)))
    .filter((row) => row.filter(Number.isFinite).length >= 2)

  if (numericRows.length === 0) return null

  const width = Math.max(...numericRows.map((row) => row.length))
  const colStats = Array.from({ length: width }, (_, col) => {
    const values = numericRows.map((row) => row[col]).filter(Number.isFinite)
    const steps = [] as Array<number>

    for (let i = 1; i < values.length; i++) {
      const delta = values[i] - values[i - 1]
      if (delta > 0) steps.push(delta)
    }

    const monotonic = values.length < 2 ? 0 : steps.length / (values.length - 1)

    return {
      col,
      count: values.length,
      monotonic,
      medianStep: median(steps),
      range: values.length === 0 ? 0 : Math.max(...values) - Math.min(...values),
    }
  })

  const timeCol = [...colStats]
    .filter((stat) => stat.count >= 20 && stat.monotonic > 0.9 && Number.isFinite(stat.medianStep))
    .sort((a, b) => a.medianStep - b.medianStep || b.count - a.count)[0]?.col

  if (timeCol == null) return null

  const accelCandidates = colStats.filter((stat) => stat.col !== timeCol && stat.count >= 20)
  const accelCol =
    [...accelCandidates]
      .filter((stat) => stat.monotonic < 0.95)
      .sort((a, b) => Math.abs(b.range) - Math.abs(a.range))[0]?.col ??
    accelCandidates.sort((a, b) => Math.abs(b.range) - Math.abs(a.range))[0]?.col

  if (accelCol == null) return null

  const values: Array<{ time: number; accel: number }> = []
  for (const row of numericRows) {
    const time = row[timeCol]
    const accel = row[accelCol]
    if (!Number.isFinite(time) || !Number.isFinite(accel)) continue
    values.push({ time, accel })
  }

  if (values.length === 0) return null
  return toRawSamples(values)
}

function parseMeas9206(text: string): Array<RawSample> | null {
  if (!text.includes('[MEAS]')) return null

  const values = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+=/.test(line))
    .map((line) => line.slice(line.indexOf('=') + 1).split(';'))
    .map(([time, accel]) => ({ time: parseNumber(time), accel: parseNumber(accel) }))
    .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.accel))

  return values.length > 0 ? toRawSamples(values) : null
}

function parseSimpleNumericText(text: string): Array<RawSample> | null {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const values: Array<{ time: number; accel: number }> = []
  let checkedLines = 0
  let matchedLines = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    checkedLines += 1

    const delimiter = detectDelimiter(line)
    const parts = line.split(delimiter)
    if (parts.length < 2) continue

    const time = parseNumber(parts[0])
    const accel = parseNumber(parts[1])
    if (!Number.isFinite(time) || !Number.isFinite(accel)) continue

    matchedLines += 1
    values.push({ time, accel })
  }

  if (values.length === 0) return null

  const enoughMatches = matchedLines >= 100 || matchedLines >= checkedLines * 0.8
  return enoughMatches ? toRawSamples(values) : null
}

function parseTextDataWithConfidence(text: string): {
  samples: Array<RawSample>
  confidence: number
} {
  const meas = parseMeas9206(text)
  if (meas) return { samples: meas, confidence: 4 }

  const rows = extractRowsFromText(text)

  const structured = parseDelimitedRows(rows)
  if (structured) return { samples: structured, confidence: 3 }

  const simple = parseSimpleNumericText(text)
  if (simple) return { samples: simple, confidence: 1 }

  const heuristic = parseRowsHeuristically(rows)
  if (heuristic) return { samples: heuristic, confidence: 2 }

  throw new Error('Could not find time/acceleration data in file')
}

function parseTextData(text: string): Array<RawSample> {
  return parseTextDataWithConfidence(text).samples
}

function decodeTextBytes(bytes: Uint8Array, encoding: string): string {
  return new TextDecoder(encoding, { fatal: false }).decode(bytes)
}

function parseTextFileBytes(bytes: Uint8Array): Array<RawSample> {
  const decodings = ['utf-8', 'windows-1252']
  let best: { samples: Array<RawSample>; confidence: number } | null = null
  let lastError: Error | null = null

  for (const encoding of decodings) {
    try {
      const parsed = parseTextDataWithConfidence(decodeTextBytes(bytes, encoding))
      if (!best || parsed.confidence > best.confidence) best = parsed
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  if (best) return best.samples
  throw lastError ?? new Error('Could not decode text file')
}

function parseWorkbookRows(rows: Array<Array<unknown>>): Array<RawSample> | null {
  const structured = parseDelimitedRows(rows.map(toDenseStringRow))
  if (structured) return structured

  return parseRowsHeuristically(rows)
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function parseXmlAttrs(tag: string): Record<string, string> {
  return Object.fromEntries(
    Array.from(tag.matchAll(/([\w:.-]+)="([^"]*)"/g), (match) => [match[1], decodeXmlText(match[2])]),
  )
}

function columnIndex(ref: string): number {
  const letters = ref.match(/[A-Z]+/i)?.[0] ?? ''
  let index = 0
  for (const ch of letters.toUpperCase()) {
    index = index * 26 + ch.charCodeAt(0) - 64
  }
  return Math.max(0, index - 1)
}

function parseSheetXmlRows(xml: string, sharedStrings: Array<string>): Array<Array<unknown>> {
  const rows: Array<Array<unknown>> = []

  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const row: Array<unknown> = []
    let nextIdx = 0

    for (const cellMatch of rowMatch[1].matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      const attrs = parseXmlAttrs(cellMatch[1])
      const idx = attrs.r ? columnIndex(attrs.r) : nextIdx
      const rawValue =
        cellMatch[2].match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1]
        ?? cellMatch[2].match(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1]
        ?? ''

      let value: unknown = decodeXmlText(rawValue)
      if (attrs.t === 's') value = sharedStrings[Number(value)] ?? ''
      else if (attrs.t !== 'str' && attrs.t !== 'inlineStr') {
        const num = parseNumber(value)
        value = Number.isFinite(num) ? num : value
      }

      row[idx] = value
      nextIdx = idx + 1
    }

    rows.push(row)
  }

  return rows
}

async function parseXlsxWorkbookFallback(file: File): Promise<Array<RawSample>> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (!workbookXml || !relsXml) throw new Error('Invalid XLSX workbook')

  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string')
  const sharedStrings = Array.from(
    (sharedStringsXml ?? '').matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g),
    (match) =>
      Array.from(match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g), (part) =>
        decodeXmlText(part[1]),
      ).join(''),
  )

  const relTargets = new Map(
    Array.from(
      relsXml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/>/g),
      (match) => {
        const attrs = parseXmlAttrs(match[1])
        return [attrs.Id ?? '', attrs.Target ?? '']
      },
    ),
  )

  for (const sheetMatch of workbookXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/>/g)) {
    const attrs = parseXmlAttrs(sheetMatch[1])
    const relId = attrs['r:id'] ?? ''
    const target = relTargets.get(relId)
    if (!target) continue

    const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const sheetXml = await zip.file(sheetPath)?.async('string')
    if (!sheetXml) continue

    const parsed = parseWorkbookRows(parseSheetXmlRows(sheetXml, sharedStrings))
    if (parsed) return parsed
  }

  throw new Error('Could not find time/acceleration data in XLSX workbook')
}

async function parseSpreadsheetWorkbook(file: File): Promise<Array<RawSample>> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    })

    const parsed = parseWorkbookRows(rows)
    if (parsed) return parsed
  }

  throw new Error('Could not find time/acceleration data in workbook')
}

async function parseWorkbook(file: File): Promise<Array<RawSample>> {
  try {
    return await parseSpreadsheetWorkbook(file)
  } catch (error) {
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      return parseXlsxWorkbookFallback(file)
    }
    throw error
  }
}

export async function parseDroppedFile(file: File): Promise<Array<RawSample>> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.sum')) {
    throw new Error(
      'SUM files only reference a measurement file. Drop the matching .meas9206 or .sum.xlsx instead.',
    )
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xlsb')) {
    return parseWorkbook(file)
  }

  return parseTextFileBytes(new Uint8Array(await file.arrayBuffer()))
}

export function parseRawCSV(text: string): Array<RawSample> {
  return parseTextData(text)
}
