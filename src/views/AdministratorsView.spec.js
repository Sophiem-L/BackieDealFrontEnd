import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdministratorsView from '@/views/AdministratorsView.vue'
import {
  deleteAdministrator,
  fetchAdministrators,
  resetAdministratorPassword,
} from '@/services/administrators'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/administrators', () => ({
  fetchAdministrators: vi.fn(),
  fetchAdministrator: vi.fn(),
  createAdministrator: vi.fn(),
  updateAdministrator: vi.fn(),
  deleteAdministrator: vi.fn(),
  resetAdministratorPassword: vi.fn(),
}))

vi.mock('@/services/masterData', async () => {
  const actual = await vi.importActual('@/services/masterData')
  return {
    ...actual,
    fetchAllMasterData: vi.fn().mockResolvedValue({ roles: [], adminRoles: [], permissions: [] }),
    fetchRolePermissions: vi.fn().mockResolvedValue([]),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  teleport: true,
}

function administrator(overrides = {}) {
  return {
    id: 3,
    first_name: 'Dara',
    last_name: 'Sok',
    email: 'dara@example.com',
    roles: [{ id: 2, name: 'manager' }],
    is_active: true,
    ...overrides,
  }
}

async function mountList() {
  fetchAdministrators.mockResolvedValue({ data: { items: [administrator()] } })
  const wrapper = mount(AdministratorsView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('AdministratorsView - delete and reset feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useAuthStore().user = {
      id: 1,
      permissions: ['administrators.delete', 'administrators.password-reset'],
    }
  })

  async function confirmDelete(wrapper) {
    await wrapper.find('[aria-label="Delete administrator"]').trigger('click')
    const button = wrapper.findAll('button').find((item) => item.text() === 'Delete Administrator')
    await button.trigger('click')
    await flushPromises()
  }

  async function submitReset(wrapper) {
    await wrapper.find('[aria-label="Reset password for Dara Sok"]').trigger('click')
    const [password, confirm] = wrapper.findAll('input[type="password"]')
    await password.setValue('new-password-1')
    await confirm.setValue('new-password-1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
  }

  it('toasts a success once the administrator is deleted', async () => {
    deleteAdministrator.mockResolvedValueOnce(undefined)
    const wrapper = await mountList()

    await confirmDelete(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'delete', title: 'Administrator deleted', message: 'Dara Sok was removed.' },
    ])
  })

  it('toasts the server message when the delete fails', async () => {
    deleteAdministrator.mockRejectedValueOnce(new Error('You cannot delete the last super admin.'))
    const wrapper = await mountList()

    await confirmDelete(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      {
        type: 'error',
        title: 'Could not delete administrator',
        message: 'You cannot delete the last super admin.',
      },
    ])
  })

  it('toasts a success once the password is reset, without the old page banner', async () => {
    resetAdministratorPassword.mockResolvedValueOnce(undefined)
    const wrapper = await mountList()

    await submitReset(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'update', title: 'Password reset', message: 'The password for Dara Sok was changed.' },
    ])
    expect(wrapper.find('.alert--success').exists()).toBe(false)
  })

  it('toasts the server message when the password reset fails', async () => {
    resetAdministratorPassword.mockRejectedValueOnce(new Error('Password is too common.'))
    const wrapper = await mountList()

    await submitReset(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'error', title: 'Could not reset password', message: 'Password is too common.' },
    ])
  })
})
