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
  hint?: string
}) => (
  <div class="space-y-1">
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
    {props.hint && <p class="text-[10px] text-slate-400">{props.hint}</p>}
  </div>
)

const InfoBox = (props: { children: any }) => (
  <div class="bg-white p-3 rounded border border-slate-200 text-[11px] text-slate-600 space-y-1 mb-3 shadow-sm">
    {props.children}
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
          <h2 class="font-bold text-lg break-words leading-tight text-slate-800">
            {state().filename}
          </h2>
          <div class="mt-1 text-xs text-slate-500 font-mono">
            {state().samples.length.toLocaleString()} pts @ {state().sampleRateHz} Hz
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
          {/* Raw Accel Section */}
          <section>
            <SectionHeader colorClass="bg-green-600" title="Raw Acceleration" />
            <p class="text-[11px] text-slate-500 leading-relaxed">
              Unfiltered sensor data directly from the CSV source.
            </p>
          </section>

          <hr class="border-slate-200" />

          {/* Filtered Accel Section */}
          <section>
            <SectionHeader colorClass="bg-blue-600" title="Filtered Acceleration" />
            <InfoBox>
              <p>
                <span class="font-semibold text-slate-900">Algorithm:</span> Butterworth
                (Zero-phase)
              </p>
              <p>
                <span class="font-semibold text-slate-900">Type:</span> Digital Low-pass
              </p>
              <p class="pt-1 italic text-slate-500">
                Bidirectional (zero-phase) Butterworth filter, compatible with CFC industry standard
                for automotive crash testing.
              </p>
            </InfoBox>

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
            <div class="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
              <span>10 Hz</span>
              <span>450 Hz</span>
            </div>
          </section>

          <hr class="border-slate-200" />

          {/* Jerk Section */}
          <section>
            <SectionHeader colorClass="bg-purple-600" title="Jerk" />
            <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Rate of change of acceleration. Computed using the{' '}
              <strong class="text-slate-600">Savitzky-Golay Differentiation Filter</strong> on the
              filtered data.
            </p>

            <SliderControl
              label="Window Size"
              value={state().jerkWindowMs}
              min={5}
              max={50}
              step={1}
              unit="ms"
              accentColor="#a855f7"
              onChange={(v) => uiStore.setJerkWindowMs(v)}
              hint="Time window for SG filter calculation."
            />
          </section>
        </div>
      </aside>
    </div>
  )
}
