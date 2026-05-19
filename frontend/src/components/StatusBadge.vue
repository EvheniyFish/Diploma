<template>
  <span :class="['status-badge', normalizedStatus, size]">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: null
  },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v)
  }
})

const normalizedStatus = computed(() => {
  if (!props.status) return 'unknown'
  return props.status.toLowerCase()
})

const label = computed(() => {
  const map = {
    ok: 'OK',
    risk: 'RISK',
    imminent: 'IMMINENT'
  }
  return map[normalizedStatus.value] ?? props.status ?? '—'
})
</script>
