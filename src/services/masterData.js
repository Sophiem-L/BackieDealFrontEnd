import { apiFetch } from '@/services/api'

/**
 * Master Data Service
 * Centralized service for fetching all reference data needed across the application
 */

/**
 * Fetch all roles available for administrators
 */
export async function fetchRoles(token) {
  try {
    const response = await apiFetch('/admin/roles?per_page=100', {
      method: 'GET',
      token,
    })

    // Handle different response formats
    let allRoles = []
    if (response.items) {
      allRoles = response.items
    } else if (response.data) {
      allRoles = response.data
    } else if (Array.isArray(response)) {
      allRoles = response
    }

    return allRoles.length > 0 ? allRoles : getDefaultRoles()
  } catch (err) {
    console.error('Failed to fetch roles:', err)
    return getDefaultRoles()
  }
}

/**
 * Get admin-specific roles (all roles from database)
 */
export async function fetchAdminRoles(token) {
  try {
    const allRoles = await fetchRoles(token)
    return allRoles.length > 0 ? allRoles : getDefaultRoles()
  } catch (err) {
    console.error('Failed to fetch admin roles:', err)
    return getDefaultRoles()
  }
}

/**
 * Fetch permissions for a specific role
 */
export async function fetchRolePermissions(roleId, token) {
  const response = await apiFetch(`/admin/roles/${roleId}`, {
    method: 'GET',
    token,
  })

  const role = response.data || response
  return role.permissions || role.permission_names || []
}

/**
 * Fetch all permissions available in the system
 */
export async function fetchAllPermissions(token) {
  try {
    const response = await apiFetch('/admin/permissions?per_page=1000', {
      method: 'GET',
      token,
    })

    // Handle different response formats
    let allPermissions = []
    if (response.items) {
      allPermissions = response.items
    } else if (response.data) {
      allPermissions = response.data
    } else if (Array.isArray(response)) {
      allPermissions = response
    }

    return allPermissions
  } catch (err) {
    console.error('Failed to fetch permissions:', err)
    return []
  }
}

/**
 * Fetch all master data needed for administrators management
 */
export async function fetchAllMasterData(token) {
  try {
    const [roles, permissions] = await Promise.all([
      fetchRoles(token),
      fetchAllPermissions(token),
    ])

    return {
      roles,
      adminRoles: roles,
      permissions,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    console.error('Failed to fetch master data:', err)
    return {
      roles: getDefaultRoles(),
      adminRoles: getDefaultRoles(),
      permissions: [],
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Default roles fallback
 * These match the roles created in AdminPermissionsSeeder
 */
function getDefaultRoles() {
  return [
    { id: 1, name: 'admin', guard_name: 'api' },
    { id: 2, name: 'manager', guard_name: 'api' },
    { id: 3, name: 'staff', guard_name: 'api' },
  ]
}

/**
 * Format role name for display
 * super-admin → Super Admin
 */
export function formatRoleName(roleName) {
  return roleName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format permission name for display
 * administrators.create → Administrators Create
 */
export function formatPermissionName(permissionName) {
  return permissionName
    .split('.')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Group permissions by category
 * administrators.create, administrators.read → { administrators: [...] }
 */
export function groupPermissionsByCategory(permissions) {
  return permissions.reduce((groups, permission) => {
    const [category] = permission.name.split('.')
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(permission)
    return groups
  }, {})
}
