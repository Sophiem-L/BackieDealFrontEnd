import { apiFetch } from '@/services/api'

export function deriveAvailability(item) {
  const stock = Number(item.stock_quantity ?? item.onHand ?? 0)
  if (stock <= 0) return 'out-of-stock'
  const threshold = Number(item.min_stock_alert ?? item.threshold ?? 0)
  if (threshold > 0 && stock <= threshold) return 'low-stock'
  return 'healthy'
}

export function formatStockDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const day = String(d.getDate()).padStart(2, '0')
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const month = months[d.getMonth()]
  const yr = String(d.getFullYear()).slice(-2)
  return `${day}/${month}/${yr}`
}

export function usableImage(value) {
  const url = String(value ?? '').trim()
  return /^(https?:\/\/|data:|blob:|\/)/.test(url) ? url : ''
}

export function stockFromApi(item) {
  return {
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    sku: item.sku,
    startDate: formatStockDate(item.created_at),
    lastUpdated: formatStockDate(item.updated_at),
    onHand: Number(item.stock_quantity ?? 0),
    threshold: Number(item.min_stock_alert ?? 0),
    availability: deriveAvailability(item),
    thumbnail: usableImage(item.thumbnail),
  }
}

export function stockDetailFromApi(data) {
  const movements = data.movements ?? []
  const recentLocation = movements.find(
    (m) => m.destination_location || m.source_location,
  )
  const location =
    recentLocation?.destination_location ||
    recentLocation?.source_location ||
    'Main Warehouse'

  return {
    id: data.id,
    uuid: data.uuid,
    name: data.name,
    sku: data.sku,
    category: data.category?.name ?? '—',
    location,
    startDate: formatStockDate(data.created_at),
    lastUpdated: formatStockDate(data.updated_at),
    onHand: Number(data.stock_quantity ?? 0),
    threshold: Number(data.min_stock_alert ?? 0),
    unitPrice: data.price,
    availability: deriveAvailability(data),
    thumbnail: usableImage(data.thumbnail),
  }
}

function formatMovementType(type) {
  const types = {
    adjust: 'Stock Adjustment',
    reconcile: 'Inventory Recount',
    stock_in: 'Supplier Delivery',
    stock_out: 'Stock Out',
    transfer: 'Location Transfer',
  }
  return types[type] || 'Stock Adjustment'
}

export function movementFromApi(m) {
  const changeVal = m.new_quantity - m.previous_quantity
  return {
    id: m.id,
    date: formatStockDate(m.created_at),
    type: m.reason || formatMovementType(m.movement_type),
    change:
      changeVal !== 0
        ? changeVal
        : m.movement_type === 'stock_out'
          ? -m.quantity
          : m.quantity,
    balance: m.new_quantity,
    by: m.created_by?.name ?? 'Admin User',
  }
}

export async function fetchStockList({ page = 1, per_page = 20, q, low_stock, stock_status, updated_from, updated_to, sort = 'id', direction = 'desc' } = {}, token) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(per_page),
    sort,
    direction,
  })
  if (q) params.set('q', q)
  if (low_stock) params.set('low_stock', '1')
  if (stock_status) params.set('stock_status', stock_status)
  if (updated_from) params.set('updated_from', updated_from)
  if (updated_to) params.set('updated_to', updated_to)

  const response = await apiFetch(`/admin/stock?${params.toString()}`, { token })
  const data = response?.data ?? {}
  return {
    items: (data.items ?? []).map(stockFromApi),
    pagination: data.pagination ?? {},
  }
}

export async function fetchStockAlerts(token) {
  const response = await apiFetch('/admin/stock/alerts', { token })
  return Array.isArray(response?.data) ? response.data : []
}

export async function fetchStockDetail(id, token) {
  const response = await apiFetch(`/admin/stock/${id}`, { token })
  const data = response?.data ?? {}
  return {
    item: stockDetailFromApi(data),
    movements: (data.movements ?? []).map(movementFromApi),
  }
}

export async function fetchStockCatalog(per_page = 100, token) {
  const response = await apiFetch(`/admin/stock?per_page=${per_page}`, { token })
  const items = response?.data?.items ?? []
  return items.map((item) => ({
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    sku: item.sku,
    category: item.category?.name ?? '—',
    location: 'Main Warehouse',
    currentStock: Number(item.stock_quantity ?? 0),
    unitPrice: item.price,
    threshold: Number(item.min_stock_alert ?? 0),
    thumbnail: usableImage(item.thumbnail),
  }))
}

export async function createStockMovement(payload, token) {
  const response = await apiFetch('/admin/stock/movements', {
    method: 'POST',
    token,
    body: payload,
  })
  return response?.data ?? {}
}
