/**
 * Image uploads via `POST /admin/media`.
 *
 * The endpoint forwards to Cloudinary and answers with `{ url, path }`, where
 * `url` is the public secure URL — that's what product `thumbnail` and variant
 * `image` columns store.
 */
import { apiFetch } from '@/services/api'

// Mirrors StoreMediaRequest: mimes:jpg,jpeg,png,gif,webp,svg and max:5120 (KB).
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** `accept` attribute for a file input, matching what the API will take. */
export const ACCEPT_ATTR = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'

/**
 * Check a file before spending a round trip on it. Returns an error string, or
 * null when the file is acceptable.
 */
export function validateImageFile(file) {
  if (!file) return 'No file selected.'

  const extension = String(file.name ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `Unsupported format. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `Image is ${mb}MB. The limit is 5MB.`
  }

  return null
}

/**
 * Upload one image and resolve to `{ url, path }`.
 *
 * `folder` is validated `alpha_dash` server-side, so it must not contain
 * slashes or spaces.
 */
export async function uploadImage(file, { token, folder } = {}) {
  const problem = validateImageFile(file)
  if (problem) throw new Error(problem)

  const form = new FormData()
  form.append('file', file)
  if (folder) form.append('folder', folder)

  const response = await apiFetch('/admin/media', { method: 'POST', body: form, token })

  const url = response?.data?.url
  if (!url) {
    throw new Error('Upload succeeded but no image URL came back.')
  }

  return { url, path: response?.data?.path ?? null }
}
