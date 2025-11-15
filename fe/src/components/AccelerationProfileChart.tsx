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

    const addSeries = (
      key: keyof SamplePoint,
      displayName: string,
      color: string,
      accessor: (s: SamplePoint) => number | null | undefined,
    ) => {
      if (!props.visibleSeries[key as string]) return

      const values: number[] = []
      for (const s of samples) {
        const v = accessor(s)
        if (v != null && Number.isFinite(v)) values.push(v)
      }
      if (values.length === 0) return

      series.push({
        name: displayName,
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: {
          width: 2,
          color,
        },
        data: samples.map((s) => {
          const v = accessor(s)
          return [s.timeMs, v != null && Number.isFinite(v) ? v : null]
        }),
      })
    }

    // Build series for all numeric columns
    addSeries('accelG', 'Accel (G)', '#2563eb', (s) => s.accelG)
    addSeries('accelFiltered', 'Accel filtered (G)', '#0ea5e9', (s) => s.accelFiltered ?? null)
    addSeries('speed', 'Speed', '#16a34a', (s) => s.speed ?? null)
    addSeries('pos', 'Position', '#a855f7', (s) => s.pos ?? null)
    addSeries('jerk', 'Jerk', '#f97316', (s) => s.jerk ?? null)

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
      yAxis: {
        type: 'value',
        show: false, // Hide Y-axis completely
      },
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