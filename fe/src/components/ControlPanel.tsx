import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { SamplePoint } from '../types'
import { SERIES_CONFIG, calculateSeriesRange } from '../lib/calculations'

interface ControlPanelProps {
  samples: Array<SamplePoint>
  visibleSeries: Record<string, boolean>
  setVisibleSeries: (v: Record<string, boolean>) => void
  onFullRange: () => void
  onFirstHit: () => void
}

export const ControlPanel: Component<ControlPanelProps> = (props) => {
  const toggleSeries = (key: string) => {
    props.setVisibleSeries({
      ...props.visibleSeries,
      [key]: !props.visibleSeries[key],
    })
  }

  return (
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 py-3 px-4 space-y-4">
      <h2 class="text-lg font-semibold">Controls</h2>

      <div class="flex gap-2">
        <button
          onClick={props.onFullRange}
          class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Full range
        </button>
        <button
          onClick={props.onFirstHit}
          class="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
        >
          First hit
        </button>
      </div>

      <div class="space-y-3">
        <For each={SERIES_CONFIG}>
          {(config) => {
            const range = calculateSeriesRange(props.samples, config.accessor)
            if (!range) return null

            return (
              <label class="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={props.visibleSeries[config.key as string] ?? false}
                  onChange={() => toggleSeries(config.key as string)}
                  class="mt-1 w-4 h-4 cursor-pointer"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ 'background-color': config.color }}
                    />
                    <span class="font-medium text-sm">{config.displayName}</span>
                  </div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    Min: {range.min.toFixed(4)} | Max: {range.max.toFixed(4)}
                  </div>
                </div>
              </label>
            )
          }}
        </For>
      </div>
    </section>
  )
}