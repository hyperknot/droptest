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

  const fmt = (v: number | null, digits: number, suffix: string) => {
    if (v == null) return '—'
    return `${v.toFixed(digits)}${suffix}`
  }

  const fmtNum = (v: number | null, digits: number) => {
    if (v == null) return '—'
    return v.toFixed(digits)
  }

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
                `polyOrder=${state().jerkPolyOrder}, deriv=1  →  units: G/s`,
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

            <div class="mt-2">
              <label class="text-xs font-bold text-slate-700 block mb-1">Polynomial Order</label>
              <div class="flex gap-1">
                <button
                  class={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
                    state().jerkPolyOrder === 1
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  onClick={() => uiStore.setJerkPolyOrder(1)}
                >
                  Linear (1)
                </button>
                <button
                  class={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
                    state().jerkPolyOrder === 3
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  onClick={() => uiStore.setJerkPolyOrder(3)}
                >
                  Cubic (3)
                </button>
              </div>
            </div>
          </section>

          <hr class="border-slate-200" />

          {/* Energy Section */}
          <section>
            <SectionHeader colorClass="bg-emerald-600" title="Impact Energy" />
            <div class="bg-emerald-50 p-3 rounded border border-emerald-200 shadow-sm">
              {/* Velocity toggle */}
              <div class="flex gap-1 mb-3">
                <button
                  class={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
                    !state().showVelocityOnChart
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                  }`}
                  onClick={() => uiStore.setShowVelocityOnChart(false)}
                >
                  Hide v(t)
                </button>
                <button
                  class={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
                    state().showVelocityOnChart
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                  }`}
                  onClick={() => uiStore.setShowVelocityOnChart(true)}
                >
                  Show v(t)
                </button>
              </div>

              {/* Main absorbed energy highlight */}
              <div class="bg-white rounded-lg p-3 border border-emerald-200 mb-3">
                <div class="text-center">
                  <div class="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold mb-1">
                    Energy Absorbed by Foam
                  </div>
                  <div class="text-3xl font-mono font-bold text-emerald-700">
                    {state().absorbedEnergyJPerKg?.toFixed(1) ?? '—'}
                    <span class="text-lg ml-1 font-normal">J/kg</span>
                  </div>
                  <div class="text-[10px] text-slate-500 mt-1">
                    = Impact − Rebound kinetic energy
                  </div>
                </div>
              </div>

              {/* Energy breakdown */}
              <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="bg-white rounded p-2 border border-emerald-200 text-center">
                  <div class="text-[10px] text-slate-500 uppercase tracking-wide">Impact</div>
                  <div class="text-sm font-mono font-semibold text-emerald-700">
                    {state().impactEnergyJPerKg?.toFixed(1) ?? '—'}
                    <span class="text-xs ml-0.5 font-normal">J/kg</span>
                  </div>
                  <div class="text-[9px] text-slate-400">½·v²</div>
                </div>
                <div class="bg-white rounded p-2 border border-emerald-200 text-center">
                  <div class="text-[10px] text-slate-500 uppercase tracking-wide">Rebound</div>
                  <div class="text-sm font-mono font-semibold text-emerald-700">
                    {state().reboundEnergyJPerKg?.toFixed(1) ?? '—'}
                    <span class="text-xs ml-0.5 font-normal">J/kg</span>
                  </div>
                  <div class="text-[9px] text-slate-400">½·v²</div>
                </div>
              </div>

              {/* Velocities */}
              <div class="bg-white rounded p-2 border border-emerald-200 mb-3">
                <div class="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
                  Velocity
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div class="text-[9px] text-slate-500">Before</div>
                    <div class="text-xs font-mono font-semibold">
                      {fmt(state().impactVelocityBeforeMps, 2, '')}
                    </div>
                  </div>
                  <div>
                    <div class="text-[9px] text-slate-500">After</div>
                    <div class="text-xs font-mono font-semibold">
                      {fmt(state().impactVelocityAfterMps, 2, '')}
                    </div>
                  </div>
                  <div>
                    <div class="text-[9px] text-slate-500">Δv</div>
                    <div class="text-xs font-mono font-semibold">
                      {fmt(state().impactDeltaVelocityMps, 2, '')}
                    </div>
                  </div>
                </div>
                <div class="text-[9px] text-slate-400 text-center mt-1">
                  m/s (integrated from acceleration)
                </div>
              </div>

              {/* Derived metrics */}
              <div class="space-y-2">
                <div class="bg-white rounded p-2 border border-emerald-200">
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="text-xs font-semibold text-slate-700">COR</span>
                      <span class="text-[10px] text-slate-400 ml-1">v_out / v_in</span>
                    </div>
                    <span class="text-sm font-mono font-bold text-emerald-700">
                      {fmtNum(state().cor, 3)}
                    </span>
                  </div>
                </div>

                <div class="bg-white rounded p-2 border border-emerald-200">
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="text-xs font-semibold text-slate-700">Energy Return</span>
                      <span class="text-[10px] text-slate-400 ml-1">= COR²</span>
                    </div>
                    <span class="text-sm font-mono font-bold text-emerald-700">
                      {fmt(state().energyReturnPercent, 1, '%')}
                    </span>
                  </div>
                </div>

                <div class="bg-white rounded p-2 border border-emerald-200">
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="text-xs font-semibold text-slate-700">Bounce Height</span>
                      <span class="text-[10px] text-slate-400 ml-1">v²/(2g)</span>
                    </div>
                    <span class="text-sm font-mono font-bold text-emerald-700">
                      {fmt(state().bounceHeightCm, 1, ' cm')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
        </div>
      </aside>
    </div>
  )
}
