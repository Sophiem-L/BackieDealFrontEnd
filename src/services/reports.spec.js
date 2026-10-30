import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchSalesReport,
  fetchSoldProductsReport,
  fetchStockReport,
  normalizeSalesReportPayload,
  normalizeSoldProductsPayload,
  normalizeStockReportRow,
} from '@/services/reports'

describe('normalizeSalesReportPayload', () => {
  it('normalizes the sales dashboard contract', () => {
    const payload = normalizeSalesReportPayload({
      summary: {
        revenue: '1200.50',
        cogs: '700',
        profit: '500.50',
        margin: '41.7',
        orders: 8,
        revenue_change: '4.2',
        cogs_change: '-2.1',
        profit_change: '9.5',
        margin_change: '1.3',
      },
      chart: [{ label: 'W35', revenue: '1200.50', profit: 500.5 }],
      daily_breakdown: [{ label: 'Mon', revenue: 1200, profit: 500 }],
      top_products: [{ name: 'Keyboard', units: '3', revenue: '160' }],
      table: [{ period: 'W35', date_range: '2026-08-01 - 2026-08-07', orders: '8', revenue: 1200, cogs: 700, profit: 500, margin: 41.7 }],
    })

    expect(payload.summary.revenue).toBe(1200.5)
    expect(payload.summary.profitChange).toBe(9.5)
    expect(payload.chart[0].profit).toBe(500.5)
    expect(payload.topProducts[0].units).toBe(3)
    expect(payload.table[0].dateRange).toBe('2026-08-01 - 2026-08-07')
  })
})

describe('normalizeSoldProductsPayload', () => {
  it('maps camelCase API rows onto the report table shape', () => {
    const payload = normalizeSoldProductsPayload({
      labels: ['2026-08'],
      series: [{ name: 'Keyboard', data: [3], revenue_data: [160] }],
      table: [
        {
          productId: 5,
          name: 'Keyboard',
          sku: 'KB-01',
          category: 'Peripherals',
          units: 3,
          revenue: 160,
        },
      ],
      meta: { preset: 'monthly', date_from: '2026-01-01', date_to: '2026-08-31' },
    })

    expect(payload.rows).toEqual([
      {
        productId: 5,
        name: 'Keyboard',
        sku: 'KB-01',
        category: 'Peripherals',
        units: 3,
        revenue: 160,
      },
    ])
    expect(payload.labels).toEqual(['2026-08'])
    expect(payload.series).toHaveLength(1)
    expect(payload.meta.preset).toBe('monthly')
  })

  it('tolerates snake_case rows and coerces numeric strings', () => {
    const payload = normalizeSoldProductsPayload({
      table: [
        {
          product_id: 9,
          product_name: 'Mouse',
          sku: 'MS-01',
          category_name: null,
          quantity_sold: '4',
          revenue: '80.5',
        },
      ],
    })

    expect(payload.rows[0]).toEqual({
      productId: 9,
      name: 'Mouse',
      sku: 'MS-01',
      category: 'Uncategorized',
      units: 4,
      revenue: 80.5,
    })
  })

  it('falls back to empty arrays when the payload is missing or malformed', () => {
    expect(normalizeSoldProductsPayload(null).rows).toEqual([])
    expect(normalizeSoldProductsPayload({}).rows).toEqual([])
    expect(normalizeSoldProductsPayload(undefined).labels).toEqual([])
    expect(normalizeSoldProductsPayload({ table: 'not-an-array' }).rows).toEqual([])
  })
})

describe('fetchSoldProductsReport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the endpoint with the preset mapped from granularity and the bearer token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: {
          labels: [],
          series: [],
          table: [
            { productId: 1, name: 'A', sku: 'S', category: 'C', units: 2, revenue: 40 },
          ],
          meta: { preset: 'weekly', date_from: '2026-08-01', date_to: '2026-08-30' },
        },
      }),
    })

    const result = await fetchSoldProductsReport({ granularity: 'weekly' }, 'token-123')

    expect(globalThis.fetch.mock.calls[0][0]).toMatch(
      /\/api\/v1\/admin\/reports\/sold-products\?preset=weekly$/,
    )
    expect(globalThis.fetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].units).toBe(2)
  })

  it('sends extra date filters when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: { table: [] } }),
    })

    await fetchSoldProductsReport(
      { granularity: 'yearly', date_from: '2024-01-01', date_to: '2026-12-31' },
      'token-123',
    )

    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('preset=yearly')
    expect(url).toContain('date_from=2024-01-01')
    expect(url).toContain('date_to=2026-12-31')
  })
})

describe('fetchSalesReport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests the sales endpoint with the selected preset and token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: { summary: { revenue: 10 } } }),
    })

    const result = await fetchSalesReport({ granularity: 'weekly' }, 'token-123')

    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/admin\/reports\/sales\?preset=weekly$/)
    expect(globalThis.fetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    )
    expect(result.summary.revenue).toBe(10)
  })
})
describe('normalizeStockReportRow', () => {
  it('maps an /admin/stock item and derives value and status', () => {
    const row = normalizeStockReportRow({
      id: 7,
      name: 'Keyboard',
      sku: 'KB-01',
      price: '80.00',
      cost_price: '50.00',
      stock_quantity: '12',
      min_stock_alert: '5',
      category: { name: 'Peripherals' },
      brand: { name: 'Logi' },
    })

    expect(row).toEqual({
      id: 7,
      name: 'Keyboard',
      sku: 'KB-01',
      category: 'Peripherals',
      brand: 'Logi',
      onHand: 12,
      threshold: 5,
      unitCost: 50,
      unitPrice: 80,
      stockValue: 600,
      retailValue: 960,
      status: 'in-stock',
    })
  })

  it('flags low and out of stock, counting the threshold itself as low', () => {
    const base = { id: 1, name: 'A', sku: 'A', price: 10, cost_price: 4, min_stock_alert: 5 }

    expect(normalizeStockReportRow({ ...base, stock_quantity: 5 }).status).toBe('low-stock')
    expect(normalizeStockReportRow({ ...base, stock_quantity: 0 }).status).toBe('out-of-stock')
  })

  it('leaves value null when there is no cost price instead of reporting $0', () => {
    const row = normalizeStockReportRow({
      id: 2,
      name: 'Mouse',
      price: 20,
      cost_price: null,
      stock_quantity: 10,
    })

    expect(row.unitCost).toBeNull()
    expect(row.stockValue).toBeNull()
    expect(row.retailValue).toBe(200)
  })

  it('does not let negative stock reduce inventory value', () => {
    const row = normalizeStockReportRow({
      id: 3,
      name: 'Oversold',
      price: 20,
      cost_price: 10,
      stock_quantity: -4,
    })

    expect(row.onHand).toBe(-4)
    expect(row.stockValue).toBe(0)
    expect(row.retailValue).toBe(0)
    expect(row.status).toBe('out-of-stock')
  })

  it('falls back to safe defaults for missing relations and names', () => {
    const row = normalizeStockReportRow({ id: 4 })

    expect(row.name).toBe('Unknown product')
    expect(row.category).toBe('Uncategorized')
    expect(row.brand).toBe('')
    expect(row.onHand).toBe(0)
  })
})

describe('fetchStockReport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const page = (items, lastPage) => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ data: { items, pagination: { last_page: lastPage } } }),
  })

  it('walks every page with the bearer token and flattens the rows', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: 1, name: 'A' }], 2))
      .mockResolvedValueOnce(page([{ id: 2, name: 'B' }], 2))

    const result = await fetchStockReport('token-123')

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/admin\/stock\?page=1&per_page=100/)
    expect(globalThis.fetch.mock.calls[1][0]).toMatch(/page=2/)
    expect(globalThis.fetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    )
    expect(result.rows.map((row) => row.id)).toEqual([1, 2])
    expect(result.truncated).toBe(false)
  })

  it('stops at the page cap and reports the list as truncated', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => page([], 25))

    const result = await fetchStockReport('token-123')

    expect(globalThis.fetch).toHaveBeenCalledTimes(20)
    expect(result.truncated).toBe(true)
  })

  it('returns an empty list for an empty or malformed payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: { items: 'nope' } }),
    })

    const result = await fetchStockReport('token-123')

    expect(result.rows).toEqual([])
    expect(result.truncated).toBe(false)
  })
})
