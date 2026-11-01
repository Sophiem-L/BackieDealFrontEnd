import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RoleCreateView from '@/views/RoleCreateView.vue'
import { apiFetch } from '@/services/api'
import { useToastStore } from '@/stores/toasts'

const push = vi.fn()

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const stubs = { AppHeader: { template: '<div />' } }

// The permission list loads on mount; the POST is whatever the test decides.
function serve(create) {
  apiFetch.mockImplementation(async (path, options = {}) => {
    if (options.method === 'POST') return create()
    return { data: { items: [] } }
  })
}

async function submit(create) {
  serve(create)
  const wrapper = mount(RoleCreateView, { global: { stubs } })
  await flushPromises()
  await wrapper.find('#role-name').setValue('support')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('RoleCreateView - save feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('toasts a success, then returns to the roles list', async () => {
    await submit(() => ({ data: { id: 12 } }))

    expect(useToastStore().toasts).toMatchObject([
      { type: 'success', title: 'Role created', message: '"support" was added.' },
    ])
    expect(push).toHaveBeenCalledWith('/roles')
  })

  it('toasts the first validation message and stays on the form when the save fails', async () => {
    await submit(() => {
      throw Object.assign(new Error('Validation failed.'), {
        errors: { name: ['The name has already been taken.'] },
      })
    })

    expect(useToastStore().toasts).toMatchObject([
      { type: 'error', title: 'Could not create role', message: 'The name has already been taken.' },
    ])
    expect(push).not.toHaveBeenCalled()
  })
})
