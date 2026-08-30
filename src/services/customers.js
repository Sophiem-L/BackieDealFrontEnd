/**
 * Customer accounts, backed by the admin customers API.
 *
 * The API models a customer as a user row plus a default address and two order
 * aggregates; this screen shows one flat record per shopper. The mapping below
 * is the whole of that translation — everything the views bind to comes from
 * `customerFromApi`.
 *
 * `spent` arrives as a number and is formatted here rather than in each view,
 * so the list, the detail card and the print/export paths cannot drift.
 */
import { apiFetch } from '@/services/api'

// Fallback avatar colours, picked when a customer has no uploaded photo.
export const avatarTones = ['blue', 'green', 'violet', 'amber', 'rose', 'slate']

export const statusLabels = {
  active: 'Active',
  vip: 'VIP',
  inactive: 'Inactive',
}

// The list screen has no pager, so it asks for one page big enough to hold the
// directory. The API caps this at 200.
const PAGE_SIZE = 200

/**
 * A stable tone per customer, so the same person keeps the same colour between
 * loads. The API has no tone column and does not need one — it is presentation
 * only — so it is derived from the id instead of stored.
 */
export function toneFor(id) {
  return avatarTones[Math.abs(Number(id) || 0) % avatarTones.length]
}

export function formatSpent(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0)
}

/** Up to two initials, the avatar fallback when there is no photo. */
export function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Shape a CustomerResource into the record the views and the form bind to. */
export function customerFromApi(customer) {
  return {
    id: customer.id,
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    address: customer.address || '',
    avatar: customer.avatar || '',
    tone: toneFor(customer.id),
    status: statusLabels[customer.status] ? customer.status : 'active',
    orders: Number(customer.orders_count ?? 0),
    totalSpent: Number(customer.total_spent ?? 0),
    spent: formatSpent(customer.total_spent),
    createdAt: customer.created_at || null,
  }
}

/**
 * Shape the form back into the fields StoreCustomerRequest validates.
 *
 * Blank optional fields go over as null, not '': `users.phone` is uniquely
 * indexed, so two customers saved with an empty string would collide.
 */
export function customerToPayload(form) {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    avatar: form.avatar || null,
    status: form.status,
  }
}

/**
 * `index` answers with a paginator nested under `data`, `show` with a bare
 * resource, so unwrap whichever came back.
 */
function itemsOf(response) {
  const data = response?.data
  if (Array.isArray(data)) return data
  return Array.isArray(data?.data) ? data.data : []
}

/**
 * The directory, optionally narrowed by `search`.
 *
 * Filtering server-side rather than in the view means the search box still
 * works once the directory outgrows a single page.
 */
export async function fetchCustomers(token, { search = '' } = {}) {
  const params = new URLSearchParams({ per_page: String(PAGE_SIZE) })
  if (search.trim()) params.set('search', search.trim())

  const response = await apiFetch(`/admin/customers?${params}`, { token })
  return itemsOf(response).map(customerFromApi)
}

export async function fetchCustomer(id, token) {
  const response = await apiFetch(`/admin/customers/${id}`, { token })
  return customerFromApi(response?.data ?? {})
}

export async function saveCustomer(id, form, token) {
  const response = await apiFetch(id ? `/admin/customers/${id}` : '/admin/customers', {
    method: id ? 'PATCH' : 'POST',
    body: customerToPayload(form),
    token,
  })
  return customerFromApi(response?.data ?? {})
}

export async function deleteCustomer(id, token) {
  await apiFetch(`/admin/customers/${id}`, { method: 'DELETE', token })
}
