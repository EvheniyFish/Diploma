<template>
  <div>
    <div class="breadcrumb">
      <RouterLink to="/models">Моделі</RouterLink>
      <span class="sep">/</span>
      <span class="current">{{ isNew ? 'Новий паспорт' : (parsedPassport?.model_code ?? route.params.id) }}</span>
    </div>

    <div class="page-header">
      <h1 class="page-title">{{ isNew ? 'Новий паспорт' : 'Паспорт: ' + (parsedPassport?.model_code ?? '') }}</h1>
      <div class="page-actions">
        <button class="time-range-btn" @click="validate" :disabled="saving">Валідувати</button>
        <button class="time-range-btn active" @click="save" :disabled="saving">
          {{ saving ? 'Збереження...' : 'Зберегти' }}
        </button>
      </div>
    </div>

    <div v-if="validationResult" style="margin-bottom: 16px;">
      <div :class="validationResult.ok ? 'validation-ok' : 'validation-error'">
        <span v-if="validationResult.ok && !validationResult.warnings?.length">JSON валідний. Паспорт коректний.</span>
        <span v-else-if="validationResult.ok">JSON валідний. Є рекомендації:</span>
        <div v-if="!validationResult.ok">
          <strong>Помилки валідації:</strong>
          <ul>
            <li v-for="(err, i) in validationResult.errors" :key="i">{{ err }}</li>
          </ul>
        </div>
      </div>
      <div v-if="validationResult.warnings?.length" class="validation-warn" style="margin-top: 6px;">
        <strong>Рекомендації:</strong>
        <ul>
          <li v-for="(w, i) in validationResult.warnings" :key="i">{{ w }}</li>
        </ul>
      </div>
    </div>

    <div class="editor-layout">
      <div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--color-text-muted);">JSON паспорта</div>
        <textarea
          v-model="jsonText"
          class="json-textarea"
          @input="onTextInput"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
        <div v-if="parseError" style="color: var(--color-imminent); font-size: 12px; margin-top: 4px;">{{ parseError }}</div>
      </div>

      <div>
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--color-text-muted);">Попередній перегляд</div>
        <div v-if="parsedPassport" class="card" style="padding: 16px;">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">{{ parsedPassport.display_name ?? '—' }}</div>
            <div style="font-size: 12px; color: var(--color-text-muted); font-family: monospace;">{{ parsedPassport.model_code }}</div>
            <div style="font-size: 13px; margin-top: 4px;">Категорія: {{ parsedPassport.category ?? '—' }}</div>
          </div>

          <div style="margin-bottom: 16px; display: flex; gap: 24px;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.04em;">Weibull η</div>
              <div style="font-size: 16px; font-weight: 600;">{{ parsedPassport.weibull?.eta ?? '—' }}</div>
            </div>
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.04em;">Weibull β</div>
              <div style="font-size: 16px; font-weight: 600;">{{ parsedPassport.weibull?.beta ?? '—' }}</div>
            </div>
          </div>

          <div v-if="parsedPassport.channels?.length" style="margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Канали ({{ parsedPassport.channels.length }})</div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-weight: 600;">Код</th>
                  <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-weight: 600;">Клас</th>
                  <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-weight: 600;">Одиниця</th>
                  <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-weight: 600;">Номінал</th>
                  <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-weight: 600;">Роб. діапазон</th>
                  <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-weight: 600;">Крит. діапазон</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ch in parsedPassport.channels" :key="ch.code">
                  <td style="padding: 6px 8px; border-bottom: 1px solid var(--color-border); font-family: monospace; font-weight: 600;">{{ ch.code }}</td>
                  <td style="padding: 6px 8px; border-bottom: 1px solid var(--color-border);">{{ ch.class ?? '—' }}</td>
                  <td style="padding: 6px 8px; border-bottom: 1px solid var(--color-border);">{{ ch.unit ?? '—' }}</td>
                  <td style="padding: 6px 8px; border-bottom: 1px solid var(--color-border);">{{ ch.nominal ?? '—' }}</td>
                  <td style="padding: 6px 8px; border-bottom: 1px solid var(--color-border);">
                    {{ ch.operating_range ? ch.operating_range.join(' – ') : '—' }}
                  </td>
                  <td style="padding: 6px 8px; border-bottom: 1px solid var(--color-border);">
                    {{ ch.critical_range ? ch.critical_range.join(' – ') : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="parsedPassport.failure_modes?.length">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Режими відмов ({{ parsedPassport.failure_modes.length }})</div>
            <div v-for="fm in parsedPassport.failure_modes" :key="fm.code" style="padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-family: monospace; font-weight: 700; font-size: 12px;">{{ fm.code }}</span>
                <span style="font-size: 13px;">{{ fm.name }}</span>
              </div>
              <div style="font-size: 12px; color: var(--color-text-muted);">
                Горизонт: {{ fm.typical_horizon_hours ?? '—' }} год
              </div>
              <div v-if="fm.affected_channels?.length" style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
                Канали: {{ fm.affected_channels.join(', ') }}
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="parseError" class="card" style="color: var(--color-text-muted); font-size: 13px;">
          Введіть коректний JSON для попереднього перегляду
        </div>
        <div v-else class="card" style="color: var(--color-text-muted); font-size: 13px;">
          Введіть JSON паспорта ліворуч
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useModelsStore } from '../stores/models.js'
import { useNotificationsStore } from '../stores/notifications.js'

const route = useRoute()
const router = useRouter()
const modelsStore = useModelsStore()
const notifications = useNotificationsStore()

const isNew = computed(() => route.params.id === undefined || route.name === 'model-new')
const jsonText = ref('')
const parseError = ref('')
const validationResult = ref(null)
const saving = ref(false)

const PASSPORT_TEMPLATE = {
  model_code: 'MY_MODEL_001',
  display_name: 'Назва обладнання',
  category: 'pump',
  weibull: { eta: 8760, beta: 2.5 },
  channels: [
    {
      code: 'TEMP_BEARING',
      class: 'temperature',
      unit: 'C',
      nominal: 65,
      operating_range: [20, 85],
      critical_range: [0, 100]
    }
  ],
  failure_modes: [
    {
      code: 'OVERHEATING',
      name: 'Перегрів підшипника',
      typical_horizon_hours: 72,
      affected_channels: ['TEMP_BEARING']
    }
  ]
}

const parsedPassport = computed(() => {
  try {
    const obj = JSON.parse(jsonText.value)
    return obj
  } catch {
    return null
  }
})

function onTextInput() {
  parseError.value = ''
  validationResult.value = null
  try {
    JSON.parse(jsonText.value)
  } catch (e) {
    parseError.value = 'Помилка JSON: ' + e.message
  }
}

function validate() {
  parseError.value = ''
  let parsed
  try {
    parsed = JSON.parse(jsonText.value)
  } catch (e) {
    parseError.value = 'Помилка JSON: ' + e.message
    return
  }

  const errors = []
  if (!parsed.model_code) errors.push('model_code — обов\'язкове поле')
  if (!parsed.display_name) errors.push('display_name — обов\'язкове поле')
  if (!parsed.category) errors.push('category — обов\'язкове поле')
  const warnings = []
  if (!parsed.weibull) {
    warnings.push('weibull відсутній — параметри розподілу Вейбулла не будуть враховані в розрахунку RUL')
  } else {
    if (parsed.weibull.eta == null) warnings.push('weibull.eta відсутній — рекомендується вказати характеристичний час до відмови')
    if (parsed.weibull.beta == null) warnings.push('weibull.beta відсутній — рекомендується вказати параметр форми зносу')
  }
  if (!Array.isArray(parsed.channels) || parsed.channels.length === 0) {
    errors.push('channels — масив каналів обов\'язковий')
  } else {
    parsed.channels.forEach((ch, i) => {
      if (!ch.code) errors.push(`channels[${i}].code — відсутній`)
      if (!ch.unit) errors.push(`channels[${i}].unit — відсутній`)
    })
  }

  if (errors.length === 0) {
    validationResult.value = { ok: true, errors: [], warnings }
  } else {
    validationResult.value = { ok: false, errors, warnings }
  }
}

async function save() {
  validate()
  if (!validationResult.value?.ok) return

  saving.value = true
  try {
    const parsed = JSON.parse(jsonText.value)
    if (isNew.value) {
      const created = await modelsStore.createModel({ passport: parsed })
      router.push(`/models/${created.id}`)
    } else {
      await modelsStore.updateModel(route.params.id, { passport: parsed })
    }
  } catch (e) {
    notifications.add('error', 'Помилка збереження: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isNew.value) {
    jsonText.value = JSON.stringify(PASSPORT_TEMPLATE, null, 2)
  } else {
    await modelsStore.fetchModel(route.params.id)
    if (modelsStore.currentModel) {
      const passport = modelsStore.currentModel.passport ?? modelsStore.currentModel
      jsonText.value = JSON.stringify(passport, null, 2)
    }
  }
})
</script>
