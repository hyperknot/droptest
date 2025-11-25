import { For } from 'solid-js'
import { uiStore } from '../stores/uiStore'
import { AccelerationProfileChart } from './AccelerationProfileChart'

// Local sub-components for DRY code
const SectionHeader = (props: { colorClass: string; title: string }) => (
  <div class="flex items-center gap-2 mb-2">
    <div class={`w-3 h-3 rounded-full ${props.colorClass}`} />
    <h3 class="font-bold text-sm text-slate-800">{props.title}</h3>
  </div>
)

const SliderControl = (props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  accentColor: string
  onChange: (v: number) => void
}) => (
  <div class="space-y-1 mt-2">
    <div class="flex justify-between items-center">
      <label class="text-xs font-bold text-slate-700">{props.label}</label>
      <span class="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded">
        {props.value} {props.unit}
      </span>
    </div>
    <input
      type="range"
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      onInput={(e) => props.onChange(Number(e.currentTarget.value))}
      class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
      style={{ 'accent-color': props.accentColor }}
    />
  </div>
)

// Compact algorithm/parameter summary (no key–value pairs, no prose paragraph)
const AlgorithmInfo = (props: { lines: Array<string> }) => (
  <div class="bg-white p-3 rounded border border-slate-200 text-[11px] text-slate-700 mb-3 shadow-sm">
    <div class="font-mono leading-snug space-y-0.5">
      <For each={props.lines}>{(line) => <div>{line}</div>}</For>
    </div>
  </div>
)

export const MainLayout = () => {
  const state = () => uiStore.state

  return (
    <div class="h-screen flex overflow-hidden bg-white">
      <div class="flex-1 relative min-w-0">
        <AccelerationProfileChart />
      </div>

      <aside class="w-80 bg-slate-50 border-l border-slate-200 flex flex-col overflow-y-auto z-10 shadow-xl">
        {/* Header */}
        <div class="p-4 border-b border-slate-200 bg-white">
          <div class="grid grid-cols-2 gap-2">
            <button
              class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition shadow-sm"
              onClick={() => uiStore.setRangeRequest('firstHit')}
            >
              First Hit Zoom
            </button>
            <button
              class="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition shadow-sm"
              onClick={() => uiStore.setRangeRequest('full')}
            >
              Full View
            </button>
          </div>
        </div>

        <div class="p-4 space-y-6">
          {/* Raw Accel Section */}
          <section>
            <SectionHeader colorClass="bg-green-600" title="Raw Acceleration" />
            <AlgorithmInfo
              lines={[
                `source: ${state().filename}`,
                `${state().samples.length.toLocaleString()} pts @ ${state().sampleRateHz} Hz`,
                'channel: raw accelerometer, no filtering',
              ]}
            />
          </section>

          <hr class="border-slate-200" />

          {/* Filtered Accel Section */}
          <section>
            <SectionHeader colorClass="bg-blue-600" title="Filtered Acceleration" />
            <AlgorithmInfo
              lines={[
                'Butterworth low-pass, zero-phase (filtfilt)',
                'order=1  →  2nd-order per pass (4th-order magnitude)',
                `cutoff=${state().accelCutoffHz} Hz`,
              ]}
            />

            <SliderControl
              label="Cutoff Frequency"
              value={state().accelCutoffHz}
              min={10}
              max={450}
              step={10}
              unit="Hz"
              accentColor="#2563eb"
              onChange={(v) => uiStore.setAccelCutoffHz(v)}
            />
          </section>

          <hr class="border-slate-200" />

          {/* Jerk Section */}
          <section>
            <SectionHeader colorClass="bg-purple-600" title="Jerk" />
            <AlgorithmInfo
              lines={[
                'Savitzky–Golay derivative (jerk)',
                `window=${state().jerkWindowMs} ms`,
                'polyOrder=3, deriv=1  →  units: G/s',
              ]}
            />

            <SliderControl
              label="Window Size"
              value={state().jerkWindowMs}
              min={5}
              max={51}
              step={2}
              unit="ms"
              accentColor="#a855f7"
              onChange={(v) => uiStore.setJerkWindowMs(v)}
            />
          </section>
        </div>
      </aside>
    </div>
  )
}
