import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PromotionFormView from '@/views/PromotionFormView.vue'
import { savePromotion } from '@/services/promotions'

vi.mock('@/services/promotions', async () => {
  // The pure helpers are the real ones — only the network calls are stubbed.
  const actual = await vi.importActual('@/services/promotions')
  return { ...actual, fetchPromotion: vi.fn(), savePromotion: vi.fn() }
})
vi.mock('@/services/media', () => ({ uploadImage: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

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

// The combined promotion-type selector includes both the campaign kind and the
// discount style in a single list.
function typeSelect(wrapper) {
  return wrapper.findAll('select')[0]
}

async function chooseFlashSale(wrapper) {
  await typeSelect(wrapper).setValue('Flash Sale|Percentage Discount')
}

describe('PromotionFormView — campaign kinds', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('offers every campaign kind', () => {
    const text = mountForm().text()

    expect(text).toContain('Flash Sale - Percentage Discount')
    expect(text).toContain('Buy One Get One - Percentage Discount')
    expect(text).toContain('Free Shipping - Percentage Discount')
    expect(text).toContain('Bundle Deal - Percentage Discount')
    expect(text).toContain('Free Gift - Percentage Discount')
    expect(text).toContain('Coupon - Percentage Discount')
  })

  it('keeps the discount choice inside the promotion type selector', () => {
    const options = typeSelect(mountForm()).findAll('option').map((option) => option.text())

    expect(options).toContain('Standard - Percentage Discount')
    expect(options).toContain('Standard - Fixed Amount')
    expect(options).toContain('Flash Sale - Fixed Amount')
  })

  it('starts a new promotion as a standard percentage discount', () => {
    const wrapper = mountForm()

    expect(typeSelect(wrapper).element.value).toBe('Standard|Percentage Discount')
  })

  it('sends the kind and the discount as separate choices', async () => {
    // The point of the split: a BOGO can take a flat amount off.
    const wrapper = mountForm()
    await typeSelect(wrapper).setValue('Buy One Get One|Fixed Amount')
    await wrapper.find('#name').setValue('Two for one')
    await wrapper.find('#code').setValue('BOGO26')

    await wrapper.findAll('button').find((button) => button.text().includes('Create Promotion')).trigger('click')
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
    await typeSelect(wrapper).setValue('Standard|Fixed Amount')

    expect(wrapper.find('.affix--suffix').exists()).toBe(false)
    expect(wrapper.find('#discount').element.previousElementSibling.textContent).toBe('$')
  })

  it('leaves the dates alone for a kind that is not a flash sale', async () => {
    const wrapper = mountForm()
    await typeSelect(wrapper).setValue('Free Shipping|Percentage Discount')

    expect(wrapper.find('#end').exists()).toBe(true)
    expect(wrapper.find('#flashDuration').exists()).toBe(false)
  })
})

describe('PromotionFormView — flash sales', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
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
    await typeSelect(wrapper).setValue('Standard|Percentage Discount')

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

    await wrapper.findAll('button').find((button) => button.text().includes('Create Promotion')).trigger('click')
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
