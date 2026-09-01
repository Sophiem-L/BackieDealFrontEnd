import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PromotionDetailView from '@/views/PromotionDetailView.vue'
import { fetchPromotion } from '@/services/promotions'

vi.mock('@/services/promotions', async () => {
  // liveStatus and friends stay real — only the network call is stubbed.
  const actual = await vi.importActual('@/services/promotions')
  return { ...actual, fetchPromotion: vi.fn() }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '7' } }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
}

function promotion(overrides = {}) {
  return {
    id: 7,
    name: 'Launch Week',
    code: 'LAUNCH10',
    benefitType: 'Percentage Discount',
    benefit: '10% OFF',
    period: 'Aug 1, 2026 – Aug 31, 2026',
    status: 'active',
    used: 4,
    limit: 100,
    banner: 'linear-gradient(#000, #111)',
    description: 'Ten percent off everything.',
    isFlash: false,
    expiresAt: null,
    ...overrides,
  }
}

describe('PromotionDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows a loading state instead of crashing before the fetch resolves', () => {
    fetchPromotion.mockReturnValue(new Promise(() => {}))

    const wrapper = mount(PromotionDetailView, { global: { stubs } })

    expect(wrapper.text()).toContain('Loading promotion')
  })

  it('renders the promotion once loaded', async () => {
    fetchPromotion.mockResolvedValue(promotion())

    const wrapper = mount(PromotionDetailView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('Launch Week')
    expect(wrapper.text()).toContain('LAUNCH10')
    expect(wrapper.text()).toContain('4 / 100')
  })

  it('counts down a running flash sale', async () => {
    fetchPromotion.mockResolvedValue(
      promotion({
        benefitType: 'Flash Sale',
        isFlash: true,
        // Mid-minute so the assertion cannot straddle a "2h 00m 00s" boundary.
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000 - 30_000).toISOString(),
      }),
    )

    const wrapper = mount(PromotionDetailView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('.countdown').text()).toMatch(/^1h 59m \d{2}s left$/)
  })

  it('shows a lapsed flash sale as expired even though it was fetched as active', async () => {
    fetchPromotion.mockResolvedValue(
      promotion({
        benefitType: 'Flash Sale',
        isFlash: true,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    )

    const wrapper = mount(PromotionDetailView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('.hero__status').text()).toBe('Expired')
  })

  it('shows the error message when the promotion is missing', async () => {
    fetchPromotion.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))

    const wrapper = mount(PromotionDetailView, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('could not be found')
  })
})
