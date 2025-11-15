import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { LandingPage } from './components/LandingPage'
import { MainLayout } from './components/MainLayout'
import { useFileUpload } from './hooks/useFileUpload'
import { useFilterEngine } from './hooks/useFilterEngine'
import { DEFAULT_FILTER_CONFIG } from './lib/filter-config'
import type { FilterConfig } from './types'

export const AppUI: Component = () => {
  const { testData, error, isDragging, handleDrop, handleDragOver, handleDragLeave } =
    useFileUpload()

  const [filterConfig, setFilterConfig] = createSignal<FilterConfig>(DEFAULT_FILTER_CONFIG)

  const { displaySamples } = useFilterEngine(testData, filterConfig)

  return (
    <div
      class="min-h-screen bg-slate-50 text-gray-900"
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
          />
        )}
      </Show>
    </div>
  )
}