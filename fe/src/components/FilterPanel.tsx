import type { Component } from 'solid-js'
import type { FilterConfig } from '../types'

interface FilterPanelProps {
  filterConfig: FilterConfig
  setFilterConfig: (cfg: FilterConfig) => void
}

export const FilterPanel: Component<FilterPanelProps> = (props) => {
  const updateFilter = (
    filterKey: keyof FilterConfig,
    field: string,
    value: any,
  ) => {
    props.setFilterConfig({
      ...props.filterConfig,
      [filterKey]: {
        ...(props.filterConfig as any)[filterKey],
        [field]: value,
      },
    })
  }

  const accelFilterCount = () =>
    Number(props.filterConfig.cfc.enabled) +
    Number(props.filterConfig.savitzkyGolay.enabled) +
    Number(props.filterConfig.movingAverage.enabled) +
    Number(props.filterConfig.butterworth.enabled) +
    Number(props.filterConfig.notch.enabled)

  return (
    <section class="bg-white rounded border border-gray-200 p-2 space-y-2 text-sm">
      <h2 class="font-semibold text-base">Filters</h2>

      <div class="border-t pt-2">
        {/* CFC block unchanged */}
      </div>

      <div class="space-y-2">
        <div class="border-t pt-2">
          {/* Savitzky-Golay accel block unchanged */}
        </div>

        <div class="border-t pt-2">
          {/* Moving average block unchanged */}
        </div>

        <div class="border-t pt-2">
          {/* Butterworth block unchanged */}
        </div>

        <div class="border-t pt-2">
          {/* Notch block unchanged */}
        </div>

        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.jerk.enabled}
              onChange={(e) =>
                updateFilter('jerk', 'enabled', e.currentTarget.checked)
              }
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Jerk (Savitzky-Golay)</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Window: {props.filterConfig.jerk.windowSize}
              </label>
              <input
                type="range"
                min="5"
                max="51"
                step="2"
                value={props.filterConfig.jerk.windowSize}
                onInput={(e) =>
                  updateFilter('jerk', 'windowSize', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.jerk.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Polynomial: {props.filterConfig.jerk.polynomial}
              </label>
              <input
                type="range"
                min="1"
                max="7"
                step="1"
                value={props.filterConfig.jerk.polynomial}
                onInput={(e) =>
                  updateFilter('jerk', 'polynomial', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.jerk.enabled}
              />
            </div>
            <p class="text-[10px] text-gray-500">
              Jerk is computed only when exactly one acceleration filter is enabled.
              Currently selected: {accelFilterCount()}.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}