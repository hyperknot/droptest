import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { SamplePoint, FilterConfig } from '../types'
import { SERIES_CONFIG, calculateSeriesRange } from '../lib/calculations'

interface ControlPanelProps {
  samples: Array<SamplePoint>
  visibleSeries: Record<string, boolean>
  setVisibleSeries: (v: Record<string, boolean>) => void
  filterConfig: FilterConfig
  setFilterConfig: (cfg: FilterConfig) => void
  onFullRange: () => void
  onFirstHit: () => void
}

export const ControlPanel: Component<ControlPanelProps> = (props) => {
  const toggleSeries = (key: string) => {
    props.setVisibleSeries({
      ...props.visibleSeries,
      [key]: !props.visibleSeries[key],
    })
  }

  const updateFilterField = (filterKey: keyof FilterConfig, field: string, value: any) => {
    props.setFilterConfig({
      ...props.filterConfig,
      [filterKey]: {
        ...(props.filterConfig as any)[filterKey],
        [field]: value,
      },
    })
  }

  return (
    <section class="bg-white rounded border border-gray-200 p-2 space-y-3 text-sm">
      <h2 class="font-semibold text-base">Controls</h2>

      <div class="flex gap-1">
        <button
          onClick={props.onFullRange}
          class="flex-1 px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          Full range
        </button>
        <button
          onClick={props.onFirstHit}
          class="flex-1 px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
        >
          First hit
        </button>
      </div>

      <div class="space-y-3">
        {/* Series visibility */}
        <div>
          <h3 class="text-xs font-semibold mb-1.5 text-gray-700">Series visibility</h3>
          <div class="space-y-1">
            <For each={SERIES_CONFIG}>
              {(config) => {
                const range = calculateSeriesRange(props.samples, config.accessor)
                if (!range) return null

                return (
                  <label class="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={props.visibleSeries[config.key as string] ?? false}
                      onChange={() => toggleSeries(config.key as string)}
                      class="mt-0.5 w-3.5 h-3.5 cursor-pointer"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <div
                          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ 'background-color': config.color }}
                        />
                        <span class="font-medium text-xs">{config.displayName}</span>
                      </div>
                      <div class="text-[10px] text-gray-500 mt-0.5">
                        Min: {range.min.toFixed(3)} | Max: {range.max.toFixed(3)}
                      </div>
                    </div>
                  </label>
                )
              }}
            </For>
          </div>
        </div>

        {/* Savitzky-Golay main */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.sg.enabled}
              onChange={(e) => updateFilterField('sg', 'enabled', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Savitzky-Golay (main)</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Window: {props.filterConfig.sg.windowSize}
              </label>
              <input
                type="range"
                min="3"
                max="51"
                step="2"
                value={props.filterConfig.sg.windowSize}
                onInput={(e) =>
                  updateFilterField('sg', 'windowSize', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.sg.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Polynomial: {props.filterConfig.sg.polynomial}
              </label>
              <input
                type="range"
                min="1"
                max="7"
                step="1"
                value={props.filterConfig.sg.polynomial}
                onInput={(e) =>
                  updateFilterField('sg', 'polynomial', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.sg.enabled}
              />
            </div>
          </div>
        </div>

        {/* Savitzky-Golay strong */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.sgFull.enabled}
              onChange={(e) => updateFilterField('sgFull', 'enabled', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Savitzky-Golay (strong)</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Window: {props.filterConfig.sgFull.windowSize}
              </label>
              <input
                type="range"
                min="3"
                max="81"
                step="2"
                value={props.filterConfig.sgFull.windowSize}
                onInput={(e) =>
                  updateFilterField('sgFull', 'windowSize', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.sgFull.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Polynomial: {props.filterConfig.sgFull.polynomial}
              </label>
              <input
                type="range"
                min="1"
                max="7"
                step="1"
                value={props.filterConfig.sgFull.polynomial}
                onInput={(e) =>
                  updateFilterField('sgFull', 'polynomial', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.sgFull.enabled}
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
                updateFilterField('movingAverage', 'enabled', e.currentTarget.checked)
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
                  updateFilterField('movingAverage', 'windowSize', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.movingAverage.enabled}
              />
            </div>
          </div>
        </div>

        {/* Butterworth LP #1 */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.butterworth1.enabled}
              onChange={(e) =>
                updateFilterField('butterworth1', 'enabled', e.currentTarget.checked)
              }
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Butterworth LP #1</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Cutoff Hz: {props.filterConfig.butterworth1.cutoffHz}
              </label>
              <input
                type="range"
                min="5"
                max="300"
                step="5"
                value={props.filterConfig.butterworth1.cutoffHz}
                onInput={(e) =>
                  updateFilterField('butterworth1', 'cutoffHz', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.butterworth1.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Order: {props.filterConfig.butterworth1.order}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={props.filterConfig.butterworth1.order}
                onInput={(e) =>
                  updateFilterField('butterworth1', 'order', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.butterworth1.enabled}
              />
            </div>
            <label class="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={props.filterConfig.butterworth1.zeroPhase}
                onChange={(e) =>
                  updateFilterField('butterworth1', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.butterworth1.enabled}
              />
              <span class="text-[10px]">Zero phase</span>
            </label>
          </div>
        </div>

        {/* Butterworth LP #2 */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.butterworth2.enabled}
              onChange={(e) =>
                updateFilterField('butterworth2', 'enabled', e.currentTarget.checked)
              }
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Butterworth LP #2</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Cutoff Hz: {props.filterConfig.butterworth2.cutoffHz}
              </label>
              <input
                type="range"
                min="5"
                max="300"
                step="5"
                value={props.filterConfig.butterworth2.cutoffHz}
                onInput={(e) =>
                  updateFilterField('butterworth2', 'cutoffHz', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.butterworth2.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Order: {props.filterConfig.butterworth2.order}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={props.filterConfig.butterworth2.order}
                onInput={(e) =>
                  updateFilterField('butterworth2', 'order', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.butterworth2.enabled}
              />
            </div>
            <label class="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={props.filterConfig.butterworth2.zeroPhase}
                onChange={(e) =>
                  updateFilterField('butterworth2', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.butterworth2.enabled}
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
              onChange={(e) => updateFilterField('notch', 'enabled', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">Notch / Band-stop</span>
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
                  updateFilterField('notch', 'centerHz', Number(e.currentTarget.value))
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
                  updateFilterField('notch', 'bandwidthHz', Number(e.currentTarget.value))
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
                  updateFilterField('notch', 'order', Number(e.currentTarget.value))
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
                  updateFilterField('notch', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.notch.enabled}
              />
              <span class="text-[10px]">Zero phase</span>
            </label>
          </div>
        </div>

        {/* CFC 60 */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.cfc60.enabled}
              onChange={(e) => updateFilterField('cfc60', 'enabled', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">CFC 60</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                CFC: {props.filterConfig.cfc60.cfc}
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={props.filterConfig.cfc60.cfc}
                onInput={(e) =>
                  updateFilterField('cfc60', 'cfc', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.cfc60.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Order: {props.filterConfig.cfc60.order}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={props.filterConfig.cfc60.order}
                onInput={(e) =>
                  updateFilterField('cfc60', 'order', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.cfc60.enabled}
              />
            </div>
            <label class="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={props.filterConfig.cfc60.zeroPhase}
                onChange={(e) =>
                  updateFilterField('cfc60', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.cfc60.enabled}
              />
              <span class="text-[10px]">Zero phase</span>
            </label>
          </div>
        </div>

        {/* CFC 180 */}
        <div class="border-t pt-2">
          <label class="flex items-center gap-1.5 mb-1.5">
            <input
              type="checkbox"
              checked={props.filterConfig.cfc180.enabled}
              onChange={(e) => updateFilterField('cfc180', 'enabled', e.currentTarget.checked)}
              class="w-3.5 h-3.5"
            />
            <span class="font-semibold text-xs">CFC 180</span>
          </label>
          <div class="ml-5 space-y-1.5 text-xs">
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                CFC: {props.filterConfig.cfc180.cfc}
              </label>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={props.filterConfig.cfc180.cfc}
                onInput={(e) =>
                  updateFilterField('cfc180', 'cfc', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.cfc180.enabled}
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-600 mb-0.5">
                Order: {props.filterConfig.cfc180.order}
              </label>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={props.filterConfig.cfc180.order}
                onInput={(e) =>
                  updateFilterField('cfc180', 'order', Number(e.currentTarget.value))
                }
                class="w-full"
                disabled={!props.filterConfig.cfc180.enabled}
              />
            </div>
            <label class="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={props.filterConfig.cfc180.zeroPhase}
                onChange={(e) =>
                  updateFilterField('cfc180', 'zeroPhase', e.currentTarget.checked)
                }
                class="w-3.5 h-3.5"
                disabled={!props.filterConfig.cfc180.enabled}
              />
              <span class="text-[10px]">Zero phase</span>
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}