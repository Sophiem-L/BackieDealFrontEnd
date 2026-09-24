import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAllMasterData } from '@/services/masterData'

export const useMasterDataStore = defineStore('masterData', () => {
  // State
  const roles = ref([])
  const adminRoles = ref([])
  const permissions = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  // Computed
  const isLoading = computed(() => loading.value)
  const isLoaded = computed(() => loaded.value)
  const hasError = computed(() => error.value !== null)

  const roleMap = computed(() => {
    return roles.value.reduce((map, role) => {
      map[role.name] = role
      return map
    }, {})
  })

  const permissionMap = computed(() => {
    return permissions.value.reduce((map, permission) => {
      map[permission.name] = permission
      return map
    }, {})
  })

  const permissionsByCategory = computed(() => {
    return permissions.value.reduce((groups, permission) => {
      const [category] = permission.name.split('.')
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(permission)
      return groups
    }, {})
  })

  // Methods
  async function loadMasterData(token) {
    // Skip if already loaded and recent (less than 5 minutes old)
    if (loaded.value && lastUpdated.value) {
      const minutesSinceUpdate = (Date.now() - new Date(lastUpdated.value).getTime()) / 60000
      if (minutesSinceUpdate < 5) {
        return true
      }
    }

    loading.value = true
    error.value = null

    try {
      const data = await fetchAllMasterData(token)

      roles.value = data.roles || []
      adminRoles.value = data.adminRoles || []
      permissions.value = data.permissions || []
      lastUpdated.value = data.timestamp

      loaded.value = true
      return true
    } catch (err) {
      error.value = err.message || 'Failed to load master data'
      console.error('Master data loading error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  function getRoleById(id) {
    return roles.value.find((r) => r.id === id)
  }

  function getRoleByName(name) {
    return roleMap.value[name]
  }

  function getAdminRoles() {
    return adminRoles.value
  }

  function getAllRoles() {
    return roles.value
  }

  function getPermissionById(id) {
    return permissions.value.find((p) => p.id === id)
  }

  function getPermissionByName(name) {
    return permissionMap.value[name]
  }

  function getPermissionsByCategory(category) {
    return permissionsByCategory.value[category] || []
  }

  function getPermissionsForRole(roleId) {
    const role = getRoleById(roleId)
    if (!role || !role.permissions) return []
    return role.permissions
  }

  function resetMasterData() {
    roles.value = []
    adminRoles.value = []
    permissions.value = []
    loading.value = false
    loaded.value = false
    error.value = null
    lastUpdated.value = null
  }

  return {
    // State
    roles,
    adminRoles,
    permissions,
    loading,
    loaded,
    error,
    lastUpdated,

    // Computed
    isLoading,
    isLoaded,
    hasError,
    roleMap,
    permissionMap,
    permissionsByCategory,

    // Methods
    loadMasterData,
    getRoleById,
    getRoleByName,
    getAdminRoles,
    getAllRoles,
    getPermissionById,
    getPermissionByName,
    getPermissionsByCategory,
    getPermissionsForRole,
    resetMasterData,
  }
})
