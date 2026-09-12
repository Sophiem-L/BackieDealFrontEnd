import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  slideFromApi,
  slideToPayload,
  saveSlideOrder,
  DEFAULT_GRADIENT,
} from '@/services/slides'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

// A banner as the API hands it over, with only the fields a test cares about
// overridden. Everything else stays at the shape BannerResource always sends.
function banner(overrides = {}) {
  return {
    id: 7,
    title: 'Promotion 2026',
    subtitle: 'Clear stock end of the year',
    image_desktop: 'https://cdn.test/frame-1.png',
    image_mobile: null,
    button_text: 'Shop Now',
    button_url: '/deals',
    is_active: true,
    sort_order: 0,
    starts_at: null,
    ends_at: null,
    position: 'homepage',
    meta: null,
    ...overrides,
  }
}

describe('slideFromApi — images', () => {
  it('rebuilds the frame list from image_desktop plus meta.frames', () => {
    const slide = slideFromApi(
      banner({ meta: { frames: ['https://cdn.test/frame-2.png', 'https://cdn.test/frame-3.png'] } }),
    )

    expect(slide.images).toEqual([
      'https://cdn.test/frame-1.png',
      'https://cdn.test/frame-2.png',
      'https://cdn.test/frame-3.png',
    ])
  })

  it('yields an empty frame list when the banner has no images at all', () => {
    expect(slideFromApi(banner({ image_desktop: null })).images).toEqual([])
  })

  it('ignores meta.frames when there is no cover image to lead them', () => {
    // frames without a cover would silently promote frame 2 to the cover on the
    // next save, reordering the carousel behind the user's back.
    const slide = slideFromApi(banner({ image_desktop: null, meta: { frames: ['https://cdn.test/orphan.png'] } }))
    expect(slide.images).toEqual([])
  })

  it('falls back to defaults when meta is null', () => {
    const slide = slideFromApi(banner({ meta: null }))

    expect(slide.durationMs).toBe(3000)
    expect(slide.transition).toBe('fade')
    expect(slide.gradient).toBe(DEFAULT_GRADIENT)
  })

  it('reads playback settings out of meta when present', () => {
    const slide = slideFromApi(banner({ meta: { durationMs: 5000, transition: 'cut', gradient: 'red' } }))

    expect(slide.durationMs).toBe(5000)
    expect(slide.transition).toBe('cut')
    expect(slide.gradient).toBe('red')
  })
})

describe('slideFromApi — status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('is draft whenever the banner is inactive, whatever the dates say', () => {
    const slide = slideFromApi(banner({ is_active: false, starts_at: '2026-07-01T00:00:00Z' }))
    expect(slide.status).toBe('draft')
  })

  it('is scheduled when it starts in the future', () => {
    expect(slideFromApi(banner({ starts_at: '2026-07-01T00:00:00Z' })).status).toBe('scheduled')
  })

  it('is expired when the end date has passed', () => {
    expect(slideFromApi(banner({ ends_at: '2026-06-01T00:00:00Z' })).status).toBe('expired')
  })

  it('is active when it is on and inside its window', () => {
    const slide = slideFromApi(
      banner({ starts_at: '2026-06-01T00:00:00Z', ends_at: '2026-07-01T00:00:00Z' }),
    )
    expect(slide.status).toBe('active')
  })

  it('is active when it is on with no window at all', () => {
    expect(slideFromApi(banner()).status).toBe('active')
  })
})

describe('slideFromApi — fields', () => {
  it('maps the CTA label and link off the button columns', () => {
    const slide = slideFromApi(banner())
    expect(slide.cta).toBe('Shop Now')
    expect(slide.ctaUrl).toBe('/deals')
  })

  it('turns null text columns into empty strings the form can bind to', () => {
    const slide = slideFromApi(banner({ title: null, subtitle: null, button_text: null, button_url: null }))

    expect(slide.title).toBe('')
    expect(slide.subtitle).toBe('')
    expect(slide.cta).toBe('')
    expect(slide.ctaUrl).toBe('')
  })

  it('trims timestamps down to the date input format', () => {
    const slide = slideFromApi(banner({ starts_at: '2026-07-01T09:30:00+00:00', ends_at: '2026-07-31T23:00:00+00:00' }))

    expect(slide.startDate).toBe('2026-07-01')
    expect(slide.endDate).toBe('2026-07-31')
  })
})

describe('slideToPayload', () => {
  function form(overrides = {}) {
    return {
      title: 'Promotion 2026',
      subtitle: 'Clear stock end of the year',
      cta: 'Shop Now',
      ctaUrl: '/deals',
      status: 'active',
      images: ['https://cdn.test/frame-1.png', 'https://cdn.test/frame-2.png'],
      durationMs: 3000,
      transition: 'fade',
      gradient: DEFAULT_GRADIENT,
      startDate: '',
      endDate: '',
      ...overrides,
    }
  }

  it('splits the frame list into the cover column and meta.frames', () => {
    const payload = slideToPayload(form())

    expect(payload.image_desktop).toBe('https://cdn.test/frame-1.png')
    expect(payload.meta.frames).toEqual(['https://cdn.test/frame-2.png'])
  })

  it('survives a round trip through the API shape', () => {
    const images = ['a.png', 'b.png', 'c.png']
    const payload = slideToPayload(form({ images, durationMs: 5000, transition: 'cut' }))
    const back = slideFromApi({ ...banner(), ...payload, meta: payload.meta })

    expect(back.images).toEqual(images)
    expect(back.durationMs).toBe(5000)
    expect(back.transition).toBe('cut')
  })

  it('sends null for the cover when there are no images', () => {
    const payload = slideToPayload(form({ images: [] }))

    expect(payload.image_desktop).toBeNull()
    expect(payload.meta.frames).toEqual([])
  })

  it('marks a draft inactive and anything else active', () => {
    expect(slideToPayload(form({ status: 'draft' })).is_active).toBe(false)
    expect(slideToPayload(form({ status: 'active' })).is_active).toBe(true)
    expect(slideToPayload(form({ status: 'scheduled' })).is_active).toBe(true)
  })

  it('defaults an empty CTA label but leaves an empty link null', () => {
    const payload = slideToPayload(form({ cta: '  ', ctaUrl: '  ' }))

    expect(payload.button_text).toBe('Learn More')
    expect(payload.button_url).toBeNull()
  })

  it('sends blank dates as null rather than empty strings', () => {
    const payload = slideToPayload(form({ startDate: '', endDate: '' }))

    expect(payload.starts_at).toBeNull()
    expect(payload.ends_at).toBeNull()
  })

  it('pins the banner to the homepage carousel', () => {
    expect(slideToPayload(form()).position).toBe('homepage')
  })
})

describe('saveSlideOrder', () => {
  function slide(id, sortOrder) {
    return { id, sortOrder, title: `Slide ${id}` }
  }

  beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockResolvedValue({ data: {} })
  })

  it('renumbers positions from the list order', async () => {
    const result = await saveSlideOrder([slide(7, 3), slide(4, 1), slide(9, 2)], 'tok')

    expect(result.map((s) => [s.id, s.sortOrder])).toEqual([
      [7, 1],
      [4, 2],
      [9, 3],
    ])
  })

  it('patches only sort_order, so no other column is disturbed', async () => {
    await saveSlideOrder([slide(4, 2), slide(7, 1)], 'tok')

    const [path, options] = apiFetch.mock.calls[0]
    expect(path).toBe('/admin/banners/4')
    expect(options.method).toBe('PATCH')
    expect(options.body).toEqual({ sort_order: 1 })
    expect(options.token).toBe('tok')
  })

  it('skips slides already sitting at their position', async () => {
    // Dragging the last of three onto the middle leaves the first untouched.
    await saveSlideOrder([slide(1, 1), slide(3, 3), slide(2, 2)], 'tok')

    const patched = apiFetch.mock.calls.map(([path]) => path)
    expect(patched).toEqual(['/admin/banners/3', '/admin/banners/2'])
  })

  it('writes nothing when the order did not change', async () => {
    await saveSlideOrder([slide(1, 1), slide(2, 2)], 'tok')

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('rejects if any position fails to save', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Server exploded'))

    await expect(saveSlideOrder([slide(2, 2), slide(1, 1)], 'tok')).rejects.toThrow('Server exploded')
  })
})
