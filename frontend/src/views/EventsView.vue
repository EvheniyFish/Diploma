<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Журнал подій</h1>
      <div class="page-actions">
        <a :href="exportUrl" style="font-size: 13px; padding: 5px 12px; border: 1px solid var(--color-border); border-radius: 4px; color: var(--color-text);">
          Експорт CSV
        </a>
        <button class="time-range-btn active" @click="showAddDialog = true" style="padding: 6px 14px;">
          + Додати подію
        </button>
      </div>
    </div>

    <div class="filters-row">
      <Select
        v-model="filterUnit"
        :options="unitOptions"
        option-label="label"
        option-value="value"
        placeholder="Вузол: Всі"
        style="width: 200px;"
        @change="onFilterChange"
      />
      <Select
        v-model="filterSeverity"
        :options="severityOptions"
        option-label="label"
        option-value="value"
        placeholder="Рівень: Всі"
        style="width: 160px;"
        @change="onFilterChange"
      />
      <Select
        v-model="filterEventType"
        :options="eventTypeOptions"
        option-label="label"
        option-value="value"
        placeholder="Тип: Всі"
        style="width: 180px;"
        @change="onFilterChange"
      />
      <InputText
        v-model="filterFrom"
        type="date"
        style="width: 150px; font-size: 13px;"
        @change="onFilterChange"
      />
      <span style="font-size: 13px; color: var(--color-text-muted);">—</span>
      <InputText
        v-model="filterTo"
        type="date"
        style="width: 150px; font-size: 13px;"
        @change="onFilterChange"
      />
      <button class="time-range-btn" @click="clearFilters">Скинути</button>
    </div>

    <DataTable
      :value="events"
      :loading="loading"
      size="small"
      :empty-message="'Дані відсутні'"
      :row-class="rowClass"
    >
      <Column field="ts" header="Час" sortable style="width: 160px;">
        <template #body="{ data }">{{ formatDateTime(data.ts) }}</template>
      </Column>
      <Column header="Вузол" style="width: 140px;">
        <template #body="{ data }">
          <RouterLink v-if="data.unit_id" :to="`/units/${data.unit_id}`" style="font-size: 12px;">
            {{ getUnitSerial(data.unit_id) }}
          </RouterLink>
          <span v-else style="color: var(--color-text-muted);">—</span>
        </template>
      </Column>
      <Column field="severity" header="Рівень" sortable style="width: 120px;">
        <template #body="{ data }">
          <span :class="['severity-badge', data.severity]">{{ severityLabel(data.severity) }}</span>
        </template>
      </Column>
      <Column field="event_type" header="Тип" sortable style="width: 160px;" />
      <Column field="message" header="Повідомлення" />
    </DataTable>

    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 13px; color: var(--color-text-muted);">
      <span>Всього: {{ total }}</span>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button
          class="time-range-btn"
          :disabled="offset === 0"
          @click="prevPage"
        >Назад</button>
        <span>Сторінка {{ currentPage }} / {{ totalPages }}</span>
        <button
          class="time-range-btn"
          :disabled="offset + limit >= total"
          @click="nextPage"
        >Вперед</button>
      </div>
    </div>

    <Dialog
      v-model:visible="showAddDialog"
      header="Додати подію"
      :style="{ width: '480px' }"
      modal
    >
      <div class="form-field">
        <label class="form-label">Вузол</label>
        <Select
          v-model="addForm.unit_id"
          :options="unitOptions"
          option-label="label"
          option-value="value"
          placeholder="Оберіть вузол..."
          style="width: 100%;"
        />
      </div>
      <div class="form-field">
        <label class="form-label required">Рівень</label>
        <Select
          v-model="addForm.severity"
          :options="[{ label: 'Інфо', value: 'info' }, { label: 'Попередження', value: 'warning' }, { label: 'Критично', value: 'critical' }]"
          option-label="label"
          option-value="value"
          placeholder="Оберіть рівень..."
          style="width: 100%;"
        />
        <span v-if="addErrors.severity" class="form-error">{{ addErrors.severity }}</span>
      </div>
      <div class="form-field">
        <label class="form-label required">Тип події</label>
        <InputText v-model="addForm.event_type" style="width: 100%;" placeholder="maintenance, alert, info..." />
        <span v-if="addErrors.event_type" class="form-error">{{ addErrors.event_type }}</span>
      </div>
      <div class="form-field">
        <label class="form-label required">Повідомлення</label>
        <textarea
          v-model="addForm.message"
          rows="3"
          style="width: 100%; border: 1px solid var(--color-border); border-radius: 4px; padding: 6px 8px; font-size: 13px; font-family: inherit; resize: vertical;"
          placeholder="Опис події..."
        ></textarea>
        <span v-if="addErrors.message" class="form-error">{{ addErrors.message }}</span>
      </div>
      <template #footer>
        <button class="time-range-btn" @click="showAddDialog = false">Скасувати</button>
        <button class="time-range-btn active" @click="submitAdd" :disabled="addLoading">
          {{ addLoading ? 'Збереження...' : 'Додати' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import { eventsApi, unitsApi } from '../api/index.js'
import { useNotificationsStore } from '../stores/notifications.js'

const notifications = useNotificationsStore()

const events = ref([])
const loading = ref(false)
const total = ref(0)
const limit = 20
const offset = ref(0)
const unitsList = ref([])
const showAddDialog = ref(false)
const addLoading = ref(false)

const filterUnit = ref(null)
const filterSeverity = ref(null)
const filterEventType = ref(null)
const filterFrom = ref('')
const filterTo = ref('')

const addForm = reactive({ unit_id: null, severity: null, event_type: '', message: '' })
const addErrors = reactive({ severity: '', event_type: '', message: '' })

const severityOptions = [
  { label: 'Всі', value: null },
  { label: 'Інфо', value: 'info' },
  { label: 'Попередження', value: 'warning' },
  { label: 'Критично', value: 'critical' },
]

const eventTypeOptions = [
  { label: 'Всі', value: null },
  { label: 'maintenance', value: 'maintenance' },
  { label: 'alert', value: 'alert' },
  { label: 'fault', value: 'fault' },
  { label: 'info', value: 'info' },
]

const unitOptions = computed(() => [
  { label: 'Всі', value: null },
  ...unitsList.value.map(u => ({ label: u.serial_no, value: u.id }))
])

const currentPage = computed(() => Math.floor(offset.value / limit) + 1)
const totalPages = computed(() => Math.ceil(total.value / limit) || 1)

const exportUrl = computed(() => {
  const params = {}
  if (filterUnit.value) params.unit_id = filterUnit.value
  if (filterSeverity.value) params.severity = filterSeverity.value
  if (filterEventType.value) params.event_type = filterEventType.value
  if (filterFrom.value) params.from = filterFrom.value
  if (filterTo.value) params.to = filterTo.value
  return eventsApi.exportUrl(params)
})

function getUnitSerial(unit_id) {
  const u = unitsList.value.find(u => u.id === unit_id)
  return u?.serial_no ?? String(unit_id)
}

function severityLabel(s) {
  return { info: 'Інфо', warning: 'Попередження', critical: 'Критично' }[s] ?? s
}

function rowClass(data) {
  if (data.severity === 'critical') return 'event-row-critical'
  if (data.severity === 'warning') return 'event-row-warning'
  return ''
}

function formatDateTime(ts) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(ts))
}

function buildParams() {
  const params = { limit, offset: offset.value }
  if (filterUnit.value) params.unit_id = filterUnit.value
  if (filterSeverity.value) params.severity = filterSeverity.value
  if (filterEventType.value) params.event_type = filterEventType.value
  if (filterFrom.value) params.from = filterFrom.value + 'T00:00:00Z'
  if (filterTo.value) params.to = filterTo.value + 'T23:59:59Z'
  return params
}

async function loadEvents() {
  loading.value = true
  try {
    const resp = await eventsApi.list(buildParams())
    if (Array.isArray(resp)) {
      events.value = resp
      total.value = resp.length
    } else {
      events.value = resp.items ?? []
      total.value = resp.total ?? 0
    }
  } catch (e) {
    notifications.add('error', 'Помилка завантаження подій: ' + e.message)
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  offset.value = 0
  loadEvents()
}

function clearFilters() {
  filterUnit.value = null
  filterSeverity.value = null
  filterEventType.value = null
  filterFrom.value = ''
  filterTo.value = ''
  offset.value = 0
  loadEvents()
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit)
  loadEvents()
}

function nextPage() {
  offset.value += limit
  loadEvents()
}

function validateAdd() {
  let valid = true
  addErrors.severity = ''
  addErrors.event_type = ''
  addErrors.message = ''
  if (!addForm.severity) { addErrors.severity = 'Оберіть рівень'; valid = false }
  if (!addForm.event_type.trim()) { addErrors.event_type = 'Введіть тип події'; valid = false }
  if (!addForm.message.trim()) { addErrors.message = 'Введіть повідомлення'; valid = false }
  return valid
}

async function submitAdd() {
  if (!validateAdd()) return
  addLoading.value = true
  try {
    const body = {
      severity: addForm.severity,
      event_type: addForm.event_type.trim(),
      message: addForm.message.trim()
    }
    if (addForm.unit_id) body.unit_id = addForm.unit_id
    await eventsApi.create(body)
    notifications.add('success', 'Подію додано')
    showAddDialog.value = false
    Object.assign(addForm, { unit_id: null, severity: null, event_type: '', message: '' })
    loadEvents()
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  } finally {
    addLoading.value = false
  }
}

onMounted(async () => {
  try {
    const units = await unitsApi.list()
    unitsList.value = Array.isArray(units) ? units : []
  } catch {
    unitsList.value = []
  }
  loadEvents()
})
</script>
