import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch, resetUnauthenticatedHandler } from '@/services/api'

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
  }
})
