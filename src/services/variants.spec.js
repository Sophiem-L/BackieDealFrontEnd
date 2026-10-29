import { describe, it, expect } from 'vitest'
import {
  addSerials,
  blankRow,
  fromApiPricing,
  fromApiVariant,
  isStandaloneProduct,
  normalizeDefault,
  parseSerialInput,
  pendingSerialReceipts,
  setDefaultRow,
  toApiPricing,
  toApiVariants,
  validateSimplePricing,
  validateVariants,
} from '@/services/variants'

function row(sku, serials) {
  return { ...blankRow(), name: sku, sku, ...(serials ? { serials } : {}) }
}

describe('parseSerialInput', () => {
  it('splits pasted text on newlines, commas and semicolons, trimming and upper-casing', () => {
    // Upper-cased to match the stock adjustment page: the lookup endpoint compares
    // serial numbers exactly, so mixed case would make a unit unfindable.
    expect(parseSerialInput(' sn-1\r\nsn-2 ,,sn-3;sn-4\n')).toEqual(['SN-1', 'SN-2', 'SN-3', 'SN-4'])
  })

  it('returns nothing for blank input', () => {
    expect(parseSerialInput('  \n , ')).toEqual([])
    expect(parseSerialInput(undefined)).toEqual([])
  })
})

describe('addSerials', () => {
  it('appends new serials after the existing ones', () => {
    expect(addSerials(['A1'], 'b2\nc3')).toEqual({ serials: ['A1', 'B2', 'C3'], duplicates: [] })
  })

  it('skips repeats regardless of case, both against the list and within the input', () => {
    expect(addSerials(['A1'], 'a1, B2, b2')).toEqual({ serials: ['A1', 'B2'], duplicates: ['A1', 'B2'] })
  })

  it('skips serials already taken by another variant', () => {
    expect(addSerials([], 'x1, y2', ['X1'])).toEqual({ serials: ['Y2'], duplicates: ['X1'] })
  })

  it('does not mutate the list it was given', () => {
    const existing = ['A1']
    addSerials(existing, 'b2')
    expect(existing).toEqual(['A1'])
  })
})

describe('blankRow', () => {
  it('starts with its own empty serial list', () => {
    expect(blankRow().serials).toEqual([])
    expect(blankRow().serials).not.toBe(blankRow().serials)
  })
})

describe('validateVariants serials', () => {
  it('flags a serial that two variants share, ignoring case', () => {
    const { valid, errors } = validateVariants([row('A-1', ['sn1']), row('A-2', ['SN1'])])
    expect(valid).toBe(false)
    expect(errors[1]).toBe('Serial number SN1 is already used by variant 1.')
    expect(errors[0]).toBeUndefined()
  })

  it('flags a serial longer than the API accepts', () => {
    const { valid, errors } = validateVariants([row('A-1', ['X'.repeat(192)])])
    expect(valid).toBe(false)
    expect(errors[0]).toBe('Serial numbers must be 191 characters or fewer.')
  })

  it('accepts rows with no serial list at all', () => {
    // Rows loaded on the edit page come from fromApiVariant, which has none.
    const loaded = { ...row('A-1') }
    delete loaded.serials
    expect(validateVariants([loaded, row('A-2', ['SN1'])]).valid).toBe(true)
  })

  it('flags a variant with more than one serial waiting', () => {
    const { valid, errors } = validateVariants([row('A-1', ['SN1', 'SN2'])])
    expect(valid).toBe(false)
    expect(errors[0]).toBe('Each variant can have only 1 serial number.')
  })

  it('flags a new serial on a variant that already holds a saved one', () => {
    const saved = { ...row('A-1', ['SN2']), receivedSerials: 1 }
    expect(validateVariants([saved]).errors[0]).toBe('Each variant can have only 1 serial number.')
  })

  it('leaves a variant with saved serials alone while nothing new is waiting', () => {
    const saved = { ...row('A-1'), receivedSerials: 3 }
    expect(validateVariants([saved]).valid).toBe(true)
  })
})

describe('fromApiVariant', () => {
  it('reads how many serials the saved variant already holds', () => {
    expect(fromApiVariant({ sku: 'A-1', serials_count: 1 }).receivedSerials).toBe(1)
  })

  it('treats a missing count as none', () => {
    expect(fromApiVariant({ sku: 'A-1' }).receivedSerials).toBe(0)
    expect(fromApiVariant({ sku: 'A-1', serials_count: null }).receivedSerials).toBe(0)
  })
})

describe('toApiVariants', () => {
  it('never sends serials with the variant; they are received separately', () => {
    const [variant] = toApiVariants([row('A-1', ['SN1'])])
    expect(variant).not.toHaveProperty('serials')
    expect(variant).not.toHaveProperty('receivedSerials')
  })
})

describe('pendingSerialReceipts', () => {
  const saved = [
    { id: 11, sku: 'A-1' },
    { id: 12, sku: 'A-2' },
  ]

  it('pairs each row that has serials with the saved variant of the same SKU', () => {
    const rows = [row('a-1', ['SN1', 'SN2']), row('A-2'), row('A-3', [])]
    expect(pendingSerialReceipts(rows, saved)).toEqual([
      { sku: 'a-1', variantId: 11, serials: ['SN1', 'SN2'] },
    ])
  })

  it('reports a null variant id when the saved product has no such SKU', () => {
    expect(pendingSerialReceipts([row('GONE', ['SN1'])], saved)).toEqual([
      { sku: 'GONE', variantId: null, serials: ['SN1'] },
    ])
  })
})

describe('default variant selection', () => {
  it('moves the default flag to the chosen row only', () => {
    const rows = normalizeDefault([row('A'), row('B'), row('C')])
    const next = setDefaultRow(rows, 2)
    expect(next.map((r) => r.isDefault)).toEqual([false, false, true])
    expect(rows.map((r) => r.isDefault)).toEqual([true, false, false])
  })

  it('falls back to the first row when none is flagged, as the API does', () => {
    expect(normalizeDefault([row('A'), row('B')]).map((r) => r.isDefault)).toEqual([true, false])
  })

  it('sends exactly one is_default row', () => {
    const sent = toApiVariants(setDefaultRow([row('A'), row('B')], 1))
    expect(sent.map((v) => v.is_default)).toEqual([false, true])
  })
})

describe('isStandaloneProduct', () => {
  it('treats no variants, or one variant without option values, as a single item', () => {
    expect(isStandaloneProduct([])).toBe(true)
    expect(isStandaloneProduct([{ sku: 'X-DEFAULT', attributes: {} }])).toBe(true)
    expect(isStandaloneProduct([{ sku: 'X-DEFAULT', attributes: [] }])).toBe(true)
  })

  it('keeps the variant editor for option variants or several variants', () => {
    expect(isStandaloneProduct([{ attributes: { Color: 'Red' } }])).toBe(false)
    expect(isStandaloneProduct([{ attributes: {} }, { attributes: {} }])).toBe(false)
  })
})

describe('pricing for a product without variants', () => {
  it('maps price and compare-at the way variants do', () => {
    expect(toApiPricing({ price: '90', compareAt: '120', costPrice: '60' })).toEqual({
      price: 120,
      sale_price: 90,
      cost_price: 60,
    })
    expect(toApiPricing({ price: '1,200', compareAt: '', costPrice: '' })).toEqual({
      price: 1200,
      sale_price: null,
      cost_price: null,
    })
  })

  it('reads a product or variant back into the same fields', () => {
    expect(fromApiPricing({ price: 120, sale_price: 90, cost_price: 60 })).toEqual({
      price: 90,
      compareAt: 120,
      costPrice: 60,
    })
    expect(fromApiPricing({ price: 50, sale_price: null, cost_price: null })).toEqual({
      price: 50,
      compareAt: '',
      costPrice: '',
    })
  })

  it('requires a price and a sane compare-at, cost and stock', () => {
    const valid = { ...blankRow(), price: '10', stock: 3 }
    expect(validateSimplePricing(valid)).toBe('')
    expect(validateSimplePricing({ ...valid, price: '' })).toBe('Enter a price.')
    expect(validateSimplePricing({ ...valid, compareAt: '5' })).toMatch(/Compare-at/)
    expect(validateSimplePricing({ ...valid, costPrice: 'abc' })).toMatch(/Cost/)
    expect(validateSimplePricing({ ...valid, stock: '-1' })).toMatch(/Stock/)
    expect(validateSimplePricing({ ...valid, stock: '1.5' })).toMatch(/Stock/)
  })
})
