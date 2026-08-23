import { apiFetch } from '@/services/api'

const DEFAULT_BANNER = 'linear-gradient(135deg, #b3091a 0%, #2b0a0a 100%)'

function dateValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

function formatPeriod(startsAt, expiresAt) {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const start = startsAt ? formatter.format(new Date(startsAt)) : 'Not scheduled'
  const end = expiresAt ? formatter.format(new Date(expiresAt)) : 'No end date'
  return `${start} – ${end}`
}

export function promotionFromApi(promotion) {
  const isExpired = promotion.expires_at && new Date(promotion.expires_at) < new Date()
  const isLimitReached = promotion.usage_limit !== null && Number(promotion.used_count) >= Number(promotion.usage_limit)
  const status = !promotion.is_active ? 'paused' : isExpired || isLimitReached ? 'expired' : 'active'
  const value = Number(promotion.value ?? 0)

  return {
    ...promotion,
    name: promotion.name || promotion.code,
    benefitType: promotion.type === 'percentage' ? 'Percentage Discount' : 'Fixed Amount',
    benefit: promotion.type === 'percentage' ? `${value}% OFF` : `$${value.toFixed(2)} OFF`,
    period: formatPeriod(promotion.starts_at, promotion.expires_at),
    status,
    used: Number(promotion.used_count ?? 0),
    limit: promotion.usage_limit,
    banner: promotion.banner_image
      ? `linear-gradient(rgba(20, 23, 28, 0.25), rgba(20, 23, 28, 0.55)), url("${promotion.banner_image}") center / cover`
      : DEFAULT_BANNER,
  }
}

export function promotionToForm(promotion) {
  return {
    name: promotion.name ?? '',
    code: promotion.code ?? '',
    type: promotion.type === 'fixed' ? 'Fixed Amount' : 'Percentage Discount',
    description: promotion.description ?? '',
    active: Boolean(promotion.is_active),
    bannerImage: promotion.banner_image ?? '',
    discountValue: String(promotion.value ?? ''),
    minimumSpend: String(promotion.min_order_amount ?? '0.00'),
    startDate: dateValue(promotion.starts_at),
    endDate: dateValue(promotion.expires_at),
    totalLimit: promotion.usage_limit === null ? '' : String(promotion.usage_limit),
    perCustomerLimit: promotion.user_limit === null ? '' : String(promotion.user_limit),
    currentUsage: Number(promotion.used_count ?? 0),
  }
}

export function promotionPayload(form) {
  const payload = {
    name: form.name.trim(),
    code: form.code.trim(),
    type: form.type === 'Fixed Amount' ? 'fixed' : 'percentage',
    value: Number(form.discountValue),
    min_order_amount: Number(form.minimumSpend || 0),
    starts_at: form.startDate,
    expires_at: form.endDate || null,
    usage_limit: form.totalLimit === '' ? null : Number(form.totalLimit),
    user_limit: form.perCustomerLimit === '' ? null : Number(form.perCustomerLimit),
    is_active: form.active,
    description: form.description.trim() || null,
    banner_image: form.bannerImage || null,
  }

  return payload
}

export async function fetchPromotions(token) {
  const response = await apiFetch('/admin/promotions', { token })
  const data = response?.data
  const items = Array.isArray(data) ? data : data?.data ?? []
  return items.map(promotionFromApi)
}

export async function fetchPromotion(id, token) {
  const response = await apiFetch(`/admin/promotions/${id}`, { token })
  return promotionFromApi(response?.data ?? {})
}

export async function savePromotion(id, form, token) {
  const response = await apiFetch(id ? `/admin/promotions/${id}` : '/admin/promotions', {
    method: id ? 'PATCH' : 'POST',
    body: promotionPayload(form),
    token,
  })
  return promotionFromApi(response?.data ?? {})
}

export async function deletePromotion(id, token) {
  await apiFetch(`/admin/promotions/${id}`, { method: 'DELETE', token })
}
