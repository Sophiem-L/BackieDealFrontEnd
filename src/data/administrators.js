import { reactive } from 'vue'

// Administrator accounts for the "Manage Administrators" screen.
// Reactive so a future invite / revoke flow can mutate the list and have the
// grid update (mock data, session-only — no backend admins endpoint yet).
// `role` matches a name from `@/data/roles`; `lastSeen` is a human label and
// `online` drives the green "Active now" indicator.
export const administrators = reactive([
  {
    id: 1,
    name: 'Super Admin',
    role: 'Owner',
    lastSeen: 'Active now',
    online: true,
    avatar: '',
  },
  {
    id: 2,
    name: 'Manager John',
    role: 'Store Manager',
    lastSeen: '2h ago',
    online: false,
    avatar: '',
  },
  {
    id: 3,
    name: 'Lead Tech Sarah',
    role: 'Technician Lead',
    lastSeen: '10m ago',
    online: false,
    avatar: '',
  },
  {
    id: 4,
    name: 'Support Emma',
    role: 'Customer Support',
    lastSeen: 'Yesterday',
    online: false,
    avatar: '',
  },
])

export function findAdministrator(id) {
  return administrators.find((a) => a.id === Number(id)) || null
}

export function nextAdministratorId() {
  return administrators.reduce((max, a) => Math.max(max, a.id), 0) + 1
}
