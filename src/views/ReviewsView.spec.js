import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReviewsView from '@/views/ReviewsView.vue'
import { fetchReviews, updateReview } from '@/services/reviews'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/reviews', async () => {
  const actual = await vi.importActual('@/services/reviews')
  return { ...actual, fetchReviews: vi.fn(), updateReview: vi.fn() }
})

const stub = { template: '<div><slot /></div>' }
const stubs = {
  AppHeader: stub,
  Select: stub,
  SelectContent: stub,
  SelectItem: stub,
  SelectTrigger: stub,
  SelectValue: stub,
}

function review(overrides = {}) {
  return {
    id: 4,
    rating: 5,
    title: 'Great phone',
    comment: '',
    status: 'pending',
    customerName: 'Dara Sok',
    customerEmail: 'dara@example.com',
    productName: 'iPhone 15',
    productSku: 'IP15',
    productThumbnail: '',
    isVerified: false,
    helpfulCount: 0,
    helpfulScore: 0,
    ...overrides,
  }
}

async function mountList() {
  fetchReviews.mockResolvedValue({ items: [review()], pagination: { total: 1, last_page: 1 } })
  const wrapper = mount(ReviewsView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('ReviewsView - moderation feedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useAuthStore().user = { permissions: ['reviews.update'] }
  })

  async function clickApprove(wrapper) {
    await wrapper.find('[aria-label="Approve review by Dara Sok"]').trigger('click')
    await flushPromises()
  }

  it('toasts a success once the review is approved', async () => {
    updateReview.mockResolvedValueOnce(undefined)
    const wrapper = await mountList()

    await clickApprove(wrapper)

    expect(updateReview).toHaveBeenCalledWith(4, { status: 'approved' }, null)
    expect(useToastStore().toasts).toMatchObject([
      { type: 'update', title: 'Review approved', message: 'The review by Dara Sok is now approved.' },
    ])
  })

  it('toasts the server message when the update fails', async () => {
    updateReview.mockRejectedValueOnce(new Error('Review was removed.'))
    const wrapper = await mountList()

    await clickApprove(wrapper)

    expect(useToastStore().toasts).toMatchObject([
      { type: 'error', title: 'Could not update review', message: 'Review was removed.' },
    ])
  })
})
