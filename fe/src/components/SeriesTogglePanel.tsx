import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { SamplePoint } from '../types'
import { BASE_SERIES_CONFIG, calculateSeriesRange } from '../lib/calculations'

interface SeriesTogglePanelProps {
  samples: Array<SamplePoint>
  visibleSeries: Record<string, boolean>
  setVisibleSeries: (v: Record<string, boolean>) => void
}

export const SeriesTogglePanel: Component<SeriesTogglePanelProps> = (props) => {
  const toggleSeries = (key: string) => {
    props.setVisibleSeries({
      ...props.visibleSeries,
      [key]: !props.visibleSeries[key],
    })
  }

  return (
    <section class="bg-white rounded border border-gray-200 p-2 space-y-2 text-sm">
      <h2 class="font-semibold text-base">Series</h2>
      <div class="space-y-1">
        <For each={BASE_SERIES_CONFIG}>
          {(config) => {
            const range = calculateSeriesRange(props.samples, config.accessor)
            return (
              <label class="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={props.visibleSeries[config.key as string] ?? false}
                  onChange={() => toggleSeries(config.key as string)}
                  class="mt-0.5 w-3.5 h-3.5 cursor-pointer"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <div
                      class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ 'background-color': config.color }}
                    />
                    <span class="font-medium text-xs">{config.displayName}</span>
                  </div>
                  <div class="text-[10px] text-gray-500 mt-0.5">
                    {range
                      ? `Min: ${range.min.toFixed(3)} | Max: ${range.max.toFixed(3)}`
                      : 'No data'}
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