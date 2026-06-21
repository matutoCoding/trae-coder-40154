import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const costumeApi = {
  list: (params) => api.get('/costumes', { params }),
  get: (id) => api.get(`/costumes/${id}`),
  create: (data) => api.post('/costumes', data),
  update: (id, data) => api.put(`/costumes/${id}`, data),
  delete: (id) => api.delete(`/costumes/${id}`),
  categories: () => api.get('/costumes/categories/list')
};

export const batchApi = {
  list: (params) => api.get('/batches', { params }),
  get: (id) => api.get(`/batches/${id}`),
  create: (data) => api.post('/batches', data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  delete: (id) => api.delete(`/batches/${id}`),
  warning: (days) => api.get('/batches/warning', { params: { days } }),
  lock: (id) => api.post(`/batches/${id}/lock`),
  unlock: (id) => api.post(`/batches/${id}/unlock`),
  fifo: (costumeId, quantity) => api.get(`/batches/fifo/${costumeId}/${quantity}`)
};

export const troupeApi = {
  list: (params) => api.get('/troupes', { params }),
  get: (id) => api.get(`/troupes/${id}`),
  create: (data) => api.post('/troupes', data),
  update: (id, data) => api.put(`/troupes/${id}`, data),
  delete: (id) => api.delete(`/troupes/${id}`),
  cooperative: () => api.get('/troupes/cooperative')
};

export const scheduleApi = {
  list: (params) => api.get('/schedules', { params }),
  calendar: (params) => api.get('/schedules/calendar', { params }),
  get: (id) => api.get(`/schedules/${id}`),
  create: (data) => api.post('/schedules', data),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
  confirm: (id) => api.post(`/schedules/${id}/confirm`),
  cancel: (id) => api.post(`/schedules/${id}/cancel`),
  batchCreate: (data) => api.post('/schedules/batch-create', data)
};

export const cycleRuleApi = {
  list: (params) => api.get('/cycle-rules', { params }),
  get: (id) => api.get(`/cycle-rules/${id}`),
  create: (data) => api.post('/cycle-rules', data),
  update: (id, data) => api.put(`/cycle-rules/${id}`, data),
  delete: (id) => api.delete(`/cycle-rules/${id}`),
  generate: (id, data) => api.post(`/cycle-rules/${id}/generate`, data)
};

export const outboundApi = {
  list: (params) => api.get('/outbound', { params }),
  get: (id) => api.get(`/outbound/${id}`),
  getBySchedule: (scheduleId) => api.get(`/outbound/by-schedule/${scheduleId}`),
  bySchedule: (scheduleId, data) => api.post(`/outbound/by-schedule/${scheduleId}`, data),
  direct: (data) => api.post('/outbound/direct', data),
  previewFifo: (costumeId, quantity) => api.post(`/outbound/preview-fifo/${costumeId}/${quantity}`)
};

export const returnApi = {
  listReturns: (params) => api.get('/returns/returns', { params }),
  getReturn: (id) => api.get(`/returns/returns/${id}`),
  bySchedule: (scheduleId, data) => api.post(`/returns/returns/by-schedule/${scheduleId}`, data),
  
  listDamages: (params) => api.get('/returns/damages', { params }),
  getDamage: (id) => api.get(`/returns/damages/${id}`),
  updateDamage: (id, data) => api.put(`/returns/damages/${id}`, data),
  resolveDamage: (id, data) => api.post(`/returns/damages/${id}/resolve`, data)
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  warnings: () => api.get('/dashboard/warnings'),
  calendarData: (params) => api.get('/dashboard/calendar-data', { params })
};

export default api;
