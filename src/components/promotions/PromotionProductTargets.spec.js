import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PromotionProductTargets from '@/components/promotions/PromotionProductTargets.vue'
import { fetchPromotionProducts } from '@/services/promotions'

vi.mock('@/services/promotions', async () => {
  const actual = await vi.importActual('@/services/promotions')
  return { ...actual, fetchPromotionProducts: vi.fn() }
})

const PAGE_1 = [
  { id: 'a', name: 'Monitor', short_description: '27" IPS', price: 200, sale_price: null, thumbnail: 'https://cdn.test/m.png', category: { id: 1, name: 'Displays' } },
  { id: 'b', name: 'Keyboard', short_description: null, price: 50, sale_price: 40, thumbnail: null, category: { id: 2, name: 'Input' } },
]
const PAGE_2 = [{ id: 'c', name: 'Mouse', price: 30, sale_price: null, thumbnail: null, category: { id: 2, name: 'Input' } }]

// Mirrors v-model so selection changes flow back in like they do in the form.
function mountTable(props = {}) {
  const wrapper = mount(PromotionProductTargets, {
    props: {
      modelValue: [],
      categories: [{ id: 1, name: 'Displays' }, { id: 2, name: 'Input' }],
      discount: { type: 'percentage', value: '10', maxDiscount: '' },
      'onUpdate:modelValue': (value) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
  })
  return wrapper
}

const rowTexts = (wrapper) => wrapper.findAll('.ptargets__row').map((row) => row.text())

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

  it('shows the API’s product data with a per-unit discount preview', async () => {
    const wrapper = mountTable()
    await flushPromises()

    const [monitor, keyboard] = rowTexts(wrapper)
    expect(monitor).toContain('Monitor')
    expect(monitor).toContain('27" IPS')
    expect(monitor).toContain('Displays')
    expect(monitor).toContain('$200.00')
    expect(monitor).toContain('−$20.00')
    expect(monitor).toContain('$180.00')
    // Discounts the sale price, as checkout does, and shows the list price struck.
    expect(keyboard).toContain('$40.00')
    expect(keyboard).toContain('$50.00')
    expect(keyboard).toContain('$36.00')
    expect(wrapper.find('img.ptargets__thumb').attributes('src')).toBe('https://cdn.test/m.png')
    expect(wrapper.findAll('.ptargets__thumb--empty')).toHaveLength(1)
  })

  it('recomputes the preview when the discount changes', async () => {
    const wrapper = mountTable()
    await flushPromises()

    await wrapper.setProps({ discount: { type: 'fixed', value: '75', maxDiscount: '60' } })

    const [monitor, keyboard] = rowTexts(wrapper)
    expect(monitor).toContain('−$60.00')
    expect(monitor).toContain('$140.00')
    // Never below zero.
    expect(keyboard).toContain('−$40.00')
    expect(keyboard).toContain('$0.00')
  })

  it('searches by name, debounced, from the first page', async () => {
    vi.useFakeTimers()
    const wrapper = mountTable()
    await flushPromises()
    await wrapper.find('button:not([disabled])').trigger('click') // Next → page 2
    await flushPromises()

    await wrapper.find('#productSearch').setValue('mon')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(fetchPromotionProducts).toHaveBeenLastCalledWith(null, 'mon', 1, null)
  })

  it('filters by category', async () => {
    const wrapper = mountTable()
    await flushPromises()

    await wrapper.find('#productCategory').setValue('2')
    await flushPromises()

    expect(fetchPromotionProducts).toHaveBeenLastCalledWith(null, '', 1, '2')
  })

  it('pages through results and keeps selections across pages', async () => {
    const wrapper = mountTable()
    await flushPromises()

    await wrapper.find('.ptargets__row').trigger('click')
    const next = wrapper.findAll('.ptargets__pager button').find((button) => button.text() === 'Next')
    await next.trigger('click')
    await flushPromises()

    expect(rowTexts(wrapper)[0]).toContain('Mouse')
    expect(wrapper.text()).toContain('Page 2 of 2')
    await wrapper.find('.ptargets__row').trigger('click')

    expect(wrapper.props('modelValue')).toEqual(['a', 'c'])
    expect(wrapper.text()).toContain('2 products selected')
    expect(wrapper.find('.ptargets__chips').text()).toContain('Monitor')
    expect(wrapper.find('.ptargets__chips').text()).toContain('Mouse')
  })

  it('highlights selected rows and removes a selection from its chip', async () => {
    const wrapper = mountTable({ modelValue: ['b'] })
    await flushPromises()

    expect(wrapper.findAll('.ptargets__row--selected')).toHaveLength(1)
    await wrapper.find('.ptargets__chip button').trigger('click')

    expect(wrapper.props('modelValue')).toEqual([])
    expect(wrapper.findAll('.ptargets__row--selected')).toHaveLength(0)
  })

  it('selects and clears the whole page', async () => {
    const wrapper = mountTable({ modelValue: ['z'] })
    await flushPromises()

    await wrapper.find('thead input[type="checkbox"]').setValue(true)
    expect(wrapper.props('modelValue')).toEqual(['z', 'a', 'b'])

    await wrapper.findAll('.ptargets__link').find((button) => button.text() === 'Clear all').trigger('click')
    expect(wrapper.props('modelValue')).toEqual([])
  })

  it('names saved products that are not on the current page', async () => {
    const wrapper = mountTable({ modelValue: ['old'], known: [{ id: 'old', name: 'Legacy SSD' }] })
    await flushPromises()

    expect(wrapper.find('.ptargets__chips').text()).toContain('Legacy SSD')
  })

  it('shows empty and error states', async () => {
    fetchPromotionProducts.mockResolvedValueOnce({ items: [], currentPage: 1, lastPage: 1, total: 0 })
    const empty = mountTable()
    await flushPromises()
    expect(empty.text()).toContain('No products match these filters.')

    fetchPromotionProducts.mockRejectedValueOnce(new Error('Network down'))
    const failed = mountTable()
    await flushPromises()
    expect(failed.text()).toContain('Network down')
    expect(failed.text()).toContain('Retry')
  })
})
