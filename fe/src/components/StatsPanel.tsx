import type { Component } from 'solid-js'
import type { Statistics } from '../types'

interface StatsPanelProps {
  statistics: Statistics
}

export const StatsPanel: Component<StatsPanelProps> = (props) => {
  const isOver38GLimit = () => props.statistics.timeOver38G >= 0.007 // 7 ms
  const isOver20GLimit = () => props.statistics.timeOver20G >= 0.025 // 25 ms
  const isOverAnyLimit = () => isOver38GLimit() || isOver20GLimit()

  return (
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 py-2 px-3 space-y-4">
      <h2 class="text-lg font-semibold">Statistics</h2>

      <div class="grid gap-3 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Peak acceleration:</span>
          <span class="font-semibold">{props.statistics.peakG.toFixed(2)} G</span>
        </div>

        <div class="flex justify-between">
          <span class="text-gray-600">Total stop time:</span>
          <span class="font-semibold">{props.statistics.totalTime.toFixed(2)} ms</span>
        </div>

        {/* Time over thresholds */}
        <div class="py-2 border-t border-gray-200 mt-2 space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-600">Time over 38 G:</span>
            <span
              class="font-semibold"
              classList={{
                'text-red-600': isOver38GLimit(),
              }}
            >
              {props.statistics.timeOver38G.toFixed(2)} ms
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Time over 20 G:</span>
            <span
              class="font-semibold"
              classList={{
                'text-red-600': isOver20GLimit(),
              }}
            >
              {props.statistics.timeOver20G.toFixed(2)} ms
            </span>
          </div>
        </div>

        {/* Warning message if over EN limits */}
        {isOverAnyLimit() && (
          <div class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            ⚠️ Over proposed EN limits (38 G for ≥7 ms or 20 G for ≥25 ms)
          </div>
        )}

        {/* Head Injury Criterion (HIC) */}
        <div class="py-2 border-t border-gray-200 mt-2 space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-600">HIC15:</span>
            <span class="font-semibold">{props.statistics.hic15.toFixed(0)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">HIC36:</span>
            <span class="font-semibold">{props.statistics.hic36.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
