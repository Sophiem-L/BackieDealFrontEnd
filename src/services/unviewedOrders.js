import { apiFetch } from '@/services/api'

// Both endpoints answer with the caller's refreshed list: { count, order_ids }.
// `order_ids` are order uuids, the same id the Orders list rows carry. A reply
// without that array (an unexpected shape) comes back as null so the caller can
// keep what it already knows instead of overwriting it with a guess.
function orderIdsFrom(response) {
  const ids = response?.data?.order_ids
  return Array.isArray(ids) ? ids.map(String) : null
}

export async function fetchUnviewedOrders(token) {
  return orderIdsFrom(await apiFetch('/admin/orders/unviewed', { token }))
}

// `id` is whatever the page was opened with — a uuid from the Orders list, or a
// numeric id from a notification link. The backend binds either.
export async function markOrderViewed(id, token) {
  return orderIdsFrom(await apiFetch(`/admin/orders/${id}/viewed`, { method: 'POST', token }))
}
