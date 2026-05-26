<template>
  <div class="tchart-wrap">
    <!-- Controls row -->
    <div class="tchart-controls">
      <!-- Time range -->
      <div class="tchart-group">
        <span class="tchart-group-lbl">Діапазон</span>
        <div class="time-range-btns">
          <button
            v-for="r in timeRanges"
            :key="r.value"
            :class="['time-range-btn', { active: activeRange === r.value }]"
            @click="setRange(r.value)"
          >{{ r.label }}</button>
        </div>
      </div>

      <!-- Channel toggles -->
      <div class="tchart-group tchart-channels">
        <span class="tchart-group-lbl">Канали</span>
        <div class="ch-toggle-row">
          <button
            v-for="(ch, idx) in channels"
            :key="ch.code"
            class="ch-toggle"
            :class="{ active: selectedChannels.includes(ch.code) }"
            :style="selectedChannels.includes(ch.code)
              ? { borderColor: SERIES_COLORS[idx % SERIES_COLORS.length], color: SERIES_COLORS[idx % SERIES_COLORS.length], background: hexAlpha(SERIES_COLORS[idx % SERIES_COLORS.length], 0.12) }
              : {}"
            @click="toggleChannel(ch.code)"
          >
            <span class="ch-dot" :style="{ background: SERIES_COLORS[idx % SERIES_COLORS.length] }"></span>
            {{ ch.code }}
            <span v-if="ch.unit" class="ch-unit">{{ ch.unit }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Hint row -->
    <div class="tchart-hints">
      <span class="tchart-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M3 15a4 4 0 0 0 4 4h9a5 5 0 0 0 1.8-9.7 6 6 0 0 0-11.5-1.7"/></svg>
        Жовта пунктирна лінія — робочий діапазон
      </span>
      <span class="tchart-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Червона пунктирна лінія — критичний поріг
      </span>
      <span class="tchart-hint">Скрол + затискання: масштаб ·  Ctrl+клік: вибрати кілька</span>
    </div>

    <!-- Chart -->
    <div class="telemetry-chart-container" ref="chartRef"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent,
  DataZoomComponent, MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { unitsApi } from '../api/index.js'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps({
  unitId:           { type: [Number, String], required: true },
  channels:         { type: Array, default: () => [] },
  initialTimeRange: { type: String, default: '1h' }
})

const SERIES_COLORS = ['#38bdf8','#f97316','#22c55e','#a78bfa','#f43f5e','#06b6d4','#fbbf24','#84cc16']

const timeRanges = [
  { label: '1г',  value: '1h'  },
  { label: '6г',  value: '6h'  },
  { label: '24г', value: '24h' },
  { label: '7д',  value: '7d'  }
]

const activeRange      = ref(props.initialTimeRange)
const selectedChannels = ref([])
const chartRef         = ref(null)
let chartInstance      = null
let themeObserver      = null

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${alpha})`
}

function getThemeColors() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'light'
  return {
    text:          dark ? '#7fa3c8' : '#3a5878',
    axisLine:      dark ? 'rgba(56,100,180,0.30)' : 'rgba(80,130,200,0.30)',
    splitLine:     dark ? 'rgba(56,100,180,0.12)' : 'rgba(80,130,200,0.12)',
    dzFill:        dark ? 'rgba(56,189,248,0.07)' : 'rgba(0,119,182,0.07)',
    dzBorder:      dark ? 'rgba(56,100,180,0.40)' : 'rgba(80,130,200,0.35)',
    tooltipBg:     dark ? '#111827' : '#ffffff',
    tooltipBorder: dark ? '#2a4a7f' : '#ccd8e8',
    tooltipText:   dark ? '#dde6f4' : '#0a1628',
    legendText:    dark ? '#90b4d8' : '#2e5070',
  }
}

function rangeToMs(r) {
  return { '1h':3600000,'6h':21600000,'24h':86400000,'7d':604800000 }[r] ?? 3600000
}

function toggleChannel(code) {
  const i = selectedChannels.value.indexOf(code)
  if (i === -1) selectedChannels.value.push(code)
  else selectedChannels.value.splice(i, 1)
  loadData()
}

function setRange(r) { activeRange.value = r; loadData() }

async function loadData() {
  if (!chartInstance || selectedChannels.value.length === 0) {
    chartInstance?.setOption({ series: [] }, { replaceMerge: ['series'] })
    return
  }
  const now  = Date.now()
  const from = new Date(now - rangeToMs(activeRange.value)).toISOString()
  const to   = new Date(now).toISOString()

  const dataMap = {}
  await Promise.all(selectedChannels.value.map(async code => {
    try {
      dataMap[code] = await unitsApi.telemetry(props.unitId, { channel: code, from, to, limit: 500 })
    } catch { dataMap[code] = [] }
  }))

  const series = selectedChannels.value.map((code, idx) => {
    const points    = dataMap[code] ?? []
    const passportCh = props.channels.find(c => c.code === code)
    const color      = SERIES_COLORS[idx % SERIES_COLORS.length]
    const markLines  = []

    if (passportCh?.operating_range) {
      const [lo, hi] = passportCh.operating_range
      markLines.push({ yAxis: lo, lineStyle: { color:'#f97316', type:'dashed', width:1 }, label:{ show:false } })
      markLines.push({ yAxis: hi, lineStyle: { color:'#f97316', type:'dashed', width:1 }, label:{ show:false } })
    }
    if (passportCh?.critical_range) {
      const [lo, hi] = passportCh.critical_range
      markLines.push({ yAxis: lo, lineStyle: { color:'#f43f5e', type:'dashed', width:1.5 }, label:{ show:false } })
      markLines.push({ yAxis: hi, lineStyle: { color:'#f43f5e', type:'dashed', width:1.5 }, label:{ show:false } })
    }
    return {
      name: code,
      type: 'line',
      smooth: true,
      symbol: 'none',
      sampling: 'average',
      data: points.map(p => [p.ts, p.value]),
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      areaStyle: { color, opacity: 0.05 },
      markLine: markLines.length ? { data: markLines, silent: true, animation: false } : undefined
    }
  })

  const tc = getThemeColors()
  chartInstance.setOption({
    legend: { data: selectedChannels.value, textStyle: { color: tc.legendText } },
    series
  }, { replaceMerge: ['series'] })
}

function applyThemeToChart() {
  if (!chartInstance) return
  const tc = getThemeColors()
  chartInstance.setOption({
    xAxis: {
      axisLine:  { lineStyle: { color: tc.axisLine } },
      axisLabel: { color: tc.text },
      splitLine: { lineStyle: { color: tc.splitLine } },
    },
    yAxis: {
      axisLabel: { color: tc.text },
      splitLine: { lineStyle: { color: tc.splitLine } },
    },
    legend: { textStyle: { color: tc.legendText } },
    tooltip: {
      backgroundColor: tc.tooltipBg,
      borderColor: tc.tooltipBorder,
      textStyle: { color: tc.tooltipText },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 22, bottom: 4,
        borderColor: tc.dzBorder, fillerColor: tc.dzFill,
        handleStyle: { color: tc.dzBorder },
        textStyle: { color: tc.text } }
    ],
  })
}

function initChart() {
  if (!chartRef.value) return
  const tc = getThemeColors()
  chartInstance = echarts.init(chartRef.value, null, { renderer: 'canvas' })
  chartInstance.setOption({
    animation: true,
    animationDuration: 400,
    backgroundColor: 'transparent',
    grid: { top: 36, right: 16, bottom: 56, left: 58 },
    xAxis: {
      type: 'time',
      axisLine:  { lineStyle: { color: tc.axisLine } },
      axisLabel: {
        color: tc.text, fontSize: 11,
        formatter: val => new Intl.DateTimeFormat('uk-UA', { hour:'2-digit', minute:'2-digit' }).format(new Date(val))
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine:  { show: false },
      axisLabel: { color: tc.text, fontSize: 11 },
      splitLine: { lineStyle: { color: tc.splitLine, type: 'solid' } },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: tc.axisLine } },
      backgroundColor: tc.tooltipBg,
      borderColor: tc.tooltipBorder,
      textStyle: { color: tc.tooltipText, fontSize: 12 },
      formatter: params => {
        if (!params.length) return ''
        const ts = new Intl.DateTimeFormat('uk-UA', { hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(new Date(params[0].axisValue))
        let out = `<div style="font-size:11px;font-weight:700;margin-bottom:6px;color:${tc.text}">${ts}</div>`
        params.forEach(p => {
          const v = typeof p.value[1] === 'number' ? p.value[1].toFixed(3) : p.value[1]
          out += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0">${p.marker} <span>${p.seriesName}</span> <b style="margin-left:auto;padding-left:16px">${v}</b></div>`
        })
        return out
      }
    },
    legend: {
      top: 4, left: 4,
      textStyle: { color: tc.legendText, fontSize: 11 },
      itemWidth: 16, itemHeight: 2,
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 22, bottom: 4,
        borderColor: tc.dzBorder, fillerColor: tc.dzFill,
        handleStyle: { color: tc.dzBorder },
        textStyle: { color: tc.text, fontSize: 10 } }
    ],
    series: []
  })

  const ro = new ResizeObserver(() => chartInstance?.resize())
  ro.observe(chartRef.value)
}

watch(() => props.channels, newChs => {
  if (newChs.length && selectedChannels.value.length === 0) {
    selectedChannels.value = newChs.slice(0, 2).map(c => c.code)
    loadData()
  }
}, { immediate: true })

watch(() => props.unitId, () => {
  selectedChannels.value = props.channels.slice(0, 2).map(c => c.code)
  loadData()
})

onMounted(() => {
  initChart()
  if (props.channels.length) {
    selectedChannels.value = props.channels.slice(0, 2).map(c => c.code)
    loadData()
  }
  // Observe theme changes
  themeObserver = new MutationObserver(() => {
    applyThemeToChart()
    loadData()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onUnmounted(() => {
  chartInstance?.dispose()
  chartInstance = null
  themeObserver?.disconnect()
})
</script>

<style scoped>
.tchart-wrap { display: flex; flex-direction: column; gap: 10px; }

.tchart-controls {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
}

.tchart-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tchart-group-lbl {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-text-faint);
  font-family: var(--font-mono);
}

.tchart-channels { flex: 1; }

.ch-toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid var(--color-border-bright);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.ch-toggle:hover {
  color: var(--color-text);
  background: var(--color-surface-raised);
}
.ch-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.ch-toggle.active .ch-dot { opacity: 1; }

.ch-unit {
  font-size: 9px;
  opacity: 0.65;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.tchart-hints {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.tchart-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--color-text-faint);
}
</style>
