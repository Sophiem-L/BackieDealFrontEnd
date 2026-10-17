import { apiFetch } from '@/services/api'

/**
 * Fetch all administrators with pagination
 */
export async function fetchAdministrators(token, page = 1, perPage = 15) {
  return apiFetch(`/admin/administrators?page=${page}&per_page=${perPage}`, {
    method: 'GET',
    token,
  })
}

/**
 * Fetch a single administrator
 */
export async function fetchAdministrator(id, token) {
  return apiFetch(`/admin/administrators/${id}`, {
    method: 'GET',
    token,
  })
}

/**
 * Create a new administrator
 */
export async function createAdministrator(data, token) {
  return apiFetch('/admin/administrators', {
    method: 'POST',
    token,
    body: {
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      password: data.password,
      role_id: data.roleId,
    },
  })
}

/**
 * Update an administrator
 */
export async function updateAdministrator(id, data, token) {
  return apiFetch(`/admin/administrators/${id}`, {
    method: 'PUT',
    token,
    body: {
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      recovery_email: data.recoveryEmail || null,
      password: data.password || undefined,
      password_confirmation: data.passwordConfirm || undefined,
      role_id: data.roleId,
      is_active: data.isActive,
    },
  })
}

/**
 * Delete an administrator
 */
export async function deleteAdministrator(id, token) {
  return apiFetch(`/admin/administrators/${id}`, {
    method: 'DELETE',
    token,
  })
}

/**
 * Reset administrator password (super-admin only)
 */
export async function resetAdministratorPassword(id, password, token) {
  return apiFetch(`/admin/administrators/${id}/reset-password`, {
    method: 'POST',
    token,
    body: {
      password,
      password_confirmation: password,
    },
  })
}