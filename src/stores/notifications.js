import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications'
import { connectRealtime, disconnectRealtime } from '@/services/realtime'

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const error = ref('')
  const initializedFor = ref(null)

  const unreadItems = computed(() => items.value.filter((item) => !item.read_at))

  function addNotification(notification) {
    if (!notification?.id || items.value.some((item) => item.id === notification.id)) return
    items.value = [notification, ...items.value]
    unreadCount.value += 1
  }

  async function initialize(token, userId) {
    if (!token || !userId || initializedFor.value === userId) return
    initializedFor.value = userId
    loading.value = true
    error.value = ''

    try {
      const result = await fetchNotifications(token)
      items.value = result.items
      unreadCount.value = result.unreadCount

      const channel = connectRealtime(token).private(`App.Models.User.${userId}`)
      channel.notification(addNotification)
    } catch (err) {
      error.value = err.message || 'Unable to load notifications.'
    } finally {
      loading.value = false
    }
  }

  async function markRead(item, token) {
    if (item.read_at) return
    await markNotificationRead(item.id, token)
    item.read_at = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  async function markAllRead(token) {
    if (!unreadCount.value) return
    await markAllNotificationsRead(token)
    const timestamp = new Date().toISOString()
    items.value.forEach((item) => {
      if (!item.read_at) item.read_at = timestamp
    })
    unreadCount.value = 0
  }

  function reset() {
    disconnectRealtime()
    initializedFor.value = null
    items.value = []
    unreadCount.value = 0
    error.value = ''
  }

  return { items, unreadCount, unreadItems, loading, error, initialize, markRead, markAllRead, reset }
})