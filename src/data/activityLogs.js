import { reactive } from 'vue'

// System activity log entries for the Logs screen.
// Reactive, mock data (session-only — no backend logs endpoint yet).
// `action` is the machine-style action code rendered as a monospace badge;
// `ip` is the source address (or date) shown in the right-most column.
export const activityLogs = reactive([
  { id: 1, timestamp: 'Today, 11:42 AM', user: 'Super Admin', action: 'UPDATE_PRODUCT', details: 'Updated price for RTX 4090 Founders Edition', ip: '12-May-2026' },
  { id: 2, timestamp: 'Today, 10:55 AM', user: 'Poster Alex', action: 'POST_PRODUCT', details: 'Added new listing: Gaming Mouse G502', ip: '182.44.22.10' },
  { id: 3, timestamp: 'Today, 10:15 AM', user: 'Manager John', action: 'ORDER_STATUS', details: "Changed #ORD-1041 to 'Assembly'", ip: '192.168.1.12' },
  { id: 4, timestamp: 'Today, 09:30 AM', user: 'Editor Sarah', action: 'CONTENT_APPROVE', details: 'Approved homepage slide: Ultimate Gaming 2024', ip: '192.168.1.15' },
  { id: 5, timestamp: 'Today, 09:05 AM', user: 'Support Emma', action: 'USER_LOGIN', details: 'Logged into system', ip: '182.44.22.10' },
  { id: 6, timestamp: 'Yesterday, 04:30 PM', user: 'Lead Tech Sarah', action: 'DELETE_CAT', details: "Deleted category 'Old Parts'", ip: '192.168.1.18' },
  { id: 7, timestamp: 'Yesterday, 02:12 PM', user: 'Super Admin', action: 'SETTING_CHANGE', details: 'Modified tax rate settings', ip: '192.168.1.45' },
])

// Filter option lists for the toolbar dropdowns.
export const actionFilters = ['All Actions', ...new Set(activityLogs.map((l) => l.action))]
export const userFilters = ['All Users', ...new Set(activityLogs.map((l) => l.user))]
