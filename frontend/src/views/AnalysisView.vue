<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Аналіз системи</h1>
      <div class="page-actions">
        <span style="font-size: 12px; color: var(--color-text-muted);">{{ lastRefreshLabel }}</span>
        <button class="time-range-btn active" @click="load" :disabled="loading" style="padding: 5px 14px;">
          Оновити
        </button>
      </div>
    </div>

    <div v-if="loading && !units.length" class="loading-state">Завантаження...</div>

    <!-- Local server hardware monitor -->
    <div class="card sysinfo-card">
      <div class="sysinfo-header">
        <div class="card-title" style="margin-bottom: 0;">Поточний сервер</div>
        <div class="sysinfo-meta">
          <span v-if="sysinfo">{{ sysinfo.metrics.hostname }}</span>
          <span v-if="sysinfo" style="opacity: 0.5;">·</span>
          <span v-if="sysinfo">{{ sysinfo.metrics.cpu_count }} ядер</span>
          <span v-if="sysinfo" style="opacity: 0.5;">·</span>
          <span v-if="sysinfo">{{ sysinfo.metrics.ram_total_mb >= 1024 ? (sysinfo.metrics.ram_total_mb / 1024).toFixed(0) + ' GB' : sysinfo.metrics.ram_total_mb + ' MB' }} RAM</span>
          <StatusBadge v-if="sysinfo?.health" :status="sysinfo.health.status" size="sm" style="margin-left: 8px;" />
        </div>
      </div>

      <div v-if="!sysinfo" class="sysinfo-loading">Зчитування метрик...</div>
      <div v-else class="sysinfo-gauges">

        <!-- RAM -->
        <div class="sysinfo-gauge">
          <div class="sysinfo-gauge-label">
            <span>RAM</span>
            <span class="sysinfo-gauge-value" :style="{ color: gaugeColor(sysinfo.metrics.ram_used_pct, 85, 95) }">
              {{ sysinfo.metrics.ram_used_pct }}%
            </span>
          </div>
          <div class="sysinfo-gauge-track">
            <div
              class="sysinfo-gauge-fill"
              :style="{ width: sysinfo.metrics.ram_used_pct + '%', background: gaugeColor(sysinfo.metrics.ram_used_pct, 85, 95) }"
            ></div>
          </div>
          <div class="sysinfo-gauge-detail">
            {{ sysinfo.metrics.ram_total_mb - sysinfo.metrics.ram_free_mb >= 1024
                ? ((sysinfo.metrics.ram_total_mb - sysinfo.metrics.ram_free_mb) / 1024).toFixed(1) + ' GB'
                : (sysinfo.metrics.ram_total_mb - sysinfo.metrics.ram_free_mb) + ' MB' }} / {{
               sysinfo.metrics.ram_total_mb >= 1024
                ? (sysinfo.metrics.ram_total_mb / 1024).toFixed(0) + ' GB'
                : sysinfo.metrics.ram_total_mb + ' MB'
            }}
          </div>
        </div>

        <!-- CPU -->
        <div class="sysinfo-gauge">
          <div class="sysinfo-gauge-label">
            <span>CPU</span>
            <span class="sysinfo-gauge-value" :style="{ color: gaugeColor(sysinfo.metrics.cpu_load_pct, 80, 95) }">
              {{ sysinfo.metrics.cpu_load_pct != null ? sysinfo.metrics.cpu_load_pct + '%' : '—' }}
            </span>
          </div>
          <div class="sysinfo-gauge-track">
            <div
              class="sysinfo-gauge-fill"
              :style="{ width: (sysinfo.metrics.cpu_load_pct ?? 0) + '%', background: gaugeColor(sysinfo.metrics.cpu_load_pct ?? 0, 80, 95) }"
            ></div>
          </div>
          <div class="sysinfo-gauge-detail">{{ sysinfo.metrics.cpu_count }} логічних ядер</div>
        </div>

        <!-- Disk -->
        <div class="sysinfo-gauge">
          <div class="sysinfo-gauge-label">
            <span>Диск</span>
            <span class="sysinfo-gauge-value" :style="{ color: gaugeColor(sysinfo.metrics.disk_used_pct ?? 0, 85, 95) }">
              {{ sysinfo.metrics.disk_used_pct != null ? sysinfo.metrics.disk_used_pct + '%' : '—' }}
            </span>
          </div>
          <div class="sysinfo-gauge-track">
            <div
              class="sysinfo-gauge-fill"
              :style="{ width: (sysinfo.metrics.disk_used_pct ?? 0) + '%', background: gaugeColor(sysinfo.metrics.disk_used_pct ?? 0, 85, 95) }"
            ></div>
          </div>
          <div class="sysinfo-gauge-detail">{{ sysinfo.metrics.disk_used_pct != null ? (100 - sysinfo.metrics.disk_used_pct) + '% вільно' : 'н/д' }}</div>
        </div>

        <!-- ML assessment -->
        <div class="sysinfo-ml" v-if="sysinfo.health">
          <div class="sysinfo-ml-row">
            <span class="sysinfo-ml-lbl">Аномалія</span>
            <span :style="{ color: anomalyColor(sysinfo.health.anomaly_score), fontWeight: '700' }">
              {{ (sysinfo.health.anomaly_score * 100).toFixed(0) }}%
            </span>
          </div>
          <div class="sysinfo-ml-row" v-if="sysinfo.health.rul_hours != null">
            <span class="sysinfo-ml-lbl">RUL</span>
            <span :style="{ color: rulColor(sysinfo.health.rul_hours), fontWeight: '700' }">
              {{ Math.round(sysinfo.health.rul_hours) }} год
            </span>
          </div>
          <div class="sysinfo-ml-row" v-if="sysinfo.health.predicted_mode">
            <span class="sysinfo-ml-lbl">Прогноз</span>
            <code style="font-size: 11px;">{{ sysinfo.health.predicted_mode }}</code>
          </div>
          <div v-if="sysinfo.health.rul_hours == null && !sysinfo.health.predicted_mode" style="font-size: 11px; color: var(--color-text-muted);">
            ML-оцінка накопичується (~5 хв)
          </div>
        </div>
        <div class="sysinfo-ml" v-else>
          <div style="font-size: 11px; color: var(--color-text-muted); padding-top: 4px;">ML-оцінка накопичується (~5 хв)</div>
        </div>

      </div>
    </div>

    <template v-if="!loading || units.length">

      <!-- Row 1: fleet score + status counts + category breakdown -->
      <div class="analysis-grid-top">

        <!-- Fleet Health Score -->
        <div class="card analysis-score-card">
          <div class="card-title">Загальне здоров'я флоту</div>
          <div class="score-ring-wrap">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" stroke-width="12"/>
              <circle
                cx="60" cy="60" r="50" fill="none"
                :stroke="fleetScoreColor"
                stroke-width="12"
                stroke-linecap="round"
                :stroke-dasharray="`${fleetScore * 3.14159} 314.159`"
                transform="rotate(-90 60 60)"
                style="transition: stroke-dasharray 0.6s ease;"
              />
              <text x="60" y="56" text-anchor="middle" font-size="22" font-weight="700" :fill="fleetScoreColor">
                {{ Math.round(fleetScore) }}
              </text>
              <text x="60" y="72" text-anchor="middle" font-size="10" fill="#94a3b8">з 100</text>
            </svg>
          </div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 8px; text-align: center;">
            {{ fleetScoreLabel }}
          </div>
        </div>

        <!-- Status counts -->
        <div class="card">
          <div class="card-title">Статус флоту</div>
          <div class="status-bars">
            <div v-for="s in statusStats" :key="s.key" class="status-bar-row">
              <span class="status-bar-label">{{ s.label }}</span>
              <div class="status-bar-track">
                <div class="status-bar-fill" :style="{ width: getBarPct(s.count) + '%', background: s.color }"></div>
              </div>
              <span class="status-bar-count" :style="{ color: s.color }">{{ s.count }}</span>
            </div>
          </div>
          <div style="margin-top: 16px; font-size: 12px; color: var(--color-text-muted);">
            Всього вузлів: <strong>{{ units.length }}</strong>
          </div>
        </div>

        <!-- By category -->
        <div class="card">
          <div class="card-title">За категорією</div>
          <table class="analysis-table">
            <thead>
              <tr>
                <th>Категорія</th>
                <th>Вузлів</th>
                <th>Серед. аномалія</th>
                <th>Ризик/Крит</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in categoryStats" :key="cat.category">
                <td><span class="cat-badge">{{ catLabel(cat.category) }}</span></td>
                <td>{{ cat.count }}</td>
                <td>
                  <span :style="{ color: anomalyColor(cat.avgAnomaly), fontWeight: '600' }">
                    {{ (cat.avgAnomaly * 100).toFixed(0) }}%
                  </span>
                </td>
                <td>
                  <span v-if="cat.atRisk > 0" :style="{ color: '#f59e0b', fontWeight: '600' }">{{ cat.atRisk }}</span>
                  <span v-else style="color: var(--color-text-muted);">0</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Row 2: anomaly ranking + RUL distribution -->
      <div class="analysis-grid-mid">

        <!-- Anomaly ranking -->
        <div class="card">
          <div class="card-title">Рейтинг аномальності вузлів</div>
          <div class="anomaly-list">
            <div v-for="u in anomalySorted" :key="u.id" class="anomaly-row">
              <RouterLink :to="`/units/${u.id}`" class="anomaly-serial">{{ u.serial_no }}</RouterLink>
              <span class="anomaly-model">{{ u.model_code }}</span>
              <div class="anomaly-bar-track">
                <div
                  class="anomaly-bar-fill"
                  :style="{ width: (u.anomaly_score * 100) + '%', background: anomalyColor(u.anomaly_score) }"
                ></div>
              </div>
              <span class="anomaly-score" :style="{ color: anomalyColor(u.anomaly_score) }">
                {{ (u.anomaly_score * 100).toFixed(0) }}%
              </span>
              <StatusBadge :status="u.status" size="sm" />
            </div>
          </div>
        </div>

        <!-- RUL Distribution -->
        <div class="card">
          <div class="card-title">Розподіл залишкового ресурсу (RUL)</div>
          <div class="rul-buckets">
            <div v-for="b in rulBuckets" :key="b.label" class="rul-bucket">
              <div class="rul-bucket-bar-wrap">
                <div
                  class="rul-bucket-bar"
                  :style="{ height: bucketBarHeight(b.count) + 'px', background: b.color }"
                ></div>
              </div>
              <div class="rul-bucket-label">{{ b.label }}</div>
              <div class="rul-bucket-count" :style="{ color: b.color }">{{ b.count }}</div>
            </div>
          </div>
          <div style="margin-top: 12px; font-size: 12px; color: var(--color-text-muted);">
            Середній RUL: <strong>{{ avgRulLabel }}</strong>
          </div>
        </div>
      </div>

      <!-- Row 3: predicted modes + recent critical events -->
      <div class="analysis-grid-bot">

        <!-- Predicted failure modes -->
        <div class="card">
          <div class="card-title">Прогнозовані режими відмов</div>
          <div v-if="predictedModes.length === 0" style="font-size: 13px; color: var(--color-text-muted); padding: 12px 0;">
            Активних прогнозів немає — всі вузли в нормі
          </div>
          <table v-else class="analysis-table">
            <thead>
              <tr>
                <th>Вузол</th>
                <th>Режим відмови</th>
                <th>Впевненість</th>
                <th>Аномалія</th>
                <th>RUL, год</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in predictedModes" :key="u.id">
                <td>
                  <RouterLink :to="`/units/${u.id}`" style="font-weight: 500;">{{ u.serial_no }}</RouterLink>
                </td>
                <td><code style="font-size: 12px;">{{ u.predicted_mode }}</code></td>
                <td>
                  {{ u.predicted_mode_conf != null ? (u.predicted_mode_conf * 100).toFixed(0) + '%' : '—' }}
                </td>
                <td :style="{ color: anomalyColor(u.anomaly_score), fontWeight: '600' }">
                  {{ (u.anomaly_score * 100).toFixed(0) }}%
                </td>
                <td :style="{ color: rulColor(u.rul_hours), fontWeight: '600' }">
                  {{ u.rul_hours != null ? Math.round(u.rul_hours) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Recent critical events -->
        <div class="card">
          <div class="card-title">Останні критичні події (48 год)</div>
          <div v-if="criticalEvents.length === 0" style="font-size: 13px; color: var(--color-text-muted); padding: 12px 0;">
            Критичних подій не зафіксовано
          </div>
          <div v-else class="event-feed">
            <div v-for="ev in criticalEvents" :key="ev.id" class="event-feed-row" :class="ev.severity">
              <div class="event-feed-dot" :class="ev.severity"></div>
              <div class="event-feed-body">
                <div class="event-feed-msg">{{ ev.message }}</div>
                <div class="event-feed-meta">
                  <RouterLink v-if="ev.unit_id" :to="`/units/${ev.unit_id}`" style="font-size: 11px;">
                    {{ getUnitSerial(ev.unit_id) }}
                  </RouterLink>
                  <span style="font-size: 11px; color: var(--color-text-muted);">{{ formatDateTime(ev.ts) }}</span>
                </div>
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
import StatusBadge from '../components/StatusBadge.vue'
import { unitsApi, eventsApi, sysApi } from '../api/index.js'

const units = ref([])
const events = ref([])
const sysinfo = ref(null)
const loading = ref(false)
const lastRefreshLabel = ref('—')
let interval = null
let sysInterval = null

// ── Data loading ─────────────────────────────────────────────

async function loadSysinfo() {
  try {
    sysinfo.value = await sysApi.info()
  } catch {
    // silently keep last known value
  }
}

async function load() {
  loading.value = true
  try {
    const [u, ev] = await Promise.all([
      unitsApi.list(),
      eventsApi.list({ limit: 100, severity: 'critical' }),
    ])
    units.value = Array.isArray(u) ? u : []
    events.value = Array.isArray(ev) ? ev : (ev?.items ?? [])
    lastRefreshLabel.value = 'Оновлено: ' + new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date())
  } finally {
    loading.value = false
  }
}

// ── Fleet health score ────────────────────────────────────────

const fleetScore = computed(() => {
  if (!units.value.length) return 0
  const sum = units.value.reduce((acc, u) => acc + (1 - (u.anomaly_score ?? 0)), 0)
  return (sum / units.value.length) * 100
})

const fleetScoreColor = computed(() => {
  const s = fleetScore.value
  if (s >= 75) return '#16a34a'
  if (s >= 50) return '#f59e0b'
  return '#dc2626'
})

const fleetScoreLabel = computed(() => {
  const s = fleetScore.value
  if (s >= 85) return 'Відмінний стан'
  if (s >= 70) return 'Задовільний стан'
  if (s >= 50) return 'Потребує уваги'
  return 'Критичний стан'
})

// ── Status stats ──────────────────────────────────────────────

const statusStats = computed(() => {
  const counts = { ok: 0, risk: 0, imminent: 0 }
  units.value.forEach(u => { if (counts[u.status] != null) counts[u.status]++ })
  return [
    { key: 'ok', label: 'Норма', count: counts.ok, color: '#16a34a' },
    { key: 'risk', label: 'Ризик', count: counts.risk, color: '#f59e0b' },
    { key: 'imminent', label: 'Критично', count: counts.imminent, color: '#dc2626' },
  ]
})

function getBarPct(count) {
  const total = units.value.length || 1
  return Math.round((count / total) * 100)
}

// ── Category stats ────────────────────────────────────────────

const categoryStats = computed(() => {
  const map = {}
  units.value.forEach(u => {
    const cat = u.category || 'unknown'
    if (!map[cat]) map[cat] = { category: cat, count: 0, totalAnomaly: 0, atRisk: 0 }
    map[cat].count++
    map[cat].totalAnomaly += u.anomaly_score ?? 0
    if (u.status === 'risk' || u.status === 'imminent') map[cat].atRisk++
  })
  return Object.values(map)
    .map(c => ({ ...c, avgAnomaly: c.count ? c.totalAnomaly / c.count : 0 }))
    .sort((a, b) => b.avgAnomaly - a.avgAnomaly)
})

function catLabel(cat) {
  return { compute: 'Обчислення', rotary: 'Обертові', cryo: 'Кріогенні', experimental: 'Експеримент.' }[cat] ?? cat
}

// ── Anomaly ranking ───────────────────────────────────────────

const anomalySorted = computed(() =>
  [...units.value].sort((a, b) => (b.anomaly_score ?? 0) - (a.anomaly_score ?? 0))
)

// ── RUL distribution buckets ──────────────────────────────────

const rulBuckets = computed(() => {
  const buckets = [
    { label: '< 72 год', min: 0, max: 72, color: '#dc2626', count: 0 },
    { label: '72–168 год', min: 72, max: 168, color: '#f59e0b', count: 0 },
    { label: '168–720 год', min: 168, max: 720, color: '#3b82f6', count: 0 },
    { label: '> 720 год', min: 720, max: Infinity, color: '#16a34a', count: 0 },
    { label: 'Невідомо', min: null, max: null, color: '#94a3b8', count: 0 },
  ]
  units.value.forEach(u => {
    const rul = u.rul_hours
    if (rul == null) { buckets[4].count++; return }
    const b = buckets.find(b => b.min != null && rul >= b.min && rul < b.max)
    if (b) b.count++
  })
  return buckets
})

const maxBucketCount = computed(() => Math.max(...rulBuckets.value.map(b => b.count), 1))

function bucketBarHeight(count) {
  return Math.round((count / maxBucketCount.value) * 80) + 4
}

const avgRulLabel = computed(() => {
  const vals = units.value.map(u => u.rul_hours).filter(v => v != null)
  if (!vals.length) return '—'
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (avg > 8760) return `${(avg / 8760).toFixed(1)} р.`
  if (avg > 720) return `${(avg / 720).toFixed(1)} міс.`
  return `${Math.round(avg)} год`
})

// ── Predicted modes ───────────────────────────────────────────

const predictedModes = computed(() =>
  units.value
    .filter(u => u.predicted_mode)
    .sort((a, b) => (a.rul_hours ?? Infinity) - (b.rul_hours ?? Infinity))
)

// ── Critical events ───────────────────────────────────────────

const cutoff = computed(() => new Date(Date.now() - 48 * 3600 * 1000).toISOString())

const criticalEvents = computed(() =>
  events.value
    .filter(ev => ev.ts >= cutoff.value)
    .slice(0, 20)
)

function getUnitSerial(unit_id) {
  return units.value.find(u => u.id === unit_id)?.serial_no ?? String(unit_id)
}

// ── Helpers ───────────────────────────────────────────────────

function anomalyColor(score) {
  if (score == null || score < 0.3) return '#16a34a'
  if (score < 0.7) return '#f59e0b'
  return '#dc2626'
}

function rulColor(h) {
  if (h == null) return 'var(--color-text-muted)'
  if (h > 168) return '#16a34a'
  if (h > 72) return '#f59e0b'
  return '#dc2626'
}

function gaugeColor(pct, warnAt, critAt) {
  if (pct >= critAt) return 'var(--color-imminent)'
  if (pct >= warnAt) return 'var(--color-risk)'
  return 'var(--color-ok)'
}

function formatDateTime(ts) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(ts))
}

// ── Lifecycle ─────────────────────────────────────────────────

onMounted(() => {
  load()
  loadSysinfo()
  interval = setInterval(load, 30000)
  sysInterval = setInterval(loadSysinfo, 5000)
})
onUnmounted(() => {
  clearInterval(interval)
  clearInterval(sysInterval)
})
</script>

<style scoped>
/* Top row */
.analysis-grid-top {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.analysis-score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score-ring-wrap {
  margin-top: 12px;
}

/* Mid row */
.analysis-grid-mid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  margin-bottom: 16px;
}

/* Bot row */
.analysis-grid-bot {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
}

/* Status bars */
.status-bars { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.status-bar-row { display: flex; align-items: center; gap: 10px; }
.status-bar-label { width: 70px; font-size: 13px; color: var(--color-text-muted); }
.status-bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.status-bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
.status-bar-count { width: 28px; font-size: 14px; font-weight: 700; text-align: right; }

/* Analysis tables */
.analysis-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
.analysis-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--color-text-muted); padding: 0 8px 8px 0; border-bottom: 1px solid var(--color-border); }
.analysis-table td { padding: 7px 8px 7px 0; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.analysis-table tr:last-child td { border-bottom: none; }

/* Category badge */
.cat-badge { font-size: 11px; padding: 2px 7px; background: #f1f5f9; border-radius: 10px; }

/* Anomaly ranking */
.anomaly-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.anomaly-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.anomaly-serial { font-weight: 600; width: 80px; flex-shrink: 0; }
.anomaly-model { font-size: 11px; color: var(--color-text-muted); width: 110px; flex-shrink: 0; font-family: monospace; }
.anomaly-bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.anomaly-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
.anomaly-score { width: 36px; text-align: right; font-weight: 600; font-size: 12px; }

/* RUL buckets */
.rul-buckets { display: flex; gap: 12px; align-items: flex-end; justify-content: center; height: 120px; margin-top: 16px; }
.rul-bucket { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.rul-bucket-bar-wrap { flex: 1; display: flex; align-items: flex-end; width: 100%; }
.rul-bucket-bar { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.4s ease; min-height: 4px; }
.rul-bucket-label { font-size: 10px; color: var(--color-text-muted); text-align: center; line-height: 1.3; }
.rul-bucket-count { font-size: 13px; font-weight: 700; }

/* Event feed */
.event-feed { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.event-feed-row { display: flex; gap: 10px; align-items: flex-start; }
.event-feed-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
.event-feed-dot.critical { background: #dc2626; }
.event-feed-dot.warning { background: #f59e0b; }
.event-feed-dot.info { background: #3b82f6; }
.event-feed-body { flex: 1; }
.event-feed-msg { font-size: 13px; }
.event-feed-meta { display: flex; gap: 12px; margin-top: 2px; }

/* Sysinfo card */
.sysinfo-card { margin-bottom: 16px; }
.sysinfo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.sysinfo-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; font-family: var(--font-mono, monospace); color: var(--color-text-muted); }
.sysinfo-loading { font-size: 13px; color: var(--color-text-muted); padding: 8px 0; }
.sysinfo-gauges { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 24px; align-items: start; }
.sysinfo-gauge { display: flex; flex-direction: column; gap: 6px; }
.sysinfo-gauge-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
.sysinfo-gauge-value { font-size: 20px; font-weight: 700; font-family: var(--font-mono, monospace); letter-spacing: normal; text-transform: none; }
.sysinfo-gauge-track { height: 8px; background: var(--color-border, #e2e8f0); border-radius: 2px; overflow: hidden; }
.sysinfo-gauge-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.sysinfo-gauge-detail { font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono, monospace); }
.sysinfo-ml { display: flex; flex-direction: column; gap: 8px; padding-left: 24px; border-left: 1px solid var(--color-border, #e2e8f0); min-width: 160px; }
.sysinfo-ml-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; }
.sysinfo-ml-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
</style>
