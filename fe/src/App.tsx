import type { Component } from 'solid-js'
import { createSignal, createEffect, Show } from 'solid-js'
import { LandingPage } from './components/LandingPage'
import { MainLayout } from './components/MainLayout'
import { useFileUpload } from './hooks/useFileUpload'
import { useFilterEngine } from './hooks/useFilterEngine'
import { DEFAULT_FILTER_CONFIG } from './lib/filter-config'
import type { FilterConfig, RangeCommand } from './types'

export const AppUI: Component = () => {
  const { testData, error, isDragging, handleDrop, handleDragOver, handleDragLeave } =
    useFileUpload()

  const [filterConfig, setFilterConfig] = createSignal<FilterConfig>(DEFAULT_FILTER_CONFIG)
  const [rangeCommand, setRangeCommand] = createSignal<RangeCommand>(null)
  const [pendingFirstHit, setPendingFirstHit] = createSignal(false)

  const { displaySamples } = useFilterEngine(testData, filterConfig)

  createEffect(() => {
    const data = testData()
    setPendingFirstHit(Boolean(data && data.samples.length > 0))
  })

  createEffect(() => {
    if (!pendingFirstHit()) return

    const samples = displaySamples()
    if (samples.length === 0) return

    setRangeCommand({ type: 'firstHit' })
    setPendingFirstHit(false)
  })

  return (
    <div
      class="min-h-screen bg-slate-50 text-gray-9‌00"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <Show
        when={testData()}
        fallback={<LandingPage isDragging={isDragging()} error={error()} />}
      >
        {(data) => (
          <MainLayout
            testData={data()}
            displaySamples={displaySamples()}
            filterConfig={filterConfig()}
            setFilterConfig={setFilterConfig}
            rangeCommand={rangeCommand()}
            setRangeCommand={setRangeCommand}
          />
        )}
      </Show>
    </div>
  )
}