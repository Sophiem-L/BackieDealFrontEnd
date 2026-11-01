import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NotificationsView from '@/views/NotificationsView.vue'
import { markAllNotificationsRead, markNotificationRead } from '@/services/notifications'
import { useNotificationsStore } from '@/stores/notifications'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/notifications', () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
vi.mock('@/services/realtime', () => ({ connectRealtime: vi.fn(), disconnectRealtime: vi.fn() }))
vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button :disabled="disabled"><slot /></button>', props: ['disabled'] },
}

function mountWithUnread() {
  const notifications = useNotificationsStore()
  notifications.items = [
    { id: 'a', category: 'low_stock', title: 'Low stock', message: 'Keyboard is low', read_at: null, created_at: '2026-11-01T10:00:00Z' },
    { id: 'b', category: 'low_stock', title: 'Low stock', message: 'Mouse is low', read_at: null, created_at: '2026-11-01T10:05:00Z' },
  ]
  notifications.unreadCount = 2
  return mount(NotificationsView, { global: { stubs } })
}

const markAllButton = (wrapper) => wrapper.findAll('button').find((button) => button.text() === 'Mark all as read')

describe('NotificationsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('toasts the count once mark-all-read resolves', async () => {
    markAllNotificationsRead.mockResolvedValue({})
    const wrapper = mountWithUnread()

    await markAllButton(wrapper).trigger('click')
    await flushPromises()

    const toasts = useToastStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ type: 'update', title: 'Notifications marked as read' })
    expect(toasts[0].message).toContain('2 notifications')
  })

  it('toasts the failure, and leaves the notifications unread, when mark-all-read is rejected', async () => {
    markAllNotificationsRead.mockRejectedValue(new Error('Server is down'))
    const wrapper = mountWithUnread()

    await markAllButton(wrapper).trigger('click')
    await flushPromises()

    const toasts = useToastStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ type: 'error', title: 'Could not mark notifications as read', message: 'Server is down' })
    expect(useNotificationsStore().unreadCount).toBe(2)
  })

  it('toasts the failure when marking a single notification as read is rejected', async () => {
    markNotificationRead.mockRejectedValue(new Error('Server is down'))
    const wrapper = mountWithUnread()

    await wrapper.find('.feed__row').trigger('click')
    await flushPromises()

    const toasts = useToastStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ type: 'error', title: 'Could not mark notification as read', message: 'Server is down' })
  })

  it('does not toast when a notification is opened, since the row change and redirect already show it', async () => {
    markNotificationRead.mockResolvedValue({})
    const wrapper = mountWithUnread()

    await wrapper.find('.feed__row').trigger('click')
    await flushPromises()

    expect(useToastStore().toasts).toHaveLength(0)
  })
})
