import { apiFetch } from '@/services/api'

export async function fetchNotifications(token, page = 1) {
  const response = await apiFetch(`/admin/notifications?page=${page}&per_page=30`, { token })
  const data = response?.data ?? {}

  return {
    items: Array.isArray(data.items) ? data.items : [],
    unreadCount: Number(data.unread_count ?? 0),
    pagination: data.pagination ?? {},
  }
}

export async function markNotificationRead(id, token) {
  return apiFetch(`/admin/notifications/${id}/read`, { method: 'POST', token })
}

export async function markAllNotificationsRead(token) {
  return apiFetch('/admin/notifications/read-all', { method: 'POST', token })
}