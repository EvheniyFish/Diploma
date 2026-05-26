<template>
  <div class="app-layout">
    <aside class="app-sidebar">
      <div class="sidebar-logo">
        <h2>CASS</h2>
        <span>Прогностичне ТО</span>
      </div>
      <nav class="sidebar-nav">
        <RouterLink to="/" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Панель моніторингу
        </RouterLink>
        <RouterLink to="/units" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          Обладнання
          <span v-if="imminentCount > 0" class="nav-badge">{{ imminentCount }}</span>
        </RouterLink>
        <RouterLink to="/models" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          Моделі
        </RouterLink>
        <RouterLink to="/analysis" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Аналіз системи
        </RouterLink>
        <RouterLink to="/events" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
          </svg>
          Журнал подій
        </RouterLink>
        <RouterLink to="/help" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Довідка
        </RouterLink>
        <RouterLink to="/settings" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
          </svg>
          Налаштування
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="theme-toggle-btn" @click="toggleTheme">
          <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          {{ isDark ? 'Світла тема' : 'Темна тема' }}
        </button>
      </div>
    </aside>

    <main class="app-main">
      <!-- Global IMMINENT alert strip -->
      <div v-if="imminentUnits.length > 0 && !alertDismissed" class="imminent-strip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span class="imminent-strip-title">Критичний стан:</span>
        <div class="imminent-strip-links">
          <RouterLink
            v-for="u in imminentUnits.slice(0, 6)"
            :key="u.id"
            :to="`/units/${u.id}`"
            class="imminent-strip-link"
          >{{ u.serial_no }}</RouterLink>
          <span v-if="imminentUnits.length > 6" class="imminent-strip-more">
            +{{ imminentUnits.length - 6 }} ще
          </span>
        </div>
        <span class="imminent-strip-hint">Ці вузли вимагають негайного огляду</span>
        <button class="imminent-strip-close" @click="alertDismissed = true">×</button>
      </div>

      <div class="app-content">
        <RouterView />
      </div>
    </main>

    <div class="notifications-container">
      <transition-group name="notif">
        <div
          v-for="n in notificationsStore.notifications"
          :key="n.id"
          :class="['notification-item', n.type]"
        >
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 600; color: var(--color-text);">{{ notifTypeLabel(n.type) }}</div>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">{{ n.message }}</div>
          </div>
          <button class="notification-close" @click="notificationsStore.remove(n.id)">×</button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useNotificationsStore } from './stores/notifications.js'
import { unitsApi } from './api/index.js'

const notificationsStore = useNotificationsStore()
const isDark = ref(true)
const imminentUnits = ref([])
const imminentCount = ref(0)
const alertDismissed = ref(false)
let prevImminentIds = new Set()
let alertInterval = null

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
  localStorage.setItem('cass-theme', isDark.value ? 'dark' : 'light')
}

async function checkImminentUnits() {
  try {
    const data = await unitsApi.list({ status: 'imminent', limit: 100 })
    const units = Array.isArray(data) ? data : (data.items ?? [])
    const currentIds = new Set(units.map(u => u.id))

    // Detect newly IMMINENT units
    const newlyImminent = units.filter(u => !prevImminentIds.has(u.id))
    if (newlyImminent.length > 0 && prevImminentIds.size >= 0 && alertInterval !== null) {
      newlyImminent.forEach(u => {
        notificationsStore.add('error', `Критичний стан: ${u.serial_no} — ${u.display_name ?? u.model_code}`)
      })
      alertDismissed.value = false
    }

    prevImminentIds = currentIds
    imminentUnits.value = units
    imminentCount.value = units.length
  } catch { /* silent — backend may be down */ }
}

onMounted(async () => {
  const saved = localStorage.getItem('cass-theme') || 'dark'
  isDark.value = saved === 'dark'
  applyTheme(isDark.value)

  // Initial check, then every 30s
  await checkImminentUnits()
  alertInterval = setInterval(checkImminentUnits, 30000)
})

onUnmounted(() => clearInterval(alertInterval))

function notifTypeLabel(type) {
  const map = { success: 'Успішно', error: 'Помилка', warning: 'Попередження', info: 'Інформація' }
  return map[type] ?? type
}
</script>

<style scoped>
.notif-enter-active, .notif-leave-active { transition: all 0.2s ease; }
.notif-enter-from { opacity: 0; transform: translateX(100%); }
.notif-leave-to   { opacity: 0; transform: translateX(100%); }

/* Sidebar badge */
.nav-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-imminent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: pulse-badge 2s infinite;
}
@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* IMMINENT alert strip */
.imminent-strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 40px 9px 14px;
  background: rgba(244, 63, 94, 0.12);
  border-bottom: 1px solid rgba(244, 63, 94, 0.40);
  border-left: 3px solid var(--color-imminent);
  color: var(--color-imminent);
  font-size: 12px;
  font-weight: 600;
}
.imminent-strip-title {
  white-space: nowrap;
}
.imminent-strip-links {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.imminent-strip-link {
  padding: 2px 8px;
  border: 1px solid rgba(244, 63, 94, 0.5);
  border-radius: 3px;
  color: var(--color-imminent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.15s;
}
.imminent-strip-link:hover {
  background: rgba(244, 63, 94, 0.15);
}
.imminent-strip-more {
  font-size: 11px;
  color: var(--color-text-muted);
}
.imminent-strip-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-left: auto;
}
.imminent-strip-close {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-faint);
  cursor: pointer;
  padding: 0;
}
.imminent-strip-close:hover { color: var(--color-imminent); }
</style>
