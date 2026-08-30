import { apiFetch } from '@/services/api'

const DEFAULT_BANNER = 'linear-gradient(135deg, #b3091a 0%, #2b0a0a 100%)'
const HOUR_MS = 60 * 60 * 1000

// A flash sale is not its own value in the API: `coupons.type` is an enum of
// exactly ('fixed','percentage'). It is inferred from the length of the window
// instead, so the label survives a reload without a backend change. Anything
// running for at most this many hours reads as a flash sale.
export const FLASH_SALE_TYPE = 'Flash Sale'
export const FLASH_SALE_MAX_HOURS = 24
export const DEFAULT_FLASH_HOURS = 3

function dateValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

// `datetime-local` wants a timezone-naive "YYYY-MM-DDTHH:mm" in the admin's own
// timezone, which is what the browser shows them. Built from the local getters
// rather than toISOString(), which would shift the clock face by the offset.
export function toDateTimeLocal(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''

  const pad = (part) => String(part).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// Length of a promotion's window in hours, or null when either end is missing
// or unparseable. Negative for a window that ends before it starts.
function windowHours(startsAt, expiresAt) {
  if (!startsAt || !expiresAt) return null

  const start = new Date(startsAt).getTime()
  const end = new Date(expiresAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null

  return (end - start) / HOUR_MS
}

export function isFlashSale(promotion) {
  const hours = windowHours(promotion?.starts_at, promotion?.expires_at)
  return hours !== null && hours > 0 && hours <= FLASH_SALE_MAX_HOURS
}

function formatPeriod(startsAt, expiresAt, withTime = false) {
  const formatter = new Intl.DateTimeFormat(
    undefined,
    withTime
      ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  )
  const start = startsAt ? formatter.format(new Date(startsAt)) : 'Not scheduled'
  const end = expiresAt ? formatter.format(new Date(expiresAt)) : 'No end date'
  return `${start} – ${end}`
}

// The status a card should show *right now*. `promotionFromApi` settles status
// at fetch time, which is fine for a month-long campaign and useless for a
// three-hour one — the badge has to flip while the admin is looking at it.
// A paused promotion stays paused: it was never counting down.
export function liveStatus(promotion, nowMs = Date.now()) {
  if (promotion?.status !== 'active' || !promotion.expiresAt) return promotion?.status

  return new Date(promotion.expiresAt).getTime() <= nowMs ? 'expired' : 'active'
}

export function promotionFromApi(promotion) {
  const isExpired = promotion.expires_at && new Date(promotion.expires_at) < new Date()
  const isLimitReached = promotion.usage_limit !== null && Number(promotion.used_count) >= Number(promotion.usage_limit)
  const status = !promotion.is_active ? 'paused' : isExpired || isLimitReached ? 'expired' : 'active'
  const value = Number(promotion.value ?? 0)
  const isFlash = isFlashSale(promotion)

  return {
    ...promotion,
    name: promotion.name || promotion.code,
    isFlash,
    expiresAt: promotion.expires_at ?? null,
    benefitType: isFlash
      ? FLASH_SALE_TYPE
      : promotion.type === 'percentage'
        ? 'Percentage Discount'
        : 'Fixed Amount',
    benefit: promotion.type === 'percentage' ? `${value}% OFF` : `$${value.toFixed(2)} OFF`,
    period: formatPeriod(promotion.starts_at, promotion.expires_at, isFlash),
    status,
    used: Number(promotion.used_count ?? 0),
    limit: promotion.usage_limit,
    banner: promotion.banner_image
      ? `linear-gradient(rgba(20, 23, 28, 0.25), rgba(20, 23, 28, 0.55)), url("${promotion.banner_image}") center / cover`
      : DEFAULT_BANNER,
  }
}

export function promotionToForm(promotion) {
  const isFlash = isFlashSale(promotion)
  const hours = windowHours(promotion.starts_at, promotion.expires_at)

  return {
    name: promotion.name ?? '',
    code: promotion.code ?? '',
    type: isFlash ? FLASH_SALE_TYPE : promotion.type === 'fixed' ? 'Fixed Amount' : 'Percentage Discount',
    description: promotion.description ?? '',
    active: Boolean(promotion.is_active),
    bannerImage: promotion.banner_image ?? '',
    discountValue: String(promotion.value ?? ''),
    minimumSpend: String(promotion.min_order_amount ?? '0.00'),
    startDate: dateValue(promotion.starts_at),
    endDate: dateValue(promotion.expires_at),
    // Kept to two decimals so a 2.5h window does not round up to 3h and quietly
    // extend itself on the next save.
    flashDurationHours: isFlash ? String(Math.round(hours * 100) / 100) : String(DEFAULT_FLASH_HOURS),
    startDateTime: isFlash ? toDateTimeLocal(promotion.starts_at) : '',
    totalLimit: promotion.usage_limit === null ? '' : String(promotion.usage_limit),
    perCustomerLimit: promotion.user_limit === null ? '' : String(promotion.user_limit),
    currentUsage: Number(promotion.used_count ?? 0),
  }
}

// Start and end of a flash sale as absolute instants. A three-hour window is
// timezone-sensitive in a way a date-only window is not, so these go out as ISO
// instants rather than the naive string the input hands over. A blank start
// yields nulls, letting the API's `required` rule report the missing field
// through the form's normal 422 handling.
function flashWindow(form) {
  const start = new Date(form.startDateTime)
  if (!form.startDateTime || Number.isNaN(start.getTime())) return { startsAt: null, expiresAt: null }

  const hours = Number(form.flashDurationHours)
  if (!Number.isFinite(hours) || hours <= 0) return { startsAt: start.toISOString(), expiresAt: null }

  return {
    startsAt: start.toISOString(),
    expiresAt: new Date(start.getTime() + hours * HOUR_MS).toISOString(),
  }
}

export function promotionPayload(form) {
  const isFlash = form.type === FLASH_SALE_TYPE
  const window = isFlash ? flashWindow(form) : null

  const payload = {
    name: form.name.trim(),
    code: form.code.trim(),
    type: form.type === 'Fixed Amount' ? 'fixed' : 'percentage',
    value: Number(form.discountValue),
    min_order_amount: Number(form.minimumSpend || 0),
    starts_at: isFlash ? window.startsAt : form.startDate,
    expires_at: isFlash ? window.expiresAt : form.endDate || null,
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
