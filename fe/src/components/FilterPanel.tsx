import type { Component } from 'solid-js'
import type { FilterConfig } from '../types'

interface FilterPanelProps {
  filterConfig: FilterConfig
  setFilterConfig: (cfg: FilterConfig) => void
}

export const FilterPanel: Component<FilterPanelProps> = (props) => {
  const updateFilter = (filterKey: keyof FilterConfig, field: string, value: any) => {
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

      {/* CFC */}
      <div class="border-t pt-2">
        <label class="flex items-center gap-1.5 mb-1.5">
          <input
            type="checkbox"
            checked={props.filterConfig.cfc.enabled}
            onChange={(e) => updateFilter('cfc', 'enabled', e.currentTarget.checked)}
            class="w-3.5 h-3.5"
          />
          <span class="font-semibold text-xs">CFC</span>
        </label>
        <div class="ml-5 space-y-1.5 text-xs">
          <div>
            <label class="block text-[10px] text-gray-600 mb-0.5">
              CFC: {props.filterConfig.cfc.cfc}
            </label>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={props.filterConfig.cfc.cfc}
              onInput={(e) => updateFilter('cfc', 'cfc', Number(e.currentTarget.value))}
              class="w-full"
              disabled={!props.filterConfig.cfc.enabled}
            />
          </div>
          <div>
            <label class="block text-[10px] text-gray-600 mb-0.5">
              Order: {props.filterConfig.cfc.order}
            </label>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={props.filterConfig.cfc.order}
              onInput={(e) => updateFilter('cfc', 'order', Number(e.currentTarget.value))}
              class="w-full"
              disabled={!props.filterConfig.cfc.enabled}
            />
          </div>
          <label class="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.cfc.zeroPhase}
              onChange={(e) => updateFilter('cfc', 'zeroPhase', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
              disabled={!props.filterConfig.cfc.enabled}
            />
            <span class="text-[10px]">Zero phase</span>
          </label>
        </div>
      </div>

      <div class="space-y-2">
        {/* Savitzky-Golay accel */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.savitzkyGolay.enabled}
              onChange={(e) =>
                updateFilter('savitzkyGolay', 'enabled', e.currentTarget.checked)
              }
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Savitzky-Golay</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Window: {props.filterConfig.savitzkyGolay.windowSize}
              </label>
              <input
                type="range"
                min="3"
                max="51"
                step="2"
                value={props.filterConfig.savitzkyGolay.windowSize}
                onInput={(e) =>
                  updateFilter(
                    'savitzkyGolay',
                    'windowSize',
                    Number(e.currentTarget.value),
                  )
                }
                class="w-full"
                disabled={!props.filterConfig.savitzkyGolay.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Polynomial: {props.filterConfig.savitzkyGolay.polynomial}
              </label>
              <input
                type="range"
                min="1"
                max="7"
                step="1"
                value={props.filterConfig.savitzkyGolay.polynomial}
                onInput={(e) =>
                  updateFilter(
                    'savitzkyGolay',
                    'polynomial',
                    Number(e.currentTarget.value),
                  )
                }
                class="w-full"
                disabled={!props.filterConfig.savitzkyGolay.enabled}
              />
            </div>
          </div>
        </div>

        {/* Moving average */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.movingAverage.enabled}
              onChange={(e) =>
                updateFilter('movingAverage', 'enabled', e.currentTarget.checked)
              }
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Moving average</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Window: {props.filterConfig.movingAverage.windowSize}
              </label>
              <input
                type="range"
                min="3"
                max="51"
                step="2"
                value={props.filterConfig.movingAverage.windowSize}
                onInput={(e) =>
                  updateFilter(
                    'movingAverage',
                    'windowSize',
                    Number(e.currentTarget.value),
                  )
                }
                class="w-full"
                disabled={!props.filterConfig.movingAverage.enabled}
              />
            </div>
          </div>
        </div>

        {/* Butterworth LP */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.butterworth.enabled}
              onChange={(e) =>
                updateFilter('butterworth', 'enabled', e.currentTarget.checked)
              }
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Butterworth LP</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Cutoff Hz: {props.filterConfig.butterworth.cutoffHz}
              </label>
              <input
                type="range"
                min="5"
                max="300"
                step="5"
                value={props.filterConfig.butterworth.cutoffHz}
                onInput={(e) =>
                  updateFilter(
                    'butterworth',
                    'cutoffHz',
                    Number(e.currentTarget.value),
                  )
                }
                class="w-full"
                disabled={!props.filterConfig.butterworth.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Order: {props.filterConfig.butterworth.order}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={props.filterConfig.butterworth.order}
                onInput={(e) =>
                  updateFilter('butterworth', 'order', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.butterworth.enabled}
              />
            </div>
            <label class="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={props.filterConfig.butterworth.zeroPhase}
                onChange={(e) =>
                  updateFilter('butterworth', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.butterworth.enabled}
              />
              <span class="text-[10px]">Zero phase</span>
            </label>
          </div>
        </div>

        {/* Notch / Band-stop */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.notch.enabled}
              onChange={(e) => updateFilter('notch', 'enabled', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Band-stop</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Center Hz: {props.filterConfig.notch.centerHz}
              </label>
              <input
                type="range"
                min="5"
                max="200"
                step="5"
                value={props.filterConfig.notch.centerHz}
                onInput={(e) =>
                  updateFilter('notch', 'centerHz', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.notch.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Bandwidth Hz: {props.filterConfig.notch.bandwidthHz}
              </label>
              <input
                type="range"
                min="2"
                max="50"
                step="2"
                value={props.filterConfig.notch.bandwidthHz}
                onInput={(e) =>
                  updateFilter('notch', 'bandwidthHz', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.notch.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Order: {props.filterConfig.notch.order}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={props.filterConfig.notch.order}
                onInput={(e) =>
                  updateFilter('notch', 'order', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.notch.enabled}
              />
            </div>
            <label class="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={props.filterConfig.notch.zeroPhase}
                onChange={(e) =>
                  updateFilter('notch', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.notch.enabled}
              />
              <span class="text-[10px]">Zero phase</span>
            </label>
          </div>
        </div>

        {/* Jerk (SG from filtered accel) */}
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