import { apiFetch } from '@/services/api'

export const STORE_CURRENCIES = [
  { value: 'USD', label: 'USD ($) — US Dollar' },
  { value: 'KHR', label: 'KHR (៛) — Cambodian Riel' },
]

export const STORE_PAYMENT_METHODS = [
  { value: 'aba_payway', label: 'ABA PayWay' },
  { value: 'cod', label: 'Cash on delivery' },
]

export function normalizeStoreSettings(data) {
  const settings = data?.settings ?? data ?? {}
  const payway = data?.payway ?? {}
  return {
    storeName: settings.store_name ?? '',
    storeUrl: settings.store_url ?? '',
    contactEmail: settings.contact_email ?? '',
    timezone: settings.timezone ?? 'Asia/Phnom_Penh',
    currency: settings.currency ?? 'USD',
    paymentMethods: Array.isArray(settings.payment_methods) ? settings.payment_methods : ['aba_payway', 'cod'],
    abaEnabled: Boolean(settings.aba_enabled),
    abaConfigured: Boolean(payway.connected),
    codEnabled: settings.cod_enabled !== false,
    codInstructions: settings.cod_instructions ?? '',
    options: data?.options ?? {},
  }
}

export async function fetchStoreSettings(token) {
  const response = await apiFetch('/admin/settings/store', { token })
  return normalizeStoreSettings(response?.data)
}

export async function updateStoreSettings(settings, token) {
  const response = await apiFetch('/admin/settings/store', {
    method: 'PATCH',
    token,
    body: {
      store_name: settings.storeName,
      store_url: settings.storeUrl || null,
      contact_email: settings.contactEmail || null,
      timezone: settings.timezone,
      currency: settings.currency,
      payment_methods: settings.paymentMethods,
      aba_enabled: settings.paymentMethods.includes('aba_payway'),
      cod_enabled: settings.paymentMethods.includes('cod'),
      cod_instructions: settings.codInstructions || null,
    },
  })
  return normalizeStoreSettings(response?.data)
}

export async function checkPaywayConnection(token) {
  const response = await apiFetch('/admin/settings/store/payway/check', {
    method: 'POST',
    token,
  })
  return response?.data?.payway ?? { connected: false, message: 'No PayWay response was received.' }
}
