/**
 * Homepage carousel slides, backed by the admin banners API.
 *
 * The API models a banner as a single cover image (`image_desktop`) plus a
 * free-form `meta` json column. This screen edits an ordered list of frames
 * with playback settings, so the mapping splits that list: frame 1 becomes the
 * cover — which is what the storefront reads — and frames 2..n ride along in
 * `meta`, together with the playback settings and the no-image gradient.
 *
 * `meta` also absorbs `durationMs`, `transition` and `gradient`, none of which
 * have columns of their own.
 */
import { apiFetch } from '@/services/api'

// Backdrop for a slide with no images. Only shows through until the first
// image is added, so it is not editable — it just needs to be stable.
export const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1b2a4a 0%, #6d28d9 100%)'

// Every slide this screen manages belongs to the homepage carousel.
export const SLIDE_POSITION = 'homepage'

const DEFAULT_DURATION_MS = 3000
const DEFAULT_TRANSITION = 'fade'

/** `2026-07-01T09:30:00+00:00` -> `2026-07-01`, the value a date input wants. */
function dateValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

function text(value) {
  return value ?? ''
}

/**
 * active | scheduled | expired | draft, derived from the three columns that
 * actually decide whether the storefront shows the banner. Mirrors
 * `Banner::isVisible()` server-side, with `scheduled` and `expired` splitting
 * the two ways a banner can be on but not showing.
 */
function statusOf(banner) {
  if (!banner.is_active) return 'draft'

  const now = Date.now()
  if (banner.starts_at && new Date(banner.starts_at).getTime() > now) return 'scheduled'
  if (banner.ends_at && new Date(banner.ends_at).getTime() < now) return 'expired'

  return 'active'
}

/**
 * Frame list, cover first. `meta.frames` is only meaningful behind a cover:
 * without one, promoting frame 2 on the next save would silently reorder the
 * carousel, so an image-less banner reads as having no frames at all.
 */
function framesOf(banner) {
  if (!banner.image_desktop) return []

  const extra = Array.isArray(banner.meta?.frames) ? banner.meta.frames : []
  return [banner.image_desktop, ...extra.filter(Boolean)]
}

/** Shape a banner into the slide object the views and the form both bind to. */
export function slideFromApi(banner) {
  const meta = banner.meta ?? {}

  return {
    id: banner.id,
    title: text(banner.title),
    subtitle: text(banner.subtitle),
    cta: text(banner.button_text),
    ctaUrl: text(banner.button_url),
    status: statusOf(banner),
    images: framesOf(banner),
    durationMs: Number(meta.durationMs ?? DEFAULT_DURATION_MS),
    transition: meta.transition === 'cut' ? 'cut' : DEFAULT_TRANSITION,
    gradient: meta.gradient || DEFAULT_GRADIENT,
    startDate: dateValue(banner.starts_at),
    endDate: dateValue(banner.ends_at),
    sortOrder: Number(banner.sort_order ?? 0),
  }
}

/** Shape the form back into the columns `BannerController` validates. */
export function slideToPayload(form) {
  const images = form.images ?? []

  return {
    title: form.title.trim() || 'Untitled Slide',
    subtitle: form.subtitle.trim() || null,
    button_text: form.cta.trim() || 'Learn More',
    button_url: form.ctaUrl.trim() || null,
    image_desktop: images[0] ?? null,
    // No mobile-specific control in this editor: frame 2 means "next frame",
    // not "the phone version".
    image_mobile: null,
    is_active: form.status !== 'draft',
    starts_at: form.startDate || null,
    ends_at: form.endDate || null,
    position: SLIDE_POSITION,
    meta: {
      frames: images.slice(1),
      durationMs: form.durationMs,
      transition: form.transition,
      gradient: form.gradient,
    },
  }
}

/**
 * `index` answers with a paginator, `show` with a bare resource, so unwrap
 * whichever came back.
 */
function itemsOf(response) {
  const data = response?.data
  if (Array.isArray(data)) return data
  return Array.isArray(data?.data) ? data.data : []
}

/**
 * Note: the endpoint hardcodes `paginate(15)` and orders by `latest()`, so this
 * returns at most the 15 newest banners and NOT the storefront's `sort_order`
 * sequence.
 */
export async function fetchSlides(token) {
  const response = await apiFetch(`/admin/banners?position=${SLIDE_POSITION}`, { token })
  return itemsOf(response).map(slideFromApi)
}

export async function fetchSlide(id, token) {
  const response = await apiFetch(`/admin/banners/${id}`, { token })
  return slideFromApi(response?.data ?? {})
}

export async function saveSlide(id, form, token) {
  const response = await apiFetch(id ? `/admin/banners/${id}` : '/admin/banners', {
    method: id ? 'PATCH' : 'POST',
    body: slideToPayload(form),
    token,
  })
  return slideFromApi(response?.data ?? {})
}

/**
 * Persist a new carousel order.
 *
 * `orderedSlides` is the list as the user arranged it; position 1 is the first
 * slide the storefront plays. Only the rows that actually moved are written,
 * and each write carries `sort_order` alone so a reorder can never clobber a
 * title, image or schedule.
 *
 * Resolves to the list renumbered to match what was saved.
 */
export async function saveSlideOrder(orderedSlides, token) {
  const renumbered = orderedSlides.map((slide, index) => ({ ...slide, sortOrder: index + 1 }))

  const moved = renumbered.filter((slide, index) => orderedSlides[index].sortOrder !== slide.sortOrder)

  await Promise.all(
    moved.map((slide) =>
      apiFetch(`/admin/banners/${slide.id}`, {
        method: 'PATCH',
        body: { sort_order: slide.sortOrder },
        token,
      }),
    ),
  )

  return renumbered
}

export async function deleteSlide(id, token) {
  await apiFetch(`/admin/banners/${id}`, { method: 'DELETE', token })
}
