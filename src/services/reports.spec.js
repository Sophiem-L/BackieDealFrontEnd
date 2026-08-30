import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeSoldProductsPayload, fetchSoldProductsReport } from '@/services/reports'

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

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/admin/reports/sold-products?preset=weekly',
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