<template>
  <span class="infotip-wrap">
    <span class="infotip-icon" @mouseenter="show = true" @mouseleave="show = false">?</span>
    <span v-if="show" class="infotip-popup" :class="align">
      <slot />
    </span>
  </span>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ align: { type: String, default: 'right' } })
const show = ref(false)
</script>

<style scoped>
.infotip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.infotip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-border-accent, #2a4a7f);
  color: var(--color-text-muted, #5c7a9e);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  cursor: help;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.infotip-icon:hover {
  background: var(--color-primary, #0ea5e9);
  color: #fff;
}
.infotip-popup {
  position: absolute;
  bottom: calc(100% + 6px);
  z-index: 200;
  background: var(--color-surface-raised, #1a2236);
  border: 1px solid var(--color-border-accent, #2a4a7f);
  border-radius: var(--radius-md, 4px);
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text, #c9d4e8);
  white-space: normal;
  min-width: 220px;
  max-width: 320px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.6);
}
.infotip-popup.right { left: 0; }
.infotip-popup.left { right: 0; }
.infotip-popup.center { left: 50%; transform: translateX(-50%); }
</style>
