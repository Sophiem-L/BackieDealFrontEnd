import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  await wrapper.find('button').filter((button) => button.text().includes('Add Selected Products')).trigger('click')
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
