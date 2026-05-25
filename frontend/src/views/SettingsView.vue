<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Налаштування</h1>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Симулятор</div>

      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 500;">Швидкість симуляції:</div>
        <InputText v-model.number="speedFactor" type="number" min="0.1" max="100" step="0.1" style="width: 100px;" />
        <button class="time-range-btn active" @click="applySpeed" :disabled="speedLoading">
          {{ speedLoading ? '...' : 'Застосувати' }}
        </button>
      </div>

      <div v-if="simLoading" class="loading-state">Завантаження...</div>
      <div v-else-if="simState.length === 0" style="color: var(--color-text-muted); font-size: 13px;">Симульовані вузли відсутні</div>
      <div v-else>
        <table class="sim-table">
          <thead>
            <tr>
              <th>ID вузла</th>
              <th>Код моделі</th>
              <th>Здоров'я</th>
              <th>Активний режим</th>
              <th>Прогрес режиму</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in simState" :key="row.unit_id">
              <td>
                <RouterLink :to="`/units/${row.unit_id}`" style="font-size: 12px;">{{ row.unit_id }}</RouterLink>
              </td>
              <td style="font-family: monospace; font-weight: 600;">{{ row.model_code }}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 80px; background: #f1f5f9; border-radius: 4px; overflow: hidden; height: 8px;">
                    <div
                      :style="{
                        width: (row.health * 100).toFixed(0) + '%',
                        background: healthColor(row.health),
                        height: '100%'
                      }"
                    ></div>
                  </div>
                  <span style="font-size: 12px;">{{ (row.health * 100).toFixed(0) }}%</span>
                </div>
              </td>
              <td>{{ row.active_mode ?? '—' }}</td>
              <td>
                <span v-if="row.mode_progress != null">{{ (row.mode_progress * 100).toFixed(0) }}%</span>
                <span v-else>—</span>
              </td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <button
                    class="time-range-btn"
                    style="font-size: 11px; padding: 3px 8px;"
                    @click="openInjectDialog(row.unit_id)"
                  >Відмова</button>
                  <button
                    class="time-range-btn"
                    style="font-size: 11px; padding: 3px 8px; color: var(--color-ok); border-color: var(--color-ok);"
                    @click="resetSim(row.unit_id)"
                  >Скинути</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">ML Сервіс</div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <button class="time-range-btn" @click="checkHealth">Перевірити</button>
        <div v-if="mlStatus !== null">
          <span
            :style="{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
              fontSize: '13px',
              color: mlStatus ? '#16a34a' : '#dc2626'
            }"
          >
            <span
              :style="{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: mlStatus ? '#16a34a' : '#dc2626'
              }"
            ></span>
            {{ mlStatus ? 'Сервіс доступний' : 'Сервіс недоступний' }}
          </span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">API</div>
      <div style="font-size: 13px;">
        <div style="margin-bottom: 8px;">
          <span style="color: var(--color-text-muted);">Backend URL:</span>
          <code style="margin-left: 8px; font-family: monospace; background: var(--color-surface-raised); border: 1px solid var(--color-border-bright); color: var(--color-primary); padding: 2px 8px; border-radius: 4px;">
            {{ apiUrl }}
          </code>
        </div>
        <div>
          <span style="color: var(--color-text-muted);">Admin Key:</span>
          <code style="margin-left: 8px; font-family: monospace; background: var(--color-surface-raised); border: 1px solid var(--color-border-bright); color: var(--color-text-muted); padding: 2px 8px; border-radius: 4px;">
            {{ adminKey }}
          </code>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="showInjectDialog"
      header="Ввести відмову"
      :style="{ width: '380px' }"
      modal
    >
      <div class="form-field">
        <label class="form-label">ID вузла</label>
        <div style="font-size: 13px; font-weight: 600;">{{ injectUnitId }}</div>
      </div>
      <div class="form-field">
        <label class="form-label required">Код режиму відмови</label>
        <InputText v-model="injectModeCode" style="width: 100%;" placeholder="OVERHEATING" />
      </div>
      <div class="form-field">
        <label class="form-label">Горизонт, год</label>
        <InputText v-model.number="injectHorizon" type="number" min="1" style="width: 100%;" placeholder="48" />
      </div>
      <template #footer>
        <button class="time-range-btn" @click="showInjectDialog = false">Скасувати</button>
        <button class="time-range-btn active" @click="submitInject" :disabled="injectLoading || !injectModeCode">
          {{ injectLoading ? '...' : 'Ввести' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import api, { simApi } from '../api/index.js'
import { useNotificationsStore } from '../stores/notifications.js'

const notifications = useNotificationsStore()

const simState = ref([])
const simLoading = ref(false)
const speedFactor = ref(1.0)
const speedLoading = ref(false)
const mlStatus = ref(null)
const showInjectDialog = ref(false)
const injectUnitId = ref(null)
const injectModeCode = ref('')
const injectHorizon = ref(48)
const injectLoading = ref(false)

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
const adminKey = import.meta.env.VITE_ADMIN_KEY || 'dev-admin-key'

function healthColor(h) {
  if (h == null) return '#94a3b8'
  if (h > 0.7) return '#16a34a'
  if (h > 0.4) return '#f59e0b'
  return '#dc2626'
}

async function loadSimState() {
  simLoading.value = true
  try {
    const data = await simApi.state()
    simState.value = Array.isArray(data) ? data : []
  } catch (e) {
    notifications.add('error', 'Помилка завантаження стану симулятора: ' + e.message)
  } finally {
    simLoading.value = false
  }
}

async function applySpeed() {
  if (!speedFactor.value || speedFactor.value <= 0) return
  speedLoading.value = true
  try {
    await simApi.speed({ factor: speedFactor.value })
    notifications.add('success', 'Швидкість симуляції змінено')
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  } finally {
    speedLoading.value = false
  }
}

async function resetSim(unitId) {
  if (!confirm(`Скинути стан вузла ${unitId}?`)) return
  try {
    await simApi.resetUnit({ unit_id: unitId })
    notifications.add('success', `Стан вузла ${unitId} скинуто`)
    await loadSimState()
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  }
}

function openInjectDialog(unitId) {
  injectUnitId.value = unitId
  injectModeCode.value = ''
  injectHorizon.value = 48
  showInjectDialog.value = true
}

async function submitInject() {
  if (!injectModeCode.value) return
  injectLoading.value = true
  try {
    const body = { unit_id: injectUnitId.value, mode_code: injectModeCode.value }
    if (injectHorizon.value) body.horizon_hours = injectHorizon.value
    await simApi.injectFault(body)
    notifications.add('success', 'Відмову введено')
    showInjectDialog.value = false
    await loadSimState()
  } catch (e) {
    notifications.add('error', 'Помилка: ' + e.message)
  } finally {
    injectLoading.value = false
  }
}

async function checkHealth() {
  try {
    await api.get('/healthz')
    mlStatus.value = true
  } catch {
    mlStatus.value = false
  }
}

onMounted(() => loadSimState())
</script>
