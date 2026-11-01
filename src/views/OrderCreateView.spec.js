import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OrderCreateView from '@/views/OrderCreateView.vue'
import { apiFetch } from '@/services/api'
import { fetchCustomers } from '@/services/customers'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
}))

vi.mock('@/services/customers', () => ({ fetchCustomers: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

// The pickers are the vendored shadcn Select, which renders its options
// into a portal behind pointer interactions jsdom does not implement. Stubbing
// the family down to a native select keeps these tests on what this view owns —
// the values it offers and the payload it builds — rather than on reka-ui's
// popup behaviour, which its own package already covers.
const selectStubs = {
  Select: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`,
  },
  SelectTrigger: { render: () => null },
  SelectValue: { render: () => null },
  SelectContent: { template: '<slot />' },
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
}

const stubs = {
  // The product picker is teleported to <body>; rendered in place, the
  // wrapper can reach it.
  teleport: true,
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button :disabled="disabled"><slot /></button>', props: ['disabled'] },
  ...selectStubs,
}

// The reference-data load fires on mount; the POST is the second call.
function mockReferenceData() {
  apiFetch.mockImplementation((path) => {
    if (path.startsWith('/admin/products')) {
      return Promise.resolve({ data: { items: [{ id: 5, name: 'Keyboard', description: 'Mechanical keyboard', sku: 'KEY-5', price: 20, stock_quantity: 12 }], pagination: { current_page: 1, last_page: 1 } } })
    }
    return Promise.resolve({ data: { id: 99 } })
  })
  fetchCustomers.mockResolvedValue([
    { id: 3, name: 'Dara Sok', email: 'dara@example.com', phone: '012', address: 'Phnom Penh' },
  ])
}

async function fillRequiredFields(wrapper) {
  await wrapper.find('button[aria-label="Add Products"]').trigger('click')
  await flushPromises()
  await wrapper.find('.product-option input[type="checkbox"]').setValue(true)
  await wrapper.findAll('button').find((button) => button.text().includes('Add Selected Products')).trigger('click')
  wrapper.vm.customerId = 3
  wrapper.vm.payment.method = 'cod'
  await flushPromises()
}

function submittedPayload() {
  const post = apiFetch.mock.calls.find(([, options]) => options?.method === 'POST')
  return post?.[1]?.body
}

async function submit(wrapper) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('OrderCreateView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockReferenceData()
  })

  // The API validates customer_id with exists:users,id and the picked-customer
  // panel matches on ===, so the id has to stay a number once it leaves the
  // select. Guards the coercion the native <select>'s .number modifier used to
  // do for free.
  it('sends the customer id as a number', async () => {
    const wrapper = mount(OrderCreateView, { global: { stubs } })
    await flushPromises()
    await fillRequiredFields(wrapper)

    await submit(wrapper)

    expect(submittedPayload().customer_id).toBe(3)
  })

  it('shows the picked customer once one is chosen', async () => {
    const wrapper = mount(OrderCreateView, { global: { stubs } })
    await flushPromises()
    await fillRequiredFields(wrapper)

    expect(wrapper.text()).toContain('dara@example.com')
  })

  it('merges selected products instead of adding duplicate order rows', async () => {
    const wrapper = mount(OrderCreateView, { global: { stubs } })
    await flushPromises()
    await fillRequiredFields(wrapper)
    expect(wrapper.findAll('.order-product')).toHaveLength(1)
    expect(wrapper.text()).toContain('Keyboard')
  })
})

describe('OrderCreateView — shipping method', () => {
  const COURIER = { id: 1, name: 'Courier', fee: '5.00', available: true, estimated_delivery: '1-3 days' }

  // `courierAvailable` is what the preview reports for the order's weight.
  function mockShipping({ courierAvailable = true } = {}) {
    apiFetch.mockImplementation((path, options) => {
      if (path === '/admin/orders/shipping-methods') return Promise.resolve({ data: [COURIER] })
      if (path === '/admin/orders/preview') {
        const picked = options.body.shipping_method_id === 1 && courierAvailable
        return Promise.resolve({
          data: {
            items: [],
            subtotal: '20.00',
            promotion_discount: '0.00',
            tax_total: '0.00',
            shipping_options: [{ ...COURIER, fee: '14.00', available: courierAvailable }],
            shipping_method: picked ? { ...COURIER, fee: '14.00' } : null,
            shipping_total: picked ? '14.00' : '0.00',
            total: picked ? '34.00' : '20.00',
          },
        })
      }
      if (path.startsWith('/admin/products')) {
        return Promise.resolve({ data: { items: [{ id: 5, name: 'Keyboard', sku: 'KEY-5', price: 20, stock_quantity: 12 }], pagination: {} } })
      }
      return Promise.resolve({ data: { id: 99 } })
    })
  }

  async function mountWithLine() {
    const wrapper = mount(OrderCreateView, { global: { stubs } })
    await flushPromises()
    wrapper.vm.items.push({ productId: 5, qty: 1, unitPrice: 20, product: { id: 5, name: 'Keyboard' } })
    wrapper.vm.customerId = 3
    wrapper.vm.payment.method = 'cod'
    await flushPromises()
    return wrapper
  }

  async function pick(wrapper, name) {
    const option = wrapper.findAll('.shipping__option').find((o) => o.text().includes(name))
    await option.find('input').trigger('change')
    vi.advanceTimersByTime(300)
    await flushPromises()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchCustomers.mockResolvedValue([{ id: 3, name: 'Dara Sok', email: 'dara@example.com' }])
  })

  afterEach(() => vi.useRealTimers())

  it('prices the picked method through the preview and submits only its id', async () => {
    mockShipping()
    const wrapper = await mountWithLine()

    await pick(wrapper, 'Courier')

    const previewBody = apiFetch.mock.calls.filter(([path]) => path === '/admin/orders/preview').at(-1)[1].body
    expect(previewBody.shipping_method_id).toBe(1)
    expect(wrapper.find('.summary').text()).toContain('Shipping · Courier')
    expect(wrapper.find('.summary').text()).toContain('$14.00')
    expect(wrapper.find('.summary__row--total').text()).toContain('$34.00')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const order = apiFetch.mock.calls.find(([path]) => path === '/admin/orders')[1].body
    expect(order.shipping_method_id).toBe(1)
    expect(order).not.toHaveProperty('shipping_total')
  })

  it('sends no shipping method when none is picked', async () => {
    mockShipping()
    const wrapper = await mountWithLine()
    vi.advanceTimersByTime(300)
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const order = apiFetch.mock.calls.find(([path]) => path === '/admin/orders')[1].body
    expect(order).not.toHaveProperty('shipping_method_id')
    expect(order).not.toHaveProperty('shipping_total')
  })

  it('will not save with a method that cannot carry the order', async () => {
    mockShipping({ courierAvailable: false })
    const wrapper = await mountWithLine()
    wrapper.vm.shippingMethodId = 1
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain("can't be used for this order")

    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(apiFetch.mock.calls.some(([path]) => path === '/admin/orders')).toBe(false)
  })
})
