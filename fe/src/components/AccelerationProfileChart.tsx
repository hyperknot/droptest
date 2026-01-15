import * as echarts from 'echarts'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { findFirstHitRange } from '../lib/filter/range'
import { uiStore } from '../stores/uiStore'

// Default view ranges (will auto-expand to fit all data)
const ACCEL_DEFAULT_MIN = -5
const ACCEL_DEFAULT_MAX = 46
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
const COLOR_RANGE_LINE = '#475569' // Slate-600 for DRI range markers
const COLOR_VELOCITY = '#059669' // Emerald-600
const COLOR_HIC = '#f59e0b' // Amber

export const AccelerationProfileChart = () => {
  let divRef: HTMLDivElement | undefined
  let chartInst: echarts.ECharts | null = null

  onMount(() => {
    if (!divRef) return
    chartInst = echarts.init(divRef)

    const resize = () => chartInst?.resize()
    window.addEventListener('resize', resize)
    onCleanup(() => window.removeEventListener('resize', resize))

    // Listen to zoom changes and update visible range in store
    chartInst.on('datazoom', () => {
      const samples = uiStore.state.processedSamples
      if (samples.length === 0) return

      const option = chartInst!.getOption() as any
      const zoom = option.dataZoom?.[0]
      if (!zoom || zoom.start == null || zoom.end == null) return

      const minT = samples[0].timeMs
      const maxT = samples[samples.length - 1].timeMs
      const duration = maxT - minT

      const visMin = minT + (zoom.start / 100) * duration
      const visMax = minT + (zoom.end / 100) * duration

      uiStore.setVisibleTimeRange(visMin, visMax)
    })

    chartInst.setOption({
      animation: false,
      grid: { left: 90, right: 115, top: 30, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          const t = params[0].axisValue
          let html = `<b>${Number(t).toFixed(1)} ms</b><br/>`
          params.forEach((p: any) => {
            if (p.value[1] != null) {
              const v = p.value[1]
              if (p.seriesName === 'Velocity') {
                html += `${p.marker} ${p.seriesName}: ${v.toFixed(2)}<br/>`
              } else {
                html += `${p.marker} ${p.seriesName}: ${v.toFixed(1)}<br/>`
              }
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
        // Left axis (offset): Velocity (emerald)
        {
          type: 'value',
          name: 'Velocity (m/s)',
          position: 'left',
          offset: 52,
          axisLine: { show: true, lineStyle: { color: COLOR_VELOCITY } },
          nameTextStyle: { color: COLOR_VELOCITY },
          axisLabel: {
            color: COLOR_VELOCITY,
            formatter: (v: number) => v.toFixed(1),
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
        // Right axis (offset): HIC (amber)
        {
          type: 'value',
          name: 'HIC',
          position: 'right',
          offset: 45,
          axisLine: { show: true, lineStyle: { color: COLOR_HIC } },
          nameTextStyle: { color: COLOR_HIC },
          axisLabel: {
            color: COLOR_HIC,
            formatter: (v: number) => v.toFixed(0),
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
    const samples = uiStore.state.processedSamples
    const velocity = uiStore.state.velocityTimelineMps
    const showVel = uiStore.state.showVelocityOnChart

    if (!chartInst || samples.length === 0) return

    // Calculate actual data ranges
    let accelRawMin = Number.POSITIVE_INFINITY
    let accelRawMax = Number.NEGATIVE_INFINITY
    let accelFilteredMin = Number.POSITIVE_INFINITY
    let accelFilteredMax = Number.NEGATIVE_INFINITY
    let jerkMin = Number.POSITIVE_INFINITY
    let jerkMax = Number.NEGATIVE_INFINITY
    let hicMin = Number.POSITIVE_INFINITY
    let hicMax = Number.NEGATIVE_INFINITY

    let velMin = Number.POSITIVE_INFINITY
    let velMax = Number.NEGATIVE_INFINITY

    const hasVel = showVel && velocity.length === samples.length

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]
      const raw = s.accelRaw
      const filtered = s.accelFiltered
      const jerk = s.jerkSG
      const hic = s.hic

      if (raw < accelRawMin) accelRawMin = raw
      if (raw > accelRawMax) accelRawMax = raw
      if (filtered < accelFilteredMin) accelFilteredMin = filtered
      if (filtered > accelFilteredMax) accelFilteredMax = filtered
      if (jerk < jerkMin) jerkMin = jerk
      if (jerk > jerkMax) jerkMax = jerk
      if (hic < hicMin) hicMin = hic
      if (hic > hicMax) hicMax = hic

      if (hasVel) {
        const v = velocity[i]
        if (v < velMin) velMin = v
        if (v > velMax) velMax = v
      }
    }

    const accelMin = Math.min(accelRawMin, accelFilteredMin)
    const accelMax = Math.max(accelRawMax, accelFilteredMax)

    const yAccelMin = Math.min(ACCEL_DEFAULT_MIN, accelMin - 1)
    const yAccelMax = Math.max(ACCEL_DEFAULT_MAX, accelMax + 1)
    const yJerkMin = Math.min(JERK_DEFAULT_MIN, jerkMin - 100)
    const yJerkMax = Math.max(JERK_DEFAULT_MAX, jerkMax + 100)
    const yHicMin = Math.min(0, hicMin - 1)
    const yHicMax = Math.max(10, hicMax + 5)

    const yVelMin = hasVel ? velMin - 0.5 : 0
    const yVelMax = hasVel ? velMax + 0.5 : 1

    chartInst.setOption({
      yAxis: [
        { min: yJerkMin, max: yJerkMax },
        { min: yVelMin, max: yVelMax, show: hasVel },
        { min: yAccelMin, max: yAccelMax },
        { min: yHicMin, max: yHicMax },
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
          yAxisIndex: 2,
          showSymbol: false,
          lineStyle: { color: COLOR_RAW, width: 1.5, opacity: 0.5 },
          data: samples.map((s) => [s.timeMs, s.accelRaw]),
          z: 1,
        },
        {
          name: 'Accel filtered',
          type: 'line',
          yAxisIndex: 2,
          showSymbol: false,
          lineStyle: { width: 2.5 },
          data: samples.map((s) => [s.timeMs, s.accelFiltered]),
          markLine: {
            symbol: 'none',
            silent: true,
            label: { show: false },
            lineStyle: {
              color: COLOR_RANGE_LINE,
              width: 1,
              type: [4, 4], // dashed: 4px dash, 4px gap
              opacity: 0.6,
            },
            data: uiStore.state.hitRange
              ? [{ xAxis: uiStore.state.hitRange.min }, { xAxis: uiStore.state.hitRange.max }]
              : [],
          },
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
        {
          name: 'Velocity',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { width: 2, color: COLOR_VELOCITY, opacity: 0.9 },
          data: hasVel ? samples.map((s, i) => [s.timeMs, velocity[i]]) : [],
          z: 4,
        },
        {
          name: 'HIC',
          type: 'line',
          yAxisIndex: 3,
          showSymbol: false,
          lineStyle: { width: 2, color: COLOR_HIC, opacity: 0.8 },
          data: samples.map((s) => [s.timeMs, s.hic]),
          z: 5,
        },
      ],
    })
  })

  // RANGE COMMAND (Zoom)
  createEffect(() => {
    const cmd = uiStore.state.rangeRequest
    void cmd?.id // important for refresh tracking

    const samples = uiStore.state.processedSamples
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
            // Add 50ms padding to the end for UI display
            const rangeMaxWithPadding = Math.min(lastT, range.max + 50)
            end = (rangeMaxWithPadding / lastT) * 100
          }
        }
      } catch (err) {
        console.error('Failed to find first hit range:', err)
      }
    }

    chartInst.setOption({
      dataZoom: [
        {
          start,
          end,
        },
      ],
    })
  })

  return <div ref={divRef} class="w-full h-full" />
}
