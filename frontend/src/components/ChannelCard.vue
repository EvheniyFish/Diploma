<template>
  <div :class="['channel-card', borderClass]">
    <div class="channel-card-code">{{ channel.code }}</div>
    <div class="channel-card-value">
      <span>{{ currentValue }}</span>
      <span class="channel-card-unit">{{ passportChannel?.unit ?? '' }}</span>
    </div>
    <div class="channel-card-sparkline" ref="sparklineRef"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, CanvasRenderer])

const props = defineProps({
  channel: {
    type: Object,
    required: true
  },
  points: {
    type: Array,
    default: () => []
  },
  passportChannel: {
    type: Object,
    default: null
  }
})

const sparklineRef = ref(null)
let chartInstance = null

const currentValue = computed(() => {
  if (!props.points || props.points.length === 0) return '—'
  const last = props.points[props.points.length - 1]
  const v = last?.value
  if (v == null) return '—'
  return typeof v === 'number' ? v.toFixed(2) : v
})

const borderClass = computed(() => {
  if (!props.points || props.points.length === 0) return 'border-neutral'
  const last = props.points[props.points.length - 1]
  const v = last?.value
  const pc = props.passportChannel
  if (v == null || !pc) return 'border-neutral'

  const critRange = pc.critical_range
  const opRange = pc.operating_range

  if (critRange && Array.isArray(critRange)) {
    if (v < critRange[0] || v > critRange[1]) return 'border-imminent'
  }
  if (opRange && Array.isArray(opRange)) {
    if (v < opRange[0] || v > opRange[1]) return 'border-risk'
  }
  return 'border-ok'
})

const sparkValues = computed(() => {
  if (!props.points || props.points.length === 0) return []
  return props.points.slice(-10).map(p => p.value ?? 0)
})

function initChart() {
  if (!sparklineRef.value) return
  chartInstance = echarts.init(sparklineRef.value)
  renderChart()
}

function renderChart() {
  if (!chartInstance) return
  const vals = sparkValues.value
  const color = borderClass.value === 'border-ok'
    ? '#16a34a'
    : borderClass.value === 'border-risk'
      ? '#f59e0b'
      : borderClass.value === 'border-imminent'
        ? '#dc2626'
        : '#94a3b8'

  chartInstance.setOption({
    animation: false,
    grid: { top: 2, right: 2, bottom: 2, left: 2 },
    xAxis: { type: 'category', show: false, data: vals.map((_, i) => i) },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      data: vals,
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 1.5 },
      areaStyle: { color, opacity: 0.08 }
    }]
  })
}

watch(() => props.points, () => {
  renderChart()
}, { deep: true })

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>
