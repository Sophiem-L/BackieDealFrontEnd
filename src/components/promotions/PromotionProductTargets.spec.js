import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import PromotionProductTargets from '@/components/promotions/PromotionProductTargets.vue'
import { usePromotionTargets } from '@/composables/usePromotionTargets'
import { fetchAllPromotionProducts, fetchPromotionProducts } from '@/services/promotions'

vi.mock('@/services/promotions', async () => {
  const actual = await vi.importActual('@/services/promotions')
  return { ...actual, fetchPromotionProducts: vi.fn(), fetchAllPromotionProducts: vi.fn() }
})

const PAGE_1 = [
  { id: 'a', name: 'Monitor', sku: 'MON-27', short_description: '27" IPS', price: 200, sale_price: null, thumbnail: 'https://cdn.test/m.png', category: { id: 1, name: 'Displays' }, variants_count: 2 },
  { id: 'b', name: 'Keyboard', sku: 'KB-1', short_description: null, price: 50, sale_price: 40, thumbnail: null, category: { id: 2, name: 'Input' }, variants_count: 0 },
]
const PAGE_2 = [{ id: 'c', name: 'Mouse', price: 30, sale_price: null, thumbnail: null, category: { id: 2, name: 'Input' }, variants_count: 3 }]

function mountTable(initial = {}, props = {}) {
  const form = reactive({ productIds: [], specificProductIds: [], variantIds: [], ...initial })
  const targets = usePromotionTargets(form, { loadProduct: vi.fn(async (id) => ({ id, variants: [] })) })
  const wrapper = mount(PromotionProductTargets, {
    props: {
      targets,
      categories: [{ id: 1, name: 'Displays' }, { id: 2, name: 'Input' }],
      discount: { type: 'percentage', value: '10', maxDiscount: '' },
      ...props,
    },
  })
  return { wrapper, form, targets }
}

const rowTexts = (wrapper) => wrapper.findAll('.ptargets__row').map((row) => row.text())
const button = (wrapper, text) => wrapper.findAll('button').find((candidate) => candidate.text().startsWith(text))

describe('PromotionProductTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPromotionProducts.mockImplementation(async (_token, _search, page) =>
      page === 2
        ? { items: PAGE_2, currentPage: 2, lastPage: 2, total: 3 }
        : { items: PAGE_1, currentPage: 1, lastPage: 2, total: 3 },
    )
  })

  afterEach(() => vi.useRealTimers())

  it('shows product data, SKU, variant count and a per-unit discount preview', async () => {
    const { wrapper } = mountTable()
    await flushPromises()

    const [monitor, keyboard] = rowTexts(wrapper)
    expect(monitor).toContain('Monitor')
    expect(monitor).toContain('SKU MON-27')
    expect(monitor).toContain('Displays')
    expect(monitor).toContain('$200.00')
    expect(monitor).toContain('−$20.00')
    expect(monitor).toContain('$180.00')
    expect(wrapper.findAll('.ptargets__row')[0].findAll('td')[3].text()).toBe('2')
    // Discounts the sale price, as checkout does, and shows the list price struck.
    expect(keyboard).toContain('$40.00')
    expect(keyboard).toContain('$50.00')
    expect(keyboard).toContain('$36.00')
    expect(wrapper.find('img.ptargets__thumb').attributes('src')).toBe('https://cdn.test/m.png')
  })

  it('recomputes the preview when the discount changes', async () => {
    const { wrapper } = mountTable()
    await flushPromises()

    await wrapper.setProps({ discount: { type: 'fixed', value: '75', maxDiscount: '60' } })

    const [monitor, keyboard] = rowTexts(wrapper)
    expect(monitor).toContain('−$60.00')
    expect(monitor).toContain('$140.00')
    expect(keyboard).toContain('−$40.00')
    expect(keyboard).toContain('$0.00')
  })

  it('searches by name or SKU, debounced, from the first page', async () => {
    vi.useFakeTimers()
    const { wrapper } = mountTable()
    await flushPromises()
    await button(wrapper, 'Next').trigger('click')
    await flushPromises()

    await wrapper.find('#productSearch').setValue('MON-27')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(fetchPromotionProducts).toHaveBeenLastCalledWith(null, 'MON-27', 1, null)
  })

  it('filters by category', async () => {
    const { wrapper } = mountTable()
    await flushPromises()

    await wrapper.find('#productCategory').setValue('2')
    await flushPromises()

    expect(fetchPromotionProducts).toHaveBeenLastCalledWith(null, '', 1, '2')
  })

  it('keeps selections across pages and searches', async () => {
    const { wrapper, form } = mountTable()
    await flushPromises()

    await wrapper.find('.ptargets__row').trigger('click')
    await button(wrapper, 'Next').trigger('click')
    await flushPromises()
    await wrapper.find('.ptargets__row').trigger('click')

    expect(form.productIds).toEqual(['a', 'c'])
    expect(wrapper.text()).toContain('2 products selected')
  })

  it('shows tri-state rows and switches a product between whole and specific variants', async () => {
    const { wrapper, form } = mountTable({ productIds: ['a'] })
    await flushPromises()

    const checkbox = wrapper.find('.ptargets__row input[type="checkbox"]')
    expect(checkbox.element.checked).toBe(true)

    await button(wrapper, 'Specific variants').trigger('click')
    expect(form.productIds).toEqual([])
    expect(form.specificProductIds).toEqual(['a'])
    expect(checkbox.element.indeterminate).toBe(true)
    expect(wrapper.find('.ptargets__row--partial').exists()).toBe(true)

    await button(wrapper, 'Whole product').trigger('click')
    expect(form.productIds).toEqual(['a'])
  })

  it('cannot narrow a product without variants', async () => {
    const { wrapper } = mountTable({ productIds: ['b'] })
    await flushPromises()

    const keyboardRow = wrapper.findAll('.ptargets__row')[1]
    const narrow = keyboardRow.findAll('button').find((candidate) => candidate.text() === 'Specific variants')
    expect(narrow.attributes('disabled')).toBeDefined()
  })

  it('selects and clears the page from the header checkbox', async () => {
    const { wrapper, form } = mountTable({ productIds: ['z'] })
    await flushPromises()

    await wrapper.find('thead input[type="checkbox"]').setValue(true)
    expect(form.productIds).toEqual(['z', 'a', 'b'])

    await wrapper.find('thead input[type="checkbox"]').setValue(false)
    expect(form.productIds).toEqual(['z'])
  })

  it('selects every product matching the search, across pages', async () => {
    fetchAllPromotionProducts.mockResolvedValue([...PAGE_1, ...PAGE_2])
    const { wrapper, form } = mountTable({ specificProductIds: ['c'] })
    await flushPromises()

    await button(wrapper, 'Select all 3 matching').trigger('click')
    await flushPromises()

    expect(fetchAllPromotionProducts).toHaveBeenCalledWith(null, '', null)
    // An already-narrowed product keeps its variant targeting.
    expect(form.productIds).toEqual(['a', 'b'])
    expect(form.specificProductIds).toEqual(['c'])
    expect(wrapper.text()).toContain('Added 2 products as whole products.')
  })

  it('shows only the selection in the Selected view, without a request', async () => {
    const { wrapper, targets } = mountTable({ productIds: ['old'] })
    targets.rememberProducts([{ id: 'old', name: 'Legacy SSD', sku: 'SSD-1' }])
    await flushPromises()
    const calls = fetchPromotionProducts.mock.calls.length

    await button(wrapper, 'Selected').trigger('click')

    expect(rowTexts(wrapper)).toHaveLength(1)
    expect(rowTexts(wrapper)[0]).toContain('Legacy SSD')
    expect(fetchPromotionProducts.mock.calls.length).toBe(calls)
  })

  it('asks before clearing the whole selection', async () => {
    const { wrapper, form } = mountTable({ productIds: ['a'], specificProductIds: ['c'], variantIds: [7] })
    await flushPromises()

    await button(wrapper, 'Clear selection').trigger('click')
    expect(form.productIds).toEqual(['a'])

    await button(wrapper, 'Keep').trigger('click')
    expect(form.productIds).toEqual(['a'])

    await button(wrapper, 'Clear selection').trigger('click')
    await button(wrapper, 'Remove all').trigger('click')
    expect(form).toMatchObject({ productIds: [], specificProductIds: [], variantIds: [] })
  })

  it('shows empty and error states', async () => {
    fetchPromotionProducts.mockResolvedValueOnce({ items: [], currentPage: 1, lastPage: 1, total: 0 })
    const { wrapper: empty } = mountTable()
    await flushPromises()
    expect(empty.text()).toContain('No products match these filters.')

    fetchPromotionProducts.mockRejectedValueOnce(new Error('Network down'))
    const { wrapper: failed } = mountTable()
    await flushPromises()
    expect(failed.text()).toContain('Network down')
    expect(failed.text()).toContain('Retry')
  })
})
