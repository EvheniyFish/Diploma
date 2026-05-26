<template>
  <div>
    <div v-if="loading && !unit" class="loading-state">Завантаження...</div>

    <template v-else-if="unit">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <RouterLink to="/units">Обладнання</RouterLink>
        <span class="sep">/</span>
        <span class="current">{{ unit.serial_no }}</span>
      </div>

      <!-- Unit header -->
      <div class="unit-hero">
        <div class="unit-hero-left">
          <h1 class="unit-title">{{ unit.serial_no }}</h1>
          <div class="unit-subtitle">{{ unit.display_name }}<span class="sep-dot">·</span>{{ unit.location }}</div>
        </div>
        <StatusBadge :status="unit.status" size="lg" />
      </div>

      <div class="detail-grid" style="margin-bottom: 28px;">
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
          <span class="item-value mono">{{ unit.model_code }}</span>
        </div>
        <div class="detail-item">
          <span class="item-label">Активний</span>
          <span class="item-value">{{ unit.is_active ? 'Так' : 'Ні' }}</span>
        </div>
      </div>

      <!-- ══ SECTION 1: Health & Forecast ═══════════════════════════════════ -->
      <div class="section-header">
        <div class="section-header-left">
          <div class="section-title">Стан здоров'я та прогноз</div>
          <div class="section-desc">
            ML-модель кожні 5 хвилин аналізує 360 останніх точок телеметрії і видає дві оцінки:
            <strong>Anomaly Score</strong> — наскільки поточна поведінка відхиляється від норми (0% = ідеально, >70% = критично),
            та <strong>RUL</strong> (Remaining Useful Life) — прогноз часу до відмови в годинах.
            Якщо виявлено відхилення, система також вказує найімовірніший тип відмови.
          </div>
        </div>
        <div class="section-updated" v-if="health.last_updated">
          Оновлено {{ formatDateTime(health.last_updated) }}
        </div>
      </div>

      <div class="card" style="margin-bottom: 28px;">
        <div class="health-grid">
          <div class="health-cell">
            <HealthGauge :anomaly-score="health.anomaly_score" :status="health.status" />
          </div>
          <div class="health-cell">
            <RulIndicator
              :rul-hours="health.rul_hours"
              :rul-lower="health.rul_lower_hours"
              :rul-upper="health.rul_upper_hours"
            />
          </div>
        </div>
        <div class="health-mode-row">
          <div v-if="health.predicted_mode" class="predicted-mode-box">
            <span class="predicted-mode-label">Прогнозований режим відмови:</span>
            <strong class="predicted-mode-val">{{ health.predicted_mode }}</strong>
            <span v-if="health.predicted_mode_conf != null" class="predicted-mode-conf">
              впевненість {{ Math.round(health.predicted_mode_conf * 100) }}%
            </span>
          </div>
          <div v-else class="predicted-mode-ok">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            Відхилень не виявлено
          </div>
        </div>
      </div>

      <!-- ══ SECTION 2: Key Indicators ══════════════════════════════════════ -->
      <template v-if="explanation.length > 0">
        <div class="section-header">
          <div class="section-header-left">
            <div class="section-title">Ключові індикатори аномалії</div>
            <div class="section-desc">
              Ці фактори найбільше вплинули на поточну оцінку аномальності.
              Вони виведені ML-моделлю на основі аналізу часових рядів — не просто поточні значення,
              а статистичні відхилення: тренди, дисперсія, кореляції між каналами.
              Чим вище фактор у списку — тим більший його внесок у поточний стан.
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom: 28px;">
          <ul class="indicators-list">
            <li v-for="(item, idx) in explanation" :key="idx" class="indicator-item">
              <span class="indicator-num">{{ idx + 1 }}</span>
              <span class="indicator-text">{{ item }}</span>
            </li>
          </ul>
        </div>
      </template>

      <!-- ══ SECTION 3: Channel Cards ════════════════════════════════════════ -->
      <div class="section-header">
        <div class="section-header-left">
          <div class="section-title">Канали телеметрії — поточний стан</div>
          <div class="section-desc">
            Кожна карта — один фізичний канал сенсора. Показує поточне значення та мінімакс за останні 10 точок.
            Кольоровий індикатор відображає позицію значення відносно <strong>робочого діапазону</strong> (жовта лінія на графіку)
            та <strong>критичного порогу</strong> (червона лінія). Мікро-спарклайн праворуч показує тренд останніх вимірювань.
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 28px;">
        <div v-if="channelsLoading" class="loading-inline">Завантаження каналів...</div>
        <div v-else-if="passportChannels.length === 0" class="empty-inline">Канали не налаштовано в паспорті моделі</div>
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

      <!-- ══ SECTION 4: Telemetry Chart ══════════════════════════════════════ -->
      <div class="section-header">
        <div class="section-header-left">
          <div class="section-title">Телеметрія — часові ряди</div>
          <div class="section-desc">
            Інтерактивний мультиканальний графік. Оберіть потрібні канали кнопками вгорі,
            змініть часовий діапазон (1г / 6г / 24г / 7д).
            Колір кожного каналу відповідає кольору кнопки та точки на карті вище.
            <strong>Масштаб:</strong> скрол колесом або затиснути і потягнути на нижньому слайдері.
            Горизонтальні лінії показують допустимий (жовтий) та критичний (червоний) пороги з паспорту.
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 28px;">
        <TelemetryChart
          v-if="passportChannels.length > 0"
          :unit-id="unit.id"
          :channels="passportChannels"
          initial-time-range="1h"
        />
        <div v-else class="empty-inline">Немає каналів для відображення</div>
      </div>

      <!-- ══ SECTION 5: Events ═══════════════════════════════════════════════ -->
      <div class="section-header">
        <div class="section-header-left">
          <div class="section-title">Журнал подій</div>
          <div class="section-desc">
            Хронологічний журнал усіх подій по цьому вузлу: зміни статусу, виявлені аномалії,
            зафіксовані ТО, критичні сповіщення.
            <span class="badge-inline critical">Критично</span> — вимагає негайної уваги.
            <span class="badge-inline warning">Попередження</span> — є ризик, потребує моніторингу.
            <span class="badge-inline info">Інфо</span> — планові або інформаційні події.
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 28px;">
        <div v-if="eventsLoading" class="loading-inline">Завантаження подій...</div>
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
          <Column field="severity" header="Рівень" style="width: 120px;">
            <template #body="{ data }">
              <span :class="['severity-badge', data.severity]">{{ severityLabel(data.severity) }}</span>
            </template>
          </Column>
          <Column field="event_type" header="Тип" style="width: 150px;" />
          <Column field="message" header="Повідомлення" />
        </DataTable>
      </div>

      <!-- ══ SECTION 6: Actions ══════════════════════════════════════════════ -->
      <div class="section-header">
        <div class="section-header-left">
          <div class="section-title">Управління вузлом</div>
          <div class="section-desc">
            <strong>Зафіксувати ТО</strong> — записати подію технічного обслуговування в журнал (скидає лічильник критичності).
            <strong>Симулювати відмову</strong> — запускає сценарій деградації для тестування системи оповіщення.
            <strong>Скинути стан</strong> — повертає всі симульовані відмови до нормального стану.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="actions-row">
          <button class="action-btn primary" @click="openMaintenanceDialog">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Зафіксувати ТО
          </button>
          <button class="action-btn warn" @click="openFaultDialog">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Симулювати відмову
          </button>
          <button class="action-btn danger" @click="resetUnit">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Скинути стан
          </button>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">Вузол не знайдено</div>

    <!-- Maintenance dialog -->
    <Dialog
      v-model:visible="showMaintenanceDialog"
      header="Зафіксувати технічне обслуговування"
      :style="{ width: '440px' }"
      modal
    >
      <div class="form-field">
        <label class="form-label">Примітки</label>
        <textarea
          v-model="maintenanceNotes"
          rows="3"
          class="form-textarea"
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

    <!-- Fault injection dialog -->
    <Dialog
      v-model:visible="showFaultDialog"
      header="Симулювати відмову"
      :style="{ width: '440px' }"
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
        <div v-if="faultModeDesc" class="fault-mode-desc">{{ faultModeDesc }}</div>
      </div>
      <div class="form-field">
        <label class="form-label">Горизонт прогнозу, год</label>
        <InputText v-model.number="faultHorizon" type="number" min="1" style="width: 100%;" placeholder="48" />
        <div class="form-hint">Через скільки годин прогнозується повна відмова</div>
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

const passportChannels = computed(() => unit.value?.passport?.channels ?? [])

const explanation = computed(() => {
  const features = health.value?.top_features ?? []
  return Array.isArray(features) ? features : []
})

const failureModeOptions = computed(() => {
  const modes = unit.value?.passport?.failure_modes ?? []
  return modes.map(m => ({ label: m.name ?? m.code, value: m.code, desc: m.description ?? null }))
})

const faultModeDesc = computed(() => {
  if (!faultMode.value) return null
  const opt = failureModeOptions.value.find(o => o.value === faultMode.value)
  return opt?.desc ?? null
})

function formatHours(h) {
  return new Intl.NumberFormat('uk-UA').format(Math.round(h)) + ' год'
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
    health.value = data.health ?? {
      status: data.status,
      anomaly_score: data.anomaly_score,
      predicted_mode: data.predicted_mode,
      predicted_mode_conf: null,
      rul_hours: data.rul_hours,
      rul_lower_hours: null,
      rul_upper_hours: null,
      last_updated: data.last_updated
    }
  } catch (e) {
    notifications.add('error', 'Помилка завантаження вузла: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function loadHealth() {
  try {
    health.value = await unitsApi.forecast(route.params.id)
  } catch { /* background refresh, silent */ }
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
  } catch { /* partial failure acceptable */ } finally {
    channelsLoading.value = false
  }
}

async function loadEvents() {
  eventsLoading.value = true
  try {
    const data = await unitsApi.events(route.params.id)
    const arr = Array.isArray(data) ? data : (data.items ?? [])
    unitEvents.value = arr.slice(0, 20)
  } catch (e) {
    notifications.add('error', 'Помилка завантаження подій: ' + e.message)
  } finally {
    eventsLoading.value = false
  }
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
  interval = setInterval(() => Promise.all([loadHealth(), loadChannelTelemetry()]), 15000)
})

onUnmounted(() => clearInterval(interval))
</script>

<style scoped>
.unit-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.unit-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--color-text);
}
.unit-subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
}
.sep-dot {
  margin: 0 8px;
  opacity: 0.4;
}
.mono { font-family: var(--font-mono); }

/* Section headers */
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}
.section-header-left { flex: 1; }
.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-primary);
  font-family: var(--font-mono);
  margin-bottom: 5px;
}
.section-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.section-desc strong { color: var(--color-text); }
.section-updated {
  font-size: 11px;
  color: var(--color-text-faint);
  white-space: nowrap;
  padding-top: 2px;
}

/* Health layout */
.health-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.health-cell {}
.health-mode-row {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
}
.predicted-mode-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}
.predicted-mode-label { color: var(--color-text-muted); }
.predicted-mode-val { color: var(--color-risk); font-weight: 700; }
.predicted-mode-conf {
  font-size: 11px;
  color: var(--color-text-faint);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 6px;
}
.predicted-mode-ok {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ok);
}

/* Indicators */
.indicators-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.indicator-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.indicator-num {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary-dim);
  border: 1px solid var(--color-border-accent);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
}
.indicator-text { color: var(--color-text-muted); padding-top: 2px; }

/* Inline states */
.loading-inline, .empty-inline {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 12px 0;
}

/* Section desc inline badges */
.badge-inline {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  vertical-align: middle;
  margin: 0 2px;
}
.badge-inline.critical { background: rgba(244,63,94,0.15); color: var(--color-imminent); border: 1px solid rgba(244,63,94,0.35); }
.badge-inline.warning  { background: rgba(249,115,22,0.15); color: var(--color-risk); border: 1px solid rgba(249,115,22,0.35); }
.badge-inline.info     { background: var(--color-primary-dim); color: var(--color-primary); border: 1px solid var(--color-border-accent); }

/* Actions */
.actions-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
  border-radius: var(--radius-sm);
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
}
.action-btn.primary {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.action-btn.primary:hover { background: var(--color-primary-dim); }
.action-btn.warn {
  border-color: var(--color-risk);
  color: var(--color-risk);
}
.action-btn.warn:hover { background: rgba(249,115,22,0.1); }
.action-btn.danger {
  border-color: var(--color-imminent);
  color: var(--color-imminent);
}
.action-btn.danger:hover { background: rgba(244,63,94,0.1); }

/* Fault mode */
.fault-mode-desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
  padding: 6px 8px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.form-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-faint);
}
.form-textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  background: var(--color-surface-raised);
  color: var(--color-text);
}
.form-textarea:focus {
  outline: none;
  border-color: var(--color-border-accent);
}
</style>
