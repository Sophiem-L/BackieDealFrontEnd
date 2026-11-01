import { apiFetch } from '@/services/api'

// The editable fields, in the shape the form binds to. Empty strings rather
// than nulls so inputs stay controlled.
export function blankSupplier() {
  return {
    id: null,
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    notes: '',
    isActive: true,
    isDefault: false,
  }
}

export function supplierFromApi(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    code: row.code ?? '',
    contactPerson: row.contact_person ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    taxId: row.tax_id ?? '',
    notes: row.notes ?? '',
    isActive: row.is_active !== false,
    isDefault: Boolean(row.is_default),
    productsCount: Number(row.products_count ?? 0),
  }
}

// Blank optional fields go out as null so the API clears them on update.
export function supplierToApi(form) {
  const orNull = (value) => {
    const trimmed = String(value ?? '').trim()
    return trimmed === '' ? null : trimmed
  }
  return {
    name: String(form.name ?? '').trim(),
    code: orNull(form.code),
    contact_person: orNull(form.contactPerson),
    phone: orNull(form.phone),
    email: orNull(form.email),
    address: orNull(form.address),
    tax_id: orNull(form.taxId),
    notes: orNull(form.notes),
    is_active: Boolean(form.isActive),
    is_default: Boolean(form.isActive && form.isDefault),
  }
}

export async function fetchSuppliers({ q, isActive, page = 1, perPage = 25 } = {}, token) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  if (q) params.set('q', q)
  if (isActive !== undefined && isActive !== null) params.set('is_active', isActive ? '1' : '0')

  const response = await apiFetch(`/admin/suppliers?${params.toString()}`, { token })
  const data = response?.data ?? {}
  return {
    items: (data.items ?? []).map(supplierFromApi),
    pagination: data.pagination ?? {},
  }
}

// Active suppliers for a picker. One page of 200 covers any realistic list.
export async function fetchSupplierOptions(token) {
  const { items } = await fetchSuppliers({ isActive: true, perPage: 200 }, token)
  return items
}

export async function createSupplier(form, token) {
  const response = await apiFetch('/admin/suppliers', { method: 'POST', body: supplierToApi(form), token })
  return supplierFromApi(response?.data ?? {})
}

export async function updateSupplier(id, form, token) {
  const response = await apiFetch(`/admin/suppliers/${id}`, { method: 'PATCH', body: supplierToApi(form), token })
  return supplierFromApi(response?.data ?? {})
}

export async function deleteSupplier(id, token) {
  await apiFetch(`/admin/suppliers/${id}`, { method: 'DELETE', token })
}

// Which supplier a delivery form starts on: the product's own default supplier
// when it is still in the active list, otherwise the store default, otherwise
// none. Returned as a string id ('' for none) to match the select's value.
export function suggestedSupplierId(productDefaultId, options) {
  const list = Array.isArray(options) ? options : []
  if (productDefaultId != null && list.some((s) => String(s.id) === String(productDefaultId))) {
    return String(productDefaultId)
  }
  const storeDefault = list.find((s) => s.isDefault)
  return storeDefault ? String(storeDefault.id) : ''
}
