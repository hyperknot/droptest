import { uiStore } from '../stores/uiStore'
import { AccelerationProfileChart } from './AccelerationProfileChart'

export const MainLayout = () => {
  const f = () => uiStore.state.file!
  const cfg = () => uiStore.state.config

  return (
    <div class="h-screen flex overflow-hidden">
      <div class="flex-1 relative">
        <AccelerationProfileChart />
      </div>

      <aside class="w-72 bg-white border-l border-gray-200 flex flex-col p-4 gap-4 z-10 shadow-lg">
        <div>
          <h2 class="font-bold text-lg mb-1">{f().filename}</h2>
          <div class="text-xs text-gray-500">
             {f().samples.length.toLocaleString()} samples @ ~ {f().sampleRateHz} Hz
          </div>
        </div>

        <div class="flex gap-2">
          <button
             class="flex-1 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded text-sm font-medium transition"
             onClick={() => uiStore.setRangeRequest('full')}
          >
            Full View
          </button>
          <button
             class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition"
             onClick={() => uiStore.setRangeRequest('firstHit')}
          >
            First Hit
          </button>
        </div>

        <div class="border-t pt-4 space-y-4">
          <h3 class="font-semibold text-sm text-gray-700">Filter Settings</h3>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              ACCEL CFC Class ({cfg().cfc})
            </label>
            <input
              type="range" min="10" max="1000" step="10"
              value={cfg().cfc}
              onInput={(e) => uiStore.updateConfig('cfc', Number(e.currentTarget.value))}
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              JERK SG Window ({cfg().jerkWindow})
            </label>
            <input
              type="range" min="5" max="51" step="2"
              value={cfg().jerkWindow}
              onInput={(e) => uiStore.updateConfig('jerkWindow', Number(e.currentTarget.value))}
              class="w-full"
            />
          </div>
        </div>
      </aside>
    </div>
  )
}