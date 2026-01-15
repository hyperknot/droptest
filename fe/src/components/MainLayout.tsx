import { For, type JSX, type ParentProps } from 'solid-js'
import { uiStore } from '../stores/uiStore'
import { AccelerationProfileChart } from './AccelerationProfileChart'

// Chart colors (must match AccelerationProfileChart.tsx)
const COLOR_RAW = '#16a34a' // Green
const COLOR_ACCEL_FILTERED = '#2563eb' // Blue
const COLOR_JERK = '#a855f7' // Purple
const COLOR_VELOCITY = '#059669' // Emerald

// ─────────────────────────────────────────────────────────────────────────────
// Primitive UI Components
// ─────────────────────────────────────────────────────────────────────────────

const Section = (props: ParentProps) => <section class="px-4 py-3">{props.children}</section>

const SectionHeader = (props: { title: string; color?: string; inline?: boolean }) => (
  <h2 class={`text-lg font-semibold flex items-center gap-2 ${props.inline ? '' : 'mb-2'}`}>
    {props.color && (
      <span class="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: props.color }} />
    )}
    {props.title}
  </h2>
)

const AlgorithmInfo = (props: { lines: Array<string | JSX.Element> }) => (
  <div class="text-[11px] text-neutral-600 mb-2">
    <div class="font-mono leading-snug space-y-0.5">
      <For each={props.lines}>{(line) => <div class="break-all">{line}</div>}</For>
    </div>
  </div>
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
      <label class="text-xs font-medium text-neutral-700">{props.label}</label>
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

const ToggleButton = (props: {
  active: boolean
  onClick: () => void
  children: JSX.Element
  borderRight?: boolean
}) => (
  <button
    class={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
      props.borderRight ? 'border-r border-black' : ''
    } ${props.active ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900 hover:bg-neutral-200'}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
)

const MetricRow = (props: { label: string; hint?: string; value: string; large?: boolean }) => (
  <div class="flex justify-between items-baseline">
    <div>
      <span class="text-neutral-700">{props.label}</span>
      {props.hint && <span class="text-xs text-neutral-600 ml-1">{props.hint}</span>}
    </div>
    <span
      class={`font-mono font-${props.large ? 'bold' : 'semibold'} ${props.large ? 'text-xl text-neutral-900' : ''}`}
    >
      {props.value}
    </span>
  </div>
)

const MetricCell = (props: { label: string; value: string }) => (
  <div class="text-center">
    <div class="text-neutral-600 text-xs">{props.label}</div>
    <div class="font-mono font-semibold">{props.value}</div>
  </div>
)

const formatNumber = (v: number | null, digits: number, unit = '') => {
  if (v == null) return '—'
  return `${v.toFixed(digits)}${unit}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Components
// ─────────────────────────────────────────────────────────────────────────────

const PeakStats = () => (
  <div class="h-14 flex justify-center items-center gap-8 px-4 bg-white border-b border-black">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-neutral-600">Max Acceleration (G):</span>
      <span class="text-lg font-mono font-bold text-neutral-900">
        {uiStore.state.peakAccel != null ? uiStore.state.peakAccel.toFixed(1) : '—'}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-neutral-600">Max Jerk (G/sec):</span>
      <span class="text-lg font-mono font-bold text-neutral-900">
        {uiStore.state.peakJerk != null ? Math.round(uiStore.state.peakJerk) : '—'}
      </span>
    </div>
  </div>
)

const SidebarHeader = () => (
  <div class="h-14 flex items-center px-3">
    <div class="flex gap-2 w-full">
      <button
        class="flex-1 px-3 py-1 text-sm font-medium transition-colors border border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-200"
        onClick={() => uiStore.setRangeRequest('firstHit')}
      >
        First Hit Zoom
      </button>
      <button
        class="flex-1 px-3 py-1 text-sm font-medium transition-colors border border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-200"
        onClick={() => uiStore.setRangeRequest('full')}
      >
        Full View
      </button>
    </div>
  </div>
)

const RawAccelSection = () => (
  <Section>
    <SectionHeader title="File" />
    <AlgorithmInfo
      lines={[
        uiStore.state.filename,
        `${uiStore.state.processedSamples.length.toLocaleString()} pts @ ${uiStore.state.sampleRateHz.toFixed(1)} Hz`,
      ]}
    />
  </Section>
)

const FilteredAccelSection = () => (
  <Section>
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
        `CFC ${uiStore.state.accelCfc} → Fc=${Math.round(uiStore.state.accelCfc * 2.0775)} Hz`,
      ]}
    />
    <SliderControl
      label="CFC Class"
      value={uiStore.state.accelCfc}
      min={5}
      max={225}
      step={5}
      unit=""
      onChange={(v) => uiStore.setAccelCfc(v)}
    />
  </Section>
)

const JerkSection = () => (
  <Section>
    <SectionHeader title="Jerk" color={COLOR_JERK} />
    <AlgorithmInfo
      lines={[
        'Savitzky–Golay derivative',
        `polyOrder=${uiStore.state.jerkPolyOrder}, deriv=1  →  units: G/s`,
        `window=${uiStore.state.jerkWindowMs} ms`,
      ]}
    />
    <SliderControl
      label="Window Size"
      value={uiStore.state.jerkWindowMs}
      min={5}
      max={51}
      step={2}
      unit="ms"
      onChange={(v) => uiStore.setJerkWindowMs(v)}
    />
    <div class="mt-2">
      <label class="text-xs font-medium text-neutral-700 block mb-1">Polynomial Order</label>
      <div class="flex border border-neutral-900">
        <ToggleButton
          active={uiStore.state.jerkPolyOrder === 1}
          onClick={() => uiStore.setJerkPolyOrder(1)}
          borderRight
        >
          <>Linear (1)</>
        </ToggleButton>
        <ToggleButton
          active={uiStore.state.jerkPolyOrder === 3}
          onClick={() => uiStore.setJerkPolyOrder(3)}
        >
          <>Cubic (3)</>
        </ToggleButton>
      </div>
    </div>
  </Section>
)

const EnergySection = () => {
  const state = uiStore.state
  return (
    <Section>
      <div class="flex items-center justify-between mb-3">
        <SectionHeader title="Impact Energy" color={COLOR_VELOCITY} inline />
        <button
          class={`px-3 py-1.5 text-xs font-medium transition-colors border border-neutral-900 ${
            state.showVelocityOnChart
              ? 'bg-neutral-900 text-white'
              : 'bg-white text-neutral-900 hover:bg-neutral-200'
          }`}
          onClick={() => uiStore.setShowVelocityOnChart(!state.showVelocityOnChart)}
        >
          {state.showVelocityOnChart ? 'Hide v(t)' : 'Show v(t)'}
        </button>
      </div>

      <div class="space-y-3 text-sm">
        {/* Velocity: v before | v after | Δv */}
        <div class="flex justify-between items-baseline">
          <MetricCell label="v before" value={formatNumber(state.impactVelocityBeforeMps, 2)} />
          <MetricCell label="v after" value={formatNumber(state.impactVelocityAfterMps, 2)} />
          <MetricCell label="Δv" value={formatNumber(state.impactDeltaVelocityMps, 2)} />
          <span class="text-neutral-600 text-xs self-end">m/s</span>
        </div>

        <hr class="border-neutral-300" />

        {/* Energy: impact | rebound | absorbed */}
        <div class="flex justify-between items-baseline">
          <MetricCell label="E impact" value={formatNumber(state.impactEnergyJPerKg, 1)} />
          <MetricCell label="E rebound" value={formatNumber(state.reboundEnergyJPerKg, 1)} />
          <MetricCell label="E absorbed" value={formatNumber(state.absorbedEnergyJPerKg, 1)} />
          <span class="text-neutral-600 text-xs self-end">J/kg</span>
        </div>

        <hr class="border-neutral-300" />

        <MetricRow label="COR" hint="v_out / v_in" value={formatNumber(state.cor, 3)} />
        <MetricRow
          label="Energy Return"
          hint="COR²"
          value={formatNumber(state.energyReturnPercent, 1, '%')}
        />
        <MetricRow
          label="Bounce Height"
          hint="v²/(2g)"
          value={formatNumber(state.bounceHeightCm, 1, ' cm')}
        />
      </div>
    </Section>
  )
}

const DRISection = () => (
  <Section>
    <SectionHeader title="DRI (Dynamic Response Index)" />
    <AlgorithmInfo
      lines={['model: x" + 2ζωx\' + ω²x = -a(t)', 'DRI = ω²·max(|x|)/g', 'ω=52.9 rad/s, ζ=0.224']}
    />
    <div class="space-y-2 text-sm">
      <MetricRow label="DRI" value={formatNumber(uiStore.state.dri, 2)} large />
      {uiStore.state.driDeltaMaxMm != null && (
        <div class="flex justify-between items-baseline text-neutral-600">
          <span>Δmax</span>
          <span class="font-mono">{formatNumber(uiStore.state.driDeltaMaxMm, 2, ' mm')}</span>
        </div>
      )}
    </div>
  </Section>
)

const HICSection = () => (
  <Section>
    <SectionHeader title="HIC (Head Injury Criterion)" />
    <AlgorithmInfo
      lines={[
        `HIC = max[(t₂-t₁)·(∫a dt / (t₂-t₁))^${uiStore.state.hicExponent}]`,
        `window=${uiStore.state.hicWindowMs} ms`,
      ]}
    />
    <div class="space-y-2 text-sm mb-3">
      <MetricRow label="HIC" value={formatNumber(uiStore.state.peakHIC, 1)} large />
    </div>
    <SliderControl
      label="Window Size"
      value={uiStore.state.hicWindowMs}
      min={5}
      max={50}
      step={1}
      unit="ms"
      onChange={(v) => uiStore.setHicWindowMs(v)}
    />
    <SliderControl
      label="Exponent"
      value={uiStore.state.hicExponent}
      min={1.0}
      max={3.5}
      step={0.1}
      unit=""
      onChange={(v) => uiStore.setHicExponent(v)}
    />
  </Section>
)

// ─────────────────────────────────────────────────────────────────────────────
// Main Layout
// ─────────────────────────────────────────────────────────────────────────────

export const MainLayout = () => (
  <div class="h-screen flex overflow-hidden bg-white">
    {/* Main content area */}
    <div class="flex-1 flex flex-col min-w-0 border-r border-black">
      <PeakStats />
      <div class="flex-1 min-h-0 relative">
        <AccelerationProfileChart />
      </div>
    </div>

    {/* Sidebar */}
    <aside class="w-80 h-full overflow-y-auto flex-shrink-0 divide-y divide-black">
      <SidebarHeader />
      <RawAccelSection />
      <EnergySection />
      <DRISection />
      <HICSection />
      <FilteredAccelSection />
      <JerkSection />
    </aside>
  </div>
)
