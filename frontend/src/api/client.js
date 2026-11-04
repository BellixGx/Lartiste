import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Purchases
export const getPurchases      = (day = '')        => api.get(`/purchases/${day ? `?day=${day}` : ''}`).then(r => r.data)
export const createPurchase    = (data)            => api.post('/purchases/', data).then(r => r.data)
export const updatePurchase    = (id, data)        => api.put(`/purchases/${id}`, data).then(r => r.data)
export const togglePaid        = (id)              => api.patch(`/purchases/${id}/paid`).then(r => r.data)
export const deletePurchase    = (id)              => api.delete(`/purchases/${id}`).then(r => r.data)
export const getPurchaseActiveDates = (year, month) => api.get(`/purchases/active-dates?year=${year}&month=${month}`).then(r => r.data)
// Deliveries
export const getDeliveries     = (day = '')        => api.get(`/deliveries/${day ? `?day=${day}` : ''}`).then(r => r.data)
export const getClientsByDate  = (day)             => api.get(`/deliveries/clients-by-date?day=${day}`).then(r => r.data)
export const getActiveDates    = (year, month)     => api.get(`/deliveries/active-dates?year=${year}&month=${month}`).then(r => r.data)
export const createDelivery    = (data)            => api.post('/deliveries/', data).then(r => r.data)
export const updateDelivery = (id, data)           => api.put(`/deliveries/${id}`, data).then(r => r.data)
export const deleteDelivery    = (id)              => api.delete(`/deliveries/${id}`).then(r => r.data)

// Clients
export const getClients        = ()                => api.get('/clients/').then(r => r.data)
export const createClient      = (data)            => api.post('/clients/', data).then(r => r.data)
export const updateClient      = (id, data)        => api.put(`/clients/${id}`, data).then(r => r.data)
export const deleteClient      = (id)              => api.delete(`/clients/${id}`).then(r => r.data)

// Invoices
export const getInvoices       = ()                => api.get('/invoices/').then(r => r.data)
export const createInvoice     = (data)            => api.post('/invoices/', data).then(r => r.data)
export const deleteInvoice     = (id)              => api.delete(`/invoices/${id}`).then(r => r.data)
export const downloadPDF       = (id)              => window.open(`/api/invoices/${id}/pdf`, '_blank')

// Dashboard
export const getDashboard      = ()                => api.get('/dashboard/').then(r => r.data)

export const getClientsByRange  = (dateFrom, dateTo) => {
  const params = new URLSearchParams()
  if (dateFrom) params.append('date_from', dateFrom)
  if (dateTo)   params.append('date_to', dateTo)
  return axios.get(`/api/deliveries/clients-by-range?${params}`).then(r => r.data)
}
