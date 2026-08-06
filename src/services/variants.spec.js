import { describe, it, expect } from 'vitest'
import {
  attributeSignature,
  buildVariants,
  cartesian,
  fromApiVariant,
  makeVariantName,
  makeVariantSku,
  makeVariantSlug,
  normalizeDefault,
  toApiVariants,
  validateAxes,
  validateVariants,
} from '@/services/variants'

const COLOR_SIZE = [
  { name: 'Color', values: ['Red', 'Blue'] },
  { name: 'Size', values: ['S', 'M'] },
]

describe('cartesian', () => {
  it('returns no combinations when there are no usable axes', () => {
    expect(cartesian([])).toEqual([])
    expect(cartesian(undefined)).toEqual([])
  })

  it('ignores axes missing a name or any value', () => {
    expect(cartesian([{ name: '', values: ['Red'] }])).toEqual([])
    expect(cartesian([{ name: 'Color', values: [] }])).toEqual([])
    expect(cartesian([{ name: 'Color', values: ['  '] }])).toEqual([])
  })

  it('expands a single axis into one combination per value', () => {
    expect(cartesian([{ name: 'Color', values: ['Red', 'Blue'] }])).toEqual([
      [{ name: 'Color', value: 'Red' }],
      [{ name: 'Color', value: 'Blue' }],
    ])
  })

  it('varies the last axis fastest', () => {
    expect(cartesian(COLOR_SIZE).map(makeVariantName)).toEqual([
      'Red / S',
      'Red / M',
      'Blue / S',
      'Blue / M',
    ])
  })

  it('trims values and drops blanks within an axis', () => {
    expect(cartesian([{ name: ' Color ', values: [' Red ', '', 'Blue'] }])).toEqual([
      [{ name: 'Color', value: 'Red' }],
      [{ name: 'Color', value: 'Blue' }],
    ])
  })
})

describe('SKU and slug generation', () => {
  const combo = [
    { name: 'Color', value: 'Space Grey' },
    { name: 'Size', value: 'XL' },
  ]

  it('builds an uppercase dashed SKU from the base SKU and axis values', () => {
    expect(makeVariantSku('NV-RTX4090', combo)).toBe('NV-RTX4090-SPACE-GREY-XL')
  })

  it('builds a lowercase dashed slug seeded with the base SKU', () => {
    // The base-SKU prefix is what keeps the globally-unique slug index from
    // colliding across products.
    expect(makeVariantSlug('NV-RTX4090', combo)).toBe('nv-rtx4090-space-grey-xl')
  })

  it('collapses punctuation and repeated separators', () => {
    const messy = [{ name: 'Finish', value: 'Matte / Black!!' }]
    expect(makeVariantSku('AB..CD', messy)).toBe('AB-CD-MATTE-BLACK')
    expect(makeVariantSlug('AB..CD', messy)).toBe('ab-cd-matte-black')
  })

  it('omits the base segment when there is no base SKU yet', () => {
    expect(makeVariantSku('', [{ name: 'Size', value: 'S' }])).toBe('S')
    expect(makeVariantSlug('', [{ name: 'Size', value: 'S' }])).toBe('s')
  })
})

describe('attributeSignature', () => {
  it('is independent of key order', () => {
    expect(attributeSignature({ Color: 'Red', Size: 'S' })).toBe(
      attributeSignature({ Size: 'S', Color: 'Red' }),
    )
  })

  it('distinguishes different values', () => {
    expect(attributeSignature({ Color: 'Red' })).not.toBe(attributeSignature({ Color: 'Blue' }))
  })
})

describe('buildVariants', () => {
  it('generates a row per combination with derived name, sku and slug', () => {
    const rows = buildVariants(COLOR_SIZE, 'NV-RTX4090')

    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({
      name: 'Red / S',
      sku: 'NV-RTX4090-RED-S',
      slug: 'nv-rtx4090-red-s',
      attributes: { Color: 'Red', Size: 'S' },
      isDefault: true,
    })
  })

  it('flags only the first row as default', () => {
    const rows = buildVariants(COLOR_SIZE, 'X')
    expect(rows.filter((r) => r.isDefault)).toHaveLength(1)
    expect(rows[0].isDefault).toBe(true)
  })

  it('preserves typed price and stock when an axis value is added', () => {
    const first = buildVariants([{ name: 'Size', values: ['S'] }], 'X')
    first[0].price = '19.99'
    first[0].stock = 42

    const second = buildVariants([{ name: 'Size', values: ['S', 'M'] }], 'X', first)

    expect(second).toHaveLength(2)
    expect(second[0]).toMatchObject({ name: 'S', price: '19.99', stock: 42 })
    // The newly added combination starts blank.
    expect(second[1]).toMatchObject({ name: 'M', price: '', stock: 0 })
  })

  it('keeps a hand-overridden SKU across regeneration', () => {
    const first = buildVariants([{ name: 'Size', values: ['S'] }], 'X')
    first[0].sku = 'CUSTOM-SKU'

    const second = buildVariants([{ name: 'Size', values: ['S', 'M'] }], 'X', first)

    expect(second[0].sku).toBe('CUSTOM-SKU')
    expect(second[1].sku).toBe('X-M')
  })

  it('keeps a moved default flag instead of resetting to the first row', () => {
    const first = buildVariants([{ name: 'Size', values: ['S', 'M'] }], 'X')
    first[0].isDefault = false
    first[1].isDefault = true

    const second = buildVariants([{ name: 'Size', values: ['S', 'M'] }], 'X', first)

    expect(second[1].isDefault).toBe(true)
    expect(second[0].isDefault).toBe(false)
  })

  it('regenerates the SKU when the row was left blank', () => {
    const first = buildVariants([{ name: 'Size', values: ['S'] }], 'OLD')
    first[0].sku = ''

    const second = buildVariants([{ name: 'Size', values: ['S'] }], 'NEW', first)

    expect(second[0].sku).toBe('NEW-S')
  })

  it('returns nothing when no axes are usable', () => {
    expect(buildVariants([], 'X')).toEqual([])
  })
})

describe('normalizeDefault', () => {
  it('promotes the first row when none is flagged', () => {
    const rows = normalizeDefault([{ isDefault: false }, { isDefault: false }])
    expect(rows[0].isDefault).toBe(true)
  })

  it('keeps only the first of several flagged rows', () => {
    const rows = normalizeDefault([{ isDefault: false }, { isDefault: true }, { isDefault: true }])
    expect(rows.map((r) => r.isDefault)).toEqual([false, true, false])
  })

  it('tolerates an empty list', () => {
    expect(normalizeDefault([])).toEqual([])
  })
})

describe('validateVariants', () => {
  const ok = { name: 'Red / S', sku: 'A-RED-S' }

  it('accepts well-formed rows', () => {
    expect(validateVariants([ok, { name: 'Red / M', sku: 'A-RED-M' }]).valid).toBe(true)
  })

  it('accepts an empty list — variants are optional', () => {
    expect(validateVariants([]).valid).toBe(true)
  })

  it('requires a name', () => {
    const { valid, errors } = validateVariants([{ name: '  ', sku: 'A' }])
    expect(valid).toBe(false)
    expect(errors[0]).toMatch(/name is required/i)
  })

  it('requires a SKU', () => {
    const { errors } = validateVariants([{ name: 'Red', sku: '' }])
    expect(errors[0]).toMatch(/sku is required/i)
  })

  it('rejects characters the API regex forbids', () => {
    const { errors } = validateVariants([{ name: 'Red', sku: 'A RED/S' }])
    expect(errors[0]).toMatch(/letters, digits/i)
  })

  it('rejects a SKU over 64 characters', () => {
    const { errors } = validateVariants([{ name: 'Red', sku: 'A'.repeat(65) }])
    expect(errors[0]).toMatch(/64 characters/i)
  })

  it('flags duplicate SKUs case-insensitively and points at the original row', () => {
    const { valid, errors } = validateVariants([ok, { name: 'Other', sku: 'a-red-s' }])
    expect(valid).toBe(false)
    expect(errors[0]).toBeUndefined()
    expect(errors[1]).toMatch(/duplicate sku — already used by variant 1/i)
  })
})

describe('validateAxes', () => {
  it('passes clean axes', () => {
    expect(validateAxes(COLOR_SIZE)).toEqual([])
  })

  it('ignores axes with no name yet', () => {
    expect(validateAxes([{ name: '', values: [] }])).toEqual([])
  })

  it('reports duplicate axis names', () => {
    const problems = validateAxes([
      { name: 'Color', values: ['Red'] },
      { name: 'color', values: ['Blue'] },
    ])
    expect(problems).toContainEqual(expect.stringMatching(/unique/i))
  })

  it('reports a named axis with no values', () => {
    expect(validateAxes([{ name: 'Color', values: [] }])).toContainEqual(
      expect.stringMatching(/needs at least one value/i),
    )
  })

  it('reports duplicate values within an axis', () => {
    expect(validateAxes([{ name: 'Color', values: ['Red', 'red'] }])).toContainEqual(
      expect.stringMatching(/duplicate values/i),
    )
  })
})

describe('toApiVariants', () => {
  it('maps rows onto the nested contract', () => {
    const rows = buildVariants([{ name: 'Size', values: ['S'] }], 'NV')
    rows[0].price = '1,599.00'
    rows[0].stock = 7

    expect(toApiVariants(rows)[0]).toEqual({
      name: 'S',
      slug: 'nv-s',
      sku: 'NV-S',
      price: 1599,
      sale_price: null,
      cost_price: null,
      stock_quantity: 7,
      min_stock_alert: 5,
      attributes: { Size: 'S' },
      is_default: true,
      is_active: true,
      sort_order: 0,
    })
  })

  it('never sends in_stock — the server derives it from stock_quantity', () => {
    const payload = toApiVariants(buildVariants([{ name: 'Size', values: ['S'] }], 'NV'))
    expect(payload[0]).not.toHaveProperty('in_stock')
  })

  it('maps blank money fields to null rather than zero', () => {
    const payload = toApiVariants([{ name: 'S', sku: 'S', price: '', salePrice: '  ' }])
    expect(payload[0].price).toBeNull()
    expect(payload[0].sale_price).toBeNull()
  })

  it('defaults blank quantities to zero', () => {
    const payload = toApiVariants([{ name: 'S', sku: 'S', stock: '', minStockAlert: '' }])
    expect(payload[0].stock_quantity).toBe(0)
    expect(payload[0].min_stock_alert).toBe(0)
  })

  it('assigns sort_order by position', () => {
    const payload = toApiVariants(buildVariants([{ name: 'Size', values: ['S', 'M', 'L'] }], 'NV'))
    expect(payload.map((v) => v.sort_order)).toEqual([0, 1, 2])
  })

  it('falls back to a name-derived slug when the row has none', () => {
    expect(toApiVariants([{ name: 'Red / S', sku: 'A' }])[0].slug).toBe('red-s')
  })
})

describe('fromApiVariant', () => {
  it('maps an API variant into a display row', () => {
    expect(
      fromApiVariant({
        name: 'Red / S',
        sku: 'A-RED-S',
        price: 12.5,
        stock_quantity: 3,
        attributes: { Color: 'Red' },
        is_default: true,
        is_active: false,
      }),
    ).toEqual({
      name: 'Red / S',
      sku: 'A-RED-S',
      price: 12.5,
      stock: 3,
      attributes: { Color: 'Red' },
      isDefault: true,
      isActive: false,
    })
  })

  it('normalises the empty-object attributes the API serialises as [] or {}', () => {
    // The resource emits `new stdClass` for a null attributes column, which can
    // arrive as [] once JSON-decoded in some clients.
    expect(fromApiVariant({ attributes: [] }).attributes).toEqual({})
    expect(fromApiVariant({}).attributes).toEqual({})
  })
})
