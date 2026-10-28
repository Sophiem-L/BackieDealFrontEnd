import { describe, it, expect } from 'vitest'
import { NAV_SECTIONS, badgeCount, badgeLabel, visibleSections } from '@/lib/navigation'

const ordersItem = NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.label === 'Orders')

describe('navigation', () => {
  it('does not hardcode a number on the Orders badge', () => {
    // It used to be a literal 12. The count is per admin and lives in the
    // unviewed-orders store; the nav only names which store figure to show.
    expect(ordersItem).toBeDefined()
    expect(ordersItem.badge).toBeUndefined()
    expect(ordersItem.badgeKey).toBe('unviewedOrders')
  })

  it('hides Orders from a role without orders.view', () => {
    const sections = visibleSections((permission) => permission !== 'orders.view')

    const labels = sections.flatMap((section) => section.items.map((item) => item.label))
    expect(labels).not.toContain('Orders')
  })

  it('does not expose the Serial Numbers page', () => {
    const labels = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.label))
    expect(labels).not.toContain('Serial Numbers')
  })
})

describe('nav badges', () => {
  it('reads the live figure an item names and nothing for items that name none', () => {
    const counts = { unviewedOrders: 7 }
    const products = NAV_SECTIONS.flatMap((section) => section.items).find(
      (item) => item.label === 'Products',
    )

    expect(badgeCount(ordersItem, counts)).toBe(7)
    expect(badgeCount(products, counts)).toBe(0)
  })

  it('counts a figure that has not loaded yet as zero', () => {
    expect(badgeCount(ordersItem, {})).toBe(0)
    expect(badgeCount(ordersItem, { unviewedOrders: undefined })).toBe(0)
  })

  it('writes small counts as they are and caps large ones', () => {
    expect(badgeLabel(1)).toBe('1')
    expect(badgeLabel(99)).toBe('99')
    expect(badgeLabel(100)).toBe('99+')
    expect(badgeLabel(2500)).toBe('99+')
  })
})
