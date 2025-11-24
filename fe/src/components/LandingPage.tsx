import { uiStore } from '../stores/uiStore'

export const LandingPage = () => {
  return (
    <div class="h-screen flex flex-col items-center justify-center p-4">
      <div
        class={`
          max-w-xl w-full border-2 border-dashed rounded-xl p-12 text-center transition-all
          ${uiStore.state.isDragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 bg-white'}
        `}
      >
        <h1 class="text-2xl font-bold text-gray-800 mb-2">Drop Test Visualizer</h1>

        {uiStore.state.error ? (
           <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
             {uiStore.state.error}
           </div>
        ) : (
           <p class="text-gray-500 mb-8">Drop a CSV file (datetime, accel) to begin.</p>
        )}

        <div class="text-xs text-gray-400">
          Simple. Fast. Accel CFC & Jerk SG only.
        </div>
      </div>
    </div>
  )
}