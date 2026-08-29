// The sidebar nav as data, so the filtering rule below can be unit tested
// without mounting the component. `icon` keys map to the inline <svg> set in
// AppSidebar.vue. `permission` is the grant required to see the item; null
// means always visible.

export const NAV_SECTIONS = [
  {
    title: 'Dashboard',
    items: [
      // The post-login landing page: every role needs somewhere to arrive.
      { label: 'Overview', icon: 'overview', to: '/', permission: null },
    ],
  },
  {
    title: 'E-Commerce',
    items: [
      { label: 'Orders', icon: 'orders', to: '/orders', permission: 'orders.view', badge: 12 },
      { label: 'Products', icon: 'products', to: '/products', permission: 'products.view' },
      { label: 'Categories', icon: 'categories', to: '/categories', permission: 'categories.view' },
      { label: 'Promotions', icon: 'promotions', to: '/promotions', permission: 'promotions.view' },
      { label: 'Stock Management', icon: 'stock', to: '/stock', permission: 'stock.view' },
      { label: 'Reports', icon: 'reports', to: '/reports', permission: 'logs.view' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Slides', icon: 'slides', to: '/slides', permission: 'banners.view' },
      { label: 'News', icon: 'news', to: '/news', permission: 'content.view' },
      // The website's standing pages — About, Terms, Privacy and the like.
      // Same content.* grant as News; the two differ only by ContentItem.type.
      { label: 'Pages', icon: 'pages', to: '/pages', permission: 'content.view' },
    ],
  },
  {
    title: 'Users',
    items: [
      { label: 'Customers', icon: 'customers', to: '/customers', permission: 'customers.view' },
      {
        label: 'Administrators',
        icon: 'administrators',
        to: '/administrators',
        permission: 'administrators.view',
      },
      {
        label: 'Roles & Permissions',
        icon: 'roles',
        to: '/roles',
        permission: 'roles.view',
      },
      { label: 'Logs', icon: 'logs', to: '/logs', permission: 'logs.view' },
    ],
  },
]

// Items the caller may not see are removed; a section left with no items is
// dropped so its heading does not linger over empty space.
export function visibleSections(hasPermission) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(item.permission)),
  })).filter((section) => section.items.length > 0)
}
