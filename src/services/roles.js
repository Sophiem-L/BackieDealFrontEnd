import { apiFetch } from '@/services/api'

/**
 * Fetch available roles for administrators
 */
export async function fetchAdminRoles(token) {
  try {
    const response = await apiFetch('/admin/roles?per_page=100', {
      method: 'GET',
      token,
    })

    console.log('Fetched admin roles:', response)

    // Handle both response formats (direct data or wrapped in items)
    let allRoles = []
    if (response.items) {
      allRoles = response.items
    } else if (response.data) {
      allRoles = response.data
    } else if (Array.isArray(response)) {
      allRoles = response
    }

    // Return all available roles (dynamically fetched from database)
    return allRoles.length > 0
      ? allRoles
      : getDefaultAdminRoles()
  } catch (err) {
    console.error('Failed to fetch admin roles:', err)
    return getDefaultAdminRoles()
  }
}

/**
 * Default admin roles fallback
 * These match the roles created in the backend AdminPermissionsSeeder
 */
function getDefaultAdminRoles() {
  return [
    { id: 1, name: 'admin', guard_name: 'api' },
    { id: 2, name: 'manager', guard_name: 'api' },
    { id: 3, name: 'staff', guard_name: 'api' },
  ]
}

/**
 * Format role name for display (super-admin → Super Admin)
 */
export function formatRoleName(roleName) {
  return roleName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
