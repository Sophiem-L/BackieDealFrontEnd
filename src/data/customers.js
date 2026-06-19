// Shared customer directory — source of truth for the Create Order customer
// picker. Selecting a customer fills in their contact details.
export const customers = [
  { id: 1, name: 'Mike Robertson', email: 'mike.r@example.com', phone: '+1 (555) 204-8812', address: '14 Elmwood Drive, Austin, TX 78701' },
  { id: 2, name: 'Sarah Jenkins', email: 'sarah.j@example.com', phone: '+1 (555) 332-7741', address: '88 Maple Ave, Denver, CO 80203' },
  { id: 3, name: 'Michael Chen', email: 'm.chen@example.com', phone: '+1 (555) 901-2245', address: '210 Oak Street, Seattle, WA 98101' },
  { id: 4, name: 'David Smith', email: 'david.smith@example.com', phone: '+1 (555) 447-9930', address: '5 Birch Lane, Portland, OR 97205' },
  { id: 5, name: 'Emma Wilson', email: 'emma.w@example.com', phone: '+1 (555) 668-1120', address: '47 Cedar Court, Boston, MA 02118' },
]

export function findCustomer(id) {
  return customers.find((c) => c.id === id) || null
}
