import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SlideImagesField from '@/components/slides/SlideImagesField.vue'
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

describe('SlideImagesField', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    validateImageFile.mockReturnValue(null)
  })

  it('emits the hosted URLs the upload endpoint returned', async () => {
    uploadImage
      .mockResolvedValueOnce({ url: 'https://cdn.test/one.png' })
      .mockResolvedValueOnce({ url: 'https://cdn.test/two.png' })

    const wrapper = mount(SlideImagesField, { props: { images: [] } })
    await pickFiles(wrapper, [fakeImage('one.png'), fakeImage('two.png')])

    // Hosted URLs, not blob:/data: — they have to stay loadable after this
    // component unmounts and the slide is saved.
    expect(await lastEmitted(wrapper)).toEqual([
      'https://cdn.test/one.png',
      'https://cdn.test/two.png',
    ])
  })

  it('appends to the frames already on the slide', async () => {
    uploadImage.mockResolvedValue({ url: 'https://cdn.test/new.png' })

    const wrapper = mount(SlideImagesField, { props: { images: ['https://cdn.test/old.png'] } })
    await pickFiles(wrapper, [fakeImage('new.png')])

    expect(await lastEmitted(wrapper)).toEqual([
      'https://cdn.test/old.png',
      'https://cdn.test/new.png',
    ])
  })

  it('rejects a file the API would refuse without spending a round trip', async () => {
    validateImageFile.mockReturnValue('Image is 9.0MB. The limit is 5MB.')

    const wrapper = mount(SlideImagesField, { props: { images: [] } })
    await pickFiles(wrapper, [fakeImage('huge.png')])
    await vi.waitFor(() => expect(wrapper.text()).toContain('The limit is 5MB'))

    expect(uploadImage).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:images')).toBeFalsy()
  })

  it('keeps the frames that uploaded when one of them fails', async () => {
    uploadImage
      .mockResolvedValueOnce({ url: 'https://cdn.test/ok.png' })
      .mockRejectedValueOnce(new Error('Cloudinary is down'))

    const wrapper = mount(SlideImagesField, { props: { images: [] } })
    await pickFiles(wrapper, [fakeImage('ok.png'), fakeImage('bad.png')])
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cloudinary is down'))

    expect(await lastEmitted(wrapper)).toEqual(['https://cdn.test/ok.png'])
  })

  it('removes a frame without disturbing the rest', async () => {
    const images = ['https://cdn.test/a.png', 'https://cdn.test/b.png']
    const wrapper = mount(SlideImagesField, { props: { images } })

    await wrapper.find('[aria-label="Remove image 1"]').trigger('click')

    expect(wrapper.emitted('update:images').at(-1)[0]).toEqual([images[1]])
  })

  it('reorders frames so the cover can be changed', async () => {
    const images = ['https://cdn.test/a.png', 'https://cdn.test/b.png']
    const wrapper = mount(SlideImagesField, { props: { images } })

    await wrapper.find('[aria-label="Move image 2 earlier"]').trigger('click')

    expect(wrapper.emitted('update:images').at(-1)[0]).toEqual([images[1], images[0]])
  })
})
