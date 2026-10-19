import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'
import { useUnviewedOrdersStore } from '@/stores/unviewedOrders'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications'
import { connectRealtime } from '@/services/realtime'

vi.mock('@/services/notifications', () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
vi.mock('@/services/realtime', () => ({ connectRealtime: vi.fn(), disconnectRealtime: vi.fn() }))
vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

// What the bell and the Orders sidebar badge share: one admin, one server-side
// read state. These pin that the two stay in step.
describe('notifications store and unviewed orders', () => {
  let notifications
  let unviewed
  let pushLive

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    fetchNotifications.mockResolvedValue({ items: [], unreadCount: 0 })
    connectRealtime.mockReturnValue({
      private: () => ({
        notification(callback) {
          pushLive = callback
        },
      }),
    })

    notifications = useNotificationsStore()
    unviewed = useUnviewedOrdersStore()
    vi.spyOn(unviewed, 'refresh').mockResolvedValue()
    vi.spyOn(unviewed, 'clear')
    await notifications.initialize('token', 1)
  })

  function item(category, extra = {}) {
    return { id: `n-${category}`, category, data: {}, read_at: null, ...extra }
  }

  it('refreshes the unviewed orders when a new order arrives live', () => {
    pushLive(item('orders', { id: 'live-1', data: { order_id: 5 } }))

    expect(unviewed.refresh).toHaveBeenCalledWith('token')
    expect(notifications.unreadCount).toBe(1)
  })

  it('leaves unviewed orders alone when a stock or customer notification arrives', () => {
    pushLive(item('low_stock', { id: 'live-2' }))
    pushLive(item('customers', { id: 'live-3' }))

    expect(unviewed.refresh).not.toHaveBeenCalled()
  })

  it('refreshes when an order notification is marked read from the notifications page', async () => {
    markNotificationRead.mockResolvedValue({})

    await notifications.markRead(item('orders'), 'token')

    expect(unviewed.refresh).toHaveBeenCalledWith('token')
  })

  it('does not refresh when a non-order notification is marked read', async () => {
    markNotificationRead.mockResolvedValue({})

    await notifications.markRead(item('out_of_stock'), 'token')

    expect(unviewed.refresh).not.toHaveBeenCalled()
  })

  it('clears the unviewed orders on mark all as read, since the server clears them too', async () => {
    markAllNotificationsRead.mockResolvedValue({})
    notifications.unreadCount = 3

    await notifications.markAllRead('token')

    expect(unviewed.clear).toHaveBeenCalled()
  })

  it('clears the unviewed orders when the session resets', () => {
    notifications.reset()

    expect(unviewed.clear).toHaveBeenCalled()
  })
})
