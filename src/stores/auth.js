import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/services/api'
import { can, canAny } from '@/lib/permissions'

// Persisted so a page reload keeps the admin signed in.
const STORAGE_KEY = 'beckie_admin_auth'

function loadPersisted() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export const useAuthStore = defineStore('auth', () => {
  const saved = loadPersisted()
  const accessToken = ref(saved.accessToken || null)
  const refreshToken = ref(saved.refreshToken || null)
  const user = ref(saved.user || null)
  const loading = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => !!accessToken.value)

  // `permissions` rides inside `user`, so the existing persist() already
  // carries it through a reload. It can go stale between reloads, which is
  // why App.vue refreshes from /auth/me on boot.
  const permissions = computed(() => user.value?.permissions ?? [])

  function hasPermission(permission) {
    return can(permissions.value, permission)
  }

  function hasAnyPermission(required) {
    return canAny(permissions.value, required)
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: accessToken.value,
        refreshToken: refreshToken.value,
        user: user.value,
      }),
    )
  }

  function clear() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  // Replace the cached user (e.g. after loading or editing the profile).
  function setUser(nextUser) {
    user.value = nextUser
    persist()
  }

  // POST /admin/auth/login -> { data: { access_token, refresh_token, user, ... } }
  async function login(email, password) {
    loading.value = true
    error.value = ''
    try {
      const response = await apiFetch('/admin/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      const data = response?.data ?? {}
      accessToken.value = data.access_token
      refreshToken.value = data.refresh_token
      user.value = data.user ?? null
      persist()
      return true
    } catch (err) {
      error.value = err.message || 'Unable to sign in. Please try again.'
      clear()
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      if (accessToken.value) {
        await apiFetch('/admin/auth/logout', {
          method: 'POST',
          token: accessToken.value,
        })
      }
    } catch {
      // Even if the server call fails, drop local credentials below.
    }
    clear()
  }

  // GET /admin/auth/me -> { data: { ...profile, permissions } }
  // Re-reads the profile so a grant changed server-side takes effect on the
  // next page load rather than lingering in localStorage.
  async function refreshProfile() {
    if (!accessToken.value) return
    try {
      const response = await apiFetch('/admin/auth/me', { token: accessToken.value })
      if (response?.data) setUser(response.data)
    } catch {
      // A failure here leaves the persisted user in place; the router guard
      // and API 403s still hold the line.
    }
  }

  return {
    accessToken,
    refreshToken,
    user,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    setUser,
    permissions,
    hasPermission,
    hasAnyPermission,
    refreshProfile,
  }
})
