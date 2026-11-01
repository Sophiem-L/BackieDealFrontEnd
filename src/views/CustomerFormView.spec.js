import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CustomerFormView from '@/views/CustomerFormView.vue'
import { saveCustomer } from '@/services/customers'
import { useToastStore } from '@/stores/toasts'

const push = vi.fn()

vi.mock('@/services/customers', async () => {
  const actual = await vi.importActual('@/services/customers')
  return { ...actual, fetchCustomer: vi.fn(), saveCustomer: vi.fn() }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
}

describe('CustomerFormView - save feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function submit(wrapper) {
    await wrapper.find('input[type="text"]').setValue('Dara Sok')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
  }

  it('toasts a success, then returns to the list', async () => {
    saveCustomer.mockResolvedValueOnce({ id: 7 })
    const wrapper = mount(CustomerFormView, { global: { stubs } })

    await submit(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'success', title: 'Customer created', message: 'Dara Sok was added.' },
    ])
    expect(push).toHaveBeenCalledWith({ name: 'customers' })
  })

  it('toasts the server message and stays on the form when the save fails', async () => {
    saveCustomer.mockRejectedValueOnce(Object.assign(new Error('The email has already been taken.'), { errors: {} }))
    const wrapper = mount(CustomerFormView, { global: { stubs } })

    await submit(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'error', title: 'Could not create customer', message: 'The email has already been taken.' },
    ])
    expect(push).not.toHaveBeenCalled()
  })
})
