import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RolesView from '@/views/RolesView.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const stub = { template: '<div><slot /></div>' }
const stubs = {
  AppHeader: stub,
  BaseButton: { template: '<button><slot /></button>' },
  Select: stub,
  SelectContent: stub,
  SelectItem: stub,
  SelectTrigger: stub,
  SelectValue: stub,
}

function role(overrides = {}) {
  return { id: 9, name: 'support', permissions: [], deleted_at: null, ...overrides }
}

// apiFetch answers the role list, and the test decides what the mutation does.
function serve(mutation) {
  apiFetch.mockImplementation(async (path, options = {}) => {
    if (options.method === 'DELETE') return mutation()
    if (path.startsWith('/admin/roles?')) return { data: { items: [role()], pagination: {} } }
    return { data: {} }
  })
}

async function mountList(mutation) {
  serve(mutation)
  const wrapper = mount(RolesView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('RolesView - delete feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useAuthStore().user = { permissions: ['roles.view', 'roles.delete'] }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  async function clickDelete(wrapper) {
    await wrapper.find('[aria-label="Delete support"]').trigger('click')
    await flushPromises()
  }

  it('toasts a success once the role is deleted', async () => {
    const wrapper = await mountList(() => ({}))

    await clickDelete(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'delete', title: 'Role deleted', message: '"support" was removed.' },
    ])
  })

  it('toasts the server message instead of a browser alert when the delete fails', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const wrapper = await mountList(() => {
      throw new Error('Role is assigned to 2 administrators.')
    })

    await clickDelete(wrapper)

    expect(alert).not.toHaveBeenCalled()
    expect(useToastStore().toasts).toMatchObject([
      { type: 'error', title: 'Could not delete role', message: 'Role is assigned to 2 administrators.' },
    ])
  })
})
