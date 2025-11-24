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
  })

  createEffect(() => {
    const file = uiStore.state.file
    if (!chartInst || !file) return

    const samples = file.samples

    // Axes Logic
    const accelMin = -3
    const accelMax = 45
    const jerkLimit = 4000

    const option: echarts.EChartsOption = {
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
        }
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
          min: accelMin,
          max: accelMax,
          axisLine: { show: true, lineStyle: { color: '#333' } },
          splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.5 } }
        },
        {
          type: 'value',
          name: 'Jerk (g/s)',
          position: 'right',
          min: -jerkLimit,
          max: jerkLimit,
          axisLine: { show: true, lineStyle: { color: '#333' } },
          splitLine: { show: false }
        }
      ],
      dataZoom: [{ type: 'slider', bottom: 5 }],
      visualMap: [
        {
          show: false,
          seriesIndex: 1, // Accel CFC
          pieces: [
            { gt: accelMin, lt: accelMax, color: '#2563eb' } // blue normal
          ],
          outOfRange: { color: '#f97316' } // orange warning
        },
        {
          show: false,
          seriesIndex: 2, // Jerk
          pieces: [
            { gt: -jerkLimit, lt: jerkLimit, color: '#a855f7' } // purple normal
          ],
          outOfRange: { color: '#ef4444' } // red warning
        }
      ],
      series: [
        {
          name: 'Raw Accel',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { color: '#cbd5e1', width: 1 }, // gray faint
          data: samples.map(s => [s.timeMs, s.accelRaw])
        },
        {
          name: 'Accel CFC',
          type: 'line',
          yAxisIndex: 0,
          showSymbol: false,
          lineStyle: { width: 2 },
          data: samples.map(s => [s.timeMs, s.accelCFC])
        },
        {
          name: 'Jerk SG',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          lineStyle: { width: 1.5 },
          data: samples.map(s => [s.timeMs, s.jerkSG]),
          markLine: {
            symbol: 'none',
            lineStyle: { color: 'rgba(0,0,0,0.2)', width: 1 },
            data: [{ yAxis: 0 }],
            silent: true
          }
        }
      ]
    }

    chartInst.setOption(option, { notMerge: true })
  })

  // Handle Zoom Commands
  createEffect(() => {
    const cmd = uiStore.state.rangeRequest
    const file = uiStore.state.file
    if (!chartInst || !cmd || !file) return

    let start = 0
    let end = 100 // percent

    if (cmd === 'firstHit') {
      const range = findFirstHitRange(file.samples)
      if (range) {
        const total = file.samples[file.samples.length - 1].timeMs
        start = (range.min / total) * 100
        end = (range.max / total) * 100
      }
    }

    chartInst.dispatchAction({
      type: 'dataZoom',
      start,
      end
    })

    // clear command
    uiStore.setRangeRequest(null as any)
  })

  return <div ref={divRef} class="w-full h-full" />
}