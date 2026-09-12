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
      return Promise.resolve({ data: { items: [{ id: 5, name: 'Keyboard', price: 20 }] } })
    }
    return Promise.resolve({ data: { id: 99 } })
  })
  fetchCustomers.mockResolvedValue([
    { id: 3, name: 'Dara Sok', email: 'dara@example.com', phone: '012', address: 'Phnom Penh' },
  ])
}

async function fillRequiredFields(wrapper) {
  const selects = wrapper.findAll('select')
  await selects.find((s) => s.text().includes('Keyboard')).setValue(5)
  await selects.find((s) => s.text().includes('Dara Sok')).setValue(3)
  await selects.find((s) => s.text().includes('Cash on Delivery')).setValue('cod')
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
})
