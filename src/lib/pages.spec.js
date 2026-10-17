import { describe, it, expect } from 'vitest'
import { filterPages, sortPages } from './pages'

describe('page list helpers', () => {
  const pages = [
    {
      id: 1,
      title: 'Shipping & Delivery Information',
      slug: '/shipping-delivery',
      excerpt: 'Learn the delivery times and shipping fees.',
      status: 'published',
      updated_at: '2024-01-02T00:00:00Z',
      created_at: '2023-10-10T00:00:00Z',
    },
    {
      id: 2,
      title: 'Privacy Policy',
      slug: '/privacy-policy',
      excerpt: 'Your data is handled securely.',
      status: 'draft',
      updated_at: '2025-03-01T00:00:00Z',
      created_at: '2025-02-01T00:00:00Z',
    },
    {
      id: 3,
      title: 'Financing',
      slug: '/financing-options',
      excerpt: 'Flexible payment options.',
      status: 'archived',
      updated_at: '2022-06-10T00:00:00Z',
      created_at: '2021-05-15T00:00:00Z',
    },
  ]

  it('filters by status and searchable text fields', () => {
    expect(filterPages(pages, 'shipping', 'all')).toHaveLength(1)
    expect(filterPages(pages, 'privacy', 'draft')).toHaveLength(1)
    expect(filterPages(pages, '', 'published')).toHaveLength(1)
    expect(filterPages(pages, 'financing', 'published')).toHaveLength(0)
  })

  it('sorts by most recently updated first and supports title ordering', () => {
    const updated = sortPages(pages, 'updated')
    expect(updated[0].id).toBe(2)
    expect(updated[1].id).toBe(1)

    const alpha = sortPages(pages, 'title')
    expect(alpha.map((page) => page.id)).toEqual([3, 2, 1])
  })
})
