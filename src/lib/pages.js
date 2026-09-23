export const PAGE_STATUS_ORDER = ['published', 'draft', 'archived']
export const PAGE_SORT_OPTIONS = {
  updated: 'Recently updated',
  newest: 'Newest',
  oldest: 'Oldest',
  title: 'Title A-Z',
}

export function normalizeStatus(value) {
  const status = String(value ?? 'draft').toLowerCase()
  if (status === 'published' || status === 'draft' || status === 'archived') return status
  return 'draft'
}

export function getStatusLabel(value) {
  return {
    published: 'Published',
    draft: 'Draft',
    archived: 'Archived',
  }[normalizeStatus(value)] ?? 'Draft'
}

export function getStatusCounts(pages) {
  return pages.reduce(
    (counts, page) => {
      const status = normalizeStatus(page.status)
      counts.all += 1
      counts[status] += 1
      return counts
    },
    { all: 0, published: 0, draft: 0, archived: 0 },
  )
}

export function getUpdatedAtValue(page) {
  return page?.updated_at || page?.published_at || page?.created_at || null
}

export function formatShortDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatRelativeTime(value) {
  if (!value) return 'No timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No timestamp'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)
  const diffMonths = Math.round(diffMs / 2629800000)

  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
  return `${Math.max(1, diffMonths)} months ago`
}

export function isPageStale(page, months = 12) {
  const updatedAt = getUpdatedAtValue(page)
  if (!updatedAt) return false
  const ageMs = Date.now() - new Date(updatedAt).getTime()
  return ageMs > months * 30 * 24 * 60 * 60 * 1000
}

export function filterPages(pages, search = '', status = 'all') {
  const needle = (search || '').trim().toLowerCase()
  const normalizedStatus = status === 'all' ? 'all' : normalizeStatus(status)

  return pages.filter((page) => {
    const matchesStatus = normalizedStatus === 'all' || normalizeStatus(page.status) === normalizedStatus
    if (!matchesStatus) return false
    if (!needle) return true

    const haystack = [page.title, page.slug, page.excerpt].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

export function sortPages(pages, sortKey = 'updated') {
  const sorted = [...pages]

  sorted.sort((a, b) => {
    const aUpdated = new Date(getUpdatedAtValue(a) || a.created_at || 0).getTime()
    const bUpdated = new Date(getUpdatedAtValue(b) || b.created_at || 0).getTime()

    switch (sortKey) {
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      case 'oldest':
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      case 'title':
        return String(a.title || '').localeCompare(String(b.title || ''))
      case 'updated':
      default:
        return bUpdated - aUpdated
    }
  })

  return sorted
}

export function makePageRow(row) {
  const title = row?.title || `Page ${row?.id ?? 'Untitled'}`
  const slug = String(row?.slug || row?.path || '').trim()
  const excerpt = String(row?.excerpt || row?.body || '').replace(/\s+/g, ' ').trim()

  return {
    id: row?.id ?? null,
    title,
    slug: slug.startsWith('/') ? slug : `/${slug || 'page'}`,
    excerpt: excerpt || 'No preview available.',
    status: normalizeStatus(row?.status),
    author: row?.author?.name || row?.author || 'Unknown',
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || row?.published_at || row?.created_at || null,
    published_at: row?.published_at || null,
    is_stale: isPageStale({ updated_at: row?.updated_at || row?.published_at || row?.created_at }, 12),
  }
}

export function highlightMatch(text = '', query = '') {
  const safeText = String(text ?? '')
  const safeQuery = String(query ?? '').trim()
  if (!safeQuery) return safeText

  const regex = new RegExp(`(${safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
  return safeText.replace(regex, '<mark>$1</mark>')
}
