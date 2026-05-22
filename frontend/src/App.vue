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
        <RouterLink to="/settings" class="nav-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
          </svg>
          Налаштування
        </RouterLink>
      </nav>
    </aside>

    <main class="app-main">
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
            <div style="font-size: 13px; font-weight: 500;">{{ notifTypeLabel(n.type) }}</div>
            <div style="font-size: 13px; color: var(--color-text-muted); margin-top: 2px;">{{ n.message }}</div>
          </div>
          <button class="notification-close" @click="notificationsStore.remove(n.id)">x</button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useNotificationsStore } from './stores/notifications.js'

const notificationsStore = useNotificationsStore()

function notifTypeLabel(type) {
  const map = {
    success: 'Успішно',
    error: 'Помилка',
    warning: 'Попередження',
    info: 'Інформація'
  }
  return map[type] ?? type
}
</script>

<style scoped>
.notif-enter-active, .notif-leave-active {
  transition: all 0.2s ease;
}
.notif-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.notif-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
