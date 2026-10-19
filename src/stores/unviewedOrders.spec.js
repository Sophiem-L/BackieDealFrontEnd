import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUnviewedOrdersStore } from '@/stores/unviewedOrders'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

function unviewed(ids) {
  return { data: { count: ids.length, order_ids: ids } }
}

describe('unviewed orders store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads this admin’s unviewed order ids and counts them', async () => {
    apiFetch.mockResolvedValue(unviewed(['uuid-1', 'uuid-2']))
    const store = useUnviewedOrdersStore()

    await store.refresh('token')

    expect(apiFetch).toHaveBeenCalledWith('/admin/orders/unviewed', { token: 'token' })
    expect(store.count).toBe(2)
    expect(store.isUnviewed('uuid-1')).toBe(true)
    expect(store.isUnviewed('uuid-9')).toBe(false)
  })

  it('shows nothing, not a made-up number, before anything has loaded', () => {
    const store = useUnviewedOrdersStore()

    expect(store.count).toBe(0)
    expect(store.isUnviewed('uuid-1')).toBe(false)
  })

  it('keeps the last known list when a refresh fails', async () => {
    apiFetch.mockResolvedValueOnce(unviewed(['uuid-1']))
    const store = useUnviewedOrdersStore()
    await store.refresh('token')

    apiFetch.mockRejectedValueOnce(new Error('network down'))
    await expect(store.refresh('token')).resolves.toBeUndefined()

    expect(store.count).toBe(1)
  })

  it('does not call the API without a token', async () => {
    const store = useUnviewedOrdersStore()

    await store.refresh(null)

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('drops an order at once when it is viewed, then adopts the server’s list', async () => {
    apiFetch.mockResolvedValueOnce(unviewed(['uuid-1', 'uuid-2']))
    const store = useUnviewedOrdersStore()
    await store.refresh('token')

    let resolveViewed
    apiFetch.mockReturnValueOnce(new Promise((resolve) => (resolveViewed = resolve)))
    const pending = store.markViewed('uuid-1', 'token')

    // The badge does not wait for the round trip.
    expect(store.isUnviewed('uuid-1')).toBe(false)
    expect(store.count).toBe(1)

    resolveViewed(unviewed(['uuid-2', 'uuid-3']))
    await pending

    expect(apiFetch).toHaveBeenLastCalledWith('/admin/orders/uuid-1/viewed', { method: 'POST', token: 'token' })
    // Authoritative: a new order that arrived meanwhile shows up too.
    expect(store.count).toBe(2)
    expect(store.isUnviewed('uuid-3')).toBe(true)
  })

  it('accepts a numeric id the page was opened with and still ends up correct', async () => {
    apiFetch.mockResolvedValueOnce(unviewed(['uuid-1']))
    const store = useUnviewedOrdersStore()
    await store.refresh('token')

    // The Notifications page links orders by their numeric id, so the client
    // cannot know which uuid that was; the server's answer settles it.
    apiFetch.mockResolvedValueOnce(unviewed([]))
    await store.markViewed(77, 'token')

    expect(apiFetch).toHaveBeenLastCalledWith('/admin/orders/77/viewed', { method: 'POST', token: 'token' })
    expect(store.count).toBe(0)
  })

  it('does not throw when marking viewed fails', async () => {
    apiFetch.mockResolvedValueOnce(unviewed(['uuid-1']))
    const store = useUnviewedOrdersStore()
    await store.refresh('token')

    apiFetch.mockRejectedValueOnce(new Error('boom'))

    await expect(store.markViewed('uuid-1', 'token')).resolves.toBeUndefined()
  })

  it('ignores a reply that is not the expected shape instead of corrupting the list', async () => {
    apiFetch.mockResolvedValueOnce(unviewed(['uuid-1']))
    const store = useUnviewedOrdersStore()
    await store.refresh('token')

    apiFetch.mockResolvedValueOnce({ data: { id: 'uuid-1', status: 'pending' } })
    await store.refresh('token')

    expect(store.count).toBe(1)
  })

  it('empties on clear', async () => {
    apiFetch.mockResolvedValueOnce(unviewed(['uuid-1', 'uuid-2']))
    const store = useUnviewedOrdersStore()
    await store.refresh('token')

    store.clear()

    expect(store.count).toBe(0)
  })
})
