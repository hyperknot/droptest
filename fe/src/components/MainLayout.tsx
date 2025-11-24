import { uiStore } from '../stores/uiStore'
import { AccelerationProfileChart } from './AccelerationProfileChart'

export const MainLayout = () => {
  const f = () => uiStore.state.file!
  const cfg = () => uiStore.state.config

  return (
    <div class="h-screen flex overflow-hidden bg-white">
      <div class="flex-1 relative min-w-0">
        <AccelerationProfileChart />
      </div>

      <aside class="w-80 bg-slate-50 border-l border-slate-200 flex flex-col overflow-y-auto z-10 shadow-xl">
        <div class="p-4 border-b border-slate-200 bg-white">
          <h2 class="font-bold text-lg break-words leading-tight text-slate-800">
            {f().filename}
          </h2>
          <div class="mt-1 text-xs text-slate-500 font-mono">
            {f().samples.length.toLocaleString()} pts @ {f().sampleRateHz} Hz
          </div>

          <div class="grid grid-cols-2 gap-2 mt-3">
            <button
              class="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition shadow-sm"
              onClick={() => uiStore.setRangeRequest('full')}
            >
              Full View
            </button>
            <button
              class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition shadow-sm"
              onClick={() => uiStore.setRangeRequest('firstHit')}
            >
              First Hit Zoom
            </button>
          </div>
        </div>

        <div class="p-4 space-y-6">

          {/* RAW ACCEL */}
          <section>
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full bg-green-600"></div>
              <h3 class="font-bold text-sm text-slate-800">Raw Acceleration</h3>
            </div>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              Unfiltered sensor data directly from the CSV source.
            </p>
          </section>

          <hr class="border-slate-200" />

          {/* FILTERED ACCEL */}
          <section>
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full bg-blue-600"></div>
              <h3 class="font-bold text-sm text-slate-800">Filtered Acceleration</h3>
            </div>

            <div class="bg-white p-3 rounded border border-slate-200 text-[11px] text-slate-600 space-y-1 mb-3 shadow-sm">
              <p><span class="font-semibold text-slate-900">Algorithm:</span> Butterworth (Zero-phase)</p>
              <p><span class="font-semibold text-slate-900">Type:</span> Digital Low-pass</p>
              <p class="pt-1 italic text-slate-500">
                This implementation uses a bidirectional (zero-phase) Butterworth filter, compatible with the CFC industry standard for automotive crash testing.
              </p>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-bold text-slate-700">Cutoff Frequency</label>
                <span class="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded">{cfg().cutoffHz} Hz</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={cfg().cutoffHz}
                onInput={(e) => uiStore.updateConfig('cutoffHz', Number(e.currentTarget.value))}
                class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div class="flex justify-between text-[10px] text-slate-400 px-1">
                <span>10 Hz</span>
                <span>300 Hz</span>
              </div>
            </div>
          </section>

          <hr class="border-slate-200" />

          {/* JERK */}
          <section>
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full bg-purple-600"></div>
              <h3 class="font-bold text-sm text-slate-800">Jerk</h3>
            </div>

            <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Rate of change of acceleration. Computed using the <strong class="text-slate-600">Savitzky-Golay Differentiation Filter</strong> on the filtered data.
            </p>

            <div class="space-y-4">
              {/* Window Size */}
              <div class="space-y-1">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-bold text-slate-700">Window Size</label>
                  <span class="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded">{cfg().jerkWindow} pts</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="51"
                  step="2"
                  value={cfg().jerkWindow}
                  onInput={(e) =>
                    uiStore.updateConfig('jerkWindow', Number(e.currentTarget.value))
                  }
                  class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <p class="text-[10px] text-slate-400">Data points involved in calculation.</p>
              </div>

              {/* Polynomial */}
              <div class="space-y-1">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-bold text-slate-700">Polynomial Order</label>
                  <span class="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded">{cfg().jerkPoly}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="7"
                  step="1"
                  value={cfg().jerkPoly}
                  onInput={(e) =>
                    uiStore.updateConfig('jerkPoly', Number(e.currentTarget.value))
                  }
                  class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <p class="text-[10px] text-slate-400">Degree of fitting polynomial.</p>
              </div>
            </div>
          </section>

        </div>
      </aside>
    </div>
  )
}