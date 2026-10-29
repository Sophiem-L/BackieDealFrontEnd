import { describe, it, expect, vi, afterEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import PromotionVariantTargets from '@/components/promotions/PromotionVariantTargets.vue'
import { usePromotionTargets } from '@/composables/usePromotionTargets'

const CATALOG = {
  ram: {
    id: 'ram',
    name: 'Vengeance DDR5',
    sku: 'VEN',
    variants: [
      { id: 1, product_id: 'ram', name: '32GB', sku: 'R-32', price: 120, in_stock: true, stock_quantity: 4, is_active: true, attributes: { speed: '6000MHz' } },
      { id: 2, product_id: 'ram', name: '64GB', sku: 'R-64', price: 220, in_stock: false, is_active: true },
    ],
  },
  gpu: {
    id: 'gpu',
    name: 'RTX 5080',
    sku: 'RTX',
    variants: [{ id: 5, product_id: 'gpu', name: '16GB', sku: 'RTX-16', price: 1000, in_stock: true, is_active: true }],
  },
}

async function mountGroups(initial) {
  const form = reactive({ productIds: [], specificProductIds: [], variantIds: [], ...initial })
  const targets = usePromotionTargets(form, { loadProduct: vi.fn(async (id) => CATALOG[id]) })
  targets.rememberProducts([{ id: 'ram', name: 'Vengeance DDR5', sku: 'VEN', variants_count: 2 }, { id: 'gpu', name: 'RTX 5080', sku: 'RTX', variants_count: 1 }])
  await targets.hydrate({ products: [], variants: [] })
  const wrapper = mount(PromotionVariantTargets, { props: { targets } })
  await flushPromises()
  return { wrapper, form, targets }
}

const group = (wrapper, name) => wrapper.findAll('.vtargets__group').find((item) => item.text().includes(name))
const button = (root, text) => root.findAll('button').find((candidate) => candidate.text().startsWith(text))

describe('PromotionVariantTargets', () => {
  afterEach(() => vi.useRealTimers())

  it('groups variants under their products and opens narrowed products', async () => {
    const { wrapper } = await mountGroups({ productIds: ['gpu'], specificProductIds: ['ram'] })

    const ram = group(wrapper, 'Vengeance DDR5')
    expect(ram.text()).toContain('Specific variants')
    expect(ram.text()).toContain('0 of 2 variants')
    expect(ram.text()).toContain('Tick at least one variant')
    expect(ram.text()).toContain('32GB')
    expect(ram.text()).toContain('speed: 6000MHz')
    expect(ram.text()).toContain('R-32')

    const gpu = group(wrapper, 'RTX 5080')
    expect(gpu.text()).toContain('Whole product')
    expect(gpu.text()).toContain('All 1 variants')
    // Collapsed until asked.
    expect(gpu.text()).not.toContain('RTX-16')
  })

  it('ticks variants and drives the tri-state group checkbox', async () => {
    const { wrapper, form } = await mountGroups({ specificProductIds: ['ram'] })
    const ram = () => group(wrapper, 'Vengeance DDR5')
    const groupBox = () => ram().find('.vtargets__head input[type="checkbox"]')

    await ram().findAll('.vtargets__variant input')[0].setValue(true)
    expect(form.variantIds).toEqual([1])
    expect(groupBox().element.indeterminate).toBe(true)

    await groupBox().trigger('change')
    await flushPromises()
    expect(form.variantIds).toEqual([1, 2])
    expect(groupBox().element.checked).toBe(true)
    expect(groupBox().element.indeterminate).toBe(false)

    await groupBox().trigger('change')
    await flushPromises()
    expect(form.variantIds).toEqual([])
  })

  it('shows a whole product’s variants as included and locked', async () => {
    const { wrapper } = await mountGroups({ productIds: ['gpu'] })

    await group(wrapper, 'RTX 5080').find('.vtargets__toggle').trigger('click')
    await flushPromises()

    const checkbox = group(wrapper, 'RTX 5080').find('.vtargets__variant input')
    expect(checkbox.element.checked).toBe(true)
    expect(checkbox.attributes('disabled')).toBeDefined()
    expect(group(wrapper, 'RTX 5080').find('.vtargets__head input').attributes('disabled')).toBeDefined()
  })

  it('switches a group between whole product and specific variants', async () => {
    const { wrapper, form } = await mountGroups({ productIds: ['gpu'] })

    await button(group(wrapper, 'RTX 5080'), 'Choose variants').trigger('click')
    await flushPromises()
    expect(form.specificProductIds).toEqual(['gpu'])
    expect(group(wrapper, 'RTX 5080').text()).toContain('RTX-16')

    await button(group(wrapper, 'RTX 5080'), 'Use whole product').trigger('click')
    expect(form.productIds).toEqual(['gpu'])
  })

  it('searches variants by SKU without changing the selection', async () => {
    vi.useFakeTimers()
    const { wrapper, form } = await mountGroups({ productIds: ['gpu'], specificProductIds: ['ram'], variantIds: [1] })

    await wrapper.find('#variantSearch').setValue('rtx-16')
    vi.advanceTimersByTime(250)
    await flushPromises()

    expect(wrapper.findAll('.vtargets__group')).toHaveLength(1)
    expect(wrapper.text()).toContain('RTX-16')
    expect(form).toMatchObject({ productIds: ['gpu'], specificProductIds: ['ram'], variantIds: [1] })
  })

  it('filters selected and unselected variants', async () => {
    const { wrapper } = await mountGroups({ specificProductIds: ['ram'], variantIds: [1] })

    await button(wrapper, 'Selected').trigger('click')
    expect(group(wrapper, 'Vengeance DDR5').text()).toContain('32GB')
    expect(group(wrapper, 'Vengeance DDR5').text()).not.toContain('64GB')

    await button(wrapper, 'Unselected').trigger('click')
    expect(group(wrapper, 'Vengeance DDR5').text()).toContain('64GB')
    expect(group(wrapper, 'Vengeance DDR5').text()).not.toContain('R-32')
  })

  it('selects all shown variants and clears picks after confirming', async () => {
    const { wrapper, form } = await mountGroups({ productIds: ['gpu'], specificProductIds: ['ram'] })

    await button(wrapper, 'Select all shown').trigger('click')
    expect(form.variantIds).toEqual([1, 2])
    expect(wrapper.find('.vtargets__summary').text()).toContain('1 narrowed to 2 variants')

    await button(wrapper, 'Clear variant picks').trigger('click')
    await button(wrapper, 'Untick all').trigger('click')
    expect(form.variantIds).toEqual([])
    expect(form.specificProductIds).toEqual(['ram'])
  })
})
