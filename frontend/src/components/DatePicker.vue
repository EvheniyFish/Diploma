<template>
  <input ref="inputEl" :placeholder="placeholder" :style="style" class="fp-input" readonly />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import flatpickr from 'flatpickr'
import { Ukrainian } from 'flatpickr/dist/l10n/uk.js'
import 'flatpickr/dist/flatpickr.min.css'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'дд.мм.рррр' },
  style: { type: [String, Object], default: '' },
})
const emit = defineEmits(['update:modelValue'])

const inputEl = ref(null)
let fp = null

onMounted(() => {
  fp = flatpickr(inputEl.value, {
    locale: Ukrainian,
    dateFormat: 'Y-m-d',
    allowInput: false,
    defaultDate: props.modelValue || null,
    onChange: ([date]) => {
      const val = date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : ''
      emit('update:modelValue', val)
    },
  })
})

watch(() => props.modelValue, (val) => {
  if (!fp) return
  if (!val) {
    fp.clear()
  } else if (fp.selectedDates[0]?.toISOString().slice(0, 10) !== val) {
    fp.setDate(val, false)
  }
})

onBeforeUnmount(() => {
  fp?.destroy()
})
</script>

<style scoped>
.fp-input {
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  background: #fff;
  color: var(--color-text, #1e293b);
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}
.fp-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px #6366f120;
}
</style>
