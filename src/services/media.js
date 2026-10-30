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
export const ACCEPTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v', 'avi']
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024

/** `accept` attribute for a file input, matching what the API will take. */
export const ACCEPT_ATTR = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'
export const VIDEO_ACCEPT_ATTR = 'video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-msvideo'

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

export function validateVideoFile(file) {
  if (!file) return 'No file selected.'

  const extension = String(file.name ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (!ACCEPTED_VIDEO_EXTENSIONS.includes(extension)) {
    return `Unsupported video format. Use ${ACCEPTED_VIDEO_EXTENSIONS.join(', ')}.`
  }

  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `Video is ${mb}MB. The limit is 100MB.`
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

export async function uploadVideo(file, { token, folder } = {}) {
  const problem = validateVideoFile(file)
  if (problem) throw new Error(problem)

  const form = new FormData()
  form.append('file', file)
  form.append('resource_type', 'video')
  if (folder) form.append('folder', folder)

  const response = await apiFetch('/admin/media', { method: 'POST', body: form, token })

  const url = response?.data?.url
  if (!url) {
    throw new Error('Upload succeeded but no video URL came back.')
  }

  return { url, path: response?.data?.path ?? null }
}
