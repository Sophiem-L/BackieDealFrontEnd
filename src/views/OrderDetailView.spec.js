import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OrderDetailView from '@/views/OrderDetailView.vue'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
}))

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'abc-123' }, query: {} }),
  useRouter: () => ({ push, back: vi.fn() }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
}

function order(tracking) {
  return {
    id: 'abc-123',
    order_number: 'ORD-1',
    status: 'pending',
    subtotal: 20,
    total: 20,
    payment: { method: 'cod', status: 'pending' },
    customer: { id: 3, name: 'Dara Sok', email: 'dara@example.com' },
    items: [],
    tracking,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  }
}

function deliveryRow(wrapper) {
  return wrapper.findAll('.kv__row').find((row) => row.find('dt').text() === 'Delivery')
}

describe('OrderDetailView customer link', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('opens that customer in the Customers section', async () => {
    apiFetch.mockResolvedValue({ data: order({ status: 'pending' }) })

    const wrapper = mount(OrderDetailView, { global: { stubs } })
    await flushPromises()
    await wrapper.find('.customer--link').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'customer-detail', params: { id: 3 } })
  })

  // `customer.id` is the users row, which OrderResource nulls out when the
  // account behind an order has been deleted. There is no page to open then.
  it('falls back to the customer list when the order has no customer id', async () => {
    const data = order({ status: 'pending' })
    data.customer = { id: null, name: 'Deleted account', email: null }
    apiFetch.mockResolvedValue({ data })

    const wrapper = mount(OrderDetailView, { global: { stubs } })
    await flushPromises()
    await wrapper.find('.customer--link').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'customers' })
  })
})

describe('OrderDetailView delivery status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows the delivery status the API returns', async () => {
    apiFetch.mockResolvedValue({ data: order({ status: 'delivered', number: null }) })

    const wrapper = mount(OrderDetailView, { global: { stubs } })
    await flushPromises()

    expect(deliveryRow(wrapper).find('dd').text()).toBe('Delivered')
  })

  it('falls back to Pending when the order carries no tracking block', async () => {
    apiFetch.mockResolvedValue({ data: order(undefined) })

    const wrapper = mount(OrderDetailView, { global: { stubs } })
    await flushPromises()

    expect(deliveryRow(wrapper).find('dd').text()).toBe('Pending')
  })
})
