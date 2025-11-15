import * as echarts from 'echarts'
import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { SamplePoint } from '../types'
import type { RangeCommand } from '../App'
import {
  SERIES_CONFIG,
  calculateSeriesRange,
  calculateTimeRange,
  addPadding,
  findFirstHitRange,
  calculateZoomPercent,
} from '../lib/calculations'

interface AccelerationProfileChartProps {
  samples: Array<SamplePoint>
  visibleSeries: Record<string, boolean>
  rangeCommand: RangeCommand
}

export const AccelerationProfileChart: Component<AccelerationProfileChartProps> = (props) => {
  let chartRef: HTMLDivElement | undefined
  const [chart, setChart] = createSignal<echarts.ECharts | null>(null)
  const [prevSamples, setPrevSamples] = createSignal<Array<SamplePoint> | null>(null)

  onMount(() => {
    if (chartRef) {
      const instance = echarts.init(chartRef)
      setChart(instance)
    }
  })

  // Handle range commands
  createEffect(() => {
    const cmd = props.rangeCommand
    const instance = chart()
    if (!instance || !cmd) return

    const samples = props.samples
    if (samples.length === 0) return

    if (cmd.type === 'full') {
      instance.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100,
      })
      console.log('Reset to full range')
    } else if (cmd.type === 'firstHit') {
      const hitRange = findFirstHitRange(samples)
      if (!hitRange) return

      const timeRange = calculateTimeRange(samples)
      if (!timeRange) return

      const axisRange = addPadding(timeRange)
      const zoomPercent = calculateZoomPercent(hitRange, axisRange)

      console.log('Zooming to first hit range:', {
        hitRange,
        axisRange,
        zoomPercent,
      })

      instance.dispatchAction({
        type: 'dataZoom',
        start: zoomPercent.start,
        end: zoomPercent.end,
      })
    }
  })

  createEffect(() => {
    const instance = chart()
    if (!instance) return

    const samples = props.samples || []
    if (samples.length === 0) {
      instance.clear()
      setPrevSamples(null)
      return
    }

    // Check if samples changed (new file loaded)
    const samplesChanged = prevSamples() !== samples
    if (samplesChanged) {
      setPrevSamples(samples)
    }

    // Calculate time axis range
    const timeRange = calculateTimeRange(samples)
    if (!timeRange) return

    const axisRange = addPadding(timeRange)

    // Build visible series
    const visibleSeriesInfo: Array<{
      config: typeof SERIES_CONFIG[0]
      range: { min: number; max: number }
      yAxisIndex: number
    }> = []

    let yAxisIndex = 0
    for (const config of SERIES_CONFIG) {
      if (!props.visibleSeries[config.key as string]) continue

      const range = calculateSeriesRange(samples, config.accessor)
      if (!range) continue

      visibleSeriesInfo.push({
        config,
        range,
        yAxisIndex: yAxisIndex++,
      })
    }

    // Build Y-axes (even if no series visible, to preserve chart structure)
    const yAxes: echarts.YAXisComponentOption[] =
      visibleSeriesInfo.length > 0
        ? visibleSeriesInfo.map((info) => {
            const padding = (info.range.max - info.range.min) * 0.05
            return {
              type: 'value',
              show: false,
              min: info.range.min - padding,
              max: info.range.max + padding,
            }
          })
        : [
            {
              type: 'value',
              show: false,
            },
          ]

    // Build series (empty array if none visible)
    const series: echarts.SeriesOption[] = visibleSeriesInfo.map((info) => ({
      name: info.config.displayName,
      type: 'line',
      yAxisIndex: info.yAxisIndex,
      showSymbol: false,
      smooth: false,
      lineStyle: {
        width: 2,
        color: info.config.color,
      },
      itemStyle: {
        color: info.config.color,
      },
      data: samples.map((s) => {
        const v = info.config.accessor(s)
        return [s.timeMs, v != null && Number.isFinite(v) ? v : null]
      }),
    }))

    const option: echarts.EChartsOption = {
      animation: false,
      grid: { left: 50, right: 20, top: 10, bottom: 50 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''
          const x = params[0].data?.[0] ?? 0
          const lines = [`<strong>t = ${x.toFixed(3)} ms</strong>`]
          for (const p of params) {
            const val = p.data?.[1]
            if (val == null) continue
            lines.push(`${p.marker} ${p.seriesName}: ${Number(val).toFixed(4)}`)
          }
          return lines.join('<br/>')
        },
      },
      xAxis: {
        type: 'value',
        name: 'Time (ms)',
        nameLocation: 'middle',
        nameGap: 30,
        min: axisRange.min,
        max: axisRange.max,
      },
      yAxis: yAxes,
      series,
    }

    // Only set dataZoom when samples change (new file loaded)
    // This preserves zoom state when just toggling series visibility
    if (samplesChanged) {
      option.dataZoom = [
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          height: 25,
        },
      ]
    }

    instance.setOption(option, { replaceMerge: ['series', 'yAxis'] })
    instance.resize()
  })

  onCleanup(() => {
    const instance = chart()
    if (instance) {
      instance.dispose()
      setChart(null)
    }
  })

  return <div ref={chartRef} class="w-full h-[600px] min-w-0" />
}