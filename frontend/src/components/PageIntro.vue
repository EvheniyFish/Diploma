<template>
  <div v-if="!hidden" class="page-intro">
    <div class="page-intro-icon">
      <slot name="icon" />
    </div>
    <div class="page-intro-body">
      <slot />
    </div>
    <button class="page-intro-close" @click="dismiss" title="Закрити">×</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({ storageKey: { type: String, required: true } })
const KEY = `cass-intro-${props.storageKey}`
const hidden = ref(localStorage.getItem(KEY) === '1')
function dismiss() {
  localStorage.setItem(KEY, '1')
  hidden.value = true
}
</script>

<style scoped>
.page-intro {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 40px 12px 14px;
  margin-bottom: 20px;
  border: 1px solid var(--color-border-accent);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-primary-dim);
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.65;
}
.page-intro-icon {
  flex-shrink: 0;
  width: 18px;
  color: var(--color-primary);
  padding-top: 1px;
}
.page-intro-body { flex: 1; }
.page-intro-body :deep(strong) { color: var(--color-text); font-weight: 600; }
.page-intro-body :deep(p) { margin: 0 0 4px; }
.page-intro-body :deep(p:last-child) { margin-bottom: 0; }
.page-intro-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-faint);
  padding: 0;
  transition: color 0.15s;
}
.page-intro-close:hover { color: var(--color-text); }
</style>
