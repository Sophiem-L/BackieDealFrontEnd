import { apiFetch } from '@/services/api'
import {
  generalMock,
  paymentsMock,
  shippingMock,
  taxesMock,
  notificationsMock,
  teamMock,
  integrationsMock,
} from '@/views/settings/settingsData.js'

export const FALLBACK_SETTINGS = {
  general: generalMock,
  payments: paymentsMock,
  shipping: shippingMock,
  taxes: taxesMock,
  notifications: notificationsMock,
  team: teamMock,
  integrations: integrationsMock,
}

const SECTION_KEY_MAP = {
  general: {
    storeName: 'store_name',
    storeUrl: 'store_url',
    contactEmail: 'contact_email',
    phone: 'phone',
    timezone: 'timezone',
    currency: 'currency',
    language: 'language',
    weightUnit: 'weight_unit',
    lengthUnit: 'length_unit',
    businessAddress: 'business_address',
    country: 'country',
  },
  payments: {
    minimumOrder: 'minimum_order',
    instructions: 'instructions',
  },
  shipping: {
    packageWeight: 'package_weight',
    freeShippingThreshold: 'free_shipping_threshold',
  },
  taxes: {
    pricesIncludeTax: 'prices_include_tax',
    showTaxAtCheckout: 'show_tax_at_checkout',
    taxId: 'tax_id',
  },
  notifications: {
    senderName: 'sender_name',
    replyTo: 'reply_to',
  },
  team: {},
  integrations: {},
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}))
}

function normalizeSection(section, value) {
  const fallback = clone(FALLBACK_SETTINGS[section] ?? {})
  const source = value && typeof value === 'object' ? value : fallback

  switch (section) {
    case 'general':
      return {
        ...fallback,
        ...source,
        storeName: source.store_name ?? source.storeName ?? fallback.storeName ?? '',
        storeUrl: source.store_url ?? source.storeUrl ?? fallback.storeUrl ?? '',
        contactEmail: source.contact_email ?? source.contactEmail ?? fallback.contactEmail ?? '',
        phone: source.phone ?? fallback.phone ?? '',
        timezone: source.timezone ?? fallback.timezone ?? 'Asia/Phnom_Penh',
        currency: source.currency ?? fallback.currency ?? 'USD',
        language: source.language ?? fallback.language ?? 'English',
        weightUnit: source.weight_unit ?? source.weightUnit ?? fallback.weightUnit ?? 'kg',
        lengthUnit: source.length_unit ?? source.lengthUnit ?? fallback.lengthUnit ?? 'cm',
        businessAddress: source.business_address ?? source.businessAddress ?? fallback.businessAddress ?? '',
        country: source.country ?? fallback.country ?? 'Cambodia',
      }
    case 'payments':
      return {
        ...fallback,
        ...source,
        minimumOrder: source.minimum_order ?? source.minimumOrder ?? fallback.minimumOrder ?? 0,
        instructions: source.instructions ?? fallback.instructions ?? '',
      }
    case 'shipping':
      return {
        ...fallback,
        ...source,
        packageWeight: source.package_weight ?? source.packageWeight ?? fallback.packageWeight ?? 0,
        freeShippingThreshold: source.free_shipping_threshold ?? source.freeShippingThreshold ?? fallback.freeShippingThreshold ?? 0,
      }
    case 'taxes':
      return {
        ...fallback,
        ...source,
        pricesIncludeTax: source.prices_include_tax ?? source.pricesIncludeTax ?? fallback.pricesIncludeTax ?? false,
        showTaxAtCheckout: source.show_tax_at_checkout ?? source.showTaxAtCheckout ?? fallback.showTaxAtCheckout ?? false,
        taxId: source.tax_id ?? source.taxId ?? fallback.taxId ?? '',
      }
    case 'notifications':
      return {
        ...fallback,
        ...source,
        rows: Array.isArray(source.rows) ? source.rows.map((row) => ({
          ...row,
          inApp: row.in_app ?? row.inApp ?? false,
        })) : fallback.rows,
        recipients: Array.isArray(source.recipients) ? source.recipients : fallback.recipients,
        senderName: source.sender_name ?? source.senderName ?? fallback.senderName ?? '',
        replyTo: source.reply_to ?? source.replyTo ?? fallback.replyTo ?? '',
      }
    case 'team':
      return {
        ...fallback,
        ...source,
        filters: Array.isArray(source.filters) ? source.filters : fallback.filters,
        members: Array.isArray(source.members) ? source.members : fallback.members,
      }
    case 'integrations':
      return {
        ...fallback,
        ...source,
        cards: Array.isArray(source.cards) ? source.cards : fallback.cards,
        webhooks: Array.isArray(source.webhooks) ? source.webhooks : fallback.webhooks,
      }
    default:
      return clone(source)
  }
}

function denormalizeSection(section, value) {
  const source = value && typeof value === 'object' ? value : {}
  const mapped = {}

  Object.entries(SECTION_KEY_MAP[section] || {}).forEach(([frontendKey, backendKey]) => {
    if (Object.prototype.hasOwnProperty.call(source, frontendKey)) {
      mapped[backendKey] = source[frontendKey]
    }
  })

  if (section === 'notifications' && Array.isArray(source.rows)) {
    mapped.rows = source.rows.map((row) => ({
      ...row,
      in_app: row.inApp ?? row.in_app ?? false,
    }))
  }

  if (section === 'general' && source.businessAddress !== undefined) {
    mapped.business_address = source.businessAddress
  }

  return mapped
}

export async function fetchSettingsSection(section, token) {
  try {
    const response = await apiFetch('/admin/settings', { token })
    const sectionData = response?.data?.settings?.[section] ?? response?.settings?.[section] ?? FALLBACK_SETTINGS[section]
    return normalizeSection(section, sectionData)
  } catch (error) {
    console.warn(`Settings API unavailable for ${section}; using local fallback values.`, error)
    return clone(FALLBACK_SETTINGS[section])
  }
}

export async function saveSettingsSection(section, payload, token) {
  const payloadToSend = denormalizeSection(section, payload)

  try {
    const response = await apiFetch('/admin/settings', {
      method: 'PATCH',
      token,
      body: {
        settings: {
          [section]: payloadToSend,
        },
      },
    })

    const sectionData = response?.data?.settings?.[section] ?? response?.settings?.[section] ?? payload
    return normalizeSection(section, sectionData)
  } catch (error) {
    console.warn(`Unable to save ${section} settings via API.`, error)
    throw error
  }
}
