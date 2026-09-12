import { describe, expect, it } from 'vitest'

describe('Stock helper logic', () => {
  function deriveAvailability(stock, threshold) {
    const qty = Number(stock ?? 0)
    if (qty <= 0) return 'out-of-stock'
    const minThreshold = Number(threshold ?? 0)
    if (minThreshold > 0 && qty <= minThreshold) return 'low-stock'
    return 'healthy'
  }

  function formatStockDate(value) {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    const day = String(d.getDate()).padStart(2, '0')
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'june', 'july', 'aug', 'sept', 'oct', 'nov', 'dec']
    const month = months[d.getMonth()]
    const yr = String(d.getFullYear()).slice(-2)
    return `${day}/${month}/${yr}`
  }

  it('correctly classifies stock availability', () => {
    expect(deriveAvailability(0, 5)).toBe('out-of-stock')
    expect(deriveAvailability(-2, 5)).toBe('out-of-stock')
    expect(deriveAvailability(3, 5)).toBe('low-stock')
    expect(deriveAvailability(5, 5)).toBe('low-stock')
    expect(deriveAvailability(10, 5)).toBe('healthy')
  })

  it('formats stock creation dates properly', () => {
    expect(formatStockDate('2026-06-23T10:00:00Z')).toContain('26')
    expect(formatStockDate(null)).toBe('—')
  })
})

