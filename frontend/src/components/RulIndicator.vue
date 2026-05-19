<template>
  <div class="rul-indicator">
    <div class="rul-main" :style="{ color: color }">
      {{ rulHours != null ? Math.round(rulHours) + ' год' : '—' }}
    </div>
    <div v-if="rulLower != null && rulUpper != null" class="rul-ci">
      CI: {{ Math.round(rulLower) }} – {{ Math.round(rulUpper) }} год
    </div>
    <div v-if="rulHours != null" class="progress-bar-wrap" style="margin-top: 6px;">
      <div
        class="progress-bar-fill"
        :style="{ width: barWidth + '%', background: color }"
      ></div>
    </div>
    <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">
      {{ statusLabel }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  rulHours: {
    type: Number,
    default: null
  },
  rulLower: {
    type: Number,
    default: null
  },
  rulUpper: {
    type: Number,
    default: null
  }
})

const color = computed(() => {
  const h = props.rulHours
  if (h == null) return 'var(--color-text-muted)'
  if (h > 168) return '#16a34a'
  if (h > 72) return '#f59e0b'
  return '#dc2626'
})

const statusLabel = computed(() => {
  const h = props.rulHours
  if (h == null) return 'Немає даних'
  if (h > 168) return 'Норма (>7 днів)'
  if (h > 72) return 'Ризик (3–7 днів)'
  return 'Критично (<3 днів)'
})

const barWidth = computed(() => {
  const h = props.rulHours
  if (h == null) return 0
  const maxH = 720
  return Math.min(100, Math.max(0, (h / maxH) * 100))
})
</script>
