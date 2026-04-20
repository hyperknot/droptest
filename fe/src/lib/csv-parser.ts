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
    .filter(Boolean)
    .map((line) => line.split(detectDelimiter(line)).map((part) => part.trim()))
}

function findHeaderColumn(headers: Array<string>, patterns: Array<string>): number {
  return headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)))
}

function findTimeHeaderColumn(headers: Array<string>): number {
  const exactPatterns = ['time0', 'ttotal', 'toffset', 'x_value', 'zeit', 'time']
  const exactCol = headers.findIndex((header) => exactPatterns.includes(header))
  if (exactCol !== -1) return exactCol

  return headers.findIndex(
    (header) =>
      !['datetime', 'timestamp', 'date', 'date_time'].includes(header)
      && exactPatterns.some((pattern) => header.includes(pattern)),
  )
}

function findAccelHeaderColumn(headers: Array<string>, timeCol: number): number {
  const specificPatterns = [
    'accel',
    'acceleration',
    'acc',
    'a raw',
    'araw',
    'g-sensor',
  ]
  const specificCol = headers.findIndex(
    (header, idx) => idx !== timeCol && specificPatterns.some((pattern) => header.includes(pattern)),
  )
  if (specificCol !== -1) return specificCol

  return headers.findIndex(
    (header, idx) => idx !== timeCol && ['measured value', 'value'].some((pattern) => header === pattern),
  )
}

function parseDelimitedRows(rows: Array<Array<string>>): Array<RawSample> | null {
  for (let headerIdx = 0; headerIdx < Math.min(rows.length, 50); headerIdx++) {
    const headers = rows[headerIdx].map(normalizeText)
    const timeCol = findTimeHeaderColumn(headers)
    const accelCol = timeCol === -1 ? -1 : findAccelHeaderColumn(headers, timeCol)

    if (timeCol === -1 || accelCol === -1) continue

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

    const monotonic =
      values.length < 2
        ? 0
        : steps.length / (values.length - 1)

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
  const accelCol = [...accelCandidates]
    .filter((stat) => stat.monotonic < 0.95)
    .sort((a, b) => Math.abs(b.range) - Math.abs(a.range))[0]?.col
    ?? accelCandidates.sort((a, b) => Math.abs(b.range) - Math.abs(a.range))[0]?.col

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

function parseTextData(text: string): Array<RawSample> {
  const meas = parseMeas9206(text)
  if (meas) return meas

  const simple = parseSimpleNumericText(text)
  if (simple) return simple

  const rows = extractRowsFromText(text)
  const structured = parseDelimitedRows(rows)
  if (structured) return structured

  const heuristic = parseRowsHeuristically(rows)
  if (heuristic) return heuristic

  throw new Error('Could not find time/acceleration data in file')
}

function parseWorkbookRows(rows: Array<Array<unknown>>): Array<RawSample> | null {
  const structured = parseDelimitedRows(rows.map((row) => row.map((cell) => String(cell ?? ''))))
  if (structured) return structured

  return parseRowsHeuristically(rows)
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function elements(node: ParentNode, tagName: string): Array<Element> {
  return Array.from((node as Document | Element).getElementsByTagNameNS('*', tagName))
}

function directChildren(node: ParentNode, tagName: string): Array<Element> {
  return Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === tagName,
  )
}

function attr(node: Element, name: string): string {
  return (
    node.getAttribute(name)
    ?? Array.from(node.attributes).find(
      (attribute) => attribute.name === name || attribute.localName === name,
    )?.value
    ?? ''
  )
}

function firstText(node: ParentNode, tagNames: Array<string>): string {
  for (const tagName of tagNames) {
    const text = elements(node, tagName)[0]?.textContent?.trim()
    if (text) return text
  }

  return ''
}

function columnIndex(ref: string | null): number {
  const letters = (ref ?? '').match(/[A-Z]+/i)?.[0] ?? ''
  let index = 0

  for (const ch of letters.toUpperCase()) {
    index = index * 26 + ch.charCodeAt(0) - 64
  }

  return Math.max(0, index - 1)
}

async function parseXlsxWorkbook(file: File): Promise<Array<RawSample>> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (!workbookXml || !relsXml) throw new Error('Invalid XLSX workbook')

  const workbookDoc = parseXml(workbookXml)
  const relsDoc = parseXml(relsXml)

  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string')
  const sharedStrings = sharedStringsXml
    ? elements(parseXml(sharedStringsXml), 'si').map((si) =>
        elements(si, 't')
          .map((t) => t.textContent ?? '')
          .join(''),
      )
    : []

  const relTargets = new Map(
    elements(relsDoc, 'Relationship').map((rel) => [
      attr(rel, 'Id'),
      attr(rel, 'Target'),
    ]),
  )

  for (const sheet of elements(workbookDoc, 'sheet')) {
    const relId = attr(sheet, 'r:id') || attr(sheet, 'id') || attr(sheet, 'Id')
    const target = relTargets.get(relId)
    if (!target) continue

    const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const sheetXml = await zip.file(sheetPath)?.async('string')
    if (!sheetXml) continue

    const sheetDoc = parseXml(sheetXml)
    const sheetData = elements(sheetDoc, 'sheetData')[0]
    if (!sheetData) continue

    const rows = directChildren(sheetData, 'row').map((row) => {
      const out: Array<unknown> = []
      let nextIdx = 0

      for (const cell of directChildren(row, 'c')) {
        const ref = attr(cell, 'r')
        const idx = ref ? columnIndex(ref) : nextIdx
        const type = attr(cell, 't')
        let value: unknown = firstText(cell, ['v', 't'])

        if (type === 's') value = sharedStrings[Number(value)] ?? ''
        else if (type !== 'str' && type !== 'inlineStr') {
          const num = parseNumber(value)
          value = Number.isFinite(num) ? num : value
        }

        out[idx] = value
        nextIdx = idx + 1
      }

      return out
    })

    const parsed = parseWorkbookRows(rows)
    if (parsed) return parsed
  }

  throw new Error('Could not find time/acceleration data in XLSX workbook')
}

async function parseXlsbWorkbook(file: File): Promise<Array<RawSample>> {
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

  throw new Error('Could not find time/acceleration data in XLSB workbook')
}

async function parseWorkbook(file: File): Promise<Array<RawSample>> {
  return file.name.toLowerCase().endsWith('.xlsb') ? parseXlsbWorkbook(file) : parseXlsxWorkbook(file)
}

export async function parseDroppedFile(file: File): Promise<Array<RawSample>> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.sum')) {
    throw new Error('SUM files only reference a measurement file. Drop the matching .meas9206 or .sum.xlsx instead.')
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xlsb')) {
    return parseWorkbook(file)
  }

  return parseTextData(await file.text())
}

export function parseRawCSV(text: string): Array<RawSample> {
  return parseTextData(text)
}
