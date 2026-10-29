import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { usePromotionTargets, variantAttributes } from '@/composables/usePromotionTargets'
import { promotionPayload, savedProductTargets } from '@/services/promotions'

const RAM = {
  id: 'ram',
  name: 'Vengeance DDR5',
  variants: [
    { id: 1, product_id: 'ram', name: '32GB', sku: 'R-32', is_active: true },
    { id: 2, product_id: 'ram', name: '64GB', sku: 'R-64', is_active: true },
    { id: 3, product_id: 'ram', name: '128GB', sku: 'R-128', is_active: false },
  ],
}

function setup(initial = {}) {
  const form = reactive({ productIds: [], specificProductIds: [], variantIds: [], ...initial })
  const loadProduct = vi.fn(async (id) => (id === 'ram' ? RAM : { id, name: id, variants: [] }))
  const targets = usePromotionTargets(form, { loadProduct })
  return { form, targets, loadProduct }
}

const v = (id) => RAM.variants.find((variant) => variant.id === id)

describe('usePromotionTargets', () => {
  it('selects a product as a whole product and deselects it again', () => {
    const { form, targets } = setup()

    targets.toggleProduct('ram')
    expect(targets.modeOf('ram')).toBe('whole')
    expect(form.productIds).toEqual(['ram'])

    targets.toggleProduct('ram')
    expect(targets.modeOf('ram')).toBe('none')
    expect(form.productIds).toEqual([])
  })

  it('narrows a whole product to specific variants without sending the product id', async () => {
    const { form, targets } = setup({ productIds: ['ram'] })

    targets.setSpecific('ram')
    await targets.ensureVariants('ram')
    targets.toggleVariant(v(1))

    expect(targets.modeOf('ram')).toBe('variants')
    expect(form.productIds).toEqual([])
    expect(form.variantIds).toEqual([1])
    expect(targets.groupState('ram')).toMatchObject({ selected: 1, total: 2, checked: false, indeterminate: true })
  })

  it('ticking a variant of an unselected product narrows that product to it', () => {
    const { form, targets } = setup()

    targets.toggleVariant(v(2))

    expect(targets.modeOf('ram')).toBe('variants')
    expect(form.specificProductIds).toEqual(['ram'])
    expect(form.variantIds).toEqual([2])
  })

  it('locks a whole product’s variants as included', async () => {
    const { form, targets } = setup({ productIds: ['ram'] })
    await targets.ensureVariants('ram')

    targets.toggleVariant(v(1))

    expect(form.variantIds).toEqual([])
    expect(targets.isVariantIncluded(v(1))).toBe(true)
    expect(targets.groupState('ram')).toMatchObject({ checked: true, indeterminate: false, total: 2 })
  })

  it('switching back to whole product drops its now-redundant variant picks only', () => {
    const { form, targets } = setup({ specificProductIds: ['ram'], variantIds: [1, 2, 99] })
    targets.rememberVariants([v(1), v(2), { id: 99, product_id: 'gpu' }])

    targets.setWhole('ram')

    expect(form.productIds).toEqual(['ram'])
    expect(form.specificProductIds).toEqual([])
    expect(form.variantIds).toEqual([99])
  })

  it('deselecting a product removes its variants and nothing else', () => {
    const { form, targets } = setup({ productIds: ['gpu'], specificProductIds: ['ram'], variantIds: [1, 99] })
    targets.rememberVariants([v(1), { id: 99, product_id: 'gpu' }])

    targets.deselect('ram')

    expect(form.productIds).toEqual(['gpu'])
    expect(form.specificProductIds).toEqual([])
    expect(form.variantIds).toEqual([99])
  })

  it('selects all variants of a narrowed group, skipping inactive ones, and clears them', async () => {
    const { form, targets } = setup({ specificProductIds: ['ram'] })
    await targets.ensureVariants('ram')

    targets.setVariants(RAM.variants, true)
    expect(form.variantIds).toEqual([1, 2])
    expect(targets.groupState('ram')).toMatchObject({ checked: true, indeterminate: false })

    targets.setVariants(RAM.variants, false)
    expect(form.variantIds).toEqual([])
  })

  it('select-many adds whole products without overriding a narrowed one', () => {
    const { form, targets } = setup({ specificProductIds: ['ram'], variantIds: [1] })
    targets.rememberVariants([v(1)])

    expect(targets.selectProducts(['a', 'ram', 'a', 'b'])).toBe(2)
    expect(form.productIds).toEqual(['a', 'b'])
    expect(targets.modeOf('ram')).toBe('variants')
  })

  it('validates: something must be targeted, and a narrowed product needs a variant', () => {
    const { targets } = setup()
    expect(targets.validate()).toEqual({ product_ids: ['Select at least one product or variant.'] })

    const narrowed = setup({ specificProductIds: ['ram'] })
    narrowed.targets.rememberProducts([{ id: 'ram', name: 'Vengeance DDR5' }])
    expect(narrowed.targets.validate().variant_ids[0]).toContain('Vengeance DDR5')

    const variantOnly = setup({ specificProductIds: ['ram'], variantIds: [1] })
    variantOnly.targets.rememberVariants([v(1)])
    expect(variantOnly.targets.validate()).toBeNull()
  })

  it('loads variant lists once, a few at a time, and retries failures', async () => {
    const { targets, loadProduct } = setup()
    await targets.ensureVariantsFor(['ram', 'ram', 'gpu'])
    await targets.ensureVariantsFor(['ram', 'gpu'])
    expect(loadProduct).toHaveBeenCalledTimes(2)

    loadProduct.mockRejectedValueOnce(new Error('Offline'))
    await targets.ensureVariants('ssd')
    expect(targets.variantLists.get('ssd')).toMatchObject({ status: 'error', error: 'Offline' })
    await targets.ensureVariants('ssd')
    expect(targets.variantLists.get('ssd').status).toBe('loaded')
  })

  it('round-trips a saved promotion: whole, narrowed and redundant variants', () => {
    const saved = {
      products: [{ id: 'gpu' }],
      variants: [{ id: 5, product_id: 'gpu' }, { id: 1, product_id: 'ram' }, { id: 1, product_id: 'ram' }],
    }
    const form = reactive({ ...savedProductTargets(saved) })
    expect(form).toEqual({ productIds: ['gpu'], specificProductIds: ['ram'], variantIds: [5, 1] })

    const targets = usePromotionTargets(form)
    targets.hydrate(saved)
    expect(targets.modeOf('gpu')).toBe('whole')
    expect(targets.modeOf('ram')).toBe('variants')

    const payload = promotionPayload({
      name: 'x', code: 'x', type: 'Percentage Discount', kind: 'Standard', discountValue: '5', minimumSpend: '',
      maxDiscountAmount: '', startDate: '', endDate: '', totalLimit: '', perCustomerLimit: '', active: true,
      description: '', bannerImage: '', targetType: 'products', ...form, productIds: [...form.productIds, 'gpu'],
    })
    expect(payload.product_ids).toEqual(['gpu'])
    expect(payload.variant_ids).toEqual([5, 1])
    expect(payload).not.toHaveProperty('specific_product_ids')
  })

  it('lists scalar variant attributes', () => {
    expect(variantAttributes({ attributes: { memory: 'DDR5', speed: 6000, nested: { a: 1 }, empty: '' } })).toEqual([
      { name: 'memory', value: 'DDR5' },
      { name: 'speed', value: '6000' },
    ])
  })
})
