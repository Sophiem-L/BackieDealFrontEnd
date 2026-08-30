import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  customerFromApi,
  customerToPayload,
  deleteCustomer,
  fetchCustomers,
  formatSpent,
  initials,
  saveCustomer,
  toneFor,
} from '@/services/customers'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

// A customer as CustomerResource hands it over, with only the fields a test
// cares about overridden.
function resource(overrides = {}) {
  return {
    id: 16,
    first_name: 'Sokha',
    last_name: 'Chan',
    name: 'Sokha Chan',
    email: 'customer.sokha1@bekie.test',
    phone: '+85592100001',
    avatar: null,
    address: '12 Street 240, Chamkarmon, Phnom Penh, 12301, Cambodia',
    status: 'vip',
    is_active: true,
    is_banned: false,
    orders_count: 6,
    total_spent: 12441.88,
    created_at: '2026-08-30T07:11:50+00:00',
    updated_at: '2026-08-30T07:11:50+00:00',
    ...overrides,
  }
}

beforeEach(() => {
  apiFetch.mockReset()
})

describe('customerFromApi', () => {
  it('maps a resource onto the record the views bind to', () => {
    const customer = customerFromApi(resource())

    expect(customer).toMatchObject({
      id: 16,
      name: 'Sokha Chan',
      email: 'customer.sokha1@bekie.test',
      phone: '+85592100001',
      address: '12 Street 240, Chamkarmon, Phnom Penh, 12301, Cambodia',
      status: 'vip',
      orders: 6,
      totalSpent: 12441.88,
      spent: '$12,441.88',
    })
  })

  it('turns null contact fields into empty strings so inputs can bind to them', () => {
    const customer = customerFromApi(resource({ phone: null, address: null, avatar: null }))

    expect(customer.phone).toBe('')
    expect(customer.address).toBe('')
    expect(customer.avatar).toBe('')
  })

  it('reads a customer with no orders as zero rather than blank', () => {
    const customer = customerFromApi(resource({ orders_count: 0, total_spent: 0 }))

    expect(customer.orders).toBe(0)
    expect(customer.spent).toBe('$0.00')
  })

  it('falls back to active when the API sends a status the badges do not cover', () => {
    expect(customerFromApi(resource({ status: 'archived' })).status).toBe('active')
    expect(customerFromApi(resource({ status: 'inactive' })).status).toBe('inactive')
  })

  it('gives the same customer the same avatar tone every time', () => {
    expect(customerFromApi(resource()).tone).toBe(toneFor(16))
    expect(toneFor(16)).toBe(toneFor(16))
  })
})

describe('customerToPayload', () => {
  const form = {
    name: '  Sreymom Yun  ',
    email: '  sreymom@example.test ',
    phone: ' +85592100010 ',
    address: ' 18 Preah Sihanouk Blvd ',
    status: 'vip',
    avatar: '',
  }

  it('trims what the admin typed', () => {
    expect(customerToPayload({ ...form })).toEqual({
      name: 'Sreymom Yun',
      email: 'sreymom@example.test',
      phone: '+85592100010',
      address: '18 Preah Sihanouk Blvd',
      status: 'vip',
      avatar: null,
    })
  })

  it('sends a blank phone as null, since users.phone is uniquely indexed', () => {
    // Two customers saved with '' would collide on that index; null does not.
    expect(customerToPayload({ ...form, phone: '   ' }).phone).toBeNull()
  })

  it('sends a blank address as null rather than an empty string', () => {
    expect(customerToPayload({ ...form, address: '' }).address).toBeNull()
  })
})

describe('fetchCustomers', () => {
  it('asks for one large page and maps every row', async () => {
    apiFetch.mockResolvedValue({ data: [resource(), resource({ id: 17, name: 'Dara Lim' })] })

    const customers = await fetchCustomers('token-1')

    expect(apiFetch).toHaveBeenCalledWith('/admin/customers?per_page=200', { token: 'token-1' })
    expect(customers.map((c) => c.name)).toEqual(['Sokha Chan', 'Dara Lim'])
  })

  it('passes the search term to the API instead of filtering locally', async () => {
    apiFetch.mockResolvedValue({ data: [] })

    await fetchCustomers('token-1', { search: '  bopha ' })

    expect(apiFetch).toHaveBeenCalledWith('/admin/customers?per_page=200&search=bopha', {
      token: 'token-1',
    })
  })

  it('unwraps a paginator nested under data', async () => {
    apiFetch.mockResolvedValue({ data: { data: [resource()], total: 1 } })

    expect(await fetchCustomers('token-1')).toHaveLength(1)
  })

  it('reads an unexpected body as an empty list rather than throwing', async () => {
    apiFetch.mockResolvedValue({ data: null })

    expect(await fetchCustomers('token-1')).toEqual([])
  })
})

describe('saveCustomer', () => {
  const form = {
    name: 'Dara Lim',
    email: 'dara@example.test',
    phone: '',
    address: '',
    status: 'active',
    avatar: '',
  }

  it('POSTs a new customer', async () => {
    apiFetch.mockResolvedValue({ data: resource({ id: 30, name: 'Dara Lim' }) })

    const saved = await saveCustomer(null, form, 'token-1')

    expect(apiFetch).toHaveBeenCalledWith('/admin/customers', {
      method: 'POST',
      body: customerToPayload(form),
      token: 'token-1',
    })
    expect(saved.id).toBe(30)
  })

  it('PATCHes an existing one', async () => {
    apiFetch.mockResolvedValue({ data: resource() })

    await saveCustomer(16, form, 'token-1')

    expect(apiFetch).toHaveBeenCalledWith(
      '/admin/customers/16',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})

describe('deleteCustomer', () => {
  it('DELETEs by id', async () => {
    apiFetch.mockResolvedValue(null)

    await deleteCustomer(16, 'token-1')

    expect(apiFetch).toHaveBeenCalledWith('/admin/customers/16', {
      method: 'DELETE',
      token: 'token-1',
    })
  })
})

describe('display helpers', () => {
  it('formats spend as USD', () => {
    expect(formatSpent(1234.5)).toBe('$1,234.50')
    expect(formatSpent(null)).toBe('$0.00')
  })

  it('takes at most two initials and ignores extra spacing', () => {
    expect(initials('Sokha Chan')).toBe('SC')
    expect(initials('  Sreymom   Yun  Sok ')).toBe('SY')
    expect(initials('')).toBe('')
  })
})
