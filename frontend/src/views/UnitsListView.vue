<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Обладнання</h1>
      <div class="page-actions">
        <button
          class="time-range-btn"
          @click="refresh"
          :disabled="store.loading"
          style="padding: 6px 14px;"
        >Оновити</button>
        <button
          class="time-range-btn active"
          @click="showAddDialog = true"
          style="padding: 6px 14px;"
        >+ Додати вузол</button>
      </div>
    </div>

    <div class="filters-row">
      <InputText
        v-model="search"
        placeholder="Пошук за серійним номером, розташуванням..."
        style="width: 280px;"
        @update:modelValue="onFilterChange"
      />
      <Select
        v-model="filterStatus"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="Статус: Всі"
        style="width: 160px;"
        @change="onFilterChange"
      />
      <Select
        v-model="filterModel"
        :options="modelOptions"
        option-label="label"
        option-value="value"
        placeholder="Модель: Всі"
        style="width: 200px;"
        @change="onFilterChange"
      />
    </div>

    <DataTable
      :value="store.units"
      :loading="store.loading"
      size="small"
      :rows="20"
      :paginator="store.units.length > 20"
      paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
      :empty-message="'Дані відсутні'"
      @row-click="onRowClick"
      style="cursor: pointer;"
    >
      <Column field="serial_no" header="Серійний номер" sortable>
        <template #body="{ data }">
          <span style="font-weight: 500;">{{ data.serial_no }}</span>
        </template>
      </Column>
      <Column field="display_name" header="Модель" sortable />
      <Column field="location" header="Розташування" />
      <Column field="status" header="Статус" sortable>
        <template #body="{ data }">
          <StatusBadge :status="data.status" size="sm" />
        </template>
      </Column>
      <Column field="rul_hours" header="Залишок, год" sortable>
        <template #body="{ data }">
          <span :style="{ color: rulColor(data.rul_hours), fontWeight: '600' }">
            {{ data.rul_hours != null ? Math.round(data.rul_hours) : '—' }}
          </span>
        </template>
      </Column>
      <Column field="predicted_mode" header="Прогноз відмови">
        <template #body="{ data }">{{ data.predicted_mode ?? '—' }}</template>
      </Column>
      <Column field="last_updated" header="Оновлено" sortable>
        <template #body="{ data }">
          {{ data.last_updated ? formatDate(data.last_updated) : '—' }}
        </template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <RouterLink :to="`/units/${data.id}`" style="font-size: 12px;" @click.stop>Деталі</RouterLink>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="showAddDialog"
      header="Додати вузол"
      :style="{ width: '480px' }"
      modal
    >
      <form @submit.prevent="submitAdd">
        <div class="form-field">
          <label class="form-label required">Модель</label>
          <Select
            v-model="addForm.model_id"
            :options="modelsStore.models"
            option-label="display_name"
            option-value="id"
            placeholder="Оберіть модель..."
            style="width: 100%;"
          />
          <span v-if="addErrors.model_id" class="form-error">{{ addErrors.model_id }}</span>
        </div>
        <div class="form-field">
          <label class="form-label required">Серійний номер</label>
          <InputText v-model="addForm.serial_no" style="width: 100%;" placeholder="SN-000001" />
          <span v-if="addErrors.serial_no" class="form-error">{{ addErrors.serial_no }}</span>
        </div>
        <div class="form-field">
          <label class="form-label required">Розташування</label>
          <InputText v-model="addForm.location" style="width: 100%;" placeholder="Цех 1, Лінія 2" />
          <span v-if="addErrors.location" class="form-error">{{ addErrors.location }}</span>
        </div>
        <div class="form-field">
          <label class="form-label required">Дата введення в експлуатацію</label>
          <DatePicker v-model="addForm.commissioned_at" :style="{ width: '100%' }" />
          <span v-if="addErrors.commissioned_at" class="form-error">{{ addErrors.commissioned_at }}</span>
        </div>
        <div class="form-field">
          <label class="form-label">Примітки</label>
          <textarea
            v-model="addForm.notes"
            rows="2"
            style="width: 100%; border: 1px solid var(--color-border); border-radius: 4px; padding: 6px 8px; font-size: 13px; font-family: inherit; resize: vertical;"
          ></textarea>
        </div>
      </form>
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
import { ref, reactive, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import StatusBadge from '../components/StatusBadge.vue'
import DatePicker from '../components/DatePicker.vue'
import { useUnitsStore } from '../stores/units.js'
import { useModelsStore } from '../stores/models.js'

const router = useRouter()
const store = useUnitsStore()
const modelsStore = useModelsStore()

const search = ref('')
const filterStatus = ref(null)
const filterModel = ref(null)
const showAddDialog = ref(false)
const addLoading = ref(false)

const statusOptions = [
  { label: 'Всі', value: null },
  { label: 'OK', value: 'ok' },
  { label: 'RISK', value: 'risk' },
  { label: 'IMMINENT', value: 'imminent' },
]

const modelOptions = ref([{ label: 'Всі', value: null }])

const addForm = reactive({
  model_id: null,
  serial_no: '',
  location: '',
  commissioned_at: '',
  notes: ''
})

const addErrors = reactive({
  model_id: '',
  serial_no: '',
  location: '',
  commissioned_at: ''
})

function rulColor(h) {
  if (h == null) return 'var(--color-text-muted)'
  if (h > 168) return '#16a34a'
  if (h > 72) return '#f59e0b'
  return '#dc2626'
}

function formatDate(ts) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(ts))
}

function onRowClick(event) {
  router.push(`/units/${event.data.id}`)
}

let filterTimer = null
function onFilterChange() {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(refresh, 300)
}

function refresh() {
  const params = {}
  if (search.value) params.q = search.value
  if (filterStatus.value) params.status = filterStatus.value
  if (filterModel.value) params.model_id = filterModel.value
  store.fetchUnits(params)
}

function validateAdd() {
  let valid = true
  addErrors.model_id = ''
  addErrors.serial_no = ''
  addErrors.location = ''
  addErrors.commissioned_at = ''

  if (!addForm.model_id) { addErrors.model_id = 'Оберіть модель'; valid = false }
  if (!addForm.serial_no.trim()) { addErrors.serial_no = 'Введіть серійний номер'; valid = false }
  if (!addForm.location.trim()) { addErrors.location = 'Введіть розташування'; valid = false }
  if (!addForm.commissioned_at) { addErrors.commissioned_at = 'Вкажіть дату'; valid = false }
  return valid
}

async function submitAdd() {
  if (!validateAdd()) return
  addLoading.value = true
  try {
    const body = {
      model_id: addForm.model_id,
      serial_no: addForm.serial_no.trim(),
      location: addForm.location.trim(),
      commissioned_at: addForm.commissioned_at,
    }
    if (addForm.notes) body.notes = addForm.notes
    await store.createUnit(body)
    showAddDialog.value = false
    Object.assign(addForm, { model_id: null, serial_no: '', location: '', commissioned_at: '', notes: '' })
    refresh()
  } finally {
    addLoading.value = false
  }
}

onMounted(async () => {
  await modelsStore.fetchModels()
  modelOptions.value = [
    { label: 'Всі', value: null },
    ...modelsStore.models.map(m => ({ label: m.display_name, value: m.id }))
  ]
  refresh()
})
</script>
