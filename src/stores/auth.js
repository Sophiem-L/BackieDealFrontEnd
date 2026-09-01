import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { can, canAny } from '@/lib/permissions'
import { apiFetch, resetUnauthenticatedHandler } from '@/services/api'

// Persisted so a page reload keeps the admin signed in.
const STORAGE_KEY = 'beckie_admin_auth'
const STAFF_ALLOWED_PERMISSIONS = new Set([
  'admin.auth.logout',
  'admin.profile.view',
  'admin.profile.update',
  'products.view',
  'products.create',
  'products.update',
  'categories.view',
  'categories.create',
  'categories.update',
  'content.view',
  'content.create',
  'content.update',
  'promotions.view',
  'promotions.create',
  'promotions.update',
  'media.view',
  'media.create',
])
const MANAGER_ALLOWED_PERMISSIONS = new Set([
  'admin.auth.logout',
  'admin.profile.view',
  'admin.profile.update',
  'orders.view',
  'orders.approve',
  'products.view',
  'products.create',
  'products.update',
  'categories.view',
  'categories.create',
  'categories.update',
  'banners.view',
  'banners.create',
  'banners.update',
  'content.view',
  'content.create',
  'content.update',
  'promotions.view',
  'promotions.create',
  'promotions.update',
  'media.view',
  'media.create',
])

function loadPersisted() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function getUserRoles(user) {
  if (!user) return []
  if (Array.isArray(user.roles)) return user.roles
  if (Array.isArray(user.role)) return user.role
  if (user.role) return [user.role]
  return []
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
    if (!can(permissions.value, permission)) return false

    const roles = getUserRoles(user.value)
    if (permission && roles.includes('staff')) {
      return STAFF_ALLOWED_PERMISSIONS.has(permission)
    }
    if (permission && roles.includes('manager')) {
      return MANAGER_ALLOWED_PERMISSIONS.has(permission)
    }

    return true
  }

  function hasAnyPermission(required) {
    const roles = getUserRoles(user.value)
    if (roles.includes('staff') || roles.includes('manager')) {
      return Array.isArray(required)
        ? required.some((permission) => {
            const allowedPermissions = roles.includes('manager')
              ? MANAGER_ALLOWED_PERMISSIONS
              : STAFF_ALLOWED_PERMISSIONS
            return allowedPermissions.has(permission) && can(permissions.value, permission)
          })
        : false
    }

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
      resetUnauthenticatedHandler()
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
