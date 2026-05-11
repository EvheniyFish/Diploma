import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  timeout: 10000,
});

api.interceptors.response.use(
  (r) => r.data,
  (e) => Promise.reject(e.response?.data ?? e)
);

export const modelsApi = {
  list: () => api.get("/models"),
  get: (id) => api.get(`/models/${id}`),
  create: (body) => api.post("/models", body),
  update: (id, body) => api.put(`/models/${id}`, body),
  remove: (id) => api.delete(`/models/${id}`),
};

export const unitsApi = {
  list: (params) => api.get("/units", { params }),
  get: (id) => api.get(`/units/${id}`),
  create: (body) => api.post("/units", body),
  telemetry: (id, params) => api.get(`/units/${id}/telemetry`, { params }),
  forecast: (id) => api.get(`/units/${id}/forecast`),
  events: (id) => api.get(`/units/${id}/events`),
};

export const eventsApi = {
  list: (params) => api.get("/events", { params }),
  exportCsv: () => `${api.defaults.baseURL}/events/export.csv`,
};

export const forecastApi = {
  summary: () => api.get("/forecast/summary"),
};
