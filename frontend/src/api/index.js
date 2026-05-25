import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 15000,
  headers: {
    'x-api-key': import.meta.env.VITE_ADMIN_KEY || 'dev-admin-key'
  }
})

api.interceptors.response.use(
  r => r.data,
  e => {
    const msg = e.response?.data?.detail || e.response?.data?.title || e.message
    return Promise.reject(new Error(msg))
  }
)

export default api

export const modelsApi = {
  list: () => api.get('/models'),
  get: (id) => api.get(`/models/${id}`),
  create: (body) => api.post('/models', body),
  update: (id, body) => api.put(`/models/${id}`, body),
  remove: (id) => api.delete(`/models/${id}`),
}

export const unitsApi = {
  list: (params) => api.get('/units', { params }),
  get: (id) => api.get(`/units/${id}`),
  create: (body) => api.post('/units', body),
  update: (id, body) => api.put(`/units/${id}`, body),
  remove: (id) => api.delete(`/units/${id}`),
  telemetry: (id, params) => api.get(`/units/${id}/telemetry`, { params }),
  forecast: (id) => api.get(`/units/${id}/forecast`),
  events: (id) => api.get(`/units/${id}/events`),
}

export const forecastApi = {
  summary: () => api.get('/forecast/summary'),
}

export const eventsApi = {
  list: (params) => api.get('/events', { params }),
  create: (body) => api.post('/events', body),
  exportUrl: (params) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString() : ''
    return `${base}/events/export.csv${qs}`
  },
}

export const simApi = {
  state: () => api.get('/sim/state'),
  injectFault: (body) => api.post('/sim/inject_fault', body),
  resetUnit: (body) => api.post('/sim/reset_unit', body),
  speed: (body) => api.post('/sim/speed', body),
}

export const sysApi = {
  info: () => api.get('/sysinfo'),
}
