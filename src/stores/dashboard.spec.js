import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'

// The store reads the bearer token off the auth store; the tests only care
// that a request went out, so a bare stub keeps Pinia happy.
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ accessToken: 'test-token' }),
}))

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ status: 'success', message: '', data }),
  }
}

function errorResponse(status, message) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ status: 'error', message }),
  }
}

const STATS = {
  total_orders: 4,
  total_revenue: 1200,
  total_products: 12,
  total_customers: 7,
  total_promotions: 2,
  today: { orders: 1, revenue: 300 },
  this_month: { orders: 4, revenue: 1200 },
  this_year: { orders: 4, revenue: 1200 },
  orders_per_day: [{ date: '2026-08-24', day: 'Mon', orders: 1 }],
  status_breakdown: [{ status: 'pending', count: 1 }],
  recent_orders: [{ id: 'abc', order_number: 'ORD-0001', customer: 'Ada', item: 'Mouse', amount: '99.00', status: 'pending' }],
}

describe('dashboard store — stats', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('stores the payload returned by GET /admin/dashboard', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(STATS))
    const store = useDashboardStore()

    await store.fetchStats()

    expect(store.stats).toEqual(STATS)
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)
  })

  it('surfaces the failure and leaves stats null rather than inventing figures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(500, 'Server exploded'))
    const store = useDashboardStore()

    const ok = await store.fetchStats()

    expect(ok).toBe(false)
    expect(store.stats).toBeNull()
    expect(store.error).toBe('Server exploded')
  })
})

describe('dashboard store — low stock', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('maps stock alerts onto the fields the panel renders', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse([
        { id: 'uuid-1', name: 'Corsair 64GB', sku: 'COR-64', stock_quantity: 0, min_stock_alert: 5 },
        { id: 'uuid-2', name: 'ROG Z790', sku: 'AS-Z790', stock_quantity: 4, min_stock_alert: 5 },
      ]),
    )
    const store = useDashboardStore()

    await store.fetchLowStock()

    expect(store.lowStock).toEqual([
      { id: 'uuid-1', name: 'Corsair 64GB', sku: 'COR-64', stock: 0 },
      { id: 'uuid-2', name: 'ROG Z790', sku: 'AS-Z790', stock: 4 },
    ])
  })

  it('requests the stock alerts endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse([]))
    const store = useDashboardStore()

    await store.fetchLowStock()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/admin/stock/alerts',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('leaves the list empty when the caller lacks stock.view', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(403, 'This action is unauthorized.'))
    const store = useDashboardStore()

    await store.fetchLowStock()

    expect(store.lowStock).toEqual([])
  })
})
