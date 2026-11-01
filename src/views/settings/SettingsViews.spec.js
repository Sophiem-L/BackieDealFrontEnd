import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SettingsShell from '@/views/settings/SettingsShell.vue'
import SettingsGeneralView from '@/views/settings/SettingsGeneralView.vue'
import SettingsPaymentsView from '@/views/settings/SettingsPaymentsView.vue'
import SettingsShippingView from '@/views/settings/SettingsShippingView.vue'
import SettingsTaxesView from '@/views/settings/SettingsTaxesView.vue'
import SettingsNotificationsView from '@/views/settings/SettingsNotificationsView.vue'
import SettingsIntegrationsView from '@/views/settings/SettingsIntegrationsView.vue'
import * as settingsApi from '@/services/settingsApi.js'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/settingsApi.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchSettingsSection: vi.fn(),
  fetchStoreSettings: vi.fn(),
  saveSettingsSection: vi.fn(),
  saveStoreSettings: vi.fn(),
  checkPaywayConnection: vi.fn(),
  fetchShippingMethods: vi.fn(),
  createShippingMethod: vi.fn(),
  updateShippingMethod: vi.fn(),
  deleteShippingMethod: vi.fn(),
}))

// The shell only forwards the Save click; stubbing it lets each test fire the
// view's own save handler without the dirty-state and keyboard plumbing.
const stubs = {
  SettingsShell: { template: '<div><slot /></div>', emits: ['save', 'discard'] },
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const STANDARD = {
  id: 3,
  name: 'Standard',
  code: 'standard',
  base_price: 2,
  price_per_kg: null,
  min_delivery_days: 2,
  max_delivery_days: 4,
  is_active: true,
}

async function mountView(View) {
  const wrapper = mount(View, { global: { stubs } })
  await flushPromises()
  return wrapper
}

const toasts = () => useToastStore().toasts
const buttonByText = (wrapper, text) => wrapper.findAll('button').find((button) => button.text() === text)

describe('settings views', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    settingsApi.fetchSettingsSection.mockImplementation(async (section) => clone(settingsApi.FALLBACK_SETTINGS[section]))
    settingsApi.saveSettingsSection.mockImplementation(async (section) => clone(settingsApi.FALLBACK_SETTINGS[section]))
    settingsApi.fetchStoreSettings.mockResolvedValue({ settings: { payment_methods: ['aba_payway', 'cod'] }, payway: { connected: false } })
    settingsApi.saveStoreSettings.mockResolvedValue({ settings: {} })
    settingsApi.fetchShippingMethods.mockResolvedValue([clone(STANDARD)])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe.each([
    ['General', SettingsGeneralView, 'General settings saved', 'Could not save general settings'],
    ['Payments', SettingsPaymentsView, 'Payment settings saved', 'Could not save payment settings'],
    ['Shipping', SettingsShippingView, 'Shipping settings saved', 'Could not save shipping settings'],
    ['Taxes', SettingsTaxesView, 'Tax settings saved', 'Could not save tax settings'],
    ['Notifications', SettingsNotificationsView, 'Notification settings saved', 'Could not save notification settings'],
    ['Integrations', SettingsIntegrationsView, 'Integrations saved', 'Could not save integrations'],
  ])('%s', (_name, View, savedTitle, failedTitle) => {
    it('toasts success once the save resolves', async () => {
      const wrapper = await mountView(View)

      wrapper.findComponent(SettingsShell).vm.$emit('save')
      await flushPromises()

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'update', title: savedTitle })
    })

    it('toasts the server reason when the save is rejected', async () => {
      const wrapper = await mountView(View)
      settingsApi.saveSettingsSection.mockRejectedValue(new Error('Server said no'))
      settingsApi.saveStoreSettings.mockRejectedValue(new Error('Server said no'))

      wrapper.findComponent(SettingsShell).vm.$emit('save')
      await flushPromises()

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'error', title: failedTitle, message: 'Server said no' })
    })
  })

  describe('payments', () => {
    it('reports a verified ABA PayWay connection as a success', async () => {
      settingsApi.checkPaywayConnection.mockResolvedValue({ connected: true })
      const wrapper = await mountView(SettingsPaymentsView)

      await buttonByText(wrapper, 'Check connection').trigger('click')
      await flushPromises()

      expect(toasts()[0]).toMatchObject({ type: 'success', title: 'ABA PayWay connection verified' })
    })

    it('reports an unconfigured ABA PayWay as an error', async () => {
      settingsApi.checkPaywayConnection.mockResolvedValue({ connected: false })
      const wrapper = await mountView(SettingsPaymentsView)

      await buttonByText(wrapper, 'Check connection').trigger('click')
      await flushPromises()

      expect(toasts()[0]).toMatchObject({ type: 'error', title: 'ABA PayWay not connected' })
    })
  })

  describe('shipping checkout methods', () => {
    async function submitNewMethod(wrapper) {
      await buttonByText(wrapper, 'Add delivery method').trigger('click')
      await wrapper.find('#new-method-name').setValue('Express')
      await wrapper.find('form.method-form').trigger('submit')
      await flushPromises()
    }

    it('toasts success after a method is created', async () => {
      settingsApi.createShippingMethod.mockResolvedValue({ ...STANDARD, id: 9, name: 'Express', code: 'express' })
      const wrapper = await mountView(SettingsShippingView)

      await submitNewMethod(wrapper)

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'success', title: 'Shipping method added' })
      expect(toasts()[0].message).toContain('Express')
    })

    it('toasts the failure and keeps the inline error when the create is rejected', async () => {
      settingsApi.createShippingMethod.mockRejectedValue(new Error('Could not reach the server'))
      const wrapper = await mountView(SettingsShippingView)

      await submitNewMethod(wrapper)

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'error', title: 'Could not add shipping method', message: 'Could not reach the server' })
      expect(wrapper.find('.form-error').text()).toContain('Could not reach the server')
    })

    it('toasts success after a method is saved', async () => {
      settingsApi.updateShippingMethod.mockResolvedValue(clone(STANDARD))
      const wrapper = await mountView(SettingsShippingView)

      await wrapper.find('button[aria-label="Save Standard"]').trigger('click')
      await flushPromises()

      expect(toasts()[0]).toMatchObject({ type: 'update', title: 'Shipping method saved' })
    })

    it('toasts success after a method is removed, but not when the confirm is declined', async () => {
      settingsApi.deleteShippingMethod.mockResolvedValue({})
      const confirm = vi.spyOn(window, 'confirm')
      const wrapper = await mountView(SettingsShippingView)

      confirm.mockReturnValue(false)
      await wrapper.find('button[aria-label="Remove Standard"]').trigger('click')
      await flushPromises()
      expect(toasts()).toHaveLength(0)

      confirm.mockReturnValue(true)
      await wrapper.find('button[aria-label="Remove Standard"]').trigger('click')
      await flushPromises()
      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'delete', title: 'Shipping method removed' })
    })

    it('toasts the failure and keeps the inline error when a remove is rejected', async () => {
      settingsApi.deleteShippingMethod.mockRejectedValue(new Error('Method is in use'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const wrapper = await mountView(SettingsShippingView)

      await wrapper.find('button[aria-label="Remove Standard"]').trigger('click')
      await flushPromises()

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toMatchObject({ type: 'error', title: 'Could not remove shipping method', message: 'Method is in use' })
      expect(wrapper.find('.settings-error').text()).toContain('Method is in use')
    })
  })
})
