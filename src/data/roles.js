import { reactive } from 'vue'

// Access-level roles for the Roles & Permissions screen.
// Reactive so a future "Create Custom Role" / "Edit Permissions" flow can mutate
// the list and have the table update (mock data, session-only — no backend roles
// endpoint yet). `admins` is the count of administrators assigned to the role;
// `permissions` are the core capability chips shown in the table.
export const roles = reactive([
  {
    id: 1,
    name: 'Owner',
    admins: 1,
    permissions: ['Full System Access', 'Financial Reports', 'Admin Management'],
  },
  {
    id: 2,
    name: 'Store Manager',
    admins: 2,
    permissions: ['Inventory Manage', 'Orders Manage', 'Customer Support'],
  },
  {
    id: 3,
    name: 'Technician Lead',
    admins: 3,
    permissions: ['Processing Orders', 'Service Logs', 'Parts Inventory'],
  },
  {
    id: 4,
    name: 'Customer Support',
    admins: 5,
    permissions: ['View Orders', 'Contact Customers', 'View Products'],
  },
])

export function findRole(id) {
  return roles.find((r) => r.id === Number(id)) || null
}

export function nextRoleId() {
  return roles.reduce((max, r) => Math.max(max, r.id), 0) + 1
}
