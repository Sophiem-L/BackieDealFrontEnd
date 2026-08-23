// Mock datasets for the Reports page.
//
// Session-only, no backend: of the six reports this page shows, only customer
// purchase history could be served by the API today (GET /admin/orders?customer_id=).
// The rest have no endpoint, and `visitor_logs` / `team_activity_logs` are never
// written to by the backend, so they would return empty even where a route exists.
// See docs/superpowers/specs/2026-08-09-reports-page-redesign-design.md for the
// audit and the decision to ship on mock data.
//
// Everything here is derived from the catalogues the rest of the app already uses
// (products, customers, the activity-log staff cast) so the admin tells one
// consistent story rather than six unrelated ones.

import { products, findProduct } from './products'
import { customers } from './customers'

// ---------------------------------------------------------------------------
// Shared cast
// ---------------------------------------------------------------------------

// The staff names come from src/data/activityLogs.js; roles are attached here
// because that file only records a display name.
const STAFF_ROLES = {
  'Super Admin': 'Administrator',
  'Poster Alex': 'Content Poster',
  'Manager John': 'Store Manager',
  'Editor Sarah': 'Content Editor',
  'Support Emma': 'Support Agent',
  'Lead Tech Sarah': 'Lead Technician',
}

// ---------------------------------------------------------------------------
// 1. Sold products
// ---------------------------------------------------------------------------

// Revenue is computed from the catalogue price rather than hardcoded, so a price
// change in products.js flows through instead of silently disagreeing.
function soldRow(productId, units) {
  const product = findProduct(productId)

  return {
    productId,
    name: product.name,
    sku: product.sku,
    category: product.category,
    units,
    revenue: Math.round(units * product.price * 100) / 100,
  }
}

export const soldProducts = {
  daily: [
    soldRow(8, 14),
    soldRow(7, 11),
    soldRow(4, 7),
    soldRow(2, 5),
    soldRow(9, 4),
    soldRow(10, 3),
  ],
  weekly: [
    soldRow(8, 86),
    soldRow(7, 72),
    soldRow(4, 44),
    soldRow(2, 31),
    soldRow(9, 28),
    soldRow(10, 22),
    soldRow(1, 18),
    soldRow(3, 16),
  ],
  monthly: [
    soldRow(8, 342),
    soldRow(7, 291),
    soldRow(4, 176),
    soldRow(2, 132),
    soldRow(9, 118),
    soldRow(10, 94),
    soldRow(1, 71),
    soldRow(3, 66),
    soldRow(6, 52),
    soldRow(5, 38),
  ],
  yearly: [
    soldRow(8, 4120),
    soldRow(7, 3480),
    soldRow(4, 2110),
    soldRow(2, 1580),
    soldRow(9, 1416),
    soldRow(10, 1128),
    soldRow(1, 852),
    soldRow(3, 792),
    soldRow(6, 624),
    soldRow(5, 456),
  ],
}

// Orders containing at least one sold item, per bucket. The other three summary
// figures are derived from the rows themselves.
const SOLD_ORDER_COUNTS = { daily: 18, weekly: 124, monthly: 512, yearly: 6240 }

function summariseSold(rows, orders) {
  const unitsByCategory = new Map()
  for (const row of rows) {
    unitsByCategory.set(row.category, (unitsByCategory.get(row.category) ?? 0) + row.units)
  }

  const topCategory = [...unitsByCategory.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    units: rows.reduce((sum, row) => sum + row.units, 0),
    orders,
    distinctProducts: rows.length,
    topCategory: topCategory ? topCategory[0] : '—',
  }
}

export const soldProductsSummary = Object.fromEntries(
  Object.entries(soldProducts).map(([bucket, rows]) => [
    bucket,
    summariseSold(rows, SOLD_ORDER_COUNTS[bucket]),
  ]),
)

// ---------------------------------------------------------------------------
// 2. Customer orders
// ---------------------------------------------------------------------------

// `returningCustomers` is always derived so the split can never fail to add up.
function orderRow(period, orders, uniqueCustomers, newCustomers, avgItems) {
  return {
    period,
    orders,
    uniqueCustomers,
    newCustomers,
    returningCustomers: uniqueCustomers - newCustomers,
    avgItems,
  }
}

export const customerOrders = {
  daily: [
    orderRow('Jul 29', 22, 19, 6, 2.4),
    orderRow('Jul 30', 18, 16, 4, 2.2),
    orderRow('Jul 31', 27, 24, 9, 2.7),
    orderRow('Aug 1', 31, 26, 10, 2.9),
    orderRow('Aug 2', 24, 21, 7, 2.5),
    orderRow('Aug 3', 19, 17, 5, 2.3),
    orderRow('Aug 4', 18, 15, 6, 2.6),
  ],
  weekly: [
    orderRow('Jun 29 – Jul 5', 118, 88, 27, 2.4),
    orderRow('Jul 6 – 12', 132, 97, 31, 2.6),
    orderRow('Jul 13 – 19', 126, 92, 28, 2.5),
    orderRow('Jul 20 – 26', 141, 103, 35, 2.7),
    orderRow('Jul 27 – Aug 2', 149, 108, 38, 2.6),
    orderRow('Aug 3 – 9', 37, 31, 11, 2.5),
  ],
  // Order counts sum to 1,820 across the year, the same total the yearly bucket
  // records for 2026 — the two views of this year must not disagree.
  monthly: [
    orderRow('Jan', 96, 70, 22, 2.3),
    orderRow('Feb', 112, 81, 25, 2.5),
    orderRow('Mar', 104, 75, 21, 2.4),
    orderRow('Apr', 128, 92, 29, 2.6),
    orderRow('May', 141, 101, 31, 2.5),
    orderRow('Jun', 152, 108, 33, 2.7),
    orderRow('Jul', 146, 104, 28, 2.4),
    orderRow('Aug', 168, 119, 36, 2.6),
    orderRow('Sep', 182, 128, 39, 2.8),
    orderRow('Oct', 174, 123, 34, 2.5),
    orderRow('Nov', 198, 139, 45, 2.9),
    orderRow('Dec', 219, 152, 51, 3.1),
  ],
  yearly: [
    orderRow('2022', 620, 402, 402, 2.1),
    orderRow('2023', 1105, 690, 388, 2.2),
    orderRow('2024', 1418, 861, 402, 2.4),
    orderRow('2025', 1663, 992, 431, 2.5),
    orderRow('2026', 1820, 1094, 468, 2.6),
  ],
}

// ---------------------------------------------------------------------------
// 3. Visitor tracking (IP)
// ---------------------------------------------------------------------------

// Columns are limited to what `visitor_logs` can actually produce — ip_address,
// action, target_url, session_id, created_at. No geo or device fields: the schema
// has none, and inventing them here would promise data the backend cannot deliver.
export const visitorLogs = [
  {
    id: 1,
    ip: '182.44.22.10',
    visits: 34,
    firstSeen: '28 Jul 2026, 09:12 AM',
    lastSeen: 'Today, 11:04 AM',
    lastPage: '/products/samsung-980-pro-2tb',
    hits: [
      { at: 'Today, 11:04 AM', action: 'product_view', targetUrl: '/products/samsung-980-pro-2tb', sessionId: 'sess_8f21ac' },
      { at: 'Today, 10:58 AM', action: 'search', targetUrl: '/search?q=nvme+ssd', sessionId: 'sess_8f21ac' },
      { at: 'Today, 10:51 AM', action: 'page_view', targetUrl: '/categories/storage', sessionId: 'sess_8f21ac' },
      { at: 'Yesterday, 03:22 PM', action: 'add_to_cart', targetUrl: '/products/corsair-vengeance-32gb', sessionId: 'sess_71b0de' },
    ],
  },
  {
    id: 2,
    ip: '203.144.87.201',
    visits: 28,
    firstSeen: '25 Jul 2026, 02:40 PM',
    lastSeen: 'Today, 10:37 AM',
    lastPage: '/checkout',
    hits: [
      { at: 'Today, 10:37 AM', action: 'checkout', targetUrl: '/checkout', sessionId: 'sess_44c9e1' },
      { at: 'Today, 10:29 AM', action: 'add_to_cart', targetUrl: '/products/nvidia-rtx-4070-fe', sessionId: 'sess_44c9e1' },
      { at: 'Today, 10:15 AM', action: 'product_view', targetUrl: '/products/nvidia-rtx-4070-fe', sessionId: 'sess_44c9e1' },
    ],
  },
  {
    id: 3,
    ip: '119.82.240.17',
    visits: 21,
    firstSeen: '21 Jul 2026, 08:05 AM',
    lastSeen: 'Today, 09:52 AM',
    lastPage: '/categories/graphics-cards',
    hits: [
      { at: 'Today, 09:52 AM', action: 'page_view', targetUrl: '/categories/graphics-cards', sessionId: 'sess_2d70fa' },
      { at: 'Today, 09:44 AM', action: 'product_view', targetUrl: '/products/nvidia-rtx-4090-fe', sessionId: 'sess_2d70fa' },
      { at: '02 Aug 2026, 06:11 PM', action: 'page_view', targetUrl: '/', sessionId: 'sess_ba3317' },
    ],
  },
  {
    id: 4,
    ip: '192.168.1.12',
    visits: 19,
    firstSeen: '18 Jul 2026, 07:55 AM',
    lastSeen: 'Today, 09:20 AM',
    lastPage: '/admin/orders',
    hits: [
      { at: 'Today, 09:20 AM', action: 'page_view', targetUrl: '/admin/orders', sessionId: 'sess_5e12b8' },
      { at: 'Today, 08:47 AM', action: 'page_view', targetUrl: '/admin/stock', sessionId: 'sess_5e12b8' },
      { at: 'Yesterday, 05:02 PM', action: 'page_view', targetUrl: '/admin/products', sessionId: 'sess_9a04cc' },
    ],
  },
  {
    id: 5,
    ip: '58.97.161.44',
    visits: 16,
    firstSeen: '30 Jul 2026, 11:31 AM',
    lastSeen: 'Yesterday, 08:14 PM',
    lastPage: '/products/intel-core-i7-13700k',
    hits: [
      { at: 'Yesterday, 08:14 PM', action: 'product_view', targetUrl: '/products/intel-core-i7-13700k', sessionId: 'sess_c7f293' },
      { at: 'Yesterday, 08:02 PM', action: 'search', targetUrl: '/search?q=i7', sessionId: 'sess_c7f293' },
    ],
  },
  {
    id: 6,
    ip: '104.28.55.9',
    visits: 12,
    firstSeen: '02 Aug 2026, 01:18 PM',
    lastSeen: 'Yesterday, 04:47 PM',
    lastPage: '/products/corsair-rm1000x',
    hits: [
      { at: 'Yesterday, 04:47 PM', action: 'product_view', targetUrl: '/products/corsair-rm1000x', sessionId: 'sess_1fd806' },
      { at: 'Yesterday, 04:39 PM', action: 'page_view', targetUrl: '/categories/power-supply', sessionId: 'sess_1fd806' },
    ],
  },
  {
    id: 7,
    ip: '192.168.1.15',
    visits: 9,
    firstSeen: '27 Jul 2026, 10:02 AM',
    lastSeen: 'Yesterday, 11:26 AM',
    lastPage: '/admin/news',
    hits: [
      { at: 'Yesterday, 11:26 AM', action: 'page_view', targetUrl: '/admin/news', sessionId: 'sess_63ba7d' },
      { at: 'Yesterday, 11:09 AM', action: 'page_view', targetUrl: '/admin/slides', sessionId: 'sess_63ba7d' },
    ],
  },
  {
    id: 8,
    ip: '175.100.208.63',
    visits: 6,
    firstSeen: '01 Aug 2026, 09:41 PM',
    lastSeen: '02 Aug 2026, 07:33 PM',
    lastPage: '/products/samsung-990-pro-1tb',
    hits: [
      { at: '02 Aug 2026, 07:33 PM', action: 'product_view', targetUrl: '/products/samsung-990-pro-1tb', sessionId: 'sess_af5520' },
      { at: '01 Aug 2026, 09:41 PM', action: 'page_view', targetUrl: '/', sessionId: 'sess_30e9b1' },
    ],
  },
]

// ---------------------------------------------------------------------------
// 4. Customer purchase history
// ---------------------------------------------------------------------------

// Orders are newest-first; order count, lifetime total and last-order date are all
// derived from the list so a row can never contradict its own summary.
const CUSTOMER_ORDERS = {
  1: [
    { number: 'ORD-1043', date: 'Aug 2, 2026', items: 3, status: 'Completed', total: 1958.98 },
    { number: 'ORD-1021', date: 'Jul 24, 2026', items: 1, status: 'Completed', total: 599.0 },
    { number: 'ORD-0994', date: 'Jul 11, 2026', items: 2, status: 'Completed', total: 288.99 },
    { number: 'ORD-0962', date: 'Jun 28, 2026', items: 4, status: 'Cancelled', total: 1476.97 },
    { number: 'ORD-0930', date: 'Jun 9, 2026', items: 1, status: 'Completed', total: 179.99 },
    { number: 'ORD-0901', date: 'May 22, 2026', items: 2, status: 'Completed', total: 708.99 },
  ],
  2: [
    { number: 'ORD-1041', date: 'Aug 2, 2026', items: 2, status: 'Processing', total: 998.0 },
    { number: 'ORD-1009', date: 'Jul 18, 2026', items: 1, status: 'Completed', total: 1599.0 },
    { number: 'ORD-0977', date: 'Jul 3, 2026', items: 3, status: 'Completed', total: 487.99 },
    { number: 'ORD-0945', date: 'Jun 17, 2026', items: 1, status: 'Completed', total: 89.0 },
    { number: 'ORD-0912', date: 'May 30, 2026', items: 2, status: 'Completed', total: 378.99 },
  ],
  3: [
    { number: 'ORD-1038', date: 'Aug 1, 2026', items: 1, status: 'Pending', total: 699.0 },
    { number: 'ORD-1002', date: 'Jul 15, 2026', items: 2, status: 'Completed', total: 1288.0 },
    { number: 'ORD-0958', date: 'Jun 26, 2026', items: 1, status: 'Completed', total: 299.0 },
    { number: 'ORD-0921', date: 'Jun 4, 2026', items: 3, status: 'Completed', total: 867.98 },
  ],
  4: [
    { number: 'ORD-1034', date: 'Jul 30, 2026', items: 2, status: 'Completed', total: 778.99 },
    { number: 'ORD-0988', date: 'Jul 9, 2026', items: 1, status: 'Completed', total: 109.0 },
    { number: 'ORD-0939', date: 'Jun 13, 2026', items: 4, status: 'Completed', total: 1596.96 },
  ],
  5: [
    { number: 'ORD-1030', date: 'Jul 28, 2026', items: 1, status: 'Completed', total: 199.99 },
    { number: 'ORD-0971', date: 'Jul 1, 2026', items: 2, status: 'Completed', total: 688.0 },
    { number: 'ORD-0933', date: 'Jun 10, 2026', items: 1, status: 'Cancelled', total: 589.0 },
  ],
}

export const purchaseHistory = customers.map((customer) => {
  const orders = CUSTOMER_ORDERS[customer.id] ?? []

  return {
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
    orders,
    orderCount: orders.length,
    // Rounded so float drift doesn't surface as 3212.9200000000005.
    lifetimeTotal: Math.round(orders.reduce((sum, order) => sum + order.total, 0) * 100) / 100,
    lastOrder: orders[0]?.date ?? '—',
  }
})

// ---------------------------------------------------------------------------
// 5. User (staff) actions
// ---------------------------------------------------------------------------

// Mirrors team_activity_logs: actor, event_type, description, created_at, plus the
// source IP the backend would carry in `metadata`.
function actionRow(id, at, staff, eventType, description, ip) {
  return { id, at, staff, role: STAFF_ROLES[staff] ?? 'Staff', eventType, description, ip }
}

export const userActions = [
  actionRow(1, 'Today, 11:42 AM', 'Super Admin', 'UPDATE_PRODUCT', 'Updated price for NVIDIA GeForce RTX 4090 Founders Edition', '192.168.1.45'),
  actionRow(2, 'Today, 10:55 AM', 'Poster Alex', 'POST_PRODUCT', 'Added new listing: Corsair Vengeance 32GB DDR5', '182.44.22.10'),
  actionRow(3, 'Today, 10:15 AM', 'Manager John', 'ORDER_STATUS', "Changed #ORD-1041 to 'Processing'", '192.168.1.12'),
  actionRow(4, 'Today, 09:30 AM', 'Editor Sarah', 'CONTENT_APPROVE', 'Approved homepage slide: Ultimate Gaming 2026', '192.168.1.15'),
  actionRow(5, 'Today, 09:05 AM', 'Support Emma', 'USER_LOGIN', 'Logged into system', '182.44.22.10'),
  actionRow(6, 'Today, 08:47 AM', 'Manager John', 'STOCK_ADJUST', 'Adjusted stock for Samsung 980 Pro 2TB NVMe SSD (+40)', '192.168.1.12'),
  actionRow(7, 'Yesterday, 05:12 PM', 'Poster Alex', 'POST_PRODUCT', 'Added new listing: Samsung 990 Pro 1TB NVMe', '182.44.22.10'),
  actionRow(8, 'Yesterday, 04:30 PM', 'Lead Tech Sarah', 'DELETE_CAT', "Deleted category 'Old Parts'", '192.168.1.18'),
  actionRow(9, 'Yesterday, 03:58 PM', 'Super Admin', 'ROLE_UPDATE', "Granted 'orders.update' to Store Manager", '192.168.1.45'),
  actionRow(10, 'Yesterday, 02:12 PM', 'Super Admin', 'SETTING_CHANGE', 'Modified tax rate settings', '192.168.1.45'),
  actionRow(11, 'Yesterday, 11:20 AM', 'Editor Sarah', 'CONTENT_APPROVE', 'Published news post: Back to School Deals', '192.168.1.15'),
  actionRow(12, '02 Aug 2026, 04:05 PM', 'Manager John', 'ORDER_STATUS', "Changed #ORD-1043 to 'Completed'", '192.168.1.12'),
  actionRow(13, '02 Aug 2026, 01:33 PM', 'Poster Alex', 'UPDATE_PRODUCT', 'Updated specs for ASUS ROG Maximus Z790 Dark Hero', '182.44.22.10'),
  actionRow(14, '01 Aug 2026, 09:48 AM', 'Support Emma', 'ORDER_STATUS', "Changed #ORD-1038 to 'Pending'", '182.44.22.10'),
]

// ---------------------------------------------------------------------------
// 6. Posted products
// ---------------------------------------------------------------------------

// `postedBy` has no backing column — `products` records no creator. Going live
// needs either products.created_by or derivation from team_activity_logs once
// product creation is instrumented. Documented in §5 of the design spec.
const POSTED = [
  { productId: 1, postedBy: 'Poster Alex', postedAt: '12 May 2026', status: 'Active' },
  { productId: 2, postedBy: 'Poster Alex', postedAt: '18 May 2026', status: 'Active' },
  { productId: 3, postedBy: 'Manager John', postedAt: '22 May 2026', status: 'Active' },
  { productId: 4, postedBy: 'Poster Alex', postedAt: '02 Jun 2026', status: 'Active' },
  { productId: 5, postedBy: 'Lead Tech Sarah', postedAt: '09 Jun 2026', status: 'Archived' },
  { productId: 6, postedBy: 'Poster Alex', postedAt: '15 Jun 2026', status: 'Active' },
  { productId: 7, postedBy: 'Poster Alex', postedAt: '21 Jun 2026', status: 'Active' },
  { productId: 8, postedBy: 'Manager John', postedAt: '04 Jul 2026', status: 'Active' },
  { productId: 9, postedBy: 'Poster Alex', postedAt: '17 Jul 2026', status: 'Draft' },
  { productId: 10, postedBy: 'Lead Tech Sarah', postedAt: '28 Jul 2026', status: 'Active' },
]

// Units sold come from the yearly sold-products bucket, so the two tabs agree.
const YEARLY_UNITS = new Map(soldProducts.yearly.map((row) => [row.productId, row.units]))

export const postedProducts = POSTED.map((row, index) => {
  const product = findProduct(row.productId)

  return {
    id: index + 1,
    productId: row.productId,
    name: product.name,
    sku: product.sku,
    category: product.category,
    postedBy: row.postedBy,
    role: STAFF_ROLES[row.postedBy] ?? 'Staff',
    postedAt: row.postedAt,
    status: row.status,
    unitsSold: YEARLY_UNITS.get(row.productId) ?? 0,
  }
})

// ---------------------------------------------------------------------------
// Filter option lists — derived so they can never drift from the data
// ---------------------------------------------------------------------------

export const granularities = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
]

export const actionStaff = ['All Staff', ...new Set(userActions.map((a) => a.staff))]
export const actionEventTypes = ['All Events', ...new Set(userActions.map((a) => a.eventType))]
export const posterStaff = ['All Staff', ...new Set(postedProducts.map((p) => p.postedBy))]
export const postedStatuses = ['All Statuses', ...new Set(postedProducts.map((p) => p.status))]
export const productCategories = ['All Categories', ...new Set(products.map((p) => p.category))]
