import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import { uploadImage, validateImageFile } from '@/services/media'

vi.mock('@/services/media', () => ({
  uploadImage: vi.fn(),
  validateImageFile: vi.fn(() => null),
  ACCEPT_ATTR: 'image/jpeg,image/png',
}))

// jsdom cannot build a real FileList, and `input.files` is read-only, so the
// list is defined onto the element directly before dispatching `change`.
function pickFiles(wrapper, files) {
  const input = wrapper.find('input[type="file"]').element
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  return wrapper.find('input[type="file"]').trigger('change')
}

function fakeImage(name) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })
}

function lastEmitted(wrapper) {
  return vi.waitFor(() => {
    const events = wrapper.emitted('update:images')
    expect(events).toBeTruthy()
    return events.at(-1)[0]
  })
}

function entry(url, isPrimary = false) {
  return { url, isPrimary }
}

describe('ProductImageGallery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    validateImageFile.mockReturnValue(null)
  })

  it('makes the first image of an empty gallery the primary one', async () => {
    uploadImage
      .mockResolvedValueOnce({ url: 'https://cdn.test/one.png' })
      .mockResolvedValueOnce({ url: 'https://cdn.test/two.png' })

    const wrapper = mount(ProductImageGallery, { props: { images: [] } })
    await pickFiles(wrapper, [fakeImage('one.png'), fakeImage('two.png')])

    // Without this a brand new product could be saved with a gallery but no
    // thumbnail, and it would show the initials tile in the product list.
    expect(await lastEmitted(wrapper)).toEqual([
      entry('https://cdn.test/one.png', true),
      entry('https://cdn.test/two.png', false),
    ])
  })

  it('does not steal the primary flag when adding to an existing gallery', async () => {
    uploadImage.mockResolvedValueOnce({ url: 'https://cdn.test/new.png' })

    const wrapper = mount(ProductImageGallery, {
      props: { images: [entry('https://cdn.test/existing.png', true)] },
    })
    await pickFiles(wrapper, [fakeImage('new.png')])

    expect(await lastEmitted(wrapper)).toEqual([
      entry('https://cdn.test/existing.png', true),
      entry('https://cdn.test/new.png', false),
    ])
  })

  it('keeps uploads that succeeded when one file in the batch fails', async () => {
    uploadImage
      .mockResolvedValueOnce({ url: 'https://cdn.test/ok.png' })
      .mockRejectedValueOnce(new Error('Upload failed.'))

    const wrapper = mount(ProductImageGallery, { props: { images: [] } })
    await pickFiles(wrapper, [fakeImage('ok.png'), fakeImage('bad.png')])

    expect(await lastEmitted(wrapper)).toEqual([entry('https://cdn.test/ok.png', true)])
    await vi.waitFor(() => {
      expect(wrapper.find('[role="alert"]').text()).toContain('bad.png')
    })
  })

  it('moves the primary flag exclusively, since the API rejects two primaries', async () => {
    const wrapper = mount(ProductImageGallery, {
      props: {
        images: [
          entry('https://cdn.test/a.png', true),
          entry('https://cdn.test/b.png'),
          entry('https://cdn.test/c.png'),
        ],
      },
    })

    await wrapper.find('[aria-label="Make image 3 the primary image"]').trigger('click')

    expect(await lastEmitted(wrapper)).toEqual([
      entry('https://cdn.test/a.png', false),
      entry('https://cdn.test/b.png', false),
      entry('https://cdn.test/c.png', true),
    ])
  })

  it('hands the primary flag on when the primary image is removed', async () => {
    const wrapper = mount(ProductImageGallery, {
      props: {
        images: [entry('https://cdn.test/a.png', true), entry('https://cdn.test/b.png')],
      },
    })

    await wrapper.find('[aria-label="Remove image 1"]').trigger('click')

    // A gallery with images but no primary would save a null thumbnail.
    expect(await lastEmitted(wrapper)).toEqual([entry('https://cdn.test/b.png', true)])
  })

  it('leaves no primary behind when the last image is removed', async () => {
    const wrapper = mount(ProductImageGallery, {
      props: { images: [entry('https://cdn.test/a.png', true)] },
    })

    await wrapper.find('[aria-label="Remove image 1"]').trigger('click')

    expect(await lastEmitted(wrapper)).toEqual([])
  })

  it('reorders images without touching which one is primary', async () => {
    const wrapper = mount(ProductImageGallery, {
      props: {
        images: [entry('https://cdn.test/a.png', true), entry('https://cdn.test/b.png')],
      },
    })

    await wrapper.find('[aria-label="Move image 2 earlier"]').trigger('click')

    expect(await lastEmitted(wrapper)).toEqual([
      entry('https://cdn.test/b.png', false),
      entry('https://cdn.test/a.png', true),
    ])
  })

  it('offers no editing affordances in read-only mode', () => {
    const wrapper = mount(ProductImageGallery, {
      props: {
        images: [entry('https://cdn.test/a.png', true), entry('https://cdn.test/b.png')],
        readonly: true,
      },
    })

    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Remove image 1"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Make image 2 the primary image"]').exists()).toBe(false)
    // Browsing still works: the thumbnails switch the large preview.
    expect(wrapper.findAll('[aria-label^="Show image"]')).toHaveLength(2)
  })

  it('previews the primary image rather than the first one', () => {
    const wrapper = mount(ProductImageGallery, {
      props: {
        images: [entry('https://cdn.test/a.png'), entry('https://cdn.test/b.png', true)],
      },
    })

    expect(wrapper.find('.gallery__preview img').attributes('src')).toBe('https://cdn.test/b.png')
  })
})
