import { apiFetch } from '@/services/api'

export async function fetchSerials(params = {}, token) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const response = await apiFetch(`/admin/product-serials?${query.toString()}`, { token })
  return response?.data ?? { items: [], pagination: {} }
}

export async function receiveSerials(payload, token) {
  const response = await apiFetch('/admin/product-serials', { method: 'POST', body: payload, token })
  return response?.data ?? {}
}

export async function fetchSerialSummary(token) {
  const response = await apiFetch('/admin/product-serials/summary', { token })
  return response?.data ?? { by_status: {}, total: 0, available: 0, warranty_expiring_soon: 0 }
}

export async function lookupSerial(serialNumber, token) {
  const response = await apiFetch(`/admin/product-serials/lookup/${encodeURIComponent(serialNumber)}`, { token })
  return response?.data ?? null
}

export async function fetchSerial(serialId, token) {
  const response = await apiFetch(`/admin/product-serials/${serialId}`, { token })
  return response?.data ?? null
}

export async function fetchSerialHistory(serialId, token) {
  const response = await apiFetch(`/admin/product-serials/${serialId}/history`, { token })
  return response?.data ?? []
}

export async function updateSerial(serialId, payload, token) {
  const response = await apiFetch(`/admin/product-serials/${serialId}`, { method: 'PATCH', body: payload, token })
  return response?.data ?? null
}

export async function bulkUpdateStatus(serialIds, status, token) {
  const response = await apiFetch('/admin/product-serials/bulk-update-status', {
    method: 'POST',
    body: { serial_ids: serialIds, status },
    token,
  })
  return response?.data ?? {}
}

export async function setWarranty(serialId, days, token) {
  const response = await apiFetch(`/admin/product-serials/${serialId}/warranty`, {
    method: 'POST',
    body: { days },
    token,
  })
  return response?.data ?? null
}

export async function fetchWarrantyStats(token) {
  const response = await apiFetch('/admin/product-serials/warranty/stats', { token })
  return response?.data ?? {}
}

export async function validateWarranty(serialNumber, token) {
  const response = await apiFetch(`/admin/product-serials/warranty/validate/${encodeURIComponent(serialNumber)}`, { token })
  return response?.data ?? null
}

export async function exportSerials(params = {}, token) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const response = await apiFetch(`/admin/product-serials/export?${query.toString()}`, { token })
  return response?.data ?? { total: 0, data: [] }
}

export async function fetchMyProducts(token) {
  const response = await apiFetch('/my-products', { token })
  return response?.data ?? { items: [], pagination: {} }
}

export async function fetchMyProductSummary(token) {
  const response = await apiFetch('/my-products/summary', { token })
  return response?.data ?? { by_status: {}, by_warranty: {}, total: 0, active_warranty: 0 }
}

export async function fetchWarrantySummary(token) {
  const response = await apiFetch('/warranty/summary', { token })
  return response?.data ?? { total_products: 0, products_under_warranty: 0, expiring_soon: 0, expired_warranty: 0 }
}

export async function validateMyWarranty(serialNumber, token) {
  const response = await apiFetch(`/warranty/${encodeURIComponent(serialNumber)}`, { token })
  return response?.data ?? null
}
