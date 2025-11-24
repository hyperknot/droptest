import * as echarts from 'echarts'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { findFirstHitRange } from '../lib/filter/range'
import { uiStore } from '../stores/uiStore'

export const AccelerationProfileChart = () => {
  let divRef: HTMLDivElement | undefined
  let chartInst: echarts.ECharts | null = null

  onMount(() => {
    if (!divRef) return
    chartInst = echarts.init(divRef)

    const resize = () => chartInst?.resize()
    window.addEventListener('resize', resize)
    onCleanup(() => window.removeEventListener('resize', resize))

    chartInst.setOption({
      animation: false,
      grid: { left: 60, right: 60, top: 30, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          const t = params[0].axisValue
          let html = `<b>${Number(t).toFixed(2)} ms</b><br/>`
          params.forEach((p: any) => {
            if (p.value[1] != null) {
              html += `${p.marker} ${p.seriesName}: ${p.value[1].toFixed(2)}<br/>`
            }
          })
          return html
        },
      },
      xAxis: {
        type: 'value',
        name: 'Time (ms)',
        min: 'dataMin',
        max: 'dataMax',
      },
      yAxis: [
        {
          type: 'value',
          name: 'Accel (g)',
          position: 'left',
          min: -3,
          max: 45,
          axisLine: { show: true, lineStyle: { color: '#333' } },
          splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.5 } },
        },
        {
          type: 'value',
          name: 'Jerk (g/s)',
          position: 'right',
          min: -4000,
          max: 4000,
          axisLine: { show: true, lineStyle: { color: '#333' } },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: 'slider',
          bottom: 5,
          filterMode: 'none',
        },
      ],
      visualMap: [
        {
          show: false,
          seriesIndex: 1, // Accel Filtered
          pieces: [{ gt: -3, lt: 45, color: '#2563eb' }], // Blue
          outOfRange: { color: '#f97316' }, // Orange
        },
        {
          show: false,
          seriesIndex: 2, // Jerk
          pieces: [{ gt: -4000, lt: 4000, color: '#a855f7' }], // Purple
          outOfRange: { color: '#ef4444' }, // Red
        },
      ],
    })
  })

  // DATA UPDATE
  createEffect(() => {
    const file = uiStore.state.file
    if (!chartInst || !file) return

    const samples = file.samples

    chartInst.setOption({
      series: [
        {
          name: 'Raw Accel',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          // Bright Green for Raw
          lineStyle: { color: '#16a34a', width: 1.5, opacity: 0.5 },
          data: samples.map((s) => [s.timeMs, s.accelRaw]),
          z: 1,
        },
        {
          name: 'Filtered Accel',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 2.5 },
          data: samples.map((s) => [s.timeMs, s.accelFiltered]),
          z: 2,
        },
        {
          name: 'Jerk SG',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { width: 1.5 },
          data: samples.map((s) => [s.timeMs, s.jerkSG]),
          markLine: {
            symbol: 'none',
            lineStyle: { color: 'rgba(0,0,0,0.2)', width: 1 },
            data: [{ yAxis: 0 }],
            silent: true,
          },
          z: 3,
        },
      ],
    })
  })

  // RANGE COMMAND (Zoom)
  createEffect(() => {
    const cmd = uiStore.state.rangeRequest
    const file = uiStore.state.file
    if (!chartInst || !cmd || !file) return

    let start = 0
    let end = 100

    // Check the type properly
    if (cmd.type === 'firstHit') {
      const range = findFirstHitRange(file.samples)
      // Only apply if we found a valid hit range
      if (range) {
        const lastT = file.samples[file.samples.length - 1].timeMs
        if (lastT > 0) {
          start = (range.min / lastT) * 100
          end = (range.max / lastT) * 100
        }
      }
    }

    chartInst.dispatchAction({
      type: 'dataZoom',
      start,
      end,
    })
  })

  return <div ref={divRef} class="w-full h-full" />
}