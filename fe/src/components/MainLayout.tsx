import { For, type JSX } from 'solid-js'
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

// Compact algorithm/parameter summary
const AlgorithmInfo = (props: { lines: Array<string | JSX.Element> }) => (
  <div class="bg-white p-3 rounded border border-slate-200 text-[11px] text-slate-700 mb-3 shadow-sm">
    <div class="font-mono leading-snug space-y-0.5">
      <For each={props.lines}>{(line) => <div>{line}</div>}</For>
    </div>
  </div>
)

// Peak values display for visible range
const PeakStats = () => {
  const peakAccel = () => uiStore.state.peakAccel
  const peakJerk = () => uiStore.state.peakJerk

  return (
    <div class="flex justify-center gap-8 px-4 py-2.5 bg-white border-b border-slate-200">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-slate-600">Max Acceleration (G):</span>
        <span class="text-lg font-mono font-bold text-blue-600">
          {peakAccel() != null ? peakAccel()!.toFixed(1) : '—'}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-slate-600">Max Jerk (G/sec):</span>
        <span class="text-lg font-mono font-bold text-purple-600">
          {peakJerk() != null ? Math.round(peakJerk()!) : '—'}
        </span>
      </div>
    </div>
  )
}

export const MainLayout = () => {
  const state = () => uiStore.state
  const dri = () => uiStore.state.dri
  const driDeltaMaxMm = () => uiStore.state.driDeltaMaxMm
  const energyJPerKg = () => uiStore.state.energyJPerKg

  return (
    <div class="h-screen flex overflow-hidden bg-white">
      <div class="flex-1 flex flex-col min-w-0">
        <PeakStats />
        <div class="flex-1 min-h-0 relative">
          <AccelerationProfileChart />
        </div>
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
                `${state().processedSamples.length.toLocaleString()} pts @ ${state().sampleRateHz} Hz`,
                'expected accel convention:',
                '  ~ 0 G at rest, ~ -1 G in free fall',
              ]}
            />
          </section>

          <hr class="border-slate-200" />

          {/* Filtered Accel Section */}
          <section>
            <SectionHeader colorClass="bg-blue-600" title="Filtered Acceleration" />
            <AlgorithmInfo
              lines={[
                <>
                  CFC low-pass per{' '}
                  <a
                    href="https://law.resource.org/pub/us/cfr/ibr/005/sae.j211-1.1995.pdf"
                    target="_blank"
                    rel="noopener"
                    class="text-blue-600 underline"
                  >
                    SAE J211/1
                  </a>
                </>,
                `CFC ${state().accelCfc} → Fc=${Math.round(state().accelCfc * 2.0775)} Hz`,
              ]}
            />

            <SliderControl
              label="CFC Class"
              value={state().accelCfc}
              min={5}
              max={225}
              step={5}
              unit=""
              accentColor="#2563eb"
              onChange={(v) => uiStore.setAccelCfc(v)}
            />
          </section>

          <hr class="border-slate-200" />

          {/* Jerk Section */}
          <section>
            <SectionHeader colorClass="bg-purple-600" title="Jerk" />
            <AlgorithmInfo
              lines={[
                'Savitzky–Golay derivative',
                'polyOrder=3, deriv=1  →  units: G/s',
                `window=${state().jerkWindowMs} ms`,
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

          <hr class="border-slate-200" />

          {/* DRI Section */}
          <section>
            <SectionHeader colorClass="bg-slate-800" title="DRI (Dynamic Response Index)" />
            <div class="bg-white p-3 rounded border border-slate-200 text-[11px] text-slate-700 shadow-sm">
              <div class="font-mono leading-snug space-y-0.5">
                <div>model: x" + 2ζωx' + ω²x = -a(t)</div>
                <div>DRI = ω²·max(|x|)/g</div>
                <div>ω=52.9 rad/s, ζ=0.224</div>
                <div>range: peak ± until accel {'<'} -0.85G</div>
              </div>
              <div class="border-t border-slate-200 mt-2 pt-2 flex justify-between items-baseline">
                <span class="text-xs font-bold text-slate-700">DRI</span>
                <span class="text-xl font-mono font-bold text-slate-900">
                  {dri() != null ? dri()!.toFixed(2) : '—'}
                </span>
              </div>
              {driDeltaMaxMm() != null && (
                <div class="flex justify-between items-center mt-1 text-xs text-slate-500">
                  <span>Δmax</span>
                  <span class="font-mono">{driDeltaMaxMm()!.toFixed(2)} mm</span>
                </div>
              )}
            </div>
          </section>

          <hr class="border-slate-200" />

          {/* Energy Section */}
          <section>
            <SectionHeader colorClass="bg-amber-600" title="Impact Energy" />
            <div class="bg-white p-3 rounded border border-slate-200 text-[11px] text-slate-700 shadow-sm">
              <div class="font-mono leading-snug space-y-0.5">
                <div>E/m = ½v²</div>
                <div>v = ∫a·dt (velocity from accel)</div>
                <div>same range as DRI</div>
              </div>
              <div class="border-t border-slate-200 mt-2 pt-2 flex justify-between items-baseline">
                <span class="text-xs font-bold text-slate-700">Energy</span>
                <span class="text-xl font-mono font-bold text-amber-700">
                  {energyJPerKg() != null ? energyJPerKg()!.toFixed(1) : '—'}
                  <span class="text-sm ml-1">J/kg</span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
