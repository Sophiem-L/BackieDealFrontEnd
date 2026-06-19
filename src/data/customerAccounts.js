import { reactive } from 'vue'

// Shared customer directory for the Customers list + create/edit form.
// Reactive so edits and new entries from the form reflect in the list (mock data,
// session-only — there's no backend customers endpoint yet).
// `tone` is the fallback avatar colour (initials); `avatar` is an optional
// uploaded photo URL that takes precedence when present.
export const customerAccounts = reactive([
  { id: 1, name: 'John Doe', email: 'john@example.com', phone: '+1 (555) 010-2233', address: '14 Elmwood Drive, Austin, TX 78701', spent: '$4,250.00', orders: 12, status: 'active', tone: 'blue', avatar: '' },
  { id: 2, name: 'Sarah Smith', email: 'sarah.s@gmail.com', phone: '+1 (555) 332-7741', address: '88 Maple Ave, Denver, CO 80203', spent: '$1,890.00', orders: 5, status: 'active', tone: 'green', avatar: '' },
  { id: 3, name: 'Wei Chen', email: 'w.chen@tech.net', phone: '+1 (555) 901-2245', address: '210 Oak Street, Seattle, WA 98101', spent: '$12,400.00', orders: 28, status: 'vip', tone: 'violet', avatar: '' },
  { id: 4, name: 'Elena Rodriguez', email: 'elena.rod@provider.com', phone: '+1 (555) 447-9930', address: '5 Birch Lane, Portland, OR 97205', spent: '$850.00', orders: 2, status: 'inactive', tone: 'amber', avatar: '' },
])

export const avatarTones = ['blue', 'green', 'violet', 'amber', 'rose', 'slate']

export function randomTone() {
  return avatarTones[Math.floor(Math.random() * avatarTones.length)]
}

export function findCustomerAccount(id) {
  return customerAccounts.find((c) => c.id === Number(id)) || null
}

export function nextCustomerId() {
  return customerAccounts.reduce((max, c) => Math.max(max, c.id), 0) + 1
}
