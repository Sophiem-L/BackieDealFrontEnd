import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SlideSequence from '@/components/slides/SlideSequence.vue'

const IMAGES = ['a.png', 'b.png', 'c.png']

function mountSequence(props = {}) {
  return mount(SlideSequence, { props: { images: IMAGES, durationMs: 3000, ...props } })
}

describe('SlideSequence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('per-image transitions', () => {
    const transitions = ['fade', 'slide', 'blinds-right']

    it('plays the transition of the image that is coming in', async () => {
      const wrapper = mountSequence({ transitions })

      await vi.advanceTimersByTimeAsync(3000) // image 2 comes in
      expect(wrapper.classes()).toContain('sequence--slide')

      await vi.advanceTimersByTimeAsync(3000) // image 3 comes in
      expect(wrapper.classes()).toContain('sequence--blinds')
      expect(wrapper.classes()).not.toContain('sequence--slide')

      await vi.advanceTimersByTimeAsync(3000) // loops back to image 1
      expect(wrapper.classes()).toContain('sequence--fade')
      expect(wrapper.classes()).not.toContain('sequence--blinds')
    })

    it('only draws blinds strips while the image that asked for blinds is coming in', async () => {
      const wrapper = mountSequence({ transitions })

      await vi.advanceTimersByTimeAsync(3000)
      expect(wrapper.findAll('.sequence__strip')).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(3000)
      expect(wrapper.findAll('.sequence__strip')).toHaveLength(16)
      expect(wrapper.findAll('.sequence__strip')[0].attributes('src')).toBe('c.png')

      await vi.advanceTimersByTimeAsync(3000)
      expect(wrapper.findAll('.sequence__strip')).toHaveLength(0)
    })

    it('uses the slide default for an image with no transition of its own', async () => {
      const wrapper = mountSequence({ transition: 'zoom', transitions: ['fade'] })

      await vi.advanceTimersByTimeAsync(3000)

      expect(wrapper.classes()).toContain('sequence--zoom')
    })

    it('uses the slide default for every image when there is no list', async () => {
      const wrapper = mountSequence({ transition: 'cut' })

      await vi.advanceTimersByTimeAsync(3000)

      expect(wrapper.classes()).toContain('sequence--cut')
    })

    it('plays an unrecognised transition as a fade', async () => {
      const wrapper = mountSequence({ transitions: ['fade', 'spin', 'fade'] })

      await vi.advanceTimersByTimeAsync(3000)

      expect(wrapper.classes()).toContain('sequence--fade')
    })

    it('does not animate the first image in on load, whatever its transition', () => {
      const wrapper = mountSequence({ transitions: ['blinds-left', 'fade', 'fade'] })

      expect(wrapper.find('.sequence__frame--enter').exists()).toBe(false)
      expect(wrapper.findAll('.sequence__strip')).toHaveLength(0)
    })

    it('keeps the old image in place under the incoming one', async () => {
      const wrapper = mountSequence({ transitions })

      await vi.advanceTimersByTimeAsync(3000)

      const [first, second] = wrapper.findAll('.sequence__frame')
      expect(second.classes()).toContain('sequence__frame--enter')
      expect(first.classes()).toContain('sequence__frame--leave')
    })

    it('animates the first image when the loop wraps back to it', async () => {
      const wrapper = mountSequence({ transitions: ['zoom', 'fade', 'fade'] })

      await vi.advanceTimersByTimeAsync(9000)

      expect(wrapper.classes()).toContain('sequence--zoom')
      expect(wrapper.findAll('.sequence__frame')[0].classes()).toContain('sequence__frame--enter')
    })
  })

  describe('blinds', () => {
    it('staggers the strips left to right from the left', async () => {
      const wrapper = mountSequence({ transitions: ['fade', 'blinds-left', 'fade'] })

      await vi.advanceTimersByTimeAsync(3000)
      const strips = wrapper.findAll('.sequence__strip')

      expect(strips[0].attributes('style')).toContain('animation-delay: 0ms')
      expect(strips[15].attributes('style')).toContain('animation-delay: 600ms')
    })

    it('staggers the strips right to left from the right', async () => {
      const wrapper = mountSequence({ transitions: ['fade', 'blinds-right', 'fade'] })

      await vi.advanceTimersByTimeAsync(3000)
      const strips = wrapper.findAll('.sequence__strip')

      expect(strips[15].attributes('style')).toContain('animation-delay: 0ms')
      expect(strips[0].attributes('style')).toContain('animation-delay: 600ms')
    })

    it('draws rows, not columns, for blinds from the top', async () => {
      const wrapper = mountSequence({ transitions: ['fade', 'blinds-top', 'fade'] })

      await vi.advanceTimersByTimeAsync(3000)
      const strips = wrapper.findAll('.sequence__strip')

      expect(strips).toHaveLength(8)
      expect(strips[0].attributes('style')).toContain('animation-delay: 0ms')
      expect(strips[7].attributes('style')).toContain('animation-delay: 560ms')
      // Rows are cut across the height: top and bottom insets, no left/right.
      expect(strips[1].attributes('style')).toMatch(/clip-path: inset\(12\.5% 0/)
    })

    it('starts at the bottom row for blinds from the bottom', async () => {
      const wrapper = mountSequence({ transitions: ['fade', 'blinds-bottom', 'fade'] })

      await vi.advanceTimersByTimeAsync(3000)
      const strips = wrapper.findAll('.sequence__strip')

      expect(strips).toHaveLength(8)
      expect(strips[7].attributes('style')).toContain('animation-delay: 0ms')
      expect(strips[0].attributes('style')).toContain('animation-delay: 560ms')
    })

    it('treats every direction as blinds', async () => {
      for (const direction of ['blinds-left', 'blinds-right', 'blinds-top', 'blinds-bottom']) {
        const wrapper = mountSequence({ transitions: ['fade', direction, 'fade'] })

        await vi.advanceTimersByTimeAsync(3000)

        expect(wrapper.classes()).toContain('sequence--blinds')
      }
    })

    it('keeps a lone image as a plain image', () => {
      const wrapper = mountSequence({ images: ['a.png'], transitions: ['blinds-left'] })

      expect(wrapper.findAll('.sequence__strip')).toHaveLength(0)
      expect(wrapper.findAll('img.sequence__frame')).toHaveLength(1)
    })
  })

  it.each([
    'fade',
    'cut',
    'zoom',
    'grow',
    'blur',
    'slide',
    'slide-left',
    'slide-up',
    'slide-down',
    'wipe-left',
    'wipe-right',
    'circle',
    'flip',
  ])('plays %s as one image per frame', async (transition) => {
    const wrapper = mountSequence({ transition })

    await vi.advanceTimersByTimeAsync(3000)

    expect(wrapper.findAll('img.sequence__frame')).toHaveLength(IMAGES.length)
    expect(wrapper.findAll('.sequence__strip')).toHaveLength(0)
    expect(wrapper.classes()).toContain(`sequence--${transition}`)
  })

  it.each([
    ['slide-left', 'sequence--slide'],
    ['slide-up', 'sequence--slide'],
    ['slide-down', 'sequence--slide'],
    ['wipe-left', 'sequence--wipe'],
    ['wipe-right', 'sequence--wipe'],
  ])('plays %s with the rules shared by its family', async (transition, family) => {
    const wrapper = mountSequence({ transition })

    await vi.advanceTimersByTimeAsync(3000)

    expect(wrapper.classes()).toContain(family)
  })

  it('does not mistake zoom in for a zoom out', async () => {
    const wrapper = mountSequence({ transition: 'grow' })

    await vi.advanceTimersByTimeAsync(3000)

    expect(wrapper.classes()).toContain('sequence--grow')
    expect(wrapper.classes()).not.toContain('sequence--zoom')
  })

  it('gives a cut no animation time and the slower effects longer', async () => {
    const durationAfterOneChange = async (transition) => {
      const wrapper = mountSequence({ transition })
      await vi.advanceTimersByTimeAsync(3000)
      return wrapper.findAll('.sequence__frame')[1].attributes('style')
    }

    expect(await durationAfterOneChange('cut')).toContain('animation-duration: 0ms')
    expect(await durationAfterOneChange('fade')).toContain('animation-duration: 600ms')
    expect(await durationAfterOneChange('flip')).toContain('animation-duration: 900ms')
  })

  it('labels the sequence for assistive tech on the first frame only', () => {
    const wrapper = mountSequence({ alt: 'Back to school' })
    const frames = wrapper.findAll('.sequence__frame')

    expect(frames[0].attributes('alt')).toBe('Back to school')
    expect(frames[1].attributes('alt')).toBe('')
  })
})
