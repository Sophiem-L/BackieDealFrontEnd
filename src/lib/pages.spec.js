import { describe, it, expect } from 'vitest'
import { escapeHtml, filterPages, highlightMatch, makePageRow, sortPages } from './pages'

describe('page row helpers', () => {
  it('does not invent a slug for a page that has none', () => {
    expect(makePageRow({ id: 1, title: 'Careers', slug: null }).slug).toBe('')
    expect(makePageRow({ id: 2, title: 'About', slug: 'about-us' }).slug).toBe('/about-us')
    expect(makePageRow({ id: 3, title: 'Terms', slug: '/terms' }).slug).toBe('/terms')
  })

  it('turns an HTML body into a plain-text excerpt', () => {
    const row = makePageRow({ id: 1, body: '<p>Free&nbsp;returns &amp; <strong>refunds</strong></p><p>30 days</p>' })
    expect(row.excerpt).toBe('Free returns & refunds 30 days')
  })

  it('keeps encoded markup in the body as text rather than tags', () => {
    const row = makePageRow({ id: 1, body: '&lt;img src=x onerror=alert(1)&gt;' })
    expect(row.excerpt).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('highlightMatch', () => {
  it('wraps matches in <mark> and leaves other text intact', () => {
    expect(highlightMatch('Gift Cards', 'gift')).toBe('<mark>Gift</mark> Cards')
  })

  it('escapes markup in the text so it cannot render as HTML', () => {
    expect(highlightMatch('<img src=x onerror=alert(1)>', '')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
    expect(highlightMatch('<b>bold</b>', 'bold')).toBe('&lt;b&gt;<mark>bold</mark>&lt;/b&gt;')
  })

  it('does not match inside the entities it just produced', () => {
    expect(highlightMatch('Terms & Conditions', 'amp')).toBe('Terms &amp; Conditions')
  })

  it('treats the query as literal text, not a pattern', () => {
    expect(highlightMatch('a.b (c)', '(c)')).toBe('a.b <mark>(c)</mark>')
  })

  it('exposes escapeHtml for plain-text fallbacks', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
  })
})

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
