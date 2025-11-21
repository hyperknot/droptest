import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DropTestData, FilterConfig, SamplePoint, RangeCommand } from '../types'
import { AccelerationProfileChart } from './AccelerationProfileChart'
import { FilterPanel } from './FilterPanel'
import { FileInfoPanel } from './FileInfo'
import { SeriesTogglePanel } from './SeriesTogglePanel'

interface MainLayoutProps {
  testData: DropTestData
  displaySamples: Array<SamplePoint>
  filterConfig: FilterConfig
  setFilterConfig: (cfg: FilterConfig) => void
  rangeCommand: RangeCommand
  setRangeCommand: (cmd: RangeCommand) => void
}

export const MainLayout: Component<MainLayoutProps> = (props) => {
  const [visibleSeries, setVisibleSeries] = createSignal<Record<string, boolean>>({
    accelG: true,
  })

  return (
    <div class="h-screen flex overflow-hidden">
      <div class="flex-1">
        <AccelerationProfileChart
          samples={props.displaySamples}
          visibleSeries={visibleSeries()}
          filterConfig={props.filterConfig}
          rangeCommand={props.rangeCommand}
        />
      </div>

      <div class="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          <section class="bg-white rounded border border-gray-200 p-2">
            <div class="flex gap-1">
              <button
                onClick={() => props.setRangeCommand({ type: 'full' })}
                class="flex-1 px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                Full range
              </button>
              <button
                onClick={() => props.setRangeCommand({ type: 'firstHit' })}
                class="flex-1 px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
              >
                First hit
              </button>
            </div>
          </section>

          <SeriesTogglePanel
            samples={props.displaySamples}
            visibleSeries={visibleSeries()}
            setVisibleSeries={setVisibleSeries}
          />

          <FilterPanel
            filterConfig={props.filterConfig}
            setFilterConfig={props.setFilterConfig}
          />

          <FileInfoPanel data={props.testData} />
        </div>
      </div>
    </div>
  )
}