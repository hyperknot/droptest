import * as echarts from 'echarts'
import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { SamplePoint } from '../types'

interface AccelerationProfileChartProps {
  samples: Array<SamplePoint>
  visibleSeries: Record<string, boolean>
}

export const AccelerationProfileChart: Component<AccelerationProfileChartProps> = (props) => {
  let chartRef: HTMLDivElement | undefined
  const [chart, setChart] = createSignal<echarts.ECharts | null>(null)

  onMount(() => {
    if (chartRef) {
      const instance = echarts.init(chartRef)
      setChart(instance)
    }
  })

  createEffect(() => {
    const instance = chart()
    if (!instance) return

    const samples = props.samples || []
    if (samples.length === 0) {
      instance.clear()
      return
    }

    const times = samples.map((s) => s.timeMs)
    const xMinRaw = Math.min(...times)
    const xMaxRaw = Math.max(...times)
    const xSpan = xMaxRaw - xMinRaw || 1
    const xPadding = xSpan * 0.02
    const xMin = xMinRaw - xPadding
    const xMax = xMaxRaw + xPadding

    const series: echarts.SeriesOption[] = []
    const yAxes: echarts.YAXisComponentOption[] = []

    const seriesConfig: Array<{
      key: keyof SamplePoint
      displayName: string
      color: string
      accessor: (s: SamplePoint) => number | null | undefined
    }> = [
      { key: 'accelG', displayName: 'Accel (G)', color: '#2563eb', accessor: (s) => s.accelG },
      {
        key: 'accelFiltered',
        displayName: 'Accel filtered (G)',
        color: '#0ea5e9',
        accessor: (s) => s.accelFiltered ?? null,
      },
      { key: 'speed', displayName: 'Speed', color: '#16a34a', accessor: (s) => s.speed ?? null },
      { key: 'pos', displayName: 'Position', color: '#a855f7', accessor: (s) => s.pos ?? null },
      { key: 'jerk', displayName: 'Jerk', color: '#f97316', accessor: (s) => s.jerk ?? null },
    ]

    // Build visible series with their calculated ranges
    const visibleSeriesInfo: Array<{
      config: typeof seriesConfig[0]
      min: number
      max: number
      yAxisIndex: number
    }> = []

    let yAxisIndex = 0
    for (const config of seriesConfig) {
      if (!props.visibleSeries[config.key as string]) continue

      const values: number[] = []
      for (const s of samples) {
        const v = config.accessor(s)
        if (v != null && Number.isFinite(v)) values.push(v)
      }
      if (values.length === 0) continue

      const min = Math.min(...values)
      const max = Math.max(...values)

      visibleSeriesInfo.push({
        config,
        min,
        max,
        yAxisIndex: yAxisIndex++,
      })
    }

    // Create hidden Y-axes, each scaled to its series range
    for (const info of visibleSeriesInfo) {
      const range = info.max - info.min
      const padding = range * 0.05

      yAxes.push({
        type: 'value',
        show: false, // Hide the axis completely
        min: info.min - padding,
        max: info.max + padding,
      })

      // Add series bound to this Y-axis
      series.push({
        name: info.config.displayName,
        type: 'line',
        yAxisIndex: info.yAxisIndex,
        showSymbol: false,
        smooth: false,
        lineStyle: {
          width: 2,
          color: info.config.color,
        },
        data: samples.map((s) => {
          const v = info.config.accessor(s)
          return [s.timeMs, v != null && Number.isFinite(v) ? v : null]
        }),
      })
    }

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
        min: xMin,
        max: xMax,
      },
      yAxis: yAxes,
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          height: 25,
        },
      ],
      series,
    }

    instance.setOption(option, true)
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