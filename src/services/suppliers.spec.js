import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSuppliers, suggestedSupplierId, supplierToApi, blankSupplier } from '@/services/suppliers'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

describe('suggestedSupplierId', () => {
  const options = [
    { id: 1, isDefault: false },
    { id: 2, isDefault: true },
    { id: 3, isDefault: false },
  ]

  it("prefers the product's default supplier", () => {
    expect(suggestedSupplierId(3, options)).toBe('3')
  })

  it('falls back to the store default when the product has none', () => {
    expect(suggestedSupplierId(null, options)).toBe('2')
  })

  // An inactive supplier is left out of the options, so a product still
  // pointing at one gets the store default rather than an unselectable id.
  it('falls back to the store default when the product default is not offered', () => {
    expect(suggestedSupplierId(99, options)).toBe('2')
  })

  it('suggests none when there is no default anywhere', () => {
    expect(suggestedSupplierId(null, [{ id: 1, isDefault: false }])).toBe('')
    expect(suggestedSupplierId(null, undefined)).toBe('')
  })
})

describe('supplierToApi', () => {
  it('sends blank optional fields as null and trims the rest', () => {
    const body = supplierToApi({ ...blankSupplier(), name: '  Acme  ', phone: ' ' })
    expect(body.name).toBe('Acme')
    expect(body.phone).toBeNull()
    expect(body.code).toBeNull()
  })

  it('never marks an inactive supplier as the default', () => {
    const body = supplierToApi({ ...blankSupplier(), name: 'A', isActive: false, isDefault: true })
    expect(body.is_default).toBe(false)
  })
})

describe('fetchSuppliers', () => {
  beforeEach(() => apiFetch.mockReset())

  it('passes filters through and maps rows', async () => {
    apiFetch.mockResolvedValue({
      data: { items: [{ id: 7, name: 'Acme', is_active: true, is_default: true, products_count: 2 }], pagination: { total: 1 } },
    })

    const { items, pagination } = await fetchSuppliers({ q: 'ac', isActive: true }, 'tok')

    expect(apiFetch).toHaveBeenCalledWith('/admin/suppliers?page=1&per_page=25&q=ac&is_active=1', { token: 'tok' })
    expect(items[0]).toMatchObject({ id: 7, name: 'Acme', isDefault: true, productsCount: 2 })
    expect(pagination.total).toBe(1)
  })
})
