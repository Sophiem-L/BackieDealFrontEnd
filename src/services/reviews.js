/**
 * Customer review/rating records for the admin dashboard.
 *
 * The admin API returns a paginated resource with `items` + `pagination` and a
 * flattened customer/product payload, so this service converts that payload into
 * the shape the review screen binds to.
 */
import { apiFetch } from '@/services/api'

export const reviewStatuses = {
  all: 'All statuses',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  hidden: 'Hidden',
}

export function reviewTone(status) {
  switch (status) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'hidden':
      return 'muted'
    default:
      return 'warning'
  }
}

export function reviewStars(rating) {
  const value = Number(rating) || 0
  return `${'★'.repeat(Math.min(5, Math.max(0, value)))}${'☆'.repeat(5 - Math.min(5, Math.max(0, value)))}`
}

export function reviewFromApi(raw) {
  return {
    id: raw?.id,
    rating: Number(raw?.rating ?? 0),
    title: raw?.title || 'Customer review',
    comment: raw?.comment || '',
    status: raw?.status || 'pending',
    customerId: raw?.customer?.id ?? null,
    customerName: raw?.customer?.name || 'Unknown customer',
    customerEmail: raw?.customer?.email || '',
    productId: raw?.product?.id ?? null,
    productName: raw?.product?.name || 'Unknown product',
    productSku: raw?.product?.sku || '',
    productThumbnail: raw?.product?.thumbnail || '',
    orderId: raw?.order_id ?? null,
    isVerified: Boolean(raw?.is_verified_purchase),
    isFeatured: Boolean(raw?.is_featured),
    helpfulCount: Number(raw?.helpful_count ?? 0),
    notHelpfulCount: Number(raw?.not_helpful_count ?? 0),
    helpfulScore: Number(raw?.helpful_score ?? 0),
    createdAt: raw?.created_at || null,
    updatedAt: raw?.updated_at || null,
  }
}

export async function fetchReviews(
  token,
  {
    page = 1,
    perPage = 15,
    q = '',
    status = 'all',
    rating = '',
    sort = 'created_at',
    direction = 'desc',
  } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort,
    direction,
  })

  const keyword = q.trim()
  if (keyword) params.set('q', keyword)
  if (status && status !== 'all') params.set('status', status)
  if (rating !== '' && rating !== 'all') params.set('rating', String(rating))

  const response = await apiFetch(`/admin/reviews?${params.toString()}`, { token })
  const data = response?.data ?? {}
  const items = Array.isArray(data.items) ? data.items : []

  return {
    items: items.map(reviewFromApi),
    pagination: data.pagination ?? {
      total: items.length,
      per_page: perPage,
      current_page: page,
      last_page: 1,
      count: items.length,
    },
    filters: data.filters ?? {},
  }
}

export async function updateReview(id, payload, token) {
  const response = await apiFetch(`/admin/reviews/${id}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
  return reviewFromApi(response?.data ?? {})
}
