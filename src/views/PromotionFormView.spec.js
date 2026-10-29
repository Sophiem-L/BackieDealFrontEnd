import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PromotionFormView from '@/views/PromotionFormView.vue'
import {
  fetchPromotion,
  fetchPromotionCategories,
  fetchPromotionCustomerGroups,
  fetchPromotionProducts,
  promotionPayload,
  savePromotion,
} from '@/services/promotions'

vi.mock('@/services/promotions', async () => {
  // The pure helpers are the real ones — only the network calls are stubbed.
  const actual = await vi.importActual('@/services/promotions')
  return {
    ...actual,
    fetchPromotion: vi.fn(),
    savePromotion: vi.fn(),
    fetchPromotionProducts: vi.fn(),
    fetchPromotionCategories: vi.fn(),
    fetchPromotionCustomerGroups: vi.fn(),
    fetchPromotionTargetProduct: vi.fn(async (id) => ({ id, variants: [] })),
  }
})
vi.mock('@/services/media', () => ({ uploadImage: vi.fn() }))

const route = { params: {} }
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
}))

const PRODUCTS = [
  { id: 'p-1', name: 'RTX 5080', short_description: 'GPU', price: 1000, sale_price: null, thumbnail: null, category: { id: 1, name: 'GPUs' } },
  { id: 'p-2', name: 'Ryzen 9', short_description: 'CPU', price: 500, sale_price: 400, thumbnail: 'https://cdn.test/r9.png', category: { id: 2, name: 'CPUs' } },
]
const CATEGORIES = [
  { id: 1, name: 'GPUs', is_active: true, parent: { id: 9, name: 'Components' } },
  { id: 2, name: 'CPUs', is_active: true },
]
const GROUPS = [{ id: 7, name: 'VIP', description: 'Top spenders', users_count: 3 }]

function stubTargetApis() {
  fetchPromotionProducts.mockResolvedValue({ items: PRODUCTS, currentPage: 1, lastPage: 1, total: 2 })
  fetchPromotionCategories.mockResolvedValue({ items: CATEGORIES, currentPage: 1, lastPage: 1 })
  fetchPromotionCustomerGroups.mockResolvedValue({ items: GROUPS, currentPage: 1, lastPage: 1 })
}

function createButton(wrapper) {
  return wrapper.findAll('button').find((button) => button.text().includes('Create Promotion'))
}

function targetRadio(wrapper, value) {
  return wrapper.find(`input[name="targetType"][value="${value}"]`)
}

async function selectFirstProduct(wrapper) {
  await flushPromises()
  await wrapper.find('.ptargets__row input[type="checkbox"]').setValue(true)
}

// The reka-ui Select is replaced by a native one so a test can pick a value.
const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  ToggleSwitch: { template: '<input type="checkbox" />' },
  RouterLink: { template: '<a><slot /></a>' },
  Select: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  },
  // The trigger and its value render nothing: a <select> only accepts <option>
  // children, and anything else in there makes setValue a no-op. That also
  // takes the trigger's id with it, hence the positional helpers below.
  SelectTrigger: { render: () => null },
  SelectContent: { template: '<slot />' },
  SelectValue: { render: () => null },
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
}

function mountForm() {
  return mount(PromotionFormView, { global: { stubs } })
}

// The form keeps the campaign kind and the discount style in separate controls.
function kindSelect(wrapper) {
  return wrapper.findAll('select')[0]
}

function typeSelect(wrapper) {
  return wrapper.findAll('select')[1]
}

async function chooseFlashSale(wrapper) {
  await kindSelect(wrapper).setValue('Flash Sale')
}

describe('PromotionFormView — campaign kinds', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    route.params = {}
    stubTargetApis()
  })

  it('offers every campaign kind', () => {
    const text = mountForm().text()

    expect(text).toContain('Standard')
    expect(text).toContain('Flash Sale')
    expect(text).toContain('Buy One Get One')
    expect(text).toContain('Free Shipping')
    expect(text).toContain('Bundle Deal')
    expect(text).toContain('Free Gift')
    expect(text).toContain('Coupon')
  })

  it('keeps the discount choice separate from the promotion kind', () => {
    const options = typeSelect(mountForm()).findAll('option').map((option) => option.text())

    expect(options).toContain('Percentage Discount')
    expect(options).toContain('Fixed Amount')
  })

  it('starts a new promotion as a standard percentage discount', () => {
    const wrapper = mountForm()

    expect(kindSelect(wrapper).element.value).toBe('Standard')
    expect(typeSelect(wrapper).element.value).toBe('Percentage Discount')
  })

  it('sends the kind and the discount as separate choices', async () => {
    // The point of the split: a BOGO can take a flat amount off.
    const wrapper = mountForm()
    await kindSelect(wrapper).setValue('Buy One Get One')
    await typeSelect(wrapper).setValue('Fixed Amount')
    await wrapper.find('#name').setValue('Two for one')
    await wrapper.find('#code').setValue('BOGO26')
    await selectFirstProduct(wrapper)

    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(savePromotion).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ kind: 'Buy One Get One', type: 'Fixed Amount' }),
      null,
    )
  })

  it('marks the discount value as a percentage by default', () => {
    expect(mountForm().find('.affix--suffix').text()).toBe('%')
  })

  it('marks the discount value as money once a fixed amount is chosen', async () => {
    const wrapper = mountForm()
    await typeSelect(wrapper).setValue('Fixed Amount')

    expect(wrapper.find('.affix--suffix').exists()).toBe(false)
    expect(wrapper.find('#discount').element.previousElementSibling.textContent).toBe('$')
  })

  it('leaves the dates alone for a kind that is not a flash sale', async () => {
    const wrapper = mountForm()
    await kindSelect(wrapper).setValue('Free Shipping')

    expect(wrapper.find('#start').exists()).toBe(true)
    expect(wrapper.find('#end').exists()).toBe(true)
    expect(wrapper.find('#flashDuration').exists()).toBe(false)
  })
})

describe('PromotionFormView — flash sales', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    route.params = {}
    stubTargetApis()
  })

  it('replaces the end date with a duration once flash sale is picked', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)

    expect(wrapper.find('#flashDuration').exists()).toBe(true)
    expect(wrapper.find('#end').exists()).toBe(false)
  })

  it('defaults a flash sale to three hours', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)

    expect(wrapper.find('#flashDuration').element.value).toBe('3')
  })

  it('seeds the start with the current time rather than leaving it blank', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)

    const seeded = new Date(wrapper.find('#flashStart').element.value).getTime()

    expect(Math.abs(seeded - Date.now())).toBeLessThan(60_000)
  })

  it('previews when the sale will end', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)
    await wrapper.find('#flashStart').setValue('2026-08-30T14:00')

    expect(wrapper.text()).toContain('5:00')
  })

  it('moves the preview when the duration changes', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)
    await wrapper.find('#flashStart').setValue('2026-08-30T14:00')
    await wrapper.find('#flashDuration').setValue('6')

    expect(wrapper.text()).toContain('8:00')
  })

  it('restores the end date when the admin switches back to a standard promotion', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)
    await kindSelect(wrapper).setValue('Standard')

    expect(wrapper.find('#end').exists()).toBe(true)
    expect(wrapper.find('#flashDuration').exists()).toBe(false)
  })

  it('saves the chosen window', async () => {
    const wrapper = mountForm()
    await chooseFlashSale(wrapper)
    await wrapper.find('#flashStart').setValue('2026-08-30T14:00')
    await wrapper.find('#name').setValue('Three Hour Frenzy')
    await wrapper.find('#code').setValue('FLASH3')
    await wrapper.find('#discount').setValue('25')
    await selectFirstProduct(wrapper)

    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(savePromotion).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kind: 'Flash Sale',
        startDateTime: '2026-08-30T14:00',
        flashDurationHours: '3',
      }),
      null,
    )
  })
})

describe('PromotionFormView — targeting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    route.params = {}
    stubTargetApis()
  })

  it('offers the three target types as one radio group, products first', async () => {
    const wrapper = mountForm()
    await flushPromises()

    const radios = wrapper.findAll('input[name="targetType"]')
    expect(radios.map((radio) => radio.element.value)).toEqual(['products', 'categories', 'customer_groups'])
    expect(targetRadio(wrapper, 'products').element.checked).toBe(true)
    expect(wrapper.find('.ptargets').exists()).toBe(true)
  })

  it('shows only the chosen target type’s selector', async () => {
    const wrapper = mountForm()
    await flushPromises()

    await targetRadio(wrapper, 'categories').setValue(true)
    expect(wrapper.find('.ptargets').exists()).toBe(false)
    expect(wrapper.find('#categorySearch').exists()).toBe(true)
    expect(wrapper.text()).toContain('in Components')

    await targetRadio(wrapper, 'customer_groups').setValue(true)
    expect(wrapper.find('#categorySearch').exists()).toBe(false)
    expect(wrapper.text()).toContain('Top spenders')
    expect(wrapper.text()).toContain('3 members')
  })

  it('clears the previous selection when the target type changes', async () => {
    const wrapper = mountForm()
    await selectFirstProduct(wrapper)
    expect(wrapper.text()).toContain('1 product selected')

    await targetRadio(wrapper, 'categories').setValue(true)
    await targetRadio(wrapper, 'products').setValue(true)
    await flushPromises()

    expect(wrapper.text()).toContain('0 products selected')
  })

  it('blocks saving without a target and says what is missing', async () => {
    const wrapper = mountForm()
    await flushPromises()
    await targetRadio(wrapper, 'customer_groups').setValue(true)

    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(savePromotion).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Select at least one customer group.')
  })

  it('saves only the chosen target type’s ids', async () => {
    const wrapper = mountForm()
    await flushPromises()
    await targetRadio(wrapper, 'categories').setValue(true)
    await wrapper.find('.targeting__list input[type="checkbox"]').setValue(true)

    await createButton(wrapper).trigger('click')
    await flushPromises()

    const [, form] = savePromotion.mock.calls[0]
    expect(promotionPayload(form)).toMatchObject({ target_type: 'categories', category_ids: [1] })
    expect(promotionPayload(form)).not.toHaveProperty('product_ids')
    expect(promotionPayload(form)).not.toHaveProperty('customer_group_ids')
  })

  it('shows the API’s target errors next to the selector', async () => {
    savePromotion.mockRejectedValueOnce({ status: 422, errors: { 'product_ids.0': ['A selected product does not exist or is inactive.'] } })
    const wrapper = mountForm()
    await selectFirstProduct(wrapper)

    await createButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.ptargets').text()).toContain('A selected product does not exist or is inactive.')
  })

  it('restores a saved category promotion on edit', async () => {
    route.params = { id: '12' }
    fetchPromotion.mockResolvedValue({
      id: 12,
      name: 'GPU week',
      code: 'GPU',
      type: 'percentage',
      value: '10.00',
      is_active: true,
      target_type: 'categories',
      include_subcategories: true,
      products: [],
      categories: [{ id: 1, name: 'GPUs' }],
      customer_groups: [],
      variants: [],
    })
    const wrapper = mount(PromotionFormView, { global: { stubs } })
    await flushPromises()

    expect(targetRadio(wrapper, 'categories').element.checked).toBe(true)
    expect(wrapper.text()).toContain('1 category selected')
    expect(wrapper.find('.targeting__toggle input').element.checked).toBe(true)
  })

  it('restores saved products, including ones not on the current page', async () => {
    route.params = { id: '13' }
    fetchPromotion.mockResolvedValue({
      id: 13,
      name: 'Old stock',
      code: 'OLD',
      type: 'fixed',
      value: '5.00',
      is_active: true,
      target_type: 'products',
      products: [{ id: 'p-99', name: 'Legacy SSD', price: 80 }],
      categories: [],
      customer_groups: [],
      variants: [],
    })
    const wrapper = mount(PromotionFormView, { global: { stubs } })
    await flushPromises()

    expect(targetRadio(wrapper, 'products').element.checked).toBe(true)
    expect(wrapper.find('.ptargets__chips').text()).toContain('Legacy SSD')
  })

  it('warns when a legacy promotion has more than one kind of target', async () => {
    route.params = { id: '14' }
    fetchPromotion.mockResolvedValue({
      id: 14,
      name: 'Mixed',
      code: 'MIX',
      type: 'percentage',
      value: '5.00',
      is_active: true,
      target_type: 'products',
      products: [{ id: 'p-1', name: 'RTX 5080' }],
      categories: [],
      customer_groups: [{ id: 7, name: 'VIP' }],
      variants: [],
    })
    const wrapper = mount(PromotionFormView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('more than one kind of target')
  })
})
