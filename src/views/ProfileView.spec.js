import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from '@/views/ProfileView.vue'
import { apiFetch } from '@/services/api'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
}))

const ME = { first_name: 'Sok', last_name: 'Dara', email: 'sok@example.com', phone: '012345678' }

const stubs = {
  AppHeader: { template: '<div />' },
  Teleport: true,
}

// The modal is teleported to <body>; stubbing Teleport keeps it inside the
// wrapper so the tests can find its fields.
async function mountView() {
  const wrapper = mount(ProfileView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

const toasts = () => useToastStore().toasts
const buttonByText = (wrapper, text) => wrapper.findAll('button').find((button) => button.text() === text)

async function editProfile(wrapper) {
  await wrapper.find('#firstName').setValue('Sokha')
}

async function submitPassword(wrapper) {
  await buttonByText(wrapper, 'Change Password').trigger('click')
  await wrapper.find('#current').setValue('old-password')
  await wrapper.find('#newPassword').setValue('new-password-1')
  await wrapper.find('#confirmPassword').setValue('new-password-1')
  await buttonByText(wrapper, 'Update Password').trigger('click')
  await flushPromises()
}

describe('ProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    apiFetch.mockImplementation(async (path, options) => {
      if (path === '/admin/auth/me') return { data: ME }
      if (path === '/admin/auth/profile') return { data: { ...ME, first_name: options.body.first_name } }
      return {}
    })
  })

  describe('profile update', () => {
    it('toasts success once the update resolves', async () => {
      const wrapper = await mountView()
      await editProfile(wrapper)

      await buttonByText(wrapper, 'Update Profile').trigger('click')
      await flushPromises()

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'update', title: 'Profile updated' })
      expect(wrapper.find('.alert').exists()).toBe(false)
    })

    it('toasts the failure and keeps the inline error when the update is rejected', async () => {
      const wrapper = await mountView()
      await editProfile(wrapper)
      apiFetch.mockImplementation(async (path) => {
        if (path === '/admin/auth/profile') throw new Error('Email is already taken')
        return { data: ME }
      })

      await buttonByText(wrapper, 'Update Profile').trigger('click')
      await flushPromises()

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'error', title: 'Could not update profile', message: 'Email is already taken' })
      expect(wrapper.find('.alert--error').text()).toContain('Email is already taken')
    })
  })

  describe('password change', () => {
    it('toasts success and closes the modal once the change resolves', async () => {
      const wrapper = await mountView()

      await submitPassword(wrapper)

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'update', title: 'Password changed' })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('toasts the failure and keeps the modal and its inline error when the change is rejected', async () => {
      const wrapper = await mountView()
      apiFetch.mockImplementation(async (path) => {
        if (path === '/admin/auth/change-password') throw new Error('Current password is incorrect')
        return { data: ME }
      })

      await submitPassword(wrapper)

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'error', title: 'Could not change password', message: 'Current password is incorrect' })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.find('[role="dialog"] .alert--error').text()).toContain('Current password is incorrect')
    })

    it('does not toast when the confirmation does not match, since the inline error already says so', async () => {
      const wrapper = await mountView()
      await buttonByText(wrapper, 'Change Password').trigger('click')
      await wrapper.find('#newPassword').setValue('one')
      await wrapper.find('#confirmPassword').setValue('two')

      await buttonByText(wrapper, 'Update Password').trigger('click')
      await flushPromises()

      expect(toasts()).toHaveLength(0)
      expect(wrapper.find('[role="dialog"] .alert--error').exists()).toBe(true)
    })
  })
})
