import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config.url?.includes('/auth/login');
      if (!isLoginRequest && window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data) => api.post('/auth/change-password', data)
};

export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data)
};

export const leaveAPI = {
  create: (data, file) => {
    if (file) {
      const formData = new FormData();
      formData.append('leaveTypeId', data.leaveTypeId);
      formData.append('startDate', data.startDate);
      formData.append('endDate', data.endDate);
      formData.append('reason', data.reason);
      formData.append('document', file);
      return api.post('/leaves', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post('/leaves', data);
  },
  getAll: (params) => api.get('/leaves', { params }),
  getById: (id) => api.get(`/leaves/${id}`),
  getBalance: (userId) => api.get(`/leaves/balance/${userId || ''}`),
  supervisorAction: (id, data) => api.post(`/leaves/${id}/supervisor-action`, data),
  hrAction: (id, data) => api.post(`/leaves/${id}/hr-action`, data),
  ceoAction: (id, data) => api.post(`/leaves/${id}/ceo-action`, data),
  cancel: (id) => api.post(`/leaves/${id}/cancel`),
  update: (id, data) => api.put(`/leaves/${id}`, data),
  getTypes: () => api.get('/leaves/types/all'),
  createType: (data) => api.post('/leaves/types', data),
  updateType: (id, data) => api.put(`/leaves/types/${id}`, data),
  deleteType: (id) => api.delete(`/leaves/types/${id}`)
};

export const appraisalAPI = {
  create: (data) => api.post('/appraisals', data),
  getAll: (params) => api.get('/appraisals', { params }),
  getById: (id) => api.get(`/appraisals/${id}`),
  update: (id, data) => api.put(`/appraisals/${id}`, data),
  delete: (id) => api.delete(`/appraisals/${id}`),
  getCriteria: () => api.get('/appraisals/criteria')
};

export const performanceAppraisalAPI = {
  getPillars: () => api.get('/performance-appraisals/pillars'),
  getSoftSkills: () => api.get('/performance-appraisals/soft-skills'),
  getRatingKey: () => api.get('/performance-appraisals/rating-key'),
  create: (data) => api.post('/performance-appraisals', data),
  getAll: (params) => api.get('/performance-appraisals', { params }),
  getById: (id) => api.get(`/performance-appraisals/${id}`),
  update: (id, data) => api.put(`/performance-appraisals/${id}`, data),
  delete: (id) => api.delete(`/performance-appraisals/${id}`),
  createKRA: (data) => api.post('/performance-appraisals/kras', data),
  updateKRA: (id, data) => api.put(`/performance-appraisals/kras/${id}`, data),
  deleteKRA: (id) => api.delete(`/performance-appraisals/kras/${id}`)
};

export const departmentAPI = {
  getAll: (params) => api.get('/departments', { params }),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
  getRoles: () => api.get('/departments/roles')
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getLeaveAnalytics: (params) => api.get('/dashboard/analytics/leave', { params }),
  getAppraisalAnalytics: (params) => api.get('/dashboard/analytics/appraisal', { params }),
  getAuditLogs: (params) => api.get('/dashboard/audit-logs', { params })
};

export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getByKey: (key) => api.get(`/settings/${key}`),
  create: (data) => api.post('/settings', data),
  update: (key, data) => api.put(`/settings/${key}`, data),
  bulkUpdate: (data) => api.put('/settings/bulk', data),
  delete: (key) => api.delete(`/settings/${key}`)
};

export const messageAPI = {
  send: (data) => api.post('/messages', data),
  getInbox: (params) => api.get('/messages/inbox', { params }),
  getById: (id) => api.get(`/messages/${id}`),
  getUnreadCount: () => api.get('/messages/unread-count'),
  markAsRead: (id) => api.patch(`/messages/${id}/read`),
  delete: (id) => api.delete(`/messages/${id}`)
};

export const teamAPI = {
  getMyTeam: () => api.get('/team/my-team'),
  getDepartmentMembers: (departmentId) => api.get(`/team/department/${departmentId}/members`)
};

export default api;
