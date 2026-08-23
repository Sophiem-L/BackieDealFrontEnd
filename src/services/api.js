// Thin fetch wrapper around the Beckie Deal backend API.
// In dev, requests hit the Vite proxy (`/api` -> http://localhost:8000), so no
// CORS setup is needed. Override the base URL via VITE_API_BASE_URL for prod.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

let unauthenticatedHandler = null
let unauthenticatedHandled = false

export function setUnauthenticatedHandler(handler) {
  unauthenticatedHandler = handler
}

export function resetUnauthenticatedHandler() {
  unauthenticatedHandled = false
}

async function handleUnauthenticated() {
  if (unauthenticatedHandled || !unauthenticatedHandler) return

  unauthenticatedHandled = true
  await unauthenticatedHandler()
}

export async function apiFetch(path, { method = 'GET', body, token, headers = {} } = {}) {
  // FormData bodies (file uploads) must pass through untouched: the browser has
  // to set Content-Type itself so it can include the multipart boundary.
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData

  const options = {
    method,
    headers: {
      Accept: 'application/json',
      ...(body && !isMultipart ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }

  if (body !== undefined) {
    options.body = isMultipart ? body : JSON.stringify(body)
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

    // Requests with a bearer token are protected API calls. A 401 means that
    // the stored token is no longer usable; clear the admin session once.
    if (response.status === 401 && token) {
      await handleUnauthenticated()
    }

    throw error
  }

  return payload
}
