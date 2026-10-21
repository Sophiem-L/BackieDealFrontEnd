import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/services/api'
import { fetchSettingsSection, saveSettingsSection } from '@/services/settingsApi'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
}))

describe('settings API sections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes API tax rates for the form', async () => {
    apiFetch.mockResolvedValue({
      data: {
        settings: {
          taxes: {
            prices_include_tax: true,
            show_tax_at_checkout: true,
            tax_id: 'VAT-1',
            rates: [{ region: 'Cambodia', name: 'VAT', rate: 10, applies_to: 'All goods' }],
          },
        },
      },
    })

    await expect(fetchSettingsSection('taxes', 'token')).resolves.toMatchObject({
      pricesIncludeTax: true,
      showTaxAtCheckout: true,
      taxId: 'VAT-1',
      rates: [{ region: 'Cambodia', name: 'VAT', rate: 10, appliesTo: 'All goods' }],
    })
  })

  it('sends editable nested shipping and notification values to the API', async () => {
    const zones = [{ name: 'City', regions: 'Phnom Penh', methods: 'Express', rates: '$5' }]
    const delivery = [{ id: 'express', enabled: true }]
    const rows = [{ name: 'New order', email: true, inApp: true, sms: false }]
    apiFetch.mockResolvedValue({ data: { settings: { shipping: { zones, delivery, warehouse: 'Central', package_weight: 1, free_shipping_threshold: 100 } } } })

    await saveSettingsSection('shipping', {
      zones,
      delivery,
      warehouse: 'Central',
      packageWeight: 1,
      freeShippingThreshold: 100,
    }, 'token')

    expect(apiFetch).toHaveBeenCalledWith('/admin/settings', {
      method: 'PATCH',
      token: 'token',
      body: {
        settings: {
          shipping: {
            zones,
            delivery,
            warehouse: 'Central',
            package_weight: 1,
            free_shipping_threshold: 100,
          },
        },
      },
    })

    apiFetch.mockResolvedValue({ data: { settings: { notifications: { rows, recipients: ['ops@example.test'], sender_name: 'Store', reply_to: 'help@example.test' } } } })
    await saveSettingsSection('notifications', {
      rows,
      recipients: ['ops@example.test'],
      senderName: 'Store',
      replyTo: 'help@example.test',
    }, 'token')

    expect(apiFetch.mock.calls[1][1].body.settings.notifications).toMatchObject({
      rows: [{ name: 'New order', email: true, inApp: true, in_app: true, sms: false }],
      recipients: ['ops@example.test'],
      sender_name: 'Store',
      reply_to: 'help@example.test',
    })
  })

  it('propagates API read failures instead of returning mock settings', async () => {
    apiFetch.mockRejectedValue(new Error('API unavailable'))

    await expect(fetchSettingsSection('general', 'token')).rejects.toThrow('API unavailable')
  })
})
