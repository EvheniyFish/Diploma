import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/units', name: 'units', component: () => import('../views/UnitsListView.vue') },
  { path: '/units/:id', name: 'unit-detail', component: () => import('../views/UnitDetailView.vue') },
  { path: '/models', name: 'models', component: () => import('../views/ModelsListView.vue') },
  { path: '/models/new', name: 'model-new', component: () => import('../views/ModelEditorView.vue') },
  { path: '/models/:id', name: 'model-edit', component: () => import('../views/ModelEditorView.vue') },
  { path: '/events', name: 'events', component: () => import('../views/EventsView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
]

export default createRouter({ history: createWebHistory(), routes })
