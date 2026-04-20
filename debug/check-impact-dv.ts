#!/usr/bin/env -S pnpm dlx tsx

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseDroppedFile } from '../fe/src/lib/csv-parser.ts'
import { cfcFilter } from '../fe/src/lib/filter/cfc.ts'
import { detectOriginTime, findFirstHitRange } from '../fe/src/lib/filter/range.ts'
import { resampleToUniform } from '../fe/src/lib/filter/resample.ts'
import { sgFilter } from '../fe/src/lib/filter/sg.ts'
import { computeImpactEnergyForWindow, computeVelocityTimeline } from '../fe/src/lib/metrics/energy.ts'
import { calculateHIC } from '../fe/src/lib/metrics/hic.ts'
import type { ProcessedSample, RawSample } from '../fe/src/types.ts'

const DATA_DIR = '/Users/user/Documents/life/paragliding/2026/droptest/data'
const ACCEL_CFC = 100
const JERK_WINDOW_MS = 11
const JERK_POLY_ORDER = 1
const HIC_WINDOW_MS = 100
const HIC_EXPONENT = 2.0
const ORIGIN_CFC = 75
const MIN_DV_MPS = 2
const MAX_DV_MPS = 16
const SUPPORTED_EXTENSIONS = new Set([
  '.csv',
  '.txt',
  '.lvm',
  '.meas9206',
  '.xlsx',
  '.xlsb',
  '.sum',
])

function processRawSamples(
  rawSamples: Array<RawSample>,
  sampleRateHz: number,
): Array<ProcessedSample> {
  if (rawSamples.length === 0) return []

  const nyquist = sampleRateHz / 2
  const maxCfc = (nyquist * 0.94) / 2.0775
  const safeCfc = Math.min(ACCEL_CFC, maxCfc)

  const accelRawArray = rawSamples.map((s) => s.accelRaw)
  const accelFilteredAll = cfcFilter(accelRawArray, sampleRateHz, safeCfc)
  const jerkAll = sgFilter(
    accelFilteredAll,
    JERK_WINDOW_MS,
    JERK_POLY_ORDER,
    sampleRateHz,
    1,
  )
  const hicScalar = calculateHIC(accelFilteredAll, HIC_WINDOW_MS, sampleRateHz, HIC_EXPONENT)
  const hicAll = new Array<number>(rawSamples.length).fill(hicScalar)

  const isInvalid = (i: number) =>
    !Number.isFinite(accelFilteredAll[i]) ||
    !Number.isFinite(jerkAll[i]) ||
    !Number.isFinite(hicAll[i])

  let start = 0
  let end = rawSamples.length - 1
  while (start <= end && isInvalid(start)) start++
  while (end >= start && isInvalid(end)) end--
  if (start > end) return []

  const t0 = rawSamples[start].timeMs
  const out: Array<ProcessedSample> = []

  for (let i = start; i <= end; i++) {
    const accelFiltered = accelFilteredAll[i]
    const jerkSG = jerkAll[i]
    const hic = hicAll[i]
    if (!Number.isFinite(accelFiltered) || !Number.isFinite(jerkSG) || !Number.isFinite(hic)) {
      continue
    }

    out.push({
      timeMs: rawSamples[i].timeMs - t0,
      accelRaw: rawSamples[i].accelRaw,
      accelFiltered,
      jerkSG,
      hic,
    })
  }

  return out
}

async function walkFiles(dir: string): Promise<Array<string>> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return walkFiles(fullPath)
      if (entry.isFile()) return [fullPath]
      return []
    }),
  )
  return files.flat().sort((a, b) => a.localeCompare(b))
}

async function readAsFile(filePath: string): Promise<File> {
  const bytes = await fs.readFile(filePath)
  return new File([bytes], path.basename(filePath))
}

function rel(filePath: string): string {
  return path.relative(DATA_DIR, filePath) || path.basename(filePath)
}

async function withQuietConsole<T>(fn: () => Promise<T>): Promise<T> {
  const oldLog = console.log
  const oldInfo = console.info
  const oldDebug = console.debug
  console.log = () => {}
  console.info = () => {}
  console.debug = () => {}
  try {
    return await fn()
  } finally {
    console.log = oldLog
    console.info = oldInfo
    console.debug = oldDebug
  }
}

type Result =
  | { kind: 'ok'; file: string; deltaVMps: number }
  | { kind: 'unprocessed'; file: string; reason: string }

async function processFile(filePath: string): Promise<Result> {
  try {
    const ext = path.extname(filePath).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return { kind: 'unprocessed', file: rel(filePath), reason: `unsupported extension: ${ext}` }
    }

    return await withQuietConsole(async () => {
      const file = await readAsFile(filePath)
      const rawData = await parseDroppedFile(file)
      const { samples: uniformData, sampleRateHz } = resampleToUniform(rawData)

      const accelForOrigin = uniformData.map((s) => s.accelRaw)
      const filteredForOrigin = cfcFilter(accelForOrigin, sampleRateHz, ORIGIN_CFC)
      const originTime = detectOriginTime(uniformData, filteredForOrigin)

      const trimmedRaw = uniformData
        .filter((s) => s.timeMs >= originTime)
        .map((s) => ({
          timeMs: s.timeMs - originTime,
          accelRaw: s.accelRaw,
        }))

      const processedSamples = processRawSamples(trimmedRaw, sampleRateHz)
      if (processedSamples.length === 0) {
        return { kind: 'unprocessed', file: rel(filePath), reason: 'no processed samples' } as const
      }

      const hitRange = findFirstHitRange(processedSamples)
      if (!hitRange) {
        return { kind: 'unprocessed', file: rel(filePath), reason: 'no hit range found' } as const
      }

      const velocityTimelineMps = computeVelocityTimeline(processedSamples, {
        baselineWindowMs: 200,
      }).velocityMps

      const energyRes = computeImpactEnergyForWindow(
        processedSamples,
        velocityTimelineMps,
        { minMs: hitRange.min, maxMs: hitRange.max },
        { freeFallThresholdG: -0.85, minPeakG: 5 },
      )

      if (!energyRes || !Number.isFinite(energyRes.deltaVMps)) {
        return { kind: 'unprocessed', file: rel(filePath), reason: 'no Δv result' } as const
      }

      return {
        kind: 'ok',
        file: rel(filePath),
        deltaVMps: energyRes.deltaVMps,
      } as const
    })
  } catch (error) {
    return {
      kind: 'unprocessed',
      file: rel(filePath),
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function formatDv(deltaVMps: number): string {
  return deltaVMps.toFixed(3)
}

async function main(): Promise<void> {
  const files = await walkFiles(DATA_DIR)
  const results: Array<Result> = []

  for (const file of files) {
    results.push(await processFile(file))
  }

  const unprocessed = results.filter((result) => result.kind === 'unprocessed')
  const outOfRange = results
    .filter((result): result is Extract<Result, { kind: 'ok' }> => result.kind === 'ok')
    .filter((result) => !(result.deltaVMps > MIN_DV_MPS && result.deltaVMps < MAX_DV_MPS))

  console.log(`Checked ${files.length} files under ${DATA_DIR}`)
  console.log(`Processed: ${results.length - unprocessed.length}`)
  console.log(`Unprocessed: ${unprocessed.length}`)
  console.log(`Δv outside (${MIN_DV_MPS}, ${MAX_DV_MPS}): ${outOfRange.length}`)

  if (unprocessed.length > 0) {
    console.log('\nUnprocessed files:')
    for (const result of unprocessed) {
      console.log(`- ${result.file}: ${result.reason}`)
    }
  }

  if (outOfRange.length > 0) {
    console.log(`\nFiles with Δv not in (${MIN_DV_MPS}, ${MAX_DV_MPS}) m/s:`)
    for (const result of outOfRange) {
      console.log(`- ${result.file}: Δv=${formatDv(result.deltaVMps)} m/s`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
