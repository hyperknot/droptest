import * as echarts from 'echarts'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { findFirstHitRange } from '../lib/filter/range'
import { uiStore } from '../stores/uiStore'

// Default view ranges (will auto-expand to fit all data)
const ACCEL_DEFAULT_MIN = -5
const ACCEL_DEFAULT_MAX = 42
const JERK_DEFAULT_MIN = -5000
const JERK_DEFAULT_MAX = 5000

// Safe ranges for coloration (points outside are warning-colored)
const ACCEL_SAFE_MAX = 42
const JERK_SAFE_MAX = 2000

// Colors
const COLOR_ACCEL_FILTERED = '#2563eb' // Blue
const COLOR_ACCEL_WARNING = '#f97316' // Orange - for accel > 42g
const COLOR_JERK = '#a855f7' // Purple
const COLOR_JERK_WARNING = '#ef4444' // Red - for |jerk| > 2000
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
          let html = `<b>${Number(t).toFixed(1)} ms</b><br/>`
          params.forEach((p: any) => {
            if (p.value[1] != null) {
              html += `${p.marker} ${p.seriesName}: ${p.value[1].toFixed(1)}<br/>`
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
        axisLine: { onZero: false },
        axisTick: { onZero: false },
        axisLabel: {
          formatter: (v: number) => v.toFixed(1),
        },
      },
      yAxis: [
        // Left axis: Jerk (purple)
        {
          type: 'value',
          name: 'Jerk (g/s)',
          position: 'left',
          axisLine: { show: true, lineStyle: { color: COLOR_JERK } },
          nameTextStyle: { color: COLOR_JERK },
          axisLabel: {
            color: COLOR_JERK,
            formatter: (v: number) => Math.round(v).toString(),
          },
          splitLine: { show: false },
        },
        // Right axis: Accel (blue)
        {
          type: 'value',
          name: 'Accel (g)',
          position: 'right',
          axisLine: { show: true, lineStyle: { color: COLOR_ACCEL_FILTERED } },
          nameTextStyle: { color: COLOR_ACCEL_FILTERED },
          axisLabel: {
            color: COLOR_ACCEL_FILTERED,
            formatter: (v: number) => v.toFixed(1),
          },
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

    // Calculate actual data ranges for both raw and filtered accel
    let accelRawMin = Number.POSITIVE_INFINITY
    let accelRawMax = Number.NEGATIVE_INFINITY
    let accelFilteredMin = Number.POSITIVE_INFINITY
    let accelFilteredMax = Number.NEGATIVE_INFINITY
    let jerkMin = Number.POSITIVE_INFINITY
    let jerkMax = Number.NEGATIVE_INFINITY

    for (const s of samples) {
      const raw = s.accelRaw
      const filtered = s.accelFiltered ?? s.accelRaw
      const jerk = s.jerkSG ?? 0

      if (raw < accelRawMin) accelRawMin = raw
      if (raw > accelRawMax) accelRawMax = raw
      if (filtered < accelFilteredMin) accelFilteredMin = filtered
      if (filtered > accelFilteredMax) accelFilteredMax = filtered
      if (jerk < jerkMin) jerkMin = jerk
      if (jerk > jerkMax) jerkMax = jerk
    }

    // Combine raw and filtered ranges to ensure both series fit
    const accelMin = Math.min(accelRawMin, accelFilteredMin)
    const accelMax = Math.max(accelRawMax, accelFilteredMax)

    // Auto-expand ranges to fit all data while keeping defaults as minimum view
    const yAccelMin = Math.min(ACCEL_DEFAULT_MIN, accelMin - 1)
    const yAccelMax = Math.max(ACCEL_DEFAULT_MAX, accelMax + 1)
    const yJerkMin = Math.min(JERK_DEFAULT_MIN, jerkMin - 100)
    const yJerkMax = Math.max(JERK_DEFAULT_MAX, jerkMax + 100)

    chartInst.setOption({
      yAxis: [
        { min: yJerkMin, max: yJerkMax },
        { min: yAccelMin, max: yAccelMax },
      ],
      visualMap: [
        {
          show: false,
          seriesIndex: 1, // Filtered Accel
          dimension: 1,
          pieces: [{ gte: -100000, lte: ACCEL_SAFE_MAX, color: COLOR_ACCEL_FILTERED }],
          outOfRange: { color: COLOR_ACCEL_WARNING },
        },
        {
          show: false,
          seriesIndex: 2, // Jerk
          dimension: 1,
          pieces: [{ gte: -JERK_SAFE_MAX, lte: JERK_SAFE_MAX, color: COLOR_JERK }],
          outOfRange: { color: COLOR_JERK_WARNING },
        },
      ],
      series: [
        {
          name: 'Accel raw',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { color: COLOR_RAW, width: 1.5, opacity: 0.5 },
          data: samples.map((s) => [s.timeMs, s.accelRaw]),
          z: 1,
        },
        {
          name: 'Accel filtered',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { width: 2.5 },
          data: samples.map((s) => [s.timeMs, s.accelFiltered]),
          z: 2,
        },
        {
          name: 'Jerk',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 1.5 },
          data: samples.map((s) => [s.timeMs, s.jerkSG]),
          markLine: {
            symbol: 'none',
            silent: true,
            label: { show: false },
            lineStyle: {
              color: COLOR_JERK,
              width: 1,
              type: 'dashed',
              opacity: 0.5,
            },
            data: [{ yAxis: 0 }],
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
