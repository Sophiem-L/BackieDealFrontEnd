import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

// Admin dashboard statistics.
// Contract: GET /admin/dashboard ->
//   data: {
//     total_orders, total_revenue, total_products, total_customers,
//     today:      { orders, revenue },
//     this_month: { orders, revenue },
//     this_year:  { orders, revenue },
//   }
export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref(null)
  const loading = ref(false)
  const error = ref('')

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

  return { stats, loading, error, fetchStats }
})
