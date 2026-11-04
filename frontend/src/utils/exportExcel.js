// exportExcel.js
export function exportDeliveries() {
  window.open('/api/export/deliveries', '_blank')
}

export function exportPurchases(day = '') {
  window.open(day ? `/api/export/purchases?day=${day}` : `/api/export/purchases`, '_blank')
}

export function exportClients() {
  window.open('/api/export/clients', '_blank')
}

export function exportInvoices() {
  window.open('/api/export/invoices', '_blank')
}