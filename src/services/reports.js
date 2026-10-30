import { apiFetch } from '@/services/api'
import { deriveStockStatus } from '@/services/stock'

// Report API: Sales, Stock, Sold Products and Customer Orders are all live. The
// Stock report reads the existing /admin/stock listing rather than a dedicated
// report endpoint. The remaining report tabs have no production endpoint today
// and keep reading mock data (see src/data/reports.js).

const PRESET_BY_GRANULARITY = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  yearly: 'yearly',
}

/**
 * Normalise the sold-products payload into the shape SoldProductsReport.vue
 * renders. The backend already emits camelCase table rows, but we map both that
 * and the raw snake_case query forms so a schema change on either side fails
 * visibly (row dropped, default applied) instead of crashing the tab.
 */
export function normalizeSoldProductsPayload(data) {
  const table = Array.isArray(data?.table) ? data.table : []

  return {
    rows: table.map((row) => ({
      productId: row.productId ?? row.product_id ?? row.id,
      name: row.name ?? row.product_name ?? 'Unknown product',
      sku: row.sku ?? '',
      category: row.category ?? row.category_name ?? 'Uncategorized',
      units: Number(row.units ?? row.quantity_sold ?? 0),
      revenue: Number(row.revenue ?? row.revenue_total ?? 0),
    })),
    labels: Array.isArray(data?.labels) ? data.labels : [],
    series: Array.isArray(data?.series) ? data.series : [],
    meta: data?.meta ?? {},
  }
}

/**
 * Normalise the customer-orders payload into the shape CustomerOrdersReport.vue
 * renders.
 */
export function normalizeCustomerOrdersPayload(data) {
  const table = Array.isArray(data?.table) ? data.table : []

  return {
    rows: table.map((row) => ({
      period: row.period ?? 'Unknown',
      orders: Number(row.orders ?? 0),
      uniqueCustomers: Number(row.uniqueCustomers ?? 0),
      newCustomers: Number(row.newCustomers ?? 0),
      returningCustomers: Number(row.returningCustomers ?? 0),
      avgItems: Number(row.avgItems ?? 0),
    })),
    meta: data?.meta ?? {},
  }
}

export async function fetchSoldProductsReport(
  { granularity = 'monthly', date_from, date_to } = {},
  token,
) {
  const params = new URLSearchParams({
    preset: PRESET_BY_GRANULARITY[granularity] ?? 'custom',
  })
  if (date_from) params.set('date_from', date_from)
  if (date_to) params.set('date_to', date_to)

  const response = await apiFetch(`/admin/reports/sold-products?${params.toString()}`, { token })

  return normalizeSoldProductsPayload(response?.data)
}

export async function fetchCustomerOrdersReport(
  { granularity = 'monthly', date_from, date_to } = {},
  token,
) {
  const params = new URLSearchParams({
    preset: PRESET_BY_GRANULARITY[granularity] ?? 'custom',
  })
  if (date_from) params.set('date_from', date_from)
  if (date_to) params.set('date_to', date_to)

  const response = await apiFetch(`/admin/reports/customer-orders?${params.toString()}`, { token })

  return normalizeCustomerOrdersPayload(response?.data)
}

export function normalizeSalesReportPayload(data) {
  const summary = data?.summary ?? {}
  const number = (value) => Number(value ?? 0)

  return {
    summary: {
      revenue: number(summary.revenue),
      cogs: number(summary.cogs),
      profit: number(summary.profit),
      margin: number(summary.margin),
      orders: number(summary.orders),
      revenueChange: number(summary.revenue_change),
      cogsChange: number(summary.cogs_change),
      profitChange: number(summary.profit_change),
      marginChange: number(summary.margin_change),
    },
    chart: Array.isArray(data?.chart)
      ? data.chart.map((point) => ({
          label: point.label ?? '',
          revenue: number(point.revenue),
          profit: number(point.profit),
        }))
      : [],
    dailyBreakdown: Array.isArray(data?.daily_breakdown)
      ? data.daily_breakdown.map((point) => ({
          label: point.label ?? '',
          revenue: number(point.revenue),
          profit: number(point.profit),
        }))
      : [],
    topProducts: Array.isArray(data?.top_products)
      ? data.top_products.map((product) => ({
          name: product.name ?? 'Unknown product',
          units: number(product.units),
          revenue: number(product.revenue),
        }))
      : [],
    table: Array.isArray(data?.table)
      ? data.table.map((row) => ({
          period: row.period ?? '',
          dateRange: row.date_range ?? '',
          orders: number(row.orders),
          revenue: number(row.revenue),
          cogs: number(row.cogs),
          profit: number(row.profit),
          margin: number(row.margin),
        }))
      : [],
    meta: data?.meta ?? {},
  }
}

export async function fetchSalesReport(
  { granularity = 'weekly', date_from, date_to } = {},
  token,
) {
  const params = new URLSearchParams({
    preset: PRESET_BY_GRANULARITY[granularity] ?? 'weekly',
  })
  if (date_from) params.set('date_from', date_from)
  if (date_to) params.set('date_to', date_to)

  const response = await apiFetch(`/admin/reports/sales?${params.toString()}`, { token })
  return normalizeSalesReportPayload(response?.data)
}
const STOCK_REPORT_PAGE_SIZE = 100
const STOCK_REPORT_MAX_PAGES = 20

const round2 = (value) => Math.round(value * 100) / 100

/**
 * Normalise one /admin/stock item into a Stock Report row.
 *
 * `unitCost` stays null when the product has no cost price, and so does
 * `stockValue`: a missing cost must not read as a $0 asset in the totals or the
 * export. Negative on-hand (an oversold product) is shown as-is but counts as 0
 * towards value, so a backorder never reduces the inventory total.
 */
export function normalizeStockReportRow(item) {
  const onHand = Number(item.stock_quantity ?? 0)
  const sellable = Math.max(onHand, 0)
  const unitCost = item.cost_price == null ? null : Number(item.cost_price)
  const unitPrice = Number(item.price ?? 0)

  return {
    id: item.id,
    name: item.name ?? 'Unknown product',
    sku: item.sku ?? '',
    category: item.category?.name ?? 'Uncategorized',
    brand: item.brand?.name ?? '',
    onHand,
    threshold: Number(item.min_stock_alert ?? 0),
    unitCost,
    unitPrice,
    stockValue: unitCost === null ? null : round2(sellable * unitCost),
    retailValue: round2(sellable * unitPrice),
    status: deriveStockStatus(item),
  }
}

/**
 * Load every tracked product for the Stock Report. The report filters, ranks and
 * totals client-side, so it needs the whole catalogue rather than one page; pages
 * are capped so a runaway catalogue degrades to `truncated` instead of an endless
 * request loop.
 */
export async function fetchStockReport(token) {
  const rows = []
  let page = 1
  let lastPage

  do {
    const response = await apiFetch(
      `/admin/stock?page=${page}&per_page=${STOCK_REPORT_PAGE_SIZE}&sort=name&direction=asc`,
      { token },
    )
    const data = response?.data ?? {}
    const items = Array.isArray(data.items) ? data.items : []

    rows.push(...items.map(normalizeStockReportRow))
    lastPage = Number(data.pagination?.last_page ?? 1)
    page += 1
  } while (page <= lastPage && page <= STOCK_REPORT_MAX_PAGES)

  return { rows, truncated: lastPage > STOCK_REPORT_MAX_PAGES }
}
