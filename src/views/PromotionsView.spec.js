import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PromotionsView from '@/views/PromotionsView.vue'
import { fetchPromotions } from '@/services/promotions'

vi.mock('@/services/promotions', async () => {
  const actual = await vi.importActual('@/services/promotions')
  return { ...actual, fetchPromotions: vi.fn(), deletePromotion: vi.fn() }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
}

function promotion(overrides = {}) {
  return {
    id: 3,
    name: 'Three Hour Frenzy',
    code: 'FLASH3',
    benefitType: 'Flash Sale',
    benefit: '25% OFF',
    period: 'Aug 30, 2:00 PM – Aug 30, 5:00 PM',
    status: 'active',
    isFlash: true,
    expiresAt: null,
    used: 4,
    limit: 100,
    banner: 'linear-gradient(#000, #111)',
    ...overrides,
  }
}

// Offsets land mid-minute on purpose: an exact two-hour window renders as
// "2h 00m 00s", which makes the assertion depend on how long the mount took.
function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000 - 30_000).toISOString()
}

async function mountList(promotions) {
  fetchPromotions.mockResolvedValue(promotions)
  const wrapper = mount(PromotionsView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('PromotionsView — flash sales', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('counts down the time left on a flash sale card', async () => {
    const wrapper = await mountList([promotion({ expiresAt: hoursFromNow(2) })])

    expect(wrapper.find('.countdown').text()).toMatch(/^1h 59m \d{2}s left$/)
  })

  it('leaves an ordinary promotion without a countdown', async () => {
    const wrapper = await mountList([
      promotion({ isFlash: false, benefitType: 'Percentage Discount', expiresAt: hoursFromNow(200) }),
    ])

    expect(wrapper.find('.countdown').exists()).toBe(false)
  })

  it('shows a lapsed flash sale as expired even though it was fetched as active', async () => {
    // The fetch settles status once; a three-hour sale outlives that snapshot.
    const wrapper = await mountList([promotion({ expiresAt: hoursFromNow(-1) })])

    expect(wrapper.find('.promo__status').text()).toBe('Expired')
    expect(wrapper.find('.promo__status').classes()).toContain('promo__status--expired')
  })

  it('still shows a running flash sale as active', async () => {
    const wrapper = await mountList([promotion({ expiresAt: hoursFromNow(2) })])

    expect(wrapper.find('.promo__status').text()).toBe('Active')
  })
})
