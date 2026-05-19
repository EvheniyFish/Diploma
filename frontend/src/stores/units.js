import { defineStore } from 'pinia'
import { unitsApi, forecastApi } from '../api/index.js'
import { useNotificationsStore } from './notifications.js'

export const useUnitsStore = defineStore('units', {
  state: () => ({
    units: [],
    summary: null,
    currentUnit: null,
    loading: false,
    error: null
  }),
  actions: {
    async fetchUnits(params) {
      this.loading = true
      this.error = null
      try {
        this.units = await unitsApi.list(params)
      } catch (e) {
        this.error = e.message
        useNotificationsStore().add('error', 'Помилка завантаження обладнання: ' + e.message)
      } finally {
        this.loading = false
      }
    },
    async fetchUnit(id) {
      this.loading = true
      this.error = null
      try {
        this.currentUnit = await unitsApi.get(id)
      } catch (e) {
        this.error = e.message
        useNotificationsStore().add('error', 'Помилка завантаження вузла: ' + e.message)
      } finally {
        this.loading = false
      }
    },
    async fetchSummary() {
      try {
        this.summary = await forecastApi.summary()
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка завантаження зведення: ' + e.message)
      }
    },
    async createUnit(body) {
      try {
        const unit = await unitsApi.create(body)
        useNotificationsStore().add('success', 'Вузол успішно додано')
        return unit
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка створення вузла: ' + e.message)
        throw e
      }
    },
    async updateUnit(id, body) {
      try {
        const unit = await unitsApi.update(id, body)
        useNotificationsStore().add('success', 'Вузол оновлено')
        return unit
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка оновлення: ' + e.message)
        throw e
      }
    },
    async deleteUnit(id) {
      try {
        await unitsApi.remove(id)
        this.units = this.units.filter(u => u.id !== id)
        useNotificationsStore().add('success', 'Вузол видалено')
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка видалення: ' + e.message)
        throw e
      }
    }
  }
})
