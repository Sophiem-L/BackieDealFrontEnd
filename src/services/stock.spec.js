import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveStockStatus, fetchStockSummary } from '@/services/stock'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

function alertRow(stock) {
  return { stock_quantity: stock, min_stock_alert: 5 }
}

// Route each call by path so the two requests can be answered independently.
function mockApi({ total, alerts }) {
  apiFetch.mockImplementation((path) => {
    if (path.includes('/admin/stock/alerts')) {
      return alerts instanceof Error ? Promise.reject(alerts) : Promise.resolve({ data: alerts })
    }
    return total instanceof Error
      ? Promise.reject(total)
      : Promise.resolve({ data: { pagination: { total } } })
  })
}

describe('deriveStockStatus', () => {
  it('treats zero and negative stock as out of stock', () => {
    expect(deriveStockStatus({ stock_quantity: 0, min_stock_alert: 5 })).toBe('out-of-stock')
    // Stock can go negative through an over-issue; that is still "none to sell",
    // not "low".
    expect(deriveStockStatus({ stock_quantity: -3, min_stock_alert: 5 })).toBe('out-of-stock')
  })

  it('includes the threshold itself in low stock', () => {
    // The boundary: the seeded TUF RTX 4070 sits exactly on its alert level.
    expect(deriveStockStatus({ stock_quantity: 5, min_stock_alert: 5 })).toBe('low-stock')
    expect(deriveStockStatus({ stock_quantity: 6, min_stock_alert: 5 })).toBe('in-stock')
  })

  it('counts any positive stock as in stock when no threshold is set', () => {
    expect(deriveStockStatus({ stock_quantity: 1, min_stock_alert: null })).toBe('in-stock')
  })

  it('treats a missing row as out of stock rather than throwing', () => {
    expect(deriveStockStatus(undefined)).toBe('out-of-stock')
  })
})

describe('fetchStockSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('splits the alerts list into low and out, and infers in-stock', () => {
    mockApi({ total: 20, alerts: [alertRow(0), alertRow(0), alertRow(3), alertRow(5)] })

    return expect(fetchStockSummary({ token: 't' })).resolves.toEqual({
      total: 20,
      out: 2,
      low: 2,
      inStock: 16,
    })
  })

  it('keeps the catalog total when the alerts endpoint is forbidden', async () => {
    // A role without stock.view gets a 403 here. That must not blank a total
    // that loaded fine — the cards degrade one at a time.
    mockApi({ total: 20, alerts: new Error('403 Forbidden') })

    expect(await fetchStockSummary({ token: 't' })).toEqual({
      total: 20,
      low: null,
      out: null,
      inStock: null,
    })
  })

  it('reports the alert split even when the catalog total fails', async () => {
    mockApi({ total: new Error('500'), alerts: [alertRow(0), alertRow(2)] })

    expect(await fetchStockSummary({ token: 't' })).toEqual({
      total: null,
      out: 1,
      low: 1,
      inStock: null,
    })
  })

  it('never reports a negative in-stock count', async () => {
    // The alerts endpoint is not filtered by track_inventory, so it can return
    // more rows than a tracked-only total.
    mockApi({ total: 1, alerts: [alertRow(0), alertRow(0), alertRow(1)] })

    expect((await fetchStockSummary({ token: 't' })).inStock).toBe(0)
  })

  it('asks the caller-supplied endpoint for the catalog total', async () => {
    mockApi({ total: 5, alerts: [] })

    await fetchStockSummary({ token: 't', totalPath: '/admin/stock?page=1&per_page=1' })

    expect(apiFetch).toHaveBeenCalledWith('/admin/stock?page=1&per_page=1', { token: 't' })
  })
})
