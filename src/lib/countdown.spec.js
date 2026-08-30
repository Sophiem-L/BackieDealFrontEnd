import { describe, it, expect } from 'vitest'
import { formatCountdown } from '@/lib/countdown'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

describe('formatCountdown', () => {
  it('spells out hours, minutes and seconds', () => {
    expect(formatCountdown(2 * HOUR + 41 * MINUTE + 3 * SECOND)).toBe('2h 41m 03s')
  })

  it('pads the minutes and seconds so the text does not jitter as it ticks', () => {
    expect(formatCountdown(1 * HOUR)).toBe('1h 00m 00s')
  })

  it('drops the hours once under an hour', () => {
    expect(formatCountdown(41 * MINUTE + 3 * SECOND)).toBe('41m 03s')
  })

  it('drops the minutes once under a minute', () => {
    expect(formatCountdown(9 * SECOND)).toBe('9s')
  })

  it('rounds a part-second up, so a live promotion never reads as 0s', () => {
    expect(formatCountdown(2.5 * SECOND)).toBe('3s')
  })

  it('returns nothing once the window has closed', () => {
    expect(formatCountdown(0)).toBe('')
  })

  it('returns nothing for a window that closed long ago', () => {
    expect(formatCountdown(-5 * HOUR)).toBe('')
  })
})
