import { apiFetch } from '@/services/api'

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