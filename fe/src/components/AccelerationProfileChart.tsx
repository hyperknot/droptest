import * as echarts from 'echarts'
import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'

interface SamplePoint {
  t: number // seconds
  aG: number // acceleration in G
  v: number
  x: number
}

interface AccelerationProfileChartProps {
  samples: Array<SamplePoint>
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

    const data = (props.samples || []).map((p) => [p.t * 1000, p.aG])
    const maxTimeMs = data.length ? data[data.length - 1][0] : 0

    // Find time ranges where acceleration exceeds thresholds
    const findThresholdRange = (threshold: number): [number, number] | null => {
      const points = data.filter(([_, aG]) => aG > threshold)
      if (points.length === 0) return null

      const startTime = points[0][0]
      const endTime = points[points.length - 1][0]

      return [startTime, endTime]
    }

    const range38G = findThresholdRange(38)
    const range20G = findThresholdRange(20)

    const option: echarts.EChartsOption = {
      animation: false,
      grid: { left: 0, right: 0, top: 0, bottom: 0, outerBoundsContain: 'all' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          const tMs = p?.data?.[0] ?? 0
          const aG = p?.data?.[1] ?? 0
          return `t = ${tMs.toFixed(2)} ms<br/>a = ${aG.toFixed(2)} G`
        },
      },
      xAxis: {
        type: 'value',
        name: 'Time (ms)',
        nameLocation: 'middle',
        nameGap: 30,
        min: 0,
        max: Math.max(60, maxTimeMs),
        axisLabel: { formatter: (value: number) => value.toFixed(1) },
      },
      yAxis: {
        type: 'value',
        name: 'Acceleration (G)',
        min: 0,
        max: 45,
        axisLabel: { formatter: '{value}' },
        splitLine: { show: true },
      },
      series: [
        {
          name: 'Acceleration',
          type: 'line',
          smooth: false,
          symbol: 'none',
          lineStyle: { width: 2, color: '#2563eb' },
          data,
        },
        // Red line for >38G segment
        ...(range38G
          ? [
              {
                name: '38G Threshold',
                type: 'line' as const,
                symbol: 'none',
                lineStyle: { width: 3, color: '#ef4444', type: 'solid' as const },
                data: [
                  [range38G[0], 38],
                  [range38G[1], 38],
                ],
                tooltip: { show: false },
              },
            ]
          : []),
        // Orange line for >20G segment
        ...(range20G
          ? [
              {
                name: '20G Threshold',
                type: 'line' as const,
                symbol: 'none',
                lineStyle: { width: 3, color: '#f97316', type: 'solid' as const },
                data: [
                  [range20G[0], 20],
                  [range20G[1], 20],
                ],
                tooltip: { show: false },
              },
            ]
          : []),
      ],
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

  return <div ref={chartRef} class="w-full h-80 min-w-0" />
}
