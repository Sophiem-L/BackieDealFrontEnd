import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  resetUnauthenticatedHandler,
  setUnauthenticatedHandler,
} from '@/services/api'

function unauthorizedResponse() {
  return {
    ok: false,
    status: 401,
    json: vi.fn().mockResolvedValue({ message: 'Unauthenticated.' }),
  }
}

describe('apiFetch unauthenticated handling', () => {
  afterEach(() => {
    resetUnauthenticatedHandler()
    setUnauthenticatedHandler(null)
    vi.restoreAllMocks()
  })

  it('handles simultaneous authenticated 401 responses once', async () => {
    const onUnauthenticated = vi.fn().mockResolvedValue()
    setUnauthenticatedHandler(onUnauthenticated)
    globalThis.fetch = vi.fn().mockResolvedValue(unauthorizedResponse())

    await Promise.allSettled([
      apiFetch('/admin/products', { token: 'expired-token' }),
      apiFetch('/admin/orders', { token: 'expired-token' }),
    ])

    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
  })

  it('does not treat an unauthenticated login request as a stored-session failure', async () => {
    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)
    globalThis.fetch = vi.fn().mockResolvedValue(unauthorizedResponse())

    await expect(apiFetch('/admin/auth/login', { method: 'POST' })).rejects.toMatchObject({ status: 401 })

    expect(onUnauthenticated).not.toHaveBeenCalled()
  })
})
