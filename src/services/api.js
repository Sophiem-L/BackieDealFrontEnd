// Thin fetch wrapper around the Beckie Deal backend API.
// In dev, requests hit the Vite proxy (`/api` -> http://localhost:8000), so no
// CORS setup is needed. Override the base URL via VITE_API_BASE_URL for prod.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export async function apiFetch(path, { method = 'GET', body, token, headers = {} } = {}) {
  const options = {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${path}`, options)

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // 204 No Content and other empty bodies fall through with payload = null.
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed (${response.status})`)
    error.status = response.status
    error.errors = payload?.errors || {}
    throw error
  }

  return payload
}
