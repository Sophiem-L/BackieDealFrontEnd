import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

// Admin dashboard statistics.
// Contract: GET /admin/dashboard ->
//   data: {
//     total_orders, total_revenue, total_promotions, total_products,
//     total_customers,
//     today:      { orders, revenue },
//     this_month: { orders, revenue },
//     this_year:  { orders, revenue },
//     orders_per_day:   [{ date, day, orders }]  — Mon..Sun, zero-filled
//     status_breakdown: [{ status, count }]      — all four statuses
//     recent_orders:    [{ id, order_number, customer, item, amount, status }]
//   }
export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref(null)
  const loading = ref(false)
  const error = ref('')

  const lowStock = ref([])

  async function fetchStats() {
    const auth = useAuthStore()
    loading.value = true
    error.value = ''
    try {
      const response = await apiFetch('/admin/dashboard', { token: auth.accessToken })
      stats.value = response?.data ?? null
      return true
    } catch (err) {
      error.value = err.message || 'Unable to load dashboard data.'
      return false
    } finally {
      loading.value = false
    }
  }

  // Low stock reuses the existing stock endpoint rather than duplicating the
  // threshold logic in the dashboard payload.
  // Contract: GET /admin/stock/alerts ->
  //   data: [{ id, name, sku, stock_quantity, min_stock_alert }]
  //
  // Deliberately quiet on failure: the panel is already hidden from callers
  // without `stock.view`, so a rejection here should not take over the page
  // that the rest of the dashboard rendered fine.
  async function fetchLowStock() {
    const auth = useAuthStore()
    try {
      const response = await apiFetch('/admin/stock/alerts', { token: auth.accessToken })
      const items = Array.isArray(response?.data) ? response.data : []
      lowStock.value = items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        stock: Number(item.stock_quantity) || 0,
      }))
      return true
    } catch {
      lowStock.value = []
      return false
    }
  }

  return { stats, loading, error, lowStock, fetchStats, fetchLowStock }
})
