import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('staff and manager permission filtering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hides pages outside the staff allowlist while keeping the approved menu', () => {
    const auth = useAuthStore()

    auth.user = {
      roles: ['staff'],
      permissions: [
        'admin.auth.logout',
        'admin.profile.view',
        'admin.profile.update',
        'products.view',
        'products.create',
        'products.update',
        'categories.view',
        'categories.create',
        'categories.update',
        'content.view',
        'content.create',
        'content.update',
        'promotions.view',
        'promotions.create',
        'promotions.update',
        'media.view',
        'media.create',
        'users.view',
        'orders.view',
        'logs.view',
        'stock.view',
      ],
    }

    expect(auth.hasPermission('products.view')).toBe(true)
    expect(auth.hasPermission('categories.view')).toBe(true)
    expect(auth.hasPermission('content.view')).toBe(true)
    expect(auth.hasPermission('promotions.view')).toBe(true)
    expect(auth.hasPermission('admin.profile.view')).toBe(true)
    expect(auth.hasPermission('admin.auth.logout')).toBe(true)

    expect(auth.hasPermission('orders.view')).toBe(false)
    expect(auth.hasPermission('logs.view')).toBe(false)
    expect(auth.hasPermission('stock.view')).toBe(false)
    expect(auth.hasPermission('users.view')).toBe(false)

    expect(auth.hasAnyPermission(['products.update', 'orders.update'])).toBe(true)
    expect(auth.hasAnyPermission(['orders.view', 'logs.view'])).toBe(false)
  })

  it('keeps the manager allowlist scoped to approval, product, category, content, and promotion access', () => {
    const auth = useAuthStore()

    auth.user = {
      roles: ['manager'],
      permissions: [
        'admin.auth.logout',
        'admin.profile.view',
        'admin.profile.update',
        'orders.view',
        'orders.approve',
        'products.view',
        'products.create',
        'products.update',
        'categories.view',
        'categories.create',
        'categories.update',
        'banners.view',
        'banners.create',
        'banners.update',
        'content.view',
        'content.create',
        'content.update',
        'promotions.view',
        'promotions.create',
        'promotions.update',
        'media.view',
        'media.create',
        'users.view',
        'logs.view',
        'stock.view',
      ],
    }

    expect(auth.hasPermission('orders.view')).toBe(true)
    expect(auth.hasPermission('orders.approve')).toBe(true)
    expect(auth.hasPermission('products.view')).toBe(true)
    expect(auth.hasPermission('banners.view')).toBe(true)
    expect(auth.hasPermission('content.view')).toBe(true)
    expect(auth.hasPermission('promotions.view')).toBe(true)
    expect(auth.hasPermission('categories.view')).toBe(true)

    expect(auth.hasPermission('orders.create')).toBe(false)
    expect(auth.hasPermission('stock.view')).toBe(false)
    expect(auth.hasPermission('customers.view')).toBe(false)
    expect(auth.hasPermission('logs.view')).toBe(false)
    expect(auth.hasAnyPermission(['orders.approve', 'stock.view'])).toBe(true)
    expect(auth.hasAnyPermission(['stock.view', 'logs.view'])).toBe(false)
  })
})
