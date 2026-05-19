<template>
  <div>
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;">
      <div class="time-range-btns">
        <button
          v-for="r in timeRanges"
          :key="r.value"
          :class="['time-range-btn', { active: activeRange === r.value }]"
          @click="setRange(r.value)"
        >{{ r.label }}</button>
      </div>
      <div style="flex: 1; min-width: 200px;">
        <select
          multiple
          v-model="selectedChannels"
          style="width: 100%; height: 72px; font-size: 12px; border: 1px solid var(--color-border); border-radius: 4px; padding: 4px;"
          @change="loadData"
        >
          <option v-for="ch in channels" :key="ch.code" :value="ch.code">{{ ch.code }}</option>
        </select>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">Утримуйте Ctrl для вибору кількох каналів</div>
      </div>
    </div>
    <div class="telemetry-chart-container" ref="chartRef"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { unitsApi } from '../api/index.js'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps({
  unitId: {
    type: [Number, String],
    required: true
  },
  channels: {
    type: Array,
    default: () => []
  },
  initialTimeRange: {
    type: String,
    default: '1h'
  }
})

const timeRanges = [
  { label: '1г', value: '1h' },
  { label: '6г', value: '6h' },
  { label: '24г', value: '24h' },
  { label: '7д', value: '7d' }
]

const activeRange = ref(props.initialTimeRange)
const selectedChannels = ref([])
const chartRef = ref(null)
let chartInstance = null

const SERIES_COLORS = ['#3b82f6', '#f59e0b', '#16a34a', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16']

function rangeToMs(range) {
  const map = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 }
  return map[range] ?? 3600000
}

function setRange(r) {
  activeRange.value = r
  loadData()
}

async function loadData() {
  if (!chartInstance || selectedChannels.value.length === 0) {
    if (chartInstance) {
      chartInstance.setOption({ series: [] })
    }
    return
  }

  const now = Date.now()
  const from = new Date(now - rangeToMs(activeRange.value)).toISOString()
  const to = new Date(now).toISOString()

  const seriesMap = {}
  const channelDataMap = {}

  await Promise.all(selectedChannels.value.map(async (code) => {
    try {
      const points = await unitsApi.telemetry(props.unitId, {
        channel: code,
        from,
        to,
        limit: 500
      })
      channelDataMap[code] = points
    } catch {
      channelDataMap[code] = []
    }
  }))

  const series = selectedChannels.value.map((code, idx) => {
    const points = channelDataMap[code] ?? []
    const passportCh = props.channels.find(c => c.code === code)
    const color = SERIES_COLORS[idx % SERIES_COLORS.length]

    const markLines = []
    if (passportCh?.operating_range && Array.isArray(passportCh.operating_range)) {
      markLines.push({
        yAxis: passportCh.operating_range[0],
        name: `${code} op_min`,
        lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 },
        label: { show: false }
      })
      markLines.push({
        yAxis: passportCh.operating_range[1],
        name: `${code} op_max`,
        lineStyle: { color: '#f59e0b', type: 'dashed', width: 1 },
        label: { show: false }
      })
    }
    if (passportCh?.critical_range && Array.isArray(passportCh.critical_range)) {
      markLines.push({
        yAxis: passportCh.critical_range[0],
        name: `${code} crit_min`,
        lineStyle: { color: '#dc2626', type: 'dashed', width: 1 },
        label: { show: false }
      })
      markLines.push({
        yAxis: passportCh.critical_range[1],
        name: `${code} crit_max`,
        lineStyle: { color: '#dc2626', type: 'dashed', width: 1 },
        label: { show: false }
      })
    }

    return {
      name: code,
      type: 'line',
      smooth: false,
      symbol: 'none',
      data: points.map(p => [p.ts, p.value]),
      lineStyle: { color, width: 1.5 },
      itemStyle: { color },
      markLine: markLines.length > 0 ? { data: markLines, silent: true, animation: false } : undefined
    }
  })

  chartInstance.setOption({
    series,
    legend: {
      data: selectedChannels.value
    }
  }, { replaceMerge: ['series'] })
}

function initChart() {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption({
    animation: false,
    backgroundColor: 'transparent',
    grid: { top: 40, right: 20, bottom: 60, left: 55 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: {
        formatter: (val) => new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(val)),
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { fontSize: 11 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        if (!params.length) return ''
        const ts = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(params[0].axisValue))
        let out = `<div style="font-size:12px;font-weight:600;margin-bottom:4px">${ts}</div>`
        params.forEach(p => {
          out += `<div style="font-size:12px">${p.marker} ${p.seriesName}: <b>${typeof p.value[1] === 'number' ? p.value[1].toFixed(3) : p.value[1]}</b></div>`
        })
        return out
      }
    },
    legend: {
      top: 0,
      left: 0,
      data: [],
      textStyle: { fontSize: 12 }
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 20, bottom: 5, borderColor: '#e2e8f0', fillerColor: 'rgba(59,130,246,0.1)' }
    ],
    series: []
  })

  const resizeObserver = new ResizeObserver(() => chartInstance?.resize())
  resizeObserver.observe(chartRef.value)
}

watch(() => props.channels, (newChs) => {
  if (newChs.length > 0 && selectedChannels.value.length === 0) {
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
  if (props.channels.length > 0) {
    selectedChannels.value = props.channels.slice(0, 2).map(c => c.code)
    loadData()
  }
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>
