import * as echarts from 'echarts'
import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { SamplePoint } from '../types'
import type { RangeCommand } from '../App'
import {
  SERIES_CONFIG,
  type SeriesConfig,
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

    // Build visible series infos
    const visibleSeriesInfo: Array<{
      config: SeriesConfig
      range: { min: number; max: number }
    }> = []

    for (const config of SERIES_CONFIG) {
      if (!props.visibleSeries[config.key as string]) continue

      const range = calculateSeriesRange(samples, config.accessor)
      if (!range) continue

      visibleSeriesInfo.push({
        config,
        range,
      })
    }

    // Group ranges so that all accel series share the same Y axis
    type GroupRange = { min: number; max: number }
    const groupRanges = new Map<SeriesConfig['group'], GroupRange>()

    for (const info of visibleSeriesInfo) {
      const group = info.config.group
      const existing = groupRanges.get(group)
      if (!existing) {
        groupRanges.set(group, { ...info.range })
      } else {
        existing.min = Math.min(existing.min, info.range.min)
        existing.max = Math.max(existing.max, info.range.max)
      }
    }

    const groupOrder: Array<SeriesConfig['group']> = ['accel', 'speed', 'position', 'jerk', 'other']

    const orderedGroups = Array.from(groupRanges.entries()).sort(
      (a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0]),
    )

    const yAxes: echarts.YAXisComponentOption[] = []
    const groupAxisIndex = new Map<SeriesConfig['group'], number>()

    orderedGroups.forEach(([group, range], index) => {
      const span = range.max - range.min || 1
      const padding = span * 0.05
      yAxes.push({
        type: 'value',
        show: false,
        min: range.min - padding,
        max: range.max + padding,
      })
      groupAxisIndex.set(group, index)
    })

    if (yAxes.length === 0) {
      yAxes.push({
        type: 'value',
        show: false,
      })
    }

    // Build series (empty array if none visible)
    const series: echarts.SeriesOption[] = visibleSeriesInfo.map((info) => {
      const yAxisIndex = groupAxisIndex.get(info.config.group) ?? 0
      return {
        name: info.config.displayName,
        type: 'line',
        yAxisIndex,
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
      }
    })

    const option: echarts.EChartsOption = {
      animation: false,
      grid: { left: 0, right: 0, top: 20, bottom: 20 },
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

  return <div ref={chartRef} class="w-full h-full min-w-0" />
}