<template>
  <div class="health-gauge">
    <div class="gauge-header">
      <span class="gauge-label">Аномальність</span>
      <span class="gauge-value" :style="{ color: barColor }">{{ displayValue }}%</span>
    </div>
    <div class="progress-bar-wrap">
      <div
        class="progress-bar-fill"
        :style="{ width: displayValue + '%', background: barGradient }"
      ></div>
    </div>
    <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
      Статус: <StatusBadge :status="status" size="sm" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  anomalyScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: null
  }
})

const displayValue = computed(() => {
  const val = props.anomalyScore ?? 0
  return Math.min(100, Math.max(0, Math.round(val * 100)))
})

const barColor = computed(() => {
  const v = displayValue.value
  if (v < 40) return '#16a34a'
  if (v < 70) return '#f59e0b'
  return '#dc2626'
})

const barGradient = computed(() => {
  return `linear-gradient(90deg, #16a34a 0%, #f59e0b 50%, #dc2626 100%)`
})
</script>
