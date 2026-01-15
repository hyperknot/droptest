import { For, type JSX } from 'solid-js'
import { uiStore } from '../stores/uiStore'
import { AccelerationProfileChart } from './AccelerationProfileChart'

// Chart colors (must match AccelerationProfileChart.tsx)
const COLOR_RAW = '#16a34a' // Green
const COLOR_ACCEL_FILTERED = '#2563eb' // Blue
const COLOR_JERK = '#a855f7' // Purple
const COLOR_VELOCITY = '#059669' // Emerald

// Local sub-components for DRY code
const SectionHeader = (props: { title: string; color?: string; inline?: boolean }) => (
  <h2 class={`text-lg font-semibold flex items-center gap-2 ${props.inline ? '' : 'mb-2'}`}>
    {props.color && (
      <span class="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: props.color }} />
    )}
    {props.title}
  </h2>
)

const SliderControl = (props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) => (
  <div class="space-y-1 mt-2">
    <div class="flex justify-between items-center">
      <label class="text-xs font-medium text-gray-700">{props.label}</label>
      <span class="text-xs font-mono bg-white border border-neutral-300 px-1.5 py-0.5">
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
      class="w-full h-2 bg-neutral-200 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
    />
  </div>
)

// Compact algorithm/parameter summary
const AlgorithmInfo = (props: { lines: Array<string | JSX.Element> }) => (
  <div class="text-[11px] text-gray-600 mb-2">
    <div class="font-mono leading-snug space-y-0.5">
      <For each={props.lines}>{(line) => <div class="break-all">{line}</div>}</For>
    </div>
  </div>
)

// Peak values display for visible range
const PeakStats = () => {
  const peakAccel = () => uiStore.state.peakAccel
  const peakJerk = () => uiStore.state.peakJerk

  return (
    <div class="flex justify-center gap-8 px-4 py-2.5 bg-white border-b border-black">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-600">Max Acceleration (G):</span>
        <span class="text-lg font-mono font-bold text-gray-900">
          {peakAccel() != null ? peakAccel()!.toFixed(1) : '—'}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-600">Max Jerk (G/sec):</span>
        <span class="text-lg font-mono font-bold text-gray-900">
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

  const formatNumber = (v: number | null, digits: number, unit = '') => {
    if (v == null) return '—'
    return `${v.toFixed(digits)}${unit}`
  }

  return (
    <div class="h-screen flex overflow-hidden bg-white">
      {/* Main content area */}
      <div class="flex-1 flex flex-col min-w-0 border-r border-black">
        <PeakStats />
        <div class="flex-1 min-h-0 relative">
          <AccelerationProfileChart />
        </div>
      </div>

      {/* Sidebar */}
      <aside class="w-80 h-full overflow-y-auto flex-shrink-0">
        {/* Header with buttons */}
        <div class="p-3 border-b border-black">
          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-2 text-sm font-medium transition-colors border border-neutral-900 bg-white text-gray-900 hover:bg-neutral-100"
              onClick={() => uiStore.setRangeRequest('firstHit')}
            >
              First Hit Zoom
            </button>
            <button
              class="flex-1 px-3 py-2 text-sm font-medium transition-colors border border-neutral-900 bg-white text-gray-900 hover:bg-neutral-100"
              onClick={() => uiStore.setRangeRequest('full')}
            >
              Full View
            </button>
          </div>
        </div>

        {/* Raw Accel Section */}
        <section class="px-4 py-3 border-b border-black">
          <SectionHeader title="Raw Acceleration" color={COLOR_RAW} />
          <AlgorithmInfo
            lines={[
              `source: ${state().filename}`,
              `${state().processedSamples.length.toLocaleString()} pts @ ${state().sampleRateHz.toFixed(1)} Hz`,
            ]}
          />
        </section>

        {/* Filtered Accel Section */}
        <section class="px-4 py-3 border-b border-black">
          <SectionHeader title="Filtered Acceleration" color={COLOR_ACCEL_FILTERED} />
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
            onChange={(v) => uiStore.setAccelCfc(v)}
          />
        </section>

        {/* Jerk Section */}
        <section class="px-4 py-3 border-b border-black">
          <SectionHeader title="Jerk" color={COLOR_JERK} />
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
            onChange={(v) => uiStore.setJerkWindowMs(v)}
          />

          <div class="mt-2">
            <label class="text-xs font-medium text-gray-700 block mb-1">Polynomial Order</label>
            <div class="flex border border-neutral-900">
              <button
                class={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-r border-black ${
                  state().jerkPolyOrder === 1
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
                onClick={() => uiStore.setJerkPolyOrder(1)}
              >
                Linear (1)
              </button>
              <button
                class={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                  state().jerkPolyOrder === 3
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
                onClick={() => uiStore.setJerkPolyOrder(3)}
              >
                Cubic (3)
              </button>
            </div>
          </div>
        </section>

        {/* Energy Section */}
        <section class="px-4 py-3 border-b border-black">
          <div class="flex items-center justify-between mb-3">
            <SectionHeader title="Impact Energy" color={COLOR_VELOCITY} inline />
            <button
              class={`px-3 py-1.5 text-xs font-medium transition-colors border border-neutral-900 ${
                state().showVelocityOnChart
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-gray-900 hover:bg-neutral-100'
              }`}
              onClick={() => uiStore.setShowVelocityOnChart(!state().showVelocityOnChart)}
            >
              {state().showVelocityOnChart ? 'Hide v(t)' : 'Show v(t)'}
            </button>
          </div>

          {/* All metrics in clean rows */}
          <div class="space-y-3 text-sm">
            {/* Main absorbed energy */}
            <div class="flex justify-between items-baseline border-b border-neutral-200 pb-3">
              <div>
                <div class="font-semibold text-gray-900">Energy Absorbed</div>
                <div class="text-[10px] text-gray-500">Impact − Rebound</div>
              </div>
              <div class="text-2xl font-mono font-bold text-gray-900">
                {formatNumber(state().absorbedEnergyJPerKg, 1)}
                <span class="text-sm ml-1 font-normal text-gray-600">J/kg</span>
              </div>
            </div>

            {/* Impact energy */}
            <div class="flex justify-between items-baseline">
              <div>
                <span class="text-gray-700">Impact Energy</span>
                <span class="text-[10px] text-gray-400 ml-1">½·v²</span>
              </div>
              <span class="font-mono font-semibold">
                {formatNumber(state().impactEnergyJPerKg, 1, ' J/kg')}
              </span>
            </div>

            {/* Rebound energy */}
            <div class="flex justify-between items-baseline">
              <div>
                <span class="text-gray-700">Rebound Energy</span>
                <span class="text-[10px] text-gray-400 ml-1">½·v²</span>
              </div>
              <span class="font-mono font-semibold">
                {formatNumber(state().reboundEnergyJPerKg, 1, ' J/kg')}
              </span>
            </div>

            {/* Velocity before */}
            <div class="flex justify-between items-baseline">
              <span class="text-gray-700">Velocity Before</span>
              <span class="font-mono font-semibold">
                {formatNumber(state().impactVelocityBeforeMps, 2, ' m/s')}
              </span>
            </div>

            {/* Velocity after */}
            <div class="flex justify-between items-baseline">
              <span class="text-gray-700">Velocity After</span>
              <span class="font-mono font-semibold">
                {formatNumber(state().impactVelocityAfterMps, 2, ' m/s')}
              </span>
            </div>

            {/* Delta V */}
            <div class="flex justify-between items-baseline">
              <span class="text-gray-700">Δv</span>
              <span class="font-mono font-semibold">
                {formatNumber(state().impactDeltaVelocityMps, 2, ' m/s')}
              </span>
            </div>

            {/* COR */}
            <div class="flex justify-between items-baseline">
              <div>
                <span class="text-gray-700">COR</span>
                <span class="text-[10px] text-gray-400 ml-1">v_out / v_in</span>
              </div>
              <span class="font-mono font-semibold">{formatNumber(state().cor, 3)}</span>
            </div>

            {/* Energy Return */}
            <div class="flex justify-between items-baseline">
              <div>
                <span class="text-gray-700">Energy Return</span>
                <span class="text-[10px] text-gray-400 ml-1">COR²</span>
              </div>
              <span class="font-mono font-semibold">
                {formatNumber(state().energyReturnPercent, 1, '%')}
              </span>
            </div>

            {/* Bounce Height */}
            <div class="flex justify-between items-baseline">
              <div>
                <span class="text-gray-700">Bounce Height</span>
                <span class="text-[10px] text-gray-400 ml-1">v²/(2g)</span>
              </div>
              <span class="font-mono font-semibold">{formatNumber(state().bounceHeightCm, 1, ' cm')}</span>
            </div>
          </div>
        </section>

        {/* DRI Section */}
        <section class="px-4 py-3">
          <SectionHeader title="DRI (Dynamic Response Index)" />
          <div class="border border-neutral-400 p-3 text-[11px] text-gray-700">
            <div class="font-mono leading-snug space-y-0.5">
              <div>model: x" + 2ζωx' + ω²x = -a(t)</div>
              <div>DRI = ω²·max(|x|)/g</div>
              <div>ω=52.9 rad/s, ζ=0.224</div>
            </div>
            <div class="border-t border-neutral-400 mt-2 pt-2 flex justify-between items-baseline">
              <span class="text-xs font-bold text-gray-700">DRI</span>
              <span class="text-xl font-mono font-bold text-gray-900">
                {formatNumber(dri(), 2)}
              </span>
            </div>
            {driDeltaMaxMm() != null && (
              <div class="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>Δmax</span>
                <span class="font-mono">{formatNumber(driDeltaMaxMm(), 2, ' mm')}</span>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}
