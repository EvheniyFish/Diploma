<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Аналіз системи</h1>
      <div class="page-actions">
        <span style="font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono);">{{ lastRefreshLabel }}</span>
        <button class="time-range-btn active" @click="load" :disabled="loading" style="padding: 5px 14px;">
          Оновити
        </button>
      </div>
    </div>

    <PageIntro storage-key="analysis">
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </template>
      <p><strong>Аналіз системи</strong> — поглиблений погляд на весь парк обладнання одночасно. На відміну від панелі моніторингу, яка показує тільки поточний стан, тут є прогнози, тренди, сценарний аналіз і розподіл ризиків.</p>
      <p>
        Сторінка організована у блоки: <strong>Поточний сервер</strong> → <strong>Ситуаційний аналіз</strong> → <strong>Стан флоту</strong> → <strong>Вузли під загрозою</strong> → <strong>Рейтинг аномальності</strong> → <strong>Розподіл RUL</strong> → <strong>Критичні події</strong>.
        Кожен блок підписаний — читайте підказку під заголовком.
      </p>
      <p>Усі дані оновлюються автоматично кожні 5 секунд. Клік на серійний номер вузла відкриває його детальну сторінку.</p>
    </PageIntro>

    <!-- ══ 1. ПОТОЧНИЙ СЕРВЕР ══════════════════════════════════════ -->
    <div class="section-block">
      <div class="section-heading">
        <span class="section-title">Поточний сервер</span>
        <InfoTip>
          Реальні метрики машини, на якій запущено бекенд. Дані оновлюються кожні 5 секунд.
          Метрики також надходять у загальний ML-пайплайн — через 5–10 хвилин накопичення
          система розрахує оцінку аномальності та залишковий ресурс (RUL).
        </InfoTip>
      </div>
      <div class="section-desc">
        Навантаження на залізо в реальному часі — RAM, CPU, диск.
        Зелений — норма, помаранчевий — підвищене навантаження, червоний — критичний рівень.
      </div>

      <div class="card">
        <div v-if="!sysinfo" class="empty-state">
          <span class="empty-icon">...</span>
          <span>Зчитування метрик...</span>
        </div>
        <div v-else class="sysinfo-body">
          <div class="sysinfo-host">
            <span class="sysinfo-hostname">{{ sysinfo.metrics.hostname }}</span>
            <span class="sysinfo-spec">{{ sysinfo.metrics.cpu_count }}-ядерний CPU</span>
            <span class="sysinfo-spec">{{ mbToGb(sysinfo.metrics.ram_total_mb) }} RAM</span>
            <StatusBadge v-if="sysinfo.health" :status="sysinfo.health.status" size="sm" />
          </div>

          <div class="sysinfo-gauges">
            <div class="sysinfo-gauge">
              <div class="sysinfo-gauge-top">
                <span class="sysinfo-gauge-name">RAM</span>
                <span class="sysinfo-gauge-val" :style="{ color: gaugeColor(sysinfo.metrics.ram_used_pct, 85, 95) }">
                  {{ sysinfo.metrics.ram_used_pct }}%
                </span>
              </div>
              <div class="gauge-track">
                <div class="gauge-fill" :style="{ width: sysinfo.metrics.ram_used_pct + '%', background: gaugeColor(sysinfo.metrics.ram_used_pct, 85, 95) }"></div>
              </div>
              <div class="sysinfo-gauge-sub">{{ mbToGb(sysinfo.metrics.ram_total_mb - sysinfo.metrics.ram_free_mb) }} / {{ mbToGb(sysinfo.metrics.ram_total_mb) }} використано</div>
            </div>

            <div class="sysinfo-gauge">
              <div class="sysinfo-gauge-top">
                <span class="sysinfo-gauge-name">CPU</span>
                <span class="sysinfo-gauge-val" :style="{ color: gaugeColor(sysinfo.metrics.cpu_load_pct ?? 0, 80, 95) }">
                  {{ sysinfo.metrics.cpu_load_pct != null ? sysinfo.metrics.cpu_load_pct + '%' : '—' }}
                </span>
              </div>
              <div class="gauge-track">
                <div class="gauge-fill" :style="{ width: (sysinfo.metrics.cpu_load_pct ?? 0) + '%', background: gaugeColor(sysinfo.metrics.cpu_load_pct ?? 0, 80, 95) }"></div>
              </div>
              <div class="sysinfo-gauge-sub">Поточне завантаження ({{ sysinfo.metrics.cpu_count }} ядер)</div>
            </div>

            <div class="sysinfo-gauge">
              <div class="sysinfo-gauge-top">
                <span class="sysinfo-gauge-name">Диск</span>
                <span class="sysinfo-gauge-val" :style="{ color: gaugeColor(sysinfo.metrics.disk_used_pct ?? 0, 85, 95) }">
                  {{ sysinfo.metrics.disk_used_pct != null ? sysinfo.metrics.disk_used_pct + '%' : '—' }}
                </span>
              </div>
              <div class="gauge-track">
                <div class="gauge-fill" :style="{ width: (sysinfo.metrics.disk_used_pct ?? 0) + '%', background: gaugeColor(sysinfo.metrics.disk_used_pct ?? 0, 85, 95) }"></div>
              </div>
              <div class="sysinfo-gauge-sub">{{ sysinfo.metrics.disk_used_pct != null ? (100 - sysinfo.metrics.disk_used_pct) + '% вільно' : 'недоступно' }}</div>
            </div>

            <div class="sysinfo-ml-block">
              <div class="sysinfo-ml-title">ML-оцінка
                <InfoTip>
                  Розраховується автоматично кожні 5 хвилин на основі накопичених метрик.
                  При першому запуску потрібно зачекати ~10 хвилин.
                </InfoTip>
              </div>
              <template v-if="sysinfo.health && (sysinfo.health.anomaly_score > 0 || sysinfo.health.rul_hours != null)">
                <div class="ml-metric-row">
                  <span class="ml-metric-lbl">Аномалія</span>
                  <span class="ml-metric-val" :style="{ color: anomalyColor(sysinfo.health.anomaly_score) }">
                    {{ (sysinfo.health.anomaly_score * 100).toFixed(0) }}%
                  </span>
                </div>
                <div class="ml-metric-row" v-if="sysinfo.health.rul_hours != null">
                  <span class="ml-metric-lbl">RUL</span>
                  <span class="ml-metric-val" :style="{ color: rulColor(sysinfo.health.rul_hours) }">
                    {{ Math.round(sysinfo.health.rul_hours) }} год
                  </span>
                </div>
                <div class="ml-metric-row" v-if="sysinfo.health.predicted_mode">
                  <span class="ml-metric-lbl">Режим</span>
                  <code class="ml-metric-code">{{ sysinfo.health.predicted_mode }}</code>
                </div>
              </template>
              <div v-else class="ml-pending">накопичення даних...</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 2. СТАН ФЛОТУ ══════════════════════════════════════════ -->
    <div class="section-block">
      <div class="section-heading">
        <span class="section-title">Стан флоту</span>
        <InfoTip>
          Зведений знімок усього обладнання. Статус присвоюється автоматично
          на основі оцінки аномальності та RUL (залишкового ресурсу).
        </InfoTip>
      </div>
      <div class="section-desc">
        Скільки одиниць у кожному стані прямо зараз.
        Статус оновлюється кожні 5 хвилин планувальником ML.
      </div>

      <div v-if="loading && !units.length" class="empty-state">Завантаження...</div>
      <div v-else class="fleet-stat-row">
        <div class="fleet-stat-card fleet-stat-total">
          <div class="fleet-stat-num">{{ units.length }}</div>
          <div class="fleet-stat-lbl">Всього одиниць</div>
        </div>
        <div class="fleet-stat-card fleet-stat-ok">
          <div class="fleet-stat-num" style="color: var(--color-ok);">{{ statusCount('ok') }}</div>
          <div class="fleet-stat-lbl">OK — норма</div>
          <div class="fleet-stat-hint">Аномалія &lt; 30%, RUL &gt; 168 год</div>
        </div>
        <div class="fleet-stat-card fleet-stat-risk">
          <div class="fleet-stat-num" style="color: var(--color-risk);">{{ statusCount('risk') }}</div>
          <div class="fleet-stat-lbl">RISK — під наглядом</div>
          <div class="fleet-stat-hint">Аномалія 30–70% або RUL 72–168 год</div>
        </div>
        <div class="fleet-stat-card fleet-stat-imminent">
          <div class="fleet-stat-num" style="color: var(--color-imminent);">{{ statusCount('imminent') }}</div>
          <div class="fleet-stat-lbl">IMMINENT — критично</div>
          <div class="fleet-stat-hint">Аномалія &gt; 70% або RUL &lt; 72 год</div>
        </div>
        <div class="fleet-stat-card fleet-stat-score">
          <div class="fleet-stat-num" :style="{ color: fleetScoreColor }">{{ Math.round(fleetScore) }}<span style="font-size: 16px; font-weight: 400;">/100</span></div>
          <div class="fleet-stat-lbl">Здоров'я флоту</div>
          <div class="fleet-stat-hint">{{ fleetScoreLabel }}</div>
        </div>
      </div>
    </div>

    <!-- ══ СИТУАЦІЙНИЙ АНАЛІЗ ════════════════════════════════════ -->
    <div class="section-block" v-if="!loading || units.length">
      <div class="section-heading">
        <span class="section-title">Ситуаційний аналіз</span>
        <InfoTip>
          Автоматично сформований опис поточного стану флоту на основі реальних даних.
          Оновлюється при кожному завантаженні сторінки.
        </InfoTip>
      </div>
      <div class="section-desc">Що зараз відбувається в системі і що потрібно зробити.</div>
      <div class="scenario-list">
        <div
          v-for="(s, i) in scenarios"
          :key="i"
          class="scenario-item"
          :class="s.type"
        >
          <div class="scenario-icon">
            <!-- critical -->
            <svg v-if="s.type === 'critical'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <!-- warning -->
            <svg v-else-if="s.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <!-- ok -->
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="scenario-body">
            <div class="scenario-title">{{ s.title }}</div>
            <div class="scenario-desc">{{ s.desc }}</div>
            <div class="scenario-units" v-if="s.units && s.units.length">
              <RouterLink v-for="u in s.units" :key="u.id" :to="`/units/${u.id}`" class="scenario-unit-link">
                {{ u.serial_no }}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 3. ПОТРЕБУЄ УВАГИ ══════════════════════════════════════ -->
    <div class="section-block">
      <div class="section-heading">
        <span class="section-title">Потребує уваги</span>
        <InfoTip>
          Тільки ті одиниці, у яких статус RISK або IMMINENT.
          RISK — спостерігайте і плануйте ТО. IMMINENT — негайне втручання.
        </InfoTip>
      </div>
      <div class="section-desc">
        Одиниці обладнання з підвищеною аномальністю або низьким залишковим ресурсом.
        Натисніть на серійний номер, щоб побачити повну деталізацію та графіки телеметрії.
      </div>

      <div class="card">
        <div v-if="atRiskUnits.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;color:var(--color-ok);margin-bottom:8px;">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Всі одиниці в нормі — проблем не виявлено</span>
        </div>
        <div v-else>
          <div class="attention-header">
            <span>Серійний №</span>
            <span>Модель</span>
            <span>Статус</span>
            <span>
              Аномалія
              <InfoTip align="center">
                Відсоток відхилення від норми. 0–30% — норма.
                30–70% — підвищена, 70–100% — критична аномалія.
              </InfoTip>
            </span>
            <span>
              RUL, год
              <InfoTip align="center">
                Remaining Useful Life — розрахунковий залишок часу до відмови.
                Менше 72 год — критично, 72–168 год — під наглядом.
              </InfoTip>
            </span>
            <span>Прогноз відмови</span>
            <span></span>
          </div>
          <div v-for="u in atRiskUnits" :key="u.id" class="attention-row" :class="u.status">
            <span class="attention-serial">{{ u.serial_no }}</span>
            <span class="attention-model">{{ u.model_code }}</span>
            <StatusBadge :status="u.status" size="sm" />
            <span :style="{ color: anomalyColor(u.anomaly_score), fontWeight: '600', fontFamily: 'var(--font-mono)' }">
              {{ (u.anomaly_score * 100).toFixed(0) }}%
            </span>
            <span :style="{ color: rulColor(u.rul_hours), fontWeight: '600', fontFamily: 'var(--font-mono)' }">
              {{ u.rul_hours != null ? Math.round(u.rul_hours) : '—' }}
            </span>
            <span style="font-size: 12px;">
              <code v-if="u.predicted_mode" style="font-size: 11px; color: var(--color-risk);">{{ u.predicted_mode }}</code>
              <span v-else style="color: var(--color-text-faint);">—</span>
            </span>
            <RouterLink :to="`/units/${u.id}`" class="btn-detail">Деталі</RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 4. РЕЙТИНГ АНОМАЛЬНОСТІ ════════════════════════════════ -->
    <div class="section-block">
      <div class="section-heading">
        <span class="section-title">Рейтинг аномальності</span>
        <InfoTip>
          Усе обладнання, відсортоване від найбільш проблемного до найменш.
          Оцінка розраховується моделлю IsolationForest кожні 5 хвилин
          на основі останніх 6 годин телеметрії (360 точок на канал).
        </InfoTip>
      </div>
      <div class="section-desc">
        Чим вищий відсоток — тим сильніше поведінка відрізняється від нормальної.
        До 30% — зелений (норма), 30–70% — помаранчевий (спостереження), понад 70% — червоний (критично).
      </div>

      <div class="card">
        <div v-if="!units.length" class="empty-state">Немає даних</div>
        <div v-else class="anomaly-list">
          <div v-for="u in anomalySorted" :key="u.id" class="anomaly-row">
            <RouterLink :to="`/units/${u.id}`" class="anomaly-serial">{{ u.serial_no }}</RouterLink>
            <span class="anomaly-cat">{{ catLabel(u.category) }}</span>
            <div class="anomaly-bar-wrap">
              <div class="anomaly-bar-fill" :style="{ width: (u.anomaly_score * 100) + '%', background: anomalyColor(u.anomaly_score) }"></div>
            </div>
            <span class="anomaly-pct" :style="{ color: anomalyColor(u.anomaly_score) }">
              {{ (u.anomaly_score * 100).toFixed(0) }}%
            </span>
            <StatusBadge :status="u.status" size="sm" />
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 5. РОЗПОДІЛ ЗАЛИШКОВОГО РЕСУРСУ ════════════════════════ -->
    <div class="section-block">
      <div class="section-heading">
        <span class="section-title">Розподіл залишкового ресурсу (RUL)</span>
        <InfoTip align="left">
          RUL (Remaining Useful Life) — скільки годин залишилось до потенційної відмови.
          Розраховується регресором GradientBoosting з квантильними оцінками.
          Якщо ML ще не накопичив достатньо даних — показує «невідомо».
        </InfoTip>
      </div>
      <div class="section-desc">
        Скільки одиниць обладнання потрапляє в кожен діапазон залишкового ресурсу.
        Більшість у зеленій зоні — флот у хорошому стані.
      </div>

      <div class="card">
        <div v-if="noRulData" class="empty-state">
          <span>RUL ще не розраховано — ML-планувальник запуститься через 5 хвилин після накопичення телеметрії</span>
        </div>
        <div v-else class="rul-grid">
          <div v-for="b in rulBuckets" :key="b.label" class="rul-bucket">
            <div class="rul-bucket-bar-area">
              <div class="rul-bucket-bar" :style="{ height: bucketBarHeight(b.count) + 'px', background: b.color }"></div>
            </div>
            <div class="rul-bucket-count" :style="{ color: b.count > 0 ? b.color : 'var(--color-text-faint)' }">{{ b.count }}</div>
            <div class="rul-bucket-label">{{ b.label }}</div>
            <div class="rul-bucket-hint">{{ b.hint }}</div>
          </div>
        </div>
        <div v-if="!noRulData" class="rul-avg-row">
          Середній RUL по флоту: <strong>{{ avgRulLabel }}</strong>
        </div>
      </div>
    </div>

    <!-- ══ 6. КРИТИЧНІ ПОДІЇ ═══════════════════════════════════════ -->
    <div class="section-block">
      <div class="section-heading">
        <span class="section-title">Критичні події за 48 годин</span>
        <InfoTip align="left">
          Автоматично фіксуються при зміні статусу обладнання або виявленні нового
          режиму відмови. Також включають ручно додані події зі сторінки «Журнал подій».
        </InfoTip>
      </div>
      <div class="section-desc">
        Хронологія значущих подій: зміна статусу, виявлення аномалій, попередження.
        Повна історія — у розділі «Журнал подій».
      </div>

      <div class="card">
        <div v-if="recentCritical.length === 0" class="empty-state">
          Критичних подій за останні 48 годин не зафіксовано
        </div>
        <div v-else class="event-list">
          <div v-for="ev in recentCritical" :key="ev.id" class="event-row">
            <div class="event-dot" :class="ev.severity"></div>
            <div class="event-body">
              <div class="event-msg">{{ ev.message }}</div>
              <div class="event-meta">
                <RouterLink v-if="ev.unit_id" :to="`/units/${ev.unit_id}`">{{ getSerial(ev.unit_id) }}</RouterLink>
                <span>{{ formatDt(ev.ts) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '../components/StatusBadge.vue'
import InfoTip from '../components/InfoTip.vue'
import PageIntro from '../components/PageIntro.vue'
import { unitsApi, eventsApi, sysApi } from '../api/index.js'

const units = ref([])
const events = ref([])
const sysinfo = ref(null)
const loading = ref(false)
const lastRefreshLabel = ref('—')
let interval = null
let sysInterval = null

// ── Load ─────────────────────────────────────────────────────

async function loadSysinfo() {
  try { sysinfo.value = await sysApi.info() } catch {}
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
    lastRefreshLabel.value = 'оновлено ' + new Intl.DateTimeFormat('uk-UA', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date())
  } finally {
    loading.value = false
  }
}

// ── Fleet stats ───────────────────────────────────────────────

function statusCount(s) {
  return units.value.filter(u => u.status === s).length
}

const fleetScore = computed(() => {
  if (!units.value.length) return 0
  return units.value.reduce((acc, u) => acc + (1 - (u.anomaly_score ?? 0)), 0) / units.value.length * 100
})

const fleetScoreColor = computed(() => {
  const s = fleetScore.value
  return s >= 75 ? 'var(--color-ok)' : s >= 50 ? 'var(--color-risk)' : 'var(--color-imminent)'
})

const fleetScoreLabel = computed(() => {
  const s = fleetScore.value
  if (s >= 85) return 'Відмінний стан'
  if (s >= 70) return 'Задовільний стан'
  if (s >= 50) return 'Потребує уваги'
  return 'Критичний стан'
})

// ── Scenarios ─────────────────────────────────────────────────

function noun(n) { return n === 1 ? 'одиниця' : n < 5 ? 'одиниці' : 'одиниць' }

const scenarios = computed(() => {
  if (!units.value.length) return []
  const result = []
  const imm = units.value.filter(u => u.status === 'imminent')
  const risk = units.value.filter(u => u.status === 'risk')

  if (imm.length) {
    result.push({
      type: 'critical',
      title: `${imm.length} ${noun(imm.length)} в КРИТИЧНОМУ стані — потрібне негайне ТО`,
      desc: `Аномальність перевищила 70% або залишковий ресурс нижче 72 годин. Зупиніть навантаження або замініть несправний компонент.`,
      units: imm.slice(0, 5),
    })
  }

  const modeGroups = {}
  units.value.filter(u => u.predicted_mode).forEach(u => {
    if (!modeGroups[u.predicted_mode]) modeGroups[u.predicted_mode] = []
    modeGroups[u.predicted_mode].push(u)
  })
  for (const [mode, us] of Object.entries(modeGroups)) {
    result.push({
      type: us.some(u => u.status === 'imminent') ? 'critical' : 'warning',
      title: `Режим відмови «${mode}» виявлено на ${us.length} ${noun(us.length)}`,
      desc: modeFailDesc(mode),
      units: us.slice(0, 5),
    })
  }

  const lowRul = units.value.filter(u => u.rul_hours != null && u.rul_hours < 168)
    .sort((a, b) => a.rul_hours - b.rul_hours)
  if (lowRul.length) {
    const u = lowRul[0]
    result.push({
      type: 'warning',
      title: `Найнижчий RUL у флоті: ${u.serial_no} — ${Math.round(u.rul_hours)} год (~${(u.rul_hours / 24).toFixed(1)} доби)`,
      desc: `${u.rul_hours < 72 ? 'Критична ситуація — залишилось менше 3 діб.' : 'Рекомендується запланувати ТО протягом тижня.'} ${u.predicted_mode ? `Прогнозований режим: ${u.predicted_mode}.` : ''}`,
      units: [],
    })
  }

  const highAnomaly = units.value.filter(u => (u.anomaly_score ?? 0) >= 0.5 && u.status !== 'imminent')
  if (highAnomaly.length && !imm.length) {
    result.push({
      type: 'warning',
      title: `${highAnomaly.length} ${noun(highAnomaly.length)} з підвищеною аномальністю (≥ 50%)`,
      desc: 'Поведінка суттєво відхиляється від норми. Рекомендується збільшити частоту контролю і перевірити фізичний стан обладнання.',
      units: highAnomaly.slice(0, 4),
    })
  }

  if (!result.length) {
    result.push({
      type: 'ok',
      title: 'Флот у нормальному стані',
      desc: `Усі ${units.value.length} одиниць обладнання працюють у штатному режимі. Аномалій і критичних відхилень не виявлено. Планова ML-перевірка кожні 5 хвилин.`,
      units: [],
    })
  }

  return result
})

function modeFailDesc(mode) {
  const map = {
    bearing_wear:      'Знос підшипників — підвищена вібрація і температура. Перевірте мащення і баланс ротора.',
    imbalance:         'Дисбаланс ротора — характерна синусоїдальна вібрація на робочій частоті. Потрібне балансування.',
    cavitation:        'Кавітація насоса — нерівномірний потік, удари тиску. Перевірте вхідний тиск і засмічення.',
    winding_short:     'Міжвиткове замикання обмотки — нерівномірний струм фаз. Необхідна діагностика ізоляції.',
    thermal_runaway:   'Тепловий розгін — температура зростає швидше норми. Перевірте вентиляцію і охолодження.',
    fan_bearing_wear:  'Знос підшипника вентилятора — шум і вібрація. Плановий стандартний ремонт.',
    ssd_endurance:     'Вичерпання ресурсу SSD — підвищена кількість помилок. Підготуйте резервну копію і заміну диску.',
    psu_degradation:   'Деградація блоку живлення — нестабільна напруга. Замініть ДБЖ або вимірюйте напругу під навантаженням.',
    vacuum_breach:     'Порушення вакууму — тиск вище норми. Терміново перевірте ущільнення і клапани.',
    compressor_wear:   'Знос компресора — знижена продуктивність, зростання температури. Потрібне технічне обслуговування.',
    filter_clog:       'Засмічення фільтра — перепад тиску. Заміна або очищення фільтруючого елемента.',
    field_decoherence: 'Декогеренція поля — нестабільність квантових бітів. Перевірте екранування і температуру.',
    tachyon_overflow:  'Переповнення тахіонного потоку — нетипова сигнатура. Діагностичний режим.',
    containment_drift: 'Дрейф утримання — відхилення магнітного поля. Перекалібрування контролера.',
    memory_pressure:   'Перевантаження RAM — висока утилізація. Перевірте запущені процеси, звільніть пам\'ять.',
    cpu_overload:      'Перевантаження CPU — висока утилізація. Перевірте навантажені процеси.',
    disk_full:         'Диск заповнюється — місце закінчується. Очистіть або розширте сховище.',
  }
  return map[mode] ?? `Виявлено режим відмови «${mode}». Перевірте відповідні канали телеметрії.`
}

// ── At-risk units ─────────────────────────────────────────────

const atRiskUnits = computed(() =>
  units.value
    .filter(u => u.status === 'risk' || u.status === 'imminent')
    .sort((a, b) => {
      if (a.status === 'imminent' && b.status !== 'imminent') return -1
      if (b.status === 'imminent' && a.status !== 'imminent') return 1
      return (b.anomaly_score ?? 0) - (a.anomaly_score ?? 0)
    })
)

// ── Anomaly ranking ───────────────────────────────────────────

const anomalySorted = computed(() =>
  [...units.value].sort((a, b) => (b.anomaly_score ?? 0) - (a.anomaly_score ?? 0))
)

// ── RUL buckets ───────────────────────────────────────────────

const rulBuckets = computed(() => {
  const bs = [
    { label: '< 72 год', hint: 'Критично', min: 0, max: 72, color: 'var(--color-imminent)', count: 0 },
    { label: '72–168 год', hint: 'Під наглядом', min: 72, max: 168, color: 'var(--color-risk)', count: 0 },
    { label: '168–720 год', hint: 'Прийнятно', min: 168, max: 720, color: 'var(--color-primary)', count: 0 },
    { label: '> 720 год', hint: 'Норма', min: 720, max: Infinity, color: 'var(--color-ok)', count: 0 },
    { label: 'Невідомо', hint: 'ML не запущено', min: null, max: null, color: 'var(--color-text-faint)', count: 0 },
  ]
  units.value.forEach(u => {
    const h = u.rul_hours
    if (h == null) { bs[4].count++; return }
    const b = bs.find(b => b.min != null && h >= b.min && h < b.max)
    if (b) b.count++
  })
  return bs
})

const noRulData = computed(() =>
  units.value.length > 0 && units.value.every(u => u.rul_hours == null)
)

const maxBucketCount = computed(() => Math.max(...rulBuckets.value.map(b => b.count), 1))

function bucketBarHeight(count) {
  return count === 0 ? 2 : Math.max(4, Math.round((count / maxBucketCount.value) * 80))
}

const avgRulLabel = computed(() => {
  const vals = units.value.map(u => u.rul_hours).filter(v => v != null)
  if (!vals.length) return '—'
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (avg > 8760) return `${(avg / 8760).toFixed(1)} р.`
  if (avg > 720) return `${(avg / 720).toFixed(1)} міс.`
  return `${Math.round(avg)} год`
})

// ── Events ────────────────────────────────────────────────────

const cutoff = computed(() => new Date(Date.now() - 48 * 3600 * 1000).toISOString())

const recentCritical = computed(() =>
  events.value.filter(ev => ev.ts >= cutoff.value).slice(0, 25)
)

function getSerial(unit_id) {
  return units.value.find(u => u.id === unit_id)?.serial_no ?? `#${unit_id}`
}

// ── Helpers ───────────────────────────────────────────────────

function anomalyColor(score) {
  if (score == null || score < 0.3) return 'var(--color-ok)'
  if (score < 0.7) return 'var(--color-risk)'
  return 'var(--color-imminent)'
}

function rulColor(h) {
  if (h == null) return 'var(--color-text-muted)'
  if (h > 168) return 'var(--color-ok)'
  if (h > 72) return 'var(--color-risk)'
  return 'var(--color-imminent)'
}

function gaugeColor(pct, warnAt, critAt) {
  if (pct >= critAt) return 'var(--color-imminent)'
  if (pct >= warnAt) return 'var(--color-risk)'
  return 'var(--color-ok)'
}

function mbToGb(mb) {
  return mb >= 1024 ? (mb / 1024).toFixed(0) + ' GB' : mb + ' MB'
}

function catLabel(cat) {
  return { compute: 'Сервери', rotary: 'Обертові', cryo: 'Кріо', experimental: 'Експ.', server: 'Сервер' }[cat] ?? cat
}

function formatDt(ts) {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
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
/* Scenario list */
.scenario-list { display: flex; flex-direction: column; gap: 8px; }
.scenario-item {
  display: flex; gap: 14px; align-items: flex-start;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-bright);
  background: var(--color-surface);
  backdrop-filter: blur(8px);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.scenario-item.critical {
  border-color: var(--color-imminent-border);
  background: var(--color-imminent-bg);
  box-shadow: 0 0 18px var(--color-imminent-glow), inset 0 0 0 1px var(--color-imminent-border);
}
.scenario-item.warning {
  border-color: var(--color-risk-border);
  background: var(--color-risk-bg);
}
.scenario-item.ok {
  border-color: var(--color-ok-border);
  background: var(--color-ok-bg);
}
.scenario-icon {
  width: 22px; height: 22px; flex-shrink: 0; margin-top: 1px;
}
.scenario-item.critical .scenario-icon { color: var(--color-imminent); }
.scenario-item.warning  .scenario-icon { color: var(--color-risk); }
.scenario-item.ok       .scenario-icon { color: var(--color-ok); }
.scenario-icon svg { width: 100%; height: 100%; }
.scenario-body { flex: 1; }
.scenario-title {
  font-size: 13px; font-weight: 700; color: var(--color-text); margin-bottom: 4px;
}
.scenario-item.critical .scenario-title { color: var(--color-imminent); }
.scenario-item.warning  .scenario-title { color: var(--color-risk); }
.scenario-item.ok       .scenario-title { color: var(--color-ok); }
.scenario-desc { font-size: 12px; color: var(--color-text-muted); line-height: 1.65; }
.scenario-units { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.scenario-unit-link {
  font-size: 11px; font-family: var(--font-mono); font-weight: 600;
  padding: 2px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-bright);
  background: var(--color-surface-raised);
  color: var(--color-primary);
  transition: background 0.15s, color 0.15s;
}
.scenario-unit-link:hover { background: var(--color-primary-dim); color: var(--color-accent); }

/* Section blocks */
.section-block { margin-bottom: 28px; }

.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
  font-family: var(--font-mono);
}
.section-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 10px;
  line-height: 1.6;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 16px;
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
}

/* Sysinfo */
.sysinfo-body { display: flex; flex-direction: column; gap: 16px; }
.sysinfo-host {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}
.sysinfo-hostname {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-accent);
}
.sysinfo-spec {
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-surface-raised);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
}

.sysinfo-gauges {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 20px;
  align-items: start;
}
.sysinfo-gauge { display: flex; flex-direction: column; gap: 5px; }
.sysinfo-gauge-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.sysinfo-gauge-name {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-weight: 600;
}
.sysinfo-gauge-val {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
}
.gauge-track {
  height: 6px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}
.gauge-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.sysinfo-gauge-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.sysinfo-ml-block {
  padding-left: 20px;
  border-left: 1px solid var(--color-border-accent);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 150px;
}
.sysinfo-ml-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  font-weight: 600;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 6px;
}
.ml-metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.ml-metric-lbl { font-size: 11px; color: var(--color-text-muted); }
.ml-metric-val { font-size: 15px; font-weight: 700; font-family: var(--font-mono); }
.ml-metric-code { font-size: 10px; color: var(--color-risk); }
.ml-pending { font-size: 11px; color: var(--color-text-faint); font-style: italic; }

/* Fleet stats */
.fleet-stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.fleet-stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fleet-stat-card.fleet-stat-imminent { border-top: 2px solid var(--color-imminent); }
.fleet-stat-card.fleet-stat-risk { border-top: 2px solid var(--color-risk); }
.fleet-stat-card.fleet-stat-ok { border-top: 2px solid var(--color-ok); }
.fleet-stat-card.fleet-stat-score { border-top: 2px solid var(--color-primary); }
.fleet-stat-num {
  font-size: 32px;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
}
.fleet-stat-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-muted);
  margin-top: 4px;
}
.fleet-stat-hint {
  font-size: 10px;
  color: var(--color-text-faint);
  line-height: 1.4;
  margin-top: 2px;
}

/* Attention table */
.attention-header {
  display: grid;
  grid-template-columns: 120px 110px 90px 90px 90px 1fr 70px;
  gap: 8px;
  padding: 0 8px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-faint);
  border-bottom: 1px solid var(--color-border);
}
.attention-row {
  display: grid;
  grid-template-columns: 120px 110px 90px 90px 90px 1fr 70px;
  gap: 8px;
  padding: 10px 8px;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}
.attention-row:last-child { border-bottom: none; }
.attention-row:hover { background: var(--color-surface-raised); }
.attention-row.imminent { border-left: 2px solid var(--color-imminent); }
.attention-row.risk { border-left: 2px solid var(--color-risk); }
.attention-serial { font-weight: 600; font-family: var(--font-mono); font-size: 12px; }
.attention-model { font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono); }
.btn-detail {
  font-size: 11px;
  padding: 3px 10px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-accent);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  text-decoration: none;
  text-align: center;
  transition: background 0.15s;
}
.btn-detail:hover { background: var(--color-border-accent); color: var(--color-accent); }

/* Anomaly list */
.anomaly-list { display: flex; flex-direction: column; }
.anomaly-row {
  display: grid;
  grid-template-columns: 120px 90px 1fr 46px 70px;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}
.anomaly-row:last-child { border-bottom: none; }
.anomaly-row:hover { background: var(--color-surface-raised); }
.anomaly-serial { font-weight: 600; font-family: var(--font-mono); font-size: 12px; }
.anomaly-cat { font-size: 10px; color: var(--color-text-faint); text-transform: uppercase; letter-spacing: 0.06em; }
.anomaly-bar-wrap { height: 6px; background: var(--color-border); border-radius: 2px; overflow: hidden; }
.anomaly-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.anomaly-pct { font-weight: 700; font-family: var(--font-mono); font-size: 12px; text-align: right; }

/* RUL buckets */
.rul-grid {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  padding: 8px 0;
}
.rul-bucket { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.rul-bucket-bar-area { height: 80px; display: flex; align-items: flex-end; width: 100%; justify-content: center; }
.rul-bucket-bar { width: 80%; border-radius: 2px 2px 0 0; transition: height 0.4s ease; min-height: 2px; }
.rul-bucket-count { font-size: 16px; font-weight: 700; font-family: var(--font-mono); }
.rul-bucket-label { font-size: 11px; color: var(--color-text-muted); text-align: center; line-height: 1.4; }
.rul-bucket-hint { font-size: 10px; color: var(--color-text-faint); text-align: center; }
.rul-avg-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-muted);
}
.rul-avg-row strong { color: var(--color-text); }

/* Event list */
.event-list { display: flex; flex-direction: column; gap: 0; }
.event-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 8px;
  border-bottom: 1px solid var(--color-border);
}
.event-row:last-child { border-bottom: none; }
.event-dot {
  width: 8px; height: 8px; border-radius: 50%;
  margin-top: 4px; flex-shrink: 0;
}
.event-dot.critical { background: var(--color-imminent); box-shadow: 0 0 6px var(--color-imminent); }
.event-dot.warning { background: var(--color-risk); }
.event-dot.info { background: var(--color-primary); }
.event-body { flex: 1; }
.event-msg { font-size: 13px; }
.event-meta { display: flex; gap: 14px; margin-top: 3px; font-size: 11px; color: var(--color-text-muted); }
</style>
