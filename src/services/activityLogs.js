import { apiFetch } from '@/services/api'

function formatTimestamp(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function activityLogFromApi(log) {
  const target = log.target ?? {}
  const targetLabel = [target.type, target.id].filter((value) => value !== null && value !== undefined && value !== '').join(' #')

  return {
    id: log.id,
    userId: log.user_id === null || log.user_id === undefined ? '' : String(log.user_id),
    user: log.actor?.name || (log.user_id ? `User #${log.user_id}` : 'System'),
    action: log.action || 'unknown',
    details: targetLabel || 'API request',
    ip: log.ip_address || '—',
    timestamp: formatTimestamp(log.timestamp),
  }
}

export async function fetchActivityLogs({ token, action, userId, page = 1 } = {}) {
  const params = new URLSearchParams({ page: String(page) })
  if (action) params.set('action', action)
  if (userId) params.set('user_id', userId)

  const response = await apiFetch(`/admin/activity-logs?${params.toString()}`, { token })
  const data = response?.data ?? {}

  return {
    items: Array.isArray(data.items) ? data.items.map(activityLogFromApi) : [],
    pagination: data.pagination ?? {},
  }
}