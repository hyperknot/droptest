import * as echarts from 'echarts'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { findFirstHitRange } from '../lib/filter/range'
import { uiStore } from '../stores/uiStore'

// Default ranges
const ACCEL_DEFAULT_MIN = -3
const ACCEL_DEFAULT_MAX = 42
const ACCEL_EXPAND_THRESHOLD = 50
const JERK_DEFAULT_MIN = -4000
const JERK_DEFAULT_MAX = 4000

// Colors
const COLOR_ACCEL_FILTERED = '#2563eb' // Blue
const COLOR_ACCEL_OUT_OF_RANGE = '#f97316' // Orange
const COLOR_JERK = '#a855f7' // Purple
const COLOR_JERK_OUT_OF_RANGE = '#ef4444' // Red
const COLOR_RAW = '#16a34a' // Green

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
      grid: { left: 70, right: 70, top: 30, bottom: 40 },
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
        // Left axis: Jerk (purple)
        {
          type: 'value',
          name: 'Jerk (g/s)',
          position: 'left',
          axisLine: { show: true, lineStyle: { color: COLOR_JERK } },
          nameTextStyle: { color: COLOR_JERK },
          axisLabel: { color: COLOR_JERK },
          splitLine: { show: false },
        },
        // Right axis: Accel (blue)
        {
          type: 'value',
          name: 'Accel (g)',
          position: 'right',
          axisLine: { show: true, lineStyle: { color: COLOR_ACCEL_FILTERED } },
          nameTextStyle: { color: COLOR_ACCEL_FILTERED },
          axisLabel: { color: COLOR_ACCEL_FILTERED },
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
    })
  })

  // DATA UPDATE
  createEffect(() => {
    const samples = uiStore.state.samples
    if (!chartInst || samples.length === 0) return

    // Calculate actual data ranges
    let accelMin = Infinity
    let accelMax = -Infinity
    let jerkMin = Infinity
    let jerkMax = -Infinity

    for (const s of samples) {
      const accel = s.accelFiltered ?? s.accelRaw
      const jerk = s.jerkSG ?? 0

      if (accel < accelMin) accelMin = accel
      if (accel > accelMax) accelMax = accel
      if (jerk < jerkMin) jerkMin = jerk
      if (jerk > jerkMax) jerkMax = jerk
    }

    // Accel axis: default -3..42, expand if data exceeds threshold
    const yAccelMin = Math.min(ACCEL_DEFAULT_MIN, accelMin - 1)
    const yAccelMax = accelMax > ACCEL_EXPAND_THRESHOLD ? accelMax + 2 : ACCEL_DEFAULT_MAX

    // Jerk axis: default range, expand if needed
    const yJerkMin = Math.min(JERK_DEFAULT_MIN, jerkMin - 200)
    const yJerkMax = Math.max(JERK_DEFAULT_MAX, jerkMax + 200)

    chartInst.setOption({
      yAxis: [
        { min: yJerkMin, max: yJerkMax },
        { min: yAccelMin, max: yAccelMax },
      ],
      visualMap: [
        {
          show: false,
          seriesIndex: 1, // Filtered Accel
          pieces: [{ gte: ACCEL_DEFAULT_MIN, lte: ACCEL_DEFAULT_MAX, color: COLOR_ACCEL_FILTERED }],
          outOfRange: { color: COLOR_ACCEL_OUT_OF_RANGE },
        },
        {
          show: false,
          seriesIndex: 2, // Jerk
          pieces: [{ gte: JERK_DEFAULT_MIN, lte: JERK_DEFAULT_MAX, color: COLOR_JERK }],
          outOfRange: { color: COLOR_JERK_OUT_OF_RANGE },
        },
      ],
      series: [
        {
          name: 'Raw Accel',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { color: COLOR_RAW, width: 1.5, opacity: 0.5 },
          data: samples.map((s) => [s.timeMs, s.accelRaw]),
          z: 1,
        },
        {
          name: 'Filtered Accel',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { width: 2.5 },
          data: samples.map((s) => [s.timeMs, s.accelFiltered]),
          z: 2,
        },
        {
          name: 'Jerk SG',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 1.5 },
          data: samples.map((s) => [s.timeMs, s.jerkSG]),
          markLine: {
            symbol: 'none',
            lineStyle: { color: 'rgba(168, 85, 247, 0.3)', width: 1 },
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
    const samples = uiStore.state.samples
    if (!chartInst || !cmd || samples.length === 0) return

    let start = 0
    let end = 100

    if (cmd.type === 'firstHit') {
      try {
        const range = findFirstHitRange(samples)
        if (range) {
          const lastT = samples[samples.length - 1].timeMs
          if (lastT > 0) {
            start = (range.min / lastT) * 100
            end = (range.max / lastT) * 100
          }
        }
      } catch (err) {
        console.error('Failed to find first hit range:', err)
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