<template>
  <div>
    <div v-if="loading && !unit" class="loading-state">Завантаження...</div>

    <template v-else-if="unit">
      <div class="breadcrumb">
        <RouterLink to="/units">Обладнання</RouterLink>
        <span class="sep">/</span>
        <span class="current">{{ unit.serial_no }}</span>
      </div>

      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 700; margin-bottom: 4px;">{{ unit.serial_no }}</h1>
          <div style="font-size: 14px; color: var(--color-text-muted);">
            {{ unit.display_name }} &nbsp;&bull;&nbsp; {{ unit.location }}
          </div>
        </div>
        <StatusBadge :status="unit.status" size="lg" />
      </div>

      <div class="detail-grid" style="margin-bottom: 24px;">
        <div class="detail-item">
          <span class="item-label">Напрацювання</span>
          <span class="item-value">{{ unit.hours_run != null ? formatHours(unit.hours_run) : '—' }}</span>
        </div>
        <div class="detail-item">
          <span class="item-label">Введено в експлуатацію</span>
          <span class="item-value">{{ unit.commissioned_at ? formatDateShort(unit.commissioned_at) : '—' }}</span>
        </div>
        <div class="detail-item">
          <span class="item-label">Код моделі</span>
          <span class="item-value">{{ unit.model_code }}</span>
        </div>
        <div class="detail-item">
          <span class="item-label">Активний</span>
          <span class="item-value">{{ unit.is_active ? 'Так' : 'Ні' }}</span>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-title">Стан здоров'я</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <div>
            <HealthGauge :anomaly-score="health.anomaly_score" :status="health.status" />
          </div>
          <div>
            <RulIndicator
              :rul-hours="health.rul_hours"
              :rul-lower="health.rul_lower_hours"
              :rul-upper="health.rul_upper_hours"
            />
          </div>
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border);">
          <div v-if="health.predicted_mode" style="font-size: 14px;">
            <span style="color: var(--color-text-muted);">Прогноз відмови:</span>
            <strong style="margin-left: 6px;">{{ health.predicted_mode }}</strong>
            <span v-if="health.predicted_mode_conf != null" style="color: var(--color-text-muted); font-size: 12px; margin-left: 6px;">
              ({{ Math.round(health.predicted_mode_conf * 100) }}%)
            </span>
          </div>
          <div v-else style="font-size: 14px; color: var(--color-ok);">Відхилень не виявлено</div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 6px;">
            Оновлено: {{ health.last_updated ? formatDateTime(health.last_updated) : '—' }}
          </div>
        </div>
      </div>

      <div v-if="explanation.length > 0" class="card" style="margin-bottom: 20px;">
        <div class="card-title">Ключові індикатори</div>
        <ul style="padding-left: 16px; list-style: disc; font-size: 13px; line-height: 1.8;">
          <li v-for="(item, idx) in explanation" :key="idx">{{ item }}</li>
        </ul>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-title">Канали телеметрії</div>
        <div v-if="channelsLoading" style="color: var(--color-text-muted); font-size: 13px; padding: 12px 0;">Завантаження...</div>
        <div v-else-if="passportChannels.length === 0" style="color: var(--color-text-muted); font-size: 13px; padding: 12px 0;">Канали не налаштовано</div>
        <div v-else class="channel-cards-grid">
          <ChannelCard
            v-for="ch in passportChannels"
            :key="ch.code"
            :channel="ch"
            :points="telemetryData[ch.code] ?? []"
            :passport-channel="ch"
          />
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div class="card-title" style="margin-bottom: 0;">Телеметрія</div>
        </div>
        <TelemetryChart
          v-if="passportChannels.length > 0"
          :unit-id="unit.id"
          :channels="passportChannels"
          initial-time-range="1h"
        />
        <div v-else style="color: var(--color-text-muted); font-size: 13px;">Немає каналів для відображення</div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-title">Останні події</div>
        <div v-if="eventsLoading" style="color: var(--color-text-muted); font-size: 13px;">Завантаження...</div>
        <DataTable
          v-else
          :value="unitEvents"
          :empty-message="'Дані відсутні'"
          size="small"
          :row-class="rowClass"
        >
          <Column field="ts" header="Час" style="width: 160px;">
            <template #body="{ data }">{{ formatDateTime(data.ts) }}</template>
          </Column>
          <Column field="severity" header="Рівень" style="width: 100px;">
            <template #body="{ data }">
              <span :class="['severity-badge', data.severity]">{{ severityLabel(data.severity) }}</span>
            </template>
          </Column>
          <Column field="event_type" header="Тип" style="width: 140px;" />
          <Column field="message" header="Повідомлення" />
        </DataTable>
      </div>

      <div class="card">
        <div class="card-title">Дії</div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="time-range-btn active" @click="openMaintenanceDialog">Зафіксувати ТО</button>
          <button
            class="time-range-btn"
            style="border-color: #f59e0b; color: #b45309;"
            @click="openFaultDialog"
          >Симулювати відмову</button>
          <button
            class="time-range-btn"
            style="border-color: var(--color-imminent); color: var(--color-imminent);"
            @click="resetUnit"
          >Скинути стан</button>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">Вузол не знайдено</div>

    <Dialog
      v-model:visible="showMaintenanceDialog"
      header="Зафіксувати технічне обслуговування"
      :style="{ width: '420px' }"
      modal
    >
      <div class="form-field">
        <label class="form-label">Примітки</label>
        <textarea
          v-model="maintenanceNotes"
          rows="3"
          style="width: 100%; border: 1px solid var(--color-border); border-radius: 4px; padding: 6px 8px; font-size: 13px; font-family: inherit; resize: vertical;"
          placeholder="Описіть виконані роботи..."
        ></textarea>
      </div>
      <template #footer>
        <button class="time-range-btn" @click="showMaintenanceDialog = false">Скасувати</button>
        <button class="time-range-btn active" @click="submitMaintenance" :disabled="actionLoading">
          {{ actionLoading ? 'Збереження...' : 'Зберегти' }}
        </button>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showFaultDialog"
      header="Симулювати відмову"
      :style="{ width: '420px' }"
      modal
    >
      <div class="form-field">
        <label class="form-label required">Режим відмови</label>
        <Select
          v-model="faultMode"
          :options="failureModeOptions"
          option-label="label"
          option-value="value"
          placeholder="Оберіть режим..."
          style="width: 100%;"
        />
      </div>
      <div class="form-field">
        <label class="form-label">Горизонт прогнозу, год</label>
        <InputText v-model.number="faultHorizon" type="number" min="1" style="width: 100%;" placeholder="48" />
      </div>
      <template #footer>
        <button class="time-range-btn" @click="showFaultDialog = false">Скасувати</button>
        <button class="time-range-btn active" @click="submitFault" :disabled="actionLoading || !faultMode">
          {{ actionLoading ? 'Виконується...' : 'Ввести відмову' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import StatusBadge from '../components/StatusBadge.vue'
import HealthGauge from '../components/HealthGauge.vue'
import RulIndicator from '../components/RulIndicator.vue'
import ChannelCard from '../components/ChannelCard.vue'
import TelemetryChart from '../components/TelemetryChart.vue'
import { unitsApi, eventsApi, simApi } from '../api/index.js'
import { useNotificationsStore } from '../stores/notifications.js'

const route = useRoute()
const notifications = useNotificationsStore()

const unit = ref(null)
const health = ref({})
const loading = ref(true)
const channelsLoading = ref(false)
const eventsLoading = ref(false)
const unitEvents = ref([])
const telemetryData = reactive({})
const actionLoading = ref(false)

const showMaintenanceDialog = ref(false)
const maintenanceNotes = ref('')
const showFaultDialog = ref(false)
const faultMode = ref(null)
const faultHorizon = ref(48)

let interval = null

const passportChannels = computed(() => {
  return unit.value?.passport?.channels ?? []
})

const explanation = computed(() => {
  const features = health.value?.top_features ?? []
  if (Array.isArray(features)) return features
  return []
})

const failureModeOptions = computed(() => {
  const modes = unit.value?.passport?.failure_modes ?? []
  return modes.map(m => ({ label: m.name ?? m.code, value: m.code }))
})

function formatHours(h) {
  const val = Math.round(h)
  return new Intl.NumberFormat('uk-UA').format(val) + ' год'
}

function formatDateShort(ts) {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts))
}

function formatDateTime(ts) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(ts))
}

function severityLabel(s) {
  return { info: 'Інфо', warning: 'Попередження', critical: 'Критично' }[s] ?? s
}

function rowClass(data) {
  if (data.severity === 'critical') return 'event-row-critical'
  if (data.severity === 'warning') return 'event-row-warning'
  return ''
}

async function loadUnit() {
  try {
    const data = await unitsApi.get(route.params.id)
    unit.value = data
    if (data.health) {
      health.value = data.health
    } else {
      health.value = {
        status: data.status,
        anomaly_score: data.anomaly_score,
        predicted_mode: data.predicted_mode,
        predicted_mode_conf: null,
        rul_hours: data.rul_hours,
        rul_lower_hours: null,
        rul_upper_hours: null,
        last_updated: data.last_updated
      }
    }
  } catch (e) {
    notifications.add('error', 'Помилка завантаження вузла: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function loadHealth() {
  try {
    const data = await unitsApi.forecast(route.params.id)
    health.value = data
  } catch {
    // silently fail on background refresh
  }
}

async function loadChannelTelemetry() {
  const channels = passportChannels.value
  if (!channels.length) return
  channelsLoading.value = true
  try {
    await Promise.all(channels.map(async (ch) => {
      const points = await unitsApi.telemetry(route.params.id, { channel: ch.code, limit: 60 })
      telemetryData[ch.code] = points
    }))
  } catch (e) {
    // partial failure is acceptable
  } finally {
    channelsLoading.value = false
  }
}

async function loadEvents() {
  eventsLoading.value = true
  try {
    const data = await unitsApi.events(route.params.id)
    unitEvents.value = Array.isArray(data) ? data.slice(0, 20) : (data.items ?? []).slice(0, 20)
  } catch (e) {
    notifications.add('error', 'Помилка завантаження подій: ' + e.message)
  } finally {
    eventsLoading.value = false
  }
}

async function periodicRefresh() {
  await Promise.all([loadHealth(), loadChannelTelemetry()])
}

function openMaintenanceDialog() {
  maintenanceNotes.value = ''
  showMaintenanceDialog.value = true
}

async function submitMaintenance() {
  actionLoading.value = true
  try {
    await eventsApi.create({
      unit_id: parseInt(route.params.id),
      severity: 'info',
      event_type: 'maintenance',
      message: maintenanceNotes.value || 'Технічне обслуговування виконано'
    })
    notifications.add('success', 'Подію ТО зафіксовано')
    showMaintenanceDialog.value = false
    loadEvents()
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  } finally {
    actionLoading.value = false
  }
}

function openFaultDialog() {
  faultMode.value = null
  faultHorizon.value = 48
  showFaultDialog.value = true
}

async function submitFault() {
  if (!faultMode.value) return
  actionLoading.value = true
  try {
    const body = { unit_id: parseInt(route.params.id), mode_code: faultMode.value }
    if (faultHorizon.value) body.horizon_hours = faultHorizon.value
    await simApi.injectFault(body)
    notifications.add('success', 'Відмову введено')
    showFaultDialog.value = false
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  } finally {
    actionLoading.value = false
  }
}

async function resetUnit() {
  if (!confirm('Скинути стан вузла до норми?')) return
  actionLoading.value = true
  try {
    await simApi.resetUnit({ unit_id: parseInt(route.params.id) })
    notifications.add('success', 'Стан вузла скинуто')
    await loadHealth()
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  } finally {
    actionLoading.value = false
  }
}

onMounted(async () => {
  await loadUnit()
  await Promise.all([loadChannelTelemetry(), loadEvents()])
  interval = setInterval(periodicRefresh, 15000)
})

onUnmounted(() => clearInterval(interval))
</script>
