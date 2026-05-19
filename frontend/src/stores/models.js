import { defineStore } from 'pinia'
import { modelsApi } from '../api/index.js'
import { useNotificationsStore } from './notifications.js'

export const useModelsStore = defineStore('models', {
  state: () => ({
    models: [],
    currentModel: null,
    loading: false
  }),
  actions: {
    async fetchModels() {
      this.loading = true
      try {
        this.models = await modelsApi.list()
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка завантаження моделей: ' + e.message)
      } finally {
        this.loading = false
      }
    },
    async fetchModel(id) {
      this.loading = true
      this.currentModel = null
      try {
        this.currentModel = await modelsApi.get(id)
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка завантаження моделі: ' + e.message)
      } finally {
        this.loading = false
      }
    },
    async createModel(body) {
      try {
        const model = await modelsApi.create(body)
        useNotificationsStore().add('success', 'Паспорт успішно створено')
        return model
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка створення паспорту: ' + e.message)
        throw e
      }
    },
    async updateModel(id, body) {
      try {
        const model = await modelsApi.update(id, body)
        useNotificationsStore().add('success', 'Паспорт оновлено')
        return model
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка оновлення паспорту: ' + e.message)
        throw e
      }
    },
    async deleteModel(id) {
      try {
        await modelsApi.remove(id)
        this.models = this.models.filter(m => m.id !== id)
        useNotificationsStore().add('success', 'Паспорт видалено')
      } catch (e) {
        useNotificationsStore().add('error', 'Помилка видалення: ' + e.message)
        throw e
      }
    }
  }
})
