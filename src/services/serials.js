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

export async function lookupSerial(serialNumber, token) {
  const response = await apiFetch(`/admin/product-serials/lookup/${encodeURIComponent(serialNumber)}`, { token })
  return response?.data ?? null
}

export async function fetchSerial(serialId, token) {
  const response = await apiFetch(`/admin/product-serials/${serialId}`, { token })
  return response?.data ?? null
}

export async function fetchMyProducts(token) {
  const response = await apiFetch('/my-products', { token })
  return response?.data ?? { data: [], items: [] }
}
