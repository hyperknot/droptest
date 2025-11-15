import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { AccelerationProfileChart } from './components/AccelerationProfileChart'
import { FileInfoPanel } from './components/FileInfo'
import { StatsPanel } from './components/StatsPanel'
import { calculateStatistics } from './lib/calculations'
import { parseDropTestFile } from './lib/csv-parser'
import type { DropTestData } from './types'

export const AppUI: Component = () => {
  const [testData, setTestData] = createSignal<DropTestData | null>(null)
  const [error, setError] = createSignal<string>('')
  const [isDragging, setIsDragging] = createSignal(false)

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError('')

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) {
      setError('No file dropped')
      return
    }

    const file = files[0]
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please drop a .csv file')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseDropTestFile(text, file.name)
      const stats = calculateStatistics(parsed.samples)

      setTestData({
        ...parsed,
        statistics: stats,
      })
    } catch (err) {
      setError(`Error parsing file: ${err}`)
      console.error(err)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const hasData = () => testData() !== null

  return (
    <div
      class="min-h-screen bg-slate-50 text-gray-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div class="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header class="space-y-2">
          <h1 class="md:text-3xl text-xl font-bold tracking-tight">
            Harness Drop Test Data Visualizer
          </h1>
          <p class="text-gray-600">
            Visualize real-world drop test data from harness back protectors.
          </p>
          <p class="text-gray-600">
            This is an{' '}
            <a
              href="https://github.com/hyperknot/droptest-viz"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:underline"
            >
              open source
            </a>{' '}
            project by Zsolt Ero.
          </p>
        </header>

        <Show when={!hasData()}>
          <div
            class={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging() ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <p class="text-lg mb-2">Drop a .csv drop test file here</p>
            <p class="text-sm text-gray-500">
              Expected format: CSV with accel, time0, datetime columns
            </p>
          </div>
        </Show>

        <Show when={error()}>
          <div class="text-red-600 bg-red-50 p-3 rounded border border-red-200">{error()}</div>
        </Show>

        <Show when={hasData()}>
          <div class="space-y-3">
            {/* Chart */}
            <section class="bg-white rounded-xl shadow-sm border border-gray-200 py-2 px-3 space-y-3">
              <div>
                <h2 class="text-lg font-semibold">Acceleration profile</h2>
                <p class="text-xs text-gray-500">Recorded drop test data</p>
              </div>
              <AccelerationProfileChart samples={testData()!.samples} />
            </section>

            {/* File info and stats side by side */}
            <div class="grid gap-3 md:grid-cols-2 items-start">
              <FileInfoPanel data={testData()!} />
              <StatsPanel statistics={testData()!.statistics} />
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
