import { describe, it, expect, vi } from 'vitest'
import {
  FLASH_SALE_MAX_HOURS,
  FLASH_SALE_TYPE,
  isFlashSale,
  liveStatus,
  promotionFromApi,
  promotionPayload,
  promotionToForm,
} from '@/services/promotions'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

const HOUR = 60 * 60 * 1000

// A promotion as PromotionResource hands it over, with only the fields a test
// cares about overridden.
function promotion(overrides = {}) {
  return {
    id: 12,
    name: 'Black Friday Sale',
    code: 'BLACKFRIDAY',
    type: 'percentage',
    value: '30.00',
    min_order_amount: '0.00',
    starts_at: '2026-11-20T00:00:00+00:00',
    expires_at: '2026-11-30T00:00:00+00:00',
    usage_limit: 500,
    user_limit: 1,
    used_count: 245,
    is_active: true,
    description: 'Annual clearance.',
    banner_image: null,
    ...overrides,
  }
}

// A flash sale is not a distinct type in the API — it is a short window. This
// builds one that starts `hoursFromNow` out and runs for `hours`.
function flashSale(hours = 3, startsAt = '2026-08-30T09:00:00+00:00') {
  const start = new Date(startsAt)
  return promotion({
    starts_at: start.toISOString(),
    expires_at: new Date(start.getTime() + hours * HOUR).toISOString(),
  })
}

describe('isFlashSale', () => {
  it('recognises a three-hour window as a flash sale', () => {
    expect(isFlashSale(flashSale(3))).toBe(true)
  })

  it('treats a window exactly at the threshold as a flash sale', () => {
    expect(isFlashSale(flashSale(FLASH_SALE_MAX_HOURS))).toBe(true)
  })

  it('rejects a window one minute past the threshold', () => {
    expect(isFlashSale(flashSale(FLASH_SALE_MAX_HOURS + 1 / 60))).toBe(false)
  })

  it('rejects a multi-day promotion', () => {
    expect(isFlashSale(promotion())).toBe(false)
  })

  it('rejects a promotion with no end date', () => {
    expect(isFlashSale(promotion({ expires_at: null }))).toBe(false)
  })

  it('rejects a promotion with no start date', () => {
    expect(isFlashSale(promotion({ starts_at: null }))).toBe(false)
  })

  it('rejects a window that ends before it starts', () => {
    expect(isFlashSale(flashSale(-3))).toBe(false)
  })

  it('rejects an unparseable date rather than reading it as a zero-length window', () => {
    expect(isFlashSale(promotion({ starts_at: 'not a date', expires_at: 'not a date' }))).toBe(false)
  })
})

describe('promotionFromApi — flash sales', () => {
  it('labels a short promotion as a flash sale', () => {
    const promo = promotionFromApi(flashSale(3))

    expect(promo.isFlash).toBe(true)
    expect(promo.benefitType).toBe(FLASH_SALE_TYPE)
  })

  it('exposes the raw expiry so the countdown can tick against it', () => {
    const raw = flashSale(3)
    expect(promotionFromApi(raw).expiresAt).toBe(raw.expires_at)
  })

  it('shows the time of day in the period of a flash sale', () => {
    // A three-hour window rendered as "Aug 30 – Aug 30" tells the admin nothing.
    const period = promotionFromApi(flashSale(3)).period
    expect(period).toMatch(/\d{1,2}:\d{2}/)
  })

  it('leaves the benefit type of an ordinary promotion alone', () => {
    const promo = promotionFromApi(promotion())

    expect(promo.isFlash).toBe(false)
    expect(promo.benefitType).toBe('Percentage Discount')
  })

  it('keeps the date-only period for an ordinary promotion', () => {
    expect(promotionFromApi(promotion()).period).not.toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('promotionToForm — flash sales', () => {
  it('selects the flash sale type for a short promotion', () => {
    expect(promotionToForm(flashSale(3)).type).toBe(FLASH_SALE_TYPE)
  })

  it('recovers the duration in hours', () => {
    expect(promotionToForm(flashSale(3)).flashDurationHours).toBe('3')
  })

  it('keeps a half-hour duration instead of rounding it up on the next save', () => {
    expect(promotionToForm(flashSale(2.5)).flashDurationHours).toBe('2.5')
  })

  it('fills the start field with the exact instant the promotion begins', () => {
    // datetime-local is timezone-naive, so assert on the instant it parses back
    // to rather than on the string, which differs per machine.
    const raw = flashSale(3)
    const form = promotionToForm(raw)

    expect(new Date(form.startDateTime).getTime()).toBe(new Date(raw.starts_at).getTime())
  })

  it('leaves the ordinary date fields populated so switching type back still works', () => {
    const form = promotionToForm(flashSale(3, '2026-08-30T09:00:00+00:00'))

    expect(form.startDate).not.toBe('')
    expect(form.endDate).not.toBe('')
  })

  it('leaves a long promotion on its discount type', () => {
    expect(promotionToForm(promotion()).type).toBe('Percentage Discount')
  })

  it('defaults the duration for a promotion that is not a flash sale', () => {
    expect(promotionToForm(promotion()).flashDurationHours).toBe('3')
  })
})

describe('promotionPayload — flash sales', () => {
  function flashForm(overrides = {}) {
    return {
      name: 'Three Hour Frenzy',
      code: 'FLASH3',
      type: FLASH_SALE_TYPE,
      description: '',
      active: true,
      bannerImage: '',
      discountValue: '25',
      minimumSpend: '0',
      startDate: '2026-08-30',
      endDate: '',
      startDateTime: '2026-08-30T14:00',
      flashDurationHours: '3',
      totalLimit: '',
      perCustomerLimit: '',
      ...overrides,
    }
  }

  it('sends a discount type the API enum accepts', () => {
    // coupons.type is enum('fixed','percentage') — "flash_sale" would 422.
    expect(promotionPayload(flashForm()).type).toBe('percentage')
  })

  it('starts the promotion at the instant the admin picked', () => {
    const payload = promotionPayload(flashForm())

    expect(new Date(payload.starts_at).getTime()).toBe(new Date('2026-08-30T14:00').getTime())
  })

  it('expires the promotion the set number of hours after it starts', () => {
    const payload = promotionPayload(flashForm())
    const window = new Date(payload.expires_at).getTime() - new Date(payload.starts_at).getTime()

    expect(window).toBe(3 * HOUR)
  })

  it('honours a duration other than the three-hour default', () => {
    const payload = promotionPayload(flashForm({ flashDurationHours: '6' }))
    const window = new Date(payload.expires_at).getTime() - new Date(payload.starts_at).getTime()

    expect(window).toBe(6 * HOUR)
  })

  it('sends no dates at all when the start is blank, so the API reports the missing field', () => {
    const payload = promotionPayload(flashForm({ startDateTime: '' }))

    expect(payload.starts_at).toBeNull()
    expect(payload.expires_at).toBeNull()
  })

  it('sends no expiry when the duration is zero rather than expiring on the spot', () => {
    expect(promotionPayload(flashForm({ flashDurationHours: '0' })).expires_at).toBeNull()
  })

  it('ignores the flash fields for an ordinary promotion', () => {
    const payload = promotionPayload(flashForm({ type: 'Fixed Amount' }))

    expect(payload.type).toBe('fixed')
    expect(payload.starts_at).toBe('2026-08-30')
    expect(payload.expires_at).toBeNull()
  })
})

describe('liveStatus', () => {
  const expiresAt = '2026-08-30T12:00:00+00:00'
  const promo = { status: 'active', expiresAt }

  it('keeps an active promotion active before its expiry', () => {
    expect(liveStatus(promo, new Date('2026-08-30T11:59:59+00:00').getTime())).toBe('active')
  })

  it('expires an active promotion once the clock passes its expiry', () => {
    expect(liveStatus(promo, new Date('2026-08-30T12:00:01+00:00').getTime())).toBe('expired')
  })

  it('leaves a paused promotion paused even after its expiry', () => {
    // A paused promotion is paused, not expired — the badge should not lie.
    expect(liveStatus({ status: 'paused', expiresAt }, new Date('2027-01-01').getTime())).toBe('paused')
  })

  it('keeps an open-ended promotion active', () => {
    expect(liveStatus({ status: 'active', expiresAt: null }, Date.now())).toBe('active')
  })
})
