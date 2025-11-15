import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { SamplePoint } from '../types'

interface ControlPanelProps {
  samples: Array<SamplePoint>
  visibleSeries: Record<string, boolean>
  setVisibleSeries: (v: Record<string, boolean>) => void
}

interface SeriesInfo {
  key: keyof SamplePoint
  label: string
  color: string
}

const series: SeriesInfo[] = [
  { key: 'accelG', label: 'Accel (G)', color: '#2563eb' },
  { key: 'accelFiltered', label: 'Accel filtered (G)', color: '#0ea5e9' },
  { key: 'speed', label: 'Speed', color: '#16a34a' },
  { key: 'pos', label: 'Position', color: '#a855f7' },
  { key: 'jerk', label: 'Jerk', color: '#f97316' },
]

export const ControlPanel: Component<ControlPanelProps> = (props) => {
  const getMinMax = (key: keyof SamplePoint) => {
    const values: number[] = []
    for (const s of props.samples) {
      const v = s[key]
      if (typeof v === 'number' && Number.isFinite(v)) {
        values.push(v)
      }
    }
    if (values.length === 0) return null
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }

  const toggleSeries = (key: string) => {
    props.setVisibleSeries({
      ...props.visibleSeries,
      [key]: !props.visibleSeries[key],
    })
  }

  return (
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 py-3 px-4 space-y-4">
      <h2 class="text-lg font-semibold">Controls</h2>

      <div class="space-y-3">
        <For each={series}>
          {(s) => {
            const range = getMinMax(s.key)
            if (!range) return null

            return (
              <label class="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={props.visibleSeries[s.key as string] ?? false}
                  onChange={() => toggleSeries(s.key as string)}
                  class="mt-1 w-4 h-4 cursor-pointer"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ 'background-color': s.color }}
                    />
                    <span class="font-medium text-sm">{s.label}</span>
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