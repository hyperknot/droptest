import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DropTestData, FilterConfig, SamplePoint, RangeCommand } from '../types'
import { AccelerationProfileChart } from './AccelerationProfileChart'
import { ControlPanel } from './ControlPanel'
import { FileInfoPanel } from './FileInfo'
import { SeriesTogglePanel } from './SeriesTogglePanel'

interface MainLayoutProps {
  testData: DropTestData
  displaySamples: Array<SamplePoint>
  filterConfig: FilterConfig
  setFilterConfig: (cfg: FilterConfig) => void
}

export const MainLayout: Component<MainLayoutProps> = (props) => {
  const [visibleSeries, setVisibleSeries] = createSignal<Record<string, boolean>>({
    accelG: true,
    accelFactoryFiltered: true,
    accelFiltered: true,
    accelSGFull: false,
    accelMA9: false,
    accelLPEnvLight: false,
    accelLPEnvMedium: false,
    accelLPEnvStrong: false,
    accelCFC60: false,
    accelCFC180: false,
    accelFromSpeed: false,
    accelFromPos: false,
    speed: true,
    pos: true,
    jerk: true,
  })

  const [rangeCommand, setRangeCommand] = createSignal<RangeCommand>(null)

  const handleFullRange = () => {
    setRangeCommand({ type: 'full' })
  }

  const handleFirstHit = () => {
    setRangeCommand({ type: 'firstHit' })
  }

  return (
    <div class="h-screen flex overflow-hidden">
      {/* Main chart area */}
      <div class="flex-1">
        <AccelerationProfileChart
          samples={props.displaySamples}
          visibleSeries={visibleSeries()}
          rangeCommand={rangeCommand()}
        />
      </div>

      {/* Right sidebar */}
      <div class="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          <SeriesTogglePanel
            samples={props.displaySamples}
            visibleSeries={visibleSeries()}
            setVisibleSeries={setVisibleSeries}
          />
          <ControlPanel
            filterConfig={props.filterConfig}
            setFilterConfig={props.setFilterConfig}
            onFullRange={handleFullRange}
            onFirstHit={handleFirstHit}
          />
          <FileInfoPanel data={props.testData} />
        </div>
      </div>
    </div>
  )
}