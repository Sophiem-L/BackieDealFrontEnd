import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CustomersView from '@/views/CustomersView.vue'
import { deleteCustomer, fetchCustomers } from '@/services/customers'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/customers', async () => {
  const actual = await vi.importActual('@/services/customers')
  return { ...actual, fetchCustomers: vi.fn(), deleteCustomer: vi.fn() }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
}

function customer(overrides = {}) {
  return {
    id: 7,
    name: 'Dara Sok',
    email: 'dara@example.com',
    avatar: '',
    tone: 'blue',
    status: 'active',
    orders: 2,
    spent: '$20.00',
    ...overrides,
  }
}

async function mountList(customers) {
  fetchCustomers.mockResolvedValue(customers)
  const wrapper = mount(CustomersView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('CustomersView - delete feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useAuthStore().user = { permissions: ['customers.delete'] }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  async function clickDelete(wrapper) {
    await wrapper.find('[aria-label="Delete customer"]').trigger('click')
    await flushPromises()
  }

  it('toasts a success once the customer is deleted', async () => {
    deleteCustomer.mockResolvedValueOnce(undefined)
    const wrapper = await mountList([customer()])

    await clickDelete(wrapper)

    expect(wrapper.find('.customer__name').exists()).toBe(false)
    expect(useToastStore().toasts).toMatchObject([
      { type: 'delete', title: 'Customer deleted', message: 'Dara Sok was removed.' },
    ])
  })

  it('toasts the server message when the delete fails', async () => {
    deleteCustomer.mockRejectedValueOnce(new Error('Customer has open orders.'))
    const wrapper = await mountList([customer()])

    await clickDelete(wrapper)

    expect(wrapper.find('.customer__name').exists()).toBe(true)
    expect(useToastStore().toasts).toMatchObject([
      { type: 'error', title: 'Could not delete customer', message: 'Customer has open orders.' },
    ])
  })
})
