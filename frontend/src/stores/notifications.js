import { defineStore } from 'pinia'

let nextId = 1

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: []
  }),
  actions: {
    add(type, message) {
      const id = nextId++
      this.notifications.push({ id, type, message, ts: Date.now() })
      setTimeout(() => this.remove(id), 5000)
      return id
    },
    remove(id) {
      const idx = this.notifications.findIndex(n => n.id === id)
      if (idx !== -1) this.notifications.splice(idx, 1)
    }
  }
})
