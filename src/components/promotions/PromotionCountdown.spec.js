import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PromotionCountdown from '@/components/promotions/PromotionCountdown.vue'

const NOW = new Date('2026-08-30T12:00:00.000Z')

// Advances the shared clock and lets the render queue catch up.
async function tick(ms) {
  vi.advanceTimersByTime(ms)
  await nextTick()
}

describe('PromotionCountdown', () => {
  // The clock behind the countdown is a module singleton that runs only while
  // something is subscribed. Every mount is torn down so one test's interval
  // cannot outlive its fake timers and leave the next test frozen.
  let mounted = []

  function mountCountdown(expiresAt) {
    const wrapper = mount(PromotionCountdown, { props: { expiresAt } })
    mounted.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    vi.useRealTimers()
  })

  it('shows the time left in the window', () => {
    const wrapper = mountCountdown('2026-08-30T14:41:03.000Z')

    expect(wrapper.text()).toBe('2h 41m 03s left')
  })

  it('reads the clock at mount rather than at module load', () => {
    // The shared clock is a module singleton; a card mounted an hour into the
    // session must not render the time the module happened to be imported.
    vi.setSystemTime(new Date('2026-08-30T13:00:00.000Z'))
    const wrapper = mountCountdown('2026-08-30T13:00:30.000Z')

    expect(wrapper.text()).toBe('30s left')
  })

  it('counts down on its own once a second', async () => {
    const wrapper = mountCountdown('2026-08-30T12:00:30.000Z')

    await tick(1000)

    expect(wrapper.text()).toBe('29s left')
  })

  it('flips to expired when the window closes, without a reload', async () => {
    const wrapper = mountCountdown('2026-08-30T12:00:02.000Z')

    await tick(3000)

    expect(wrapper.text()).toBe('Expired')
  })

  it('marks the expired state for styling', async () => {
    const wrapper = mountCountdown('2026-08-30T11:00:00.000Z')

    expect(wrapper.text()).toBe('Expired')
    expect(wrapper.classes()).toContain('countdown--expired')
  })

  it('renders nothing for a promotion with no expiry', () => {
    const wrapper = mountCountdown(null)

    expect(wrapper.text()).toBe('')
  })

  it('stops its timer when the last countdown leaves the page', async () => {
    // One shared interval for every card; it must not outlive them.
    const wrapper = mountCountdown('2026-08-30T14:00:00.000Z')
    wrapper.unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
