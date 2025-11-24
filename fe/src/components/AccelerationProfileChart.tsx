import * as echarts from 'echarts'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { findFirstHitRange } from '../lib/filter/range'
import { uiStore } from '../stores/uiStore'

export const AccelerationProfileChart = () => {
  let divRef: HTMLDivElement | undefined
  let chartInst: echarts.ECharts | null = null

  // 1. Initialize Chart
  onMount(() => {
    if (!divRef) return
    chartInst = echarts.init(divRef)

    const resize = () => chartInst?.resize()
    window.addEventListener('resize', resize)
    onCleanup(() => window.removeEventListener('resize', resize))

    // Set static/base configuration once
    chartInst.setOption({
      animation: false, // Disable animation for snappy updates
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
      // Define Dual Y-Axes
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
          filterMode: 'none', // Important: don't filter data, just zoom view
        },
      ],
      // Visual Mapping for Color Ranges
      visualMap: [
        {
          show: false,
          seriesIndex: 1, // Accel CFC
          pieces: [{ gt: -3, lt: 45, color: '#2563eb' }], // Normal Blue
          outOfRange: { color: '#f97316' }, // Warning Orange
        },
        {
          show: false,
          seriesIndex: 2, // Jerk
          pieces: [{ gt: -4000, lt: 4000, color: '#a855f7' }], // Normal Purple
          outOfRange: { color: '#ef4444' }, // Warning Red
        },
      ],
    })
  })

  // 2. Handle Data Updates (Filters changed)
  // This effect runs whenever file contents change (e.g. after dragging slider)
  // We specifically DO NOT touch dataZoom here to preserve user's zoom level.
  createEffect(() => {
    const file = uiStore.state.file
    if (!chartInst || !file) return

    // Create references to avoid deep proxy usage inside the heavy map loop if possible
    // (Though regular SolidJS stores handle this well enough for this data size)
    const samples = file.samples

    chartInst.setOption({
      series: [
        {
          name: 'Raw Accel',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          // Gray, slightly thinner, semi-transparent to not block CFC
          lineStyle: { color: '#94a3b8', width: 1, opacity: 0.6 },
          data: samples.map((s) => [s.timeMs, s.accelRaw]),
          z: 1,
        },
        {
          name: 'Accel CFC',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 2.5 },
          data: samples.map((s) => [s.timeMs, s.accelCFC]),
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

  // 3. Handle Explicit Range Commands (First Hit / Full View)
  // This only runs when the user clicks a button or a new file loads
  createEffect(() => {
    const cmd = uiStore.state.rangeRequest
    const file = uiStore.state.file
    if (!chartInst || !cmd || !file) return

    let startPercent = 0
    let endPercent = 100

    if (cmd === 'firstHit') {
      const range = findFirstHitRange(file.samples)
      if (range && file.samples.length > 0) {
        const lastMs = file.samples[file.samples.length - 1].timeMs
        if (lastMs > 0) {
          startPercent = (range.min / lastMs) * 100
          endPercent = (range.max / lastMs) * 100
        }
      }
    }

    chartInst.dispatchAction({
      type: 'dataZoom',
      start: Math.max(0, startPercent),
      end: Math.min(100, endPercent),
    })

    // Acknowledge command handled
    // (Deferring to next tick or just creating this effect is fine)
    // We don't necessarily need to "null" it out immediately in the store
    // unless we want to support re-clicking the same button.
    // For now, we'll leave it, but to support re-clicks, buttons usually set state.
  })

  return <div ref={divRef} class="w-full h-full" />
}