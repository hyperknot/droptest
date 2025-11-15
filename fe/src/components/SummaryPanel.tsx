import type { Component } from 'solid-js'
import { calculateFoamThickness } from '../lib/physics'
import type { PhysicsResult } from '../types/physics'

interface SummaryPanelProps {
  result: PhysicsResult
  compressionFactor: number
}

export const SummaryPanel: Component<SummaryPanelProps> = (props) => {
  const foamThickness = () => {
    if (!props.result.stopDistance) return 0
    return calculateFoamThickness(props.result.stopDistance * 100, props.compressionFactor)
  }

  return (
    <section class="bg-white rounded-lg shadow-sm border border-gray-200 py-2 px-3">
      <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-around gap-3 sm:gap-3">
        <div class="flex flex-col items-center min-w-0">
          <span class="text-sm text-gray-600 text-center leading-tight">Peak G:</span>
          <span
            class="text-base md:text-xl font-bold"
            classList={{
              'text-red-600': props.result.gLimitReached,
            }}
          >
            {props.result.peakG ? `${props.result.peakG.toFixed(2)} G` : '—'}
          </span>
        </div>

        {/* Min theoretical thickness */}
        <div class="flex flex-col items-center min-w-0">
          <span class="text-sm text-gray-600 text-center leading-tight break-words max-w-full">
            Min theoretical thickness:
          </span>
          <span class="text-base md:text-xl font-bold text-blue-600">
            {props.result.stopDistance ? `${(props.result.stopDistance * 100).toFixed(2)} cm` : '—'}
          </span>
        </div>

        {/* Min foam protector thickness */}
        <div class="flex flex-col items-center min-w-0">
          <span class="text-sm text-gray-600 text-center leading-tight break-words max-w-full">
            Min foam thickness:
          </span>
          <span class="text-base md:text-xl font-bold text-emerald-600">
            {props.result.stopDistance ? `${foamThickness().toFixed(2)} cm` : '—'}
          </span>
        </div>
      </div>
    </section>
  )
}
