import axios from 'axios';
import Cookies from 'js-cookie';

// LAN Support: if VITE_API_URL env var is set use it, otherwise
// derive from current browser hostname so clients auto-connect to server
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:8000/api/`;

const api = axios.create({ baseURL: API_BASE_URL });

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle 401 with refresh.
// The refresh token lives in an httpOnly cookie set by the backend, so the
// refresh call is credentialed and sends no token from JavaScript storage.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('token/') && !error.config?._retriedAfterRefresh) {
      error.config._retriedAfterRefresh = true;
      try {
        const res = await axios.post(
          `${API_BASE_URL}token/refresh/`,
          {},
          { withCredentials: true, headers: { 'X-Client-Type': 'web' } }
        );
        Cookies.set('access_token', res.data.access, { sameSite: 'lax' });
        error.config.headers.Authorization = `Bearer ${res.data.access}`;
        return api.request(error.config);
      } catch {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export const authAPI = {
  // Blacklists the refresh token on the server and clears its httpOnly cookie.
  logout: () => api.post('token/logout/', {}, { withCredentials: true, headers: { 'X-Client-Type': 'web' } }),
};

// ---- Customers ----
export const customersAPI = {
  list: (params = {}) => api.get('customers/', { params }),
  detail: (id) => api.get(`customers/${id}/`),
  create: (data) => api.post('customers/', data),
  update: (id, data) => api.put(`customers/${id}/`, data),
  patch: (id, data) => api.patch(`customers/${id}/`, data),
  delete: (id) => api.delete(`customers/${id}/`),
  invoices: (id) => api.get(`customers/${id}/invoices/`),
  searchByVehicle: (params) => api.get('customers/search_by_vehicle/', { params }),
};

// ---- Services ----
export const servicesAPI = {
  list: (params = {}) => api.get('services/', { params }),
  create: (data) => api.post('services/', data),
  update: (id, data) => api.put(`services/${id}/`, data),
  patch: (id, data) => api.patch(`services/${id}/`, data),
  delete: (id) => api.delete(`services/${id}/`),
};

// ---- Invoices ----
export const invoicesAPI = {
  list: (params = {}) => api.get('invoices/', { params }),
  detail: (id) => api.get(`invoices/${id}/`),
  create: (data) => api.post('invoices/', data),
  update: (id, data) => api.put(`invoices/${id}/`, data),
  patch: (id, data) => api.patch(`invoices/${id}/`, data),
  delete: (id) => api.delete(`invoices/${id}/`),
  markPaid: (id) => api.post(`invoices/${id}/mark_paid/`),
  markCommissionPaid: (id, commission_paid = true) => api.post(`invoices/${id}/mark_commission_paid/`, { commission_paid }),
  cancel: (id) => api.post(`invoices/${id}/cancel/`),
  changeStatus: (id, newStatus) => api.patch(`invoices/${id}/change_status/`, { status: newStatus }),
  overdue: () => api.get('invoices/overdue/'),
  report: (params = {}) => api.get('invoices/report/', { params }),
  stats: () => api.get('invoices/stats/'),
  filterOptions: () => api.get('invoices/filter_options/'),
  exportExcel: (params = {}) => api.get('invoices/export_excel/', { params, responseType: 'blob' }),
  exportCsv: (params = {}) => api.get('invoices/export_csv/', { params, responseType: 'blob' }),
  quickCreate: (data) => api.post('invoices/quick_create/', data),
  requestEdit: (id) => api.post(`invoices/${id}/request-edit/`),
  editRequests: () => api.get('invoices/edit-requests/'),
  reviewEditRequest: (invoiceId, requestId, decision) => api.post(`invoices/${invoiceId}/review-edit-request/`, { request_id: requestId, decision }),
  payments: (id) => api.get(`invoices/${id}/payments/`),
  addPayment: (id, data) => api.post(`invoices/${id}/payments/`, data),
  updatePayment: (invoiceId, paymentId, data) => api.patch(`invoices/${invoiceId}/payments/${paymentId}/`, data),
  deletePayment: (invoiceId, paymentId) => api.delete(`invoices/${invoiceId}/payments/${paymentId}/`),
  history: (id) => api.get(`invoices/${id}/history/`),
  restoreVersion: (id, auditId) => api.post(`invoices/${id}/restore-version/`, { audit_id: auditId }),
};

export const auditAPI = {
  list: (params = {}) => api.get('audit/', { params }),
};

// ---- Documents ----
export const documentsAPI = {
  list: (params = {}) => api.get('documents/', { params }),
  detail: (id) => api.get(`documents/${id}/`),
  create: (formData) => api.post('documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.patch(`documents/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`documents/${id}/`),
  customerFolderFiles: (customerId) => api.get(`documents/customer_folder_files/?customer=${customerId}`),
};


// ---- Dashboard ----
export const dashboardAPI = {
  stats: () => api.get('dashboard/stats/'),
  reminders: (days = 7) => api.get(`dashboard/reminders/?days=${days}`),
};

// ---- Business Profile / Branding ----
export const profileAPI = {
  get: () => api.get('profile/'),
  update: (formData) => api.patch('profile/update_profile/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const socialNetworksAPI = {
  create: (formData) => api.post('social-networks/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, formData) => api.patch(`social-networks/${id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`social-networks/${id}/`),
};

// ---- Expense Categories ----
export const expenseCategoriesAPI = {
  list: () => api.get('expense-categories/'),
  create: (data) => api.post('expense-categories/', data),
  update: (id, data) => api.put(`expense-categories/${id}/`, data),
  delete: (id) => api.delete(`expense-categories/${id}/`),
};

// ---- Expenses ----
export const expensesAPI = {
  list: (params = {}) => api.get('expenses/', { params }),
  create: (data) => api.post('expenses/', data),
  update: (id, data) => api.put(`expenses/${id}/`, data),
  delete: (id) => api.delete(`expenses/${id}/`),
  summary: (params = {}) => api.get('expenses/summary/', { params }),
};

// ---- Staff ----
export const staffAPI = {
  list: (params = {}) => api.get('staff/', { params }),
  create: (data) => api.post('staff/', data),
  update: (id, data) => api.put(`staff/${id}/`, data),
  delete: (id) => api.delete(`staff/${id}/`),
  performance: (id, params = {}) => api.get(`staff/${id}/performance/`, { params }),
};

// ---- Backup ----
export const backupAPI = {
  download: () => api.get('backup/download/', { responseType: 'blob' }),
  restore: (data) => api.post('backup/restore/', data),
};

// ---- Backup Config (scheduled & path-based) ----
export const backupConfigAPI = {
  get: () => api.get('backup-config/'),
  update: (data) => api.patch('backup-config/update_config/', data),
  browseFolders: (path = '') => api.get('backup-config/browse_folders/', { params: { path } }),
  runBackup: (data = {}) => api.post('backup-config/run_backup/', data),
  runBackupDownload: (data = {}) => api.post('backup-config/run_backup/', data, { responseType: 'blob' }),
  checkAuto: () => api.get('backup-config/check_auto/'),
};

export const invoiceSettingsAPI = {
  get: () => api.get('invoice-settings/'),
  update: (data) => api.patch('invoice-settings/update_config/', data),
};

export const welcomeAPI = {
  getConfig: () => api.get('welcome-settings/config/'),
  updateConfig: (data) => api.patch('welcome-settings/config/', data),
  users: () => api.get('welcome-settings/users/'),
  personal: () => api.get('welcome-settings/personal/'),
  savePersonal: (data) => api.post('welcome-settings/personal/', data),
  removePersonal: (user_id) => api.delete('welcome-settings/personal/', { data: { user_id } }),
  today: () => api.post('welcome-settings/today/'),
};

export const chatAPI = {
  list: (params = {}) => api.get('chat/', { params }),
  create: (formData) => api.post('chat/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  remove: (id) => api.delete(`chat/${id}/`),
  users: () => api.get('chat/users/'),
  unread: () => api.get('chat/unread/'),
  markRead: () => api.post('chat/mark_read/'),
  download: (id) => api.get(`chat/${id}/download/`, { responseType: 'blob' }),
};

export const chatSocketURL = () => {
  const apiURL = new URL(API_BASE_URL, window.location.href);
  apiURL.protocol = apiURL.protocol === 'https:' ? 'wss:' : 'ws:';
  apiURL.pathname = `${apiURL.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '')}/ws/chat/`;
  apiURL.search = '';
  return apiURL.toString();
};

export const chatSocketProtocols = () => {
  const access = Cookies.get('access_token');
  return access ? ['mohaseb-chat', access] : ['mohaseb-chat'];
};

// ---- Vehicle Types ----
export const vehicleTypesAPI = {
  list: () => api.get('vehicle-types/'),
  create: (data) => api.post('vehicle-types/', data),
  delete: (id) => api.delete(`vehicle-types/${id}/`),
};

// ---- User Management (admin only) ----
export const usersAPI = {
  list: () => api.get('users/'),
  me: () => api.get('users/me/'),
  create: (data) => api.post('users/', data),
  update: (id, data) => api.patch(`users/${id}/`, data),
  delete: (id) => api.delete(`users/${id}/`),
  setRole: (userId, role) => api.post('users/set_role/', { user_id: userId, role }),
};

// ---- Cheques ----
export const chequesAPI = {
  list: (params = {}) => api.get('cheques/', { params }),
  create: (data) => api.post('cheques/', data),
  update: (id, data) => api.put(`cheques/${id}/`, data),
  patch: (id, data) => api.patch(`cheques/${id}/`, data),
  delete: (id) => api.delete(`cheques/${id}/`),
};

export default api;
