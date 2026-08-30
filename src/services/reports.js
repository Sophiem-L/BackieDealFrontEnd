import { apiFetch } from '@/services/api'

// Sold Products report API. The Reports page's granularity tabs map 1:1 onto the
// presets the backend accepts, so the consumer never has to learn the API's
// vocabulary. The remaining report tabs have no production endpoint today and
// keep reading mock data (see src/data/reports.js).

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