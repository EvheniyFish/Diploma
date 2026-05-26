<template>
  <div>
    <div class="dash-hero">
      <div class="dash-hero-top">
        <h1 class="page-title">Панель моніторингу CASS</h1>
        <span style="font-size: 12px; color: var(--color-text-muted);">Оновлено: {{ lastRefreshLabel }}</span>
      </div>
      <div class="dash-hero-subtitle">
        Вебзастосунок для діагностики несправностей обладнання за допомогою прогнозної аналітики
      </div>
    </div>

    <PageIntro storage-key="dashboard">
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      </template>
      <p><strong>Панель моніторингу</strong> — точка входу в систему. Тут відображається агрегований стан всього парку обладнання прямо зараз.</p>
      <p>
        <strong>OK</strong> — все в нормі, аномалій немає.
        <strong>RISK</strong> — аномальна поведінка виявлена, ML-модель прогнозує деградацію. Потребує уваги впродовж тижня.
        <strong>IMMINENT</strong> — критичний стан, відмова прогнозується менш ніж за 72 год. Потрібна негайна реакція.
      </p>
      <p>Оновлення кожні 30 секунд. Щоб побачити деталі — клікніть на рядок у таблиці або перейдіть до розділу <strong>Обладнання</strong>.</p>
    </PageIntro>

    <div v-if="loading && !summary" class="loading-state">Завантаження...</div>

    <template v-else>
      <div class="status-cards">
        <div class="status-card ok">
          <span class="count">{{ summary?.counts?.ok ?? 0 }}</span>
          <span class="label">Норма (OK)</span>
        </div>
        <div class="status-card risk">
          <span class="count">{{ summary?.counts?.risk ?? 0 }}</span>
          <span class="label">Ризик (RISK)</span>
        </div>
        <div class="status-card imminent">
          <span class="count">{{ summary?.counts?.imminent ?? 0 }}</span>
          <span class="label">Критично (IMMINENT)</span>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-title">Топ-5 ризикованих вузлів</div>
        <DataTable
          :value="topRisk"
          :loading="loading"
          size="small"
          :empty-message="'Дані відсутні'"
          style="font-size: 13px;"
        >
          <Column field="serial_no" header="Серійний номер" sortable>
            <template #body="{ data }">
              <RouterLink :to="`/units/${data.id}`" style="font-weight: 500;">{{ data.serial_no }}</RouterLink>
            </template>
          </Column>
          <Column field="display_name" header="Модель" sortable />
          <Column field="location" header="Розташування" />
          <Column field="status" header="Статус">
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
          <Column header="">
            <template #body="{ data }">
              <RouterLink :to="`/units/${data.id}`" style="font-size: 12px;">Деталі</RouterLink>
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="card">
        <div class="card-title">Поточний стан (зведення)</div>
        <div style="display: flex; gap: 32px; align-items: center; padding: 16px 0;">
          <div v-for="item in statusBreakdown" :key="item.key" style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700;" :style="{ color: item.color }">{{ item.count }}</div>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">{{ item.label }}</div>
          </div>
          <div style="flex: 1; margin-left: 32px;">
            <div style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 8px;">Розподіл за статусом</div>
            <div style="display: flex; height: 24px; border-radius: 4px; overflow: hidden; width: 100%;">
              <div
                v-for="item in statusBreakdown"
                :key="item.key"
                :style="{ width: getBarPct(item.count) + '%', background: item.color }"
                :title="item.label + ': ' + item.count"
              ></div>
            </div>
            <div style="display: flex; gap: 16px; margin-top: 8px;">
              <div v-for="item in statusBreakdown" :key="item.key" style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-muted);">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px;" :style="{ background: item.color }"></span>
                {{ item.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import StatusBadge from '../components/StatusBadge.vue'
import PageIntro from '../components/PageIntro.vue'
import { useUnitsStore } from '../stores/units.js'

const store = useUnitsStore()
const loading = ref(false)
const summary = computed(() => store.summary)
const lastRefreshLabel = ref('—')
let interval = null

const topRisk = computed(() => store.summary?.top_risk ?? [])

const statusBreakdown = computed(() => {
  const counts = store.summary?.counts ?? {}
  return [
    { key: 'ok', label: 'Норма', count: counts.ok ?? 0, color: '#16a34a' },
    { key: 'risk', label: 'Ризик', count: counts.risk ?? 0, color: '#f59e0b' },
    { key: 'imminent', label: 'Критично', count: counts.imminent ?? 0, color: '#dc2626' },
  ]
})

function getBarPct(count) {
  const total = store.summary?.total ?? 1
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

function rulColor(h) {
  if (h == null) return 'var(--color-text-muted)'
  if (h > 168) return '#16a34a'
  if (h > 72) return '#f59e0b'
  return '#dc2626'
}

async function refresh() {
  loading.value = true
  await store.fetchSummary()
  loading.value = false
  lastRefreshLabel.value = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date())
}

onMounted(() => {
  refresh()
  interval = setInterval(refresh, 30000)
})

onUnmounted(() => clearInterval(interval))
</script>

<style scoped>
.dash-hero {
  margin-bottom: 28px;
}
.dash-hero-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}
.dash-hero-subtitle {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
  line-height: 1.5;
  padding: 8px 14px;
  border-left: 3px solid var(--color-primary);
  background: var(--color-primary-dim);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
</style>
