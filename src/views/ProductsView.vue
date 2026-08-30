<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
import { apiFetch } from '@/services/api'
import { downloadCsv, downloadJson } from '@/services/tableExport'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const PER_PAGE = 10
// `per_page` is capped at 200 by IndexProductsRequest; export walks pages at
// that size. The page cap is a runaway guard — a truncated export warns.
const EXPORT_PER_PAGE = 200
const EXPORT_MAX_PAGES = 50
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// Server-driven list state (GET /admin/products).
const products = ref([])
const search = ref('')
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')

// `category_id` filters server-side. Stock level does not: the API's `low_stock`
// is one bucket covering low AND zero stock, and In Stock (stock_quantity >
// min_stock_alert) is a two-column comparison no query param expresses. Until
// `stock_status` ships (docs/products-api-gaps.md) a stock filter pulls the
// matching catalog at per_page=200 and pages over it locally, so the row set,
// the total and the page count all stay correct.
const categoryId = ref('')
const stockLevel = ref('') // '' | 'in-stock' | 'low-stock' | 'out-of-stock'
const categories = ref([])
const hasFilters = computed(() => Boolean(search.value.trim() || categoryId.value || stockLevel.value))

/* ---------------------------------------------------------------------------
 * Select bindings
 *
 * reka-ui reserves the empty string for "no selection" and throws if an item
 * carries it, but '' is exactly how this page spells "no filter" — the query
 * builder, the watchers and hasFilters all read it. These proxies give the
 * unfiltered choice a real value for the widget while leaving categoryId and
 * stockLevel on their existing contract, so nothing downstream changes.
 * ------------------------------------------------------------------------- */
const ALL_CATEGORIES = 'all'
const ANY_STOCK = 'any'

const STOCK_LEVELS = [
  { value: ANY_STOCK, label: 'Stock Level: Any' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
]

const categorySelection = computed({
  // The raw id is passed through rather than stringified, so a numeric id still
  // matches its SelectItem and still reaches the query as the type it had.
  get: () => (categoryId.value === '' ? ALL_CATEGORIES : categoryId.value),
  set: (value) => {
    categoryId.value = value === ALL_CATEGORIES ? '' : value
  },
})

const stockSelection = computed({
  get: () => (stockLevel.value === '' ? ANY_STOCK : stockLevel.value),
  set: (value) => {
    stockLevel.value = value === ANY_STOCK ? '' : value
  },
})
// True when the client-side stock filter stopped at EXPORT_MAX_PAGES.
const filterTruncated = ref(false)

// Catalog-wide counts, deliberately independent of the active filters.
// There is no products summary endpoint, so these come from two calls:
// `pagination.total` for the catalog size, and GET /admin/stock/alerts (the
// full stock_quantity <= min_stock_alert set) split by stock on hand.
const summary = ref({ total: null, low: null, out: null, inStock: null })

function countLabel(value) {
  return value == null ? '—' : value.toLocaleString()
}

const stats = computed(() => [
  { key: 'total', label: 'Total Products', value: countLabel(summary.value.total), icon: 'box', tone: 'neutral' },
  { key: 'low', label: 'Low Stock', value: countLabel(summary.value.low), icon: 'warning', tone: 'warning' },
  { key: 'out', label: 'Out of Stock', value: countLabel(summary.value.out), icon: 'forbidden', tone: 'danger' },
  { key: 'in-stock', label: 'In Stock', value: countLabel(summary.value.inStock), icon: 'check', tone: 'success' },
])

const statusLabels = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

// The API has no explicit list status; derive it the same way the backend's
// `low_stock` filter does (stock_quantity vs min_stock_alert).
function deriveStatus(item) {
  const stock = Number(item.stock_quantity ?? 0)
  if (stock <= 0) return 'out-of-stock'
  if (item.min_stock_alert != null && stock <= Number(item.min_stock_alert)) return 'low-stock'
  return 'in-stock'
}

// Product thumbnails are Cloudinary `secure_url` values (see MediaController),
// so only absolute/rooted URLs are renderable — a bare storage path can't be
// resolved from here and keeps the initials tile instead.
function usableImage(value) {
  const url = String(value ?? '').trim()
  return /^(https?:\/\/|data:|blob:|\/)/.test(url) ? url : ''
}

function mapProduct(item) {
  return {
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    sku: item.sku,
    category: item.category?.name ?? '—',
    stock: Number(item.stock_quantity ?? 0),
    price: item.price != null ? currency.format(item.price) : '—',
    status: deriveStatus(item),
    thumbnail: usableImage(item.thumbnail),
  }
}

// Thumbnails that fail to load fall back to the initials tile.
const brokenThumbs = ref(new Set())
function onThumbError(id) {
  const next = new Set(brokenThumbs.value)
  next.add(id)
  brokenThumbs.value = next
}

// Shared query builder so the list and the export read the same filtered set.
function listParams({ page: targetPage = page.value, perPage = PER_PAGE } = {}) {
  const params = new URLSearchParams({
    page: String(targetPage),
    per_page: String(perPage),
    sort: 'id',
    direction: 'desc',
  })
  const q = search.value.trim()
  if (q) params.set('q', q)
  if (categoryId.value) params.set('category_id', String(categoryId.value))
  // Low and out-of-stock are both subsets of `low_stock`, so the server still
  // narrows those two before the client-side split runs.
  if (stockLevel.value === 'low-stock' || stockLevel.value === 'out-of-stock') {
    params.set('low_stock', '1')
  }
  return params
}

// Walks every page of the current filter set. Shared by the stock filter and Export.
async function fetchAllFiltered() {
  const rows = []
  let current = 1
  let last
  do {
    const response = await apiFetch(
      `/admin/products?${listParams({ page: current, perPage: EXPORT_PER_PAGE }).toString()}`,
      { token: auth.accessToken },
    )
    const data = response?.data ?? {}
    rows.push(...(data.items ?? []))
    last = data.pagination?.last_page ?? 1
    current += 1
  } while (current <= last && current <= EXPORT_MAX_PAGES)

  return { rows, truncated: last > EXPORT_MAX_PAGES }
}

// Paging inside a client-filtered set shouldn't refetch the catalog every time.
let statusCache = { key: '', rows: [], truncated: false }
function filterKey() {
  return JSON.stringify([search.value.trim(), categoryId.value, stockLevel.value])
}
function invalidateStatusCache() {
  statusCache = { key: '', rows: [], truncated: false }
}

async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    if (stockLevel.value) {
      const key = filterKey()
      if (statusCache.key !== key) {
        const { rows, truncated } = await fetchAllFiltered()
        statusCache = {
          key,
          rows: rows.filter((row) => deriveStatus(row) === stockLevel.value),
          truncated,
        }
      }

      const matched = statusCache.rows
      const start = (page.value - 1) * PER_PAGE
      products.value = matched.slice(start, start + PER_PAGE).map(mapProduct)
      total.value = matched.length
      lastPage.value = Math.max(1, Math.ceil(matched.length / PER_PAGE))
      filterTruncated.value = statusCache.truncated
    } else {
      const response = await apiFetch(`/admin/products?${listParams().toString()}`, {
        token: auth.accessToken,
      })
      const data = response?.data ?? {}
      products.value = (data.items ?? []).map(mapProduct)

      const pagination = data.pagination ?? {}
      total.value = pagination.total ?? products.value.length
      lastPage.value = pagination.last_page ?? 1
      filterTruncated.value = false
    }

    brokenThumbs.value = new Set()
  } catch (err) {
    error.value = err.message || 'Unable to load products. Please try again.'
    products.value = []
    total.value = 0
    lastPage.value = 1
  } finally {
    loading.value = false
  }
}

// Catalog totals for the stat cards. `/admin/stock/alerts` returns every product
// at or below its min_stock_alert (unpaginated); stock <= 0 is Out of Stock and
// the rest is Low Stock, matching deriveStatus() above. In Stock is the
// remainder of the catalog. A failure here leaves the cards at '—'.
async function loadSummary() {
  // allSettled, not all: a role without stock.view gets a 403 from
  // /admin/stock/alerts, and Promise.all would reject the pair and blank the
  // catalog total that had already loaded fine. Each card degrades on its own.
  const [catalogResult, alertsResult] = await Promise.allSettled([
    apiFetch('/admin/products?page=1&per_page=1', { token: auth.accessToken }),
    apiFetch('/admin/stock/alerts', { token: auth.accessToken }),
  ])

  const catalogTotal =
    catalogResult.status === 'fulfilled'
      ? (catalogResult.value?.data?.pagination?.total ?? null)
      : null

  if (alertsResult.status !== 'fulfilled') {
    summary.value = { total: catalogTotal, low: null, out: null, inStock: null }
    return
  }

  const rows = Array.isArray(alertsResult.value?.data) ? alertsResult.value.data : []
  const out = rows.filter((row) => Number(row.stock_quantity ?? 0) <= 0).length

  summary.value = {
    total: catalogTotal,
    low: rows.length - out,
    out,
    inStock: catalogTotal == null ? null : Math.max(0, catalogTotal - rows.length),
  }
}

// Category options for the filter. GET /admin/categories hard-codes paginate(20)
// and ignores per_page, so walk the pages (guarded at 10 = 200 categories).
const CATEGORY_PAGE_SIZE = 20

async function loadCategories() {
  try {
    const collected = []
    let current = 1
    let more = true
    do {
      const response = await apiFetch(`/admin/categories?page=${current}`, {
        token: auth.accessToken,
      })
      // The endpoint wraps a paginator, so `data` may be the array itself or {data: [...]}.
      const payload = response?.data
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? [])
      collected.push(...rows)
      // The success envelope serialises `data` as a bare array, dropping the
      // paginator's `meta` — so `meta.last_page` was always undefined here and
      // the walk stopped after page 1, silently capping the dropdown at 20.
      // A short page is the only reliable end-of-list signal.
      more = rows.length === CATEGORY_PAGE_SIZE
      current += 1
    } while (more && current <= 10)

    categories.value = collected
      .filter((row) => row?.id != null)
      .map((row) => ({ id: row.id, name: row.name ?? `Category ${row.id}` }))
  } catch {
    // A failed category load shouldn't block the list; the dropdown stays empty.
    categories.value = []
  }
}

onMounted(() => {
  loadProducts()
  loadSummary()
  loadCategories()
})

// Any filter change resets to page 1. Reload directly only when the page is
// already 1, otherwise the page watcher below does it (avoids a double fetch).
function applyFilters() {
  if (page.value !== 1) {
    page.value = 1
  } else {
    loadProducts()
  }
}

// Debounce search; the dropdowns apply immediately.
let searchTimer
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 350)
})

watch([categoryId, stockLevel], applyFilters)

watch(page, loadProducts)

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PER_PAGE + 1))
const rangeEnd = computed(() => (page.value - 1) * PER_PAGE + products.value.length)

function prevPage() {
  if (page.value > 1) page.value -= 1
}
function nextPage() {
  if (page.value < lastPage.value) page.value += 1
}

// Row selection
const selected = ref(new Set())
const allSelected = computed(
  () => products.value.length > 0 && selected.value.size === products.value.length,
)
function toggleRow(id) {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
function toggleAll() {
  selected.value = allSelected.value
    ? new Set()
    : new Set(products.value.map((p) => p.id))
}

// Actions
// The detail/edit route carries the uuid: Product::getRouteKeyName() is `uuid`,
// so the API resolves /admin/products/{uuid}, not the numeric id.
function viewProduct(product) {
  router.push({ name: 'product-edit', params: { id: product.uuid }, query: { view: '1' } })
}
function editProduct(product) {
  router.push({ name: 'product-edit', params: { id: product.uuid } })
}
// Fields carried over to a copy. `category_id`, `name`, `sku`, `slug` and
// `price` are set explicitly; the rest ride along when present.
const COPY_FIELDS = [
  'brand_id',
  'short_description',
  'description',
  'sale_price',
  'cost_price',
  'stock_quantity',
  'min_stock_alert',
  'track_inventory',
  'in_stock',
  'weight',
  'length',
  'width',
  'height',
  'thumbnail',
  'meta_title',
  'meta_description',
  'is_active',
  'is_featured',
  'is_digital',
  'sort_order',
]

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCopyBody(detail, attempt) {
  const label = attempt === 1 ? 'Copy' : `Copy ${attempt}`
  const tag = attempt === 1 ? 'COPY' : `COPY-${attempt}`

  const body = {
    category_id: detail.category_id,
    name: `${detail.name} (${label})`,
    // sku max:64 / slug max:191 on StoreProductRequest.
    sku: `${detail.sku}-${tag}`.slice(0, 64),
    slug: `${detail.slug || slugify(detail.name)}-${tag.toLowerCase()}`.slice(0, 191),
    price: detail.price ?? 0,
  }

  for (const key of COPY_FIELDS) {
    if (detail[key] !== null && detail[key] !== undefined) body[key] = detail[key]
  }

  return body
}

// There is no duplicate endpoint, so a copy is a real GET detail + POST create.
// `sku`, `slug` and `barcode` are globally unique: the copy gets a suffixed
// sku/slug, drops the barcode, and retries with the next suffix on a 422.
// Variants are NOT copied — their sku/slug/barcode are unique too and the API
// has no conflict handling for them (see docs/products-api-gaps.md).
const duplicatingId = ref(null)
async function duplicateProduct(product) {
  if (duplicatingId.value) return
  duplicatingId.value = product.id
  try {
    const detail = (await apiFetch(`/admin/products/${product.uuid}`, {
      token: auth.accessToken,
    }))?.data
    if (!detail?.category_id) throw new Error('This product is missing a category and cannot be copied.')

    let lastError = null
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await apiFetch('/admin/products', {
          method: 'POST',
          token: auth.accessToken,
          body: buildCopyBody(detail, attempt),
        })
        invalidateStatusCache()
        await Promise.all([loadProducts(), loadSummary()])
        return
      } catch (err) {
        if (err.status !== 422) throw err
        lastError = err
      }
    }
    throw lastError ?? new Error('Unable to duplicate this product.')
  } catch (err) {
    window.alert(err.message || 'Unable to duplicate this product.')
  } finally {
    duplicatingId.value = null
  }
}
async function deleteProduct(product) {
  if (!window.confirm(`Delete "${product.name}"? This action cannot be undone.`)) return
  try {
    // Route-model binding resolves by uuid (Product::getRouteKeyName()).
    await apiFetch(`/admin/products/${product.uuid}`, {
      method: 'DELETE',
      token: auth.accessToken,
    })
    invalidateStatusCache()
    // If we just removed the last row on a page past the first, step back.
    if (products.value.length === 1 && page.value > 1) {
      page.value -= 1
    } else {
      await loadProducts()
    }
    loadSummary()
  } catch (err) {
    window.alert(err.message || 'Unable to delete this product.')
  }
}

/* ---------------------------------------------------------------------------
 * Export
 *
 * All three formats export the same rows and the same columns; only the writer
 * differs, so the format menu picks a writer rather than a different query.
 * Columns read straight off ProductResource.
 * ------------------------------------------------------------------------- */

// Palette lifted from the page's own tokens so the sheet reads as part of the
// same product rather than a generic dump.
const XL_HEADER_FILL = '#F4C10F'
const XL_HEADER_TEXT = '#1F242D'
const XL_ZEBRA_FILL = '#FAFBFC'
const XL_TOTAL_FILL = '#F4F5F7'
const XL_GRID = '#E6E8EC'
const XL_RULE = '#C9CDD4'

// Mirrors the on-screen status badge colours.
const XL_STATUS_TEXT = {
  'in-stock': '#1F9D57',
  'low-stock': '#A8850A',
  'out-of-stock': '#D14343',
}

// statusLabels inverted, so the sheet can colour a cell from its label.
const STATUS_BY_LABEL = Object.fromEntries(
  Object.entries(statusLabels).map(([status, label]) => [label, status]),
)

const MONEY_FORMAT = '$#,##0.00'
const COUNT_FORMAT = '#,##0'

// `type` is what the workbook writes; CSV and JSON carry the raw value either
// way. `width`/`align`/`format` are workbook-only.
const EXPORT_COLUMNS = [
  { key: 'name', label: 'Product Name', width: 30 },
  { key: 'sku', label: 'SKU', width: 16 },
  { key: 'barcode', label: 'Barcode', width: 16 },
  { key: 'category', label: 'Category', width: 18 },
  { key: 'brand', label: 'Brand', width: 18 },
  { key: 'stock', label: 'Stock', width: 10, align: 'right', type: Number, format: COUNT_FORMAT },
  {
    key: 'minStockAlert',
    label: 'Min Stock Alert',
    width: 16,
    align: 'right',
    type: Number,
    format: COUNT_FORMAT,
  },
  { key: 'status', label: 'Status', width: 14, align: 'center' },
  { key: 'price', label: 'Price', width: 13, align: 'right', type: Number, format: MONEY_FORMAT },
  { key: 'salePrice', label: 'Sale Price', width: 13, align: 'right', type: Number, format: MONEY_FORMAT },
  { key: 'costPrice', label: 'Cost Price', width: 13, align: 'right', type: Number, format: MONEY_FORMAT },
  { key: 'active', label: 'Active', width: 9, align: 'center' },
  { key: 'createdAt', label: 'Created At', width: 22, type: Date, format: 'mmm d, yyyy h:mm AM/PM' },
]

// 'YYYY-MM-DDTHH:MM:SS' from the date's local fields, so CSV and JSON carry the
// same wall-clock time the sheet shows. Deliberately not toISOString(), which
// would shift it back to UTC.
function toLocalIsoDateTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

// The writer derives the Excel serial from the date's UTC fields, so a local
// 10:30 AM in UTC+7 would otherwise be written as 3:30 AM. Shifting by the
// offset makes the UTC fields match the wall-clock time above.
function toExcelDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
}

// One mapping feeding all three writers: a ProductResource item flattened to the
// export columns. Missing figures stay null so they never read as a real 0.
function toPlainRow(item) {
  return {
    name: item.name ?? '',
    sku: item.sku ?? '',
    barcode: item.barcode ?? null,
    category: item.category?.name ?? null,
    brand: item.brand?.name ?? null,
    stock: toNumber(item.stock_quantity),
    minStockAlert: toNumber(item.min_stock_alert),
    status: statusLabels[deriveStatus(item)],
    price: toNumber(item.price),
    salePrice: toNumber(item.sale_price),
    costPrice: toNumber(item.cost_price),
    active: item.is_active ? 'Yes' : 'No',
    createdAt: toLocalIsoDateTime(item.created_at),
  }
}

// Shared by every body cell: thin grid, centred vertically, roomy row height.
function bodyCellBase(zebra) {
  return {
    alignVertical: 'center',
    height: 22,
    backgroundColor: zebra,
    borderColor: XL_GRID,
    borderStyle: 'thin',
  }
}

// Builds the styled sheet from the same plain rows CSV and JSON use: a filled
// header band, zebra-striped rows and a bold totals row. Exported shape is
// [row][cell] as write-excel-file expects.
function buildSheetData(rows) {
  const header = EXPORT_COLUMNS.map((c) => ({
    value: c.label,
    type: String,
    fontWeight: 'bold',
    fontSize: 11,
    backgroundColor: XL_HEADER_FILL,
    textColor: XL_HEADER_TEXT,
    align: c.align ?? 'left',
    alignVertical: 'center',
    height: 30,
    borderColor: XL_RULE,
    borderStyle: 'thin',
  }))

  const body = rows.map((row, index) => {
    // Stripe every other row so long rows stay easy to track across.
    const base = bodyCellBase(index % 2 === 1 ? XL_ZEBRA_FILL : undefined)

    return EXPORT_COLUMNS.map((c) => {
      const cell = { ...base, align: c.align ?? 'left' }
      const value = row[c.key]

      if (c.type === Number) {
        // A null value would still need a type; emit a blank string instead so
        // an unset figure leaves the cell empty rather than showing $0.00.
        return value == null
          ? { ...cell, type: String, value: '' }
          : { ...cell, type: Number, format: c.format, value }
      }
      if (c.type === Date) {
        const date = toExcelDate(value)
        return date
          ? { ...cell, type: Date, format: c.format, value: date }
          : { ...cell, type: String, value: '' }
      }
      if (c.key === 'status') {
        return {
          ...cell,
          type: String,
          value: value ?? '',
          textColor: XL_STATUS_TEXT[STATUS_BY_LABEL[value]],
          fontWeight: 'bold',
        }
      }
      return { ...cell, type: String, value: value ?? '' }
    })
  })

  // Stock is the only column worth summing — a total of unit prices would be
  // meaningless.
  const totalStock = rows.reduce((sum, row) => sum + (row.stock ?? 0), 0)
  const totalBase = {
    fontWeight: 'bold',
    alignVertical: 'center',
    height: 26,
    backgroundColor: XL_TOTAL_FILL,
    borderColor: XL_GRID,
    borderStyle: 'thin',
    topBorderColor: XL_RULE,
    topBorderStyle: 'medium',
  }

  // The label spans two columns so it has room without overflowing into
  // neighbouring cells (Excel only spills text over genuinely empty cells).
  const totalRow = [
    {
      ...totalBase,
      type: String,
      value: `Total — ${rows.length} product${rows.length === 1 ? '' : 's'}`,
      align: 'left',
      columnSpan: 2,
    },
    null,
    ...EXPORT_COLUMNS.slice(2).map((c) =>
      c.key === 'stock'
        ? { ...totalBase, type: Number, format: c.format, value: totalStock, align: 'right' }
        : { ...totalBase, type: String, value: '' },
    ),
  ]

  return [header, ...body, totalRow]
}

// e.g. products-low-stock-2026-08-12.csv — the filter is in the name because an
// export of the whole catalog and one of a filtered set are different files.
function exportFileName(extension) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `products-${stockLevel.value || 'all'}-${today}.${extension}`
}

// Writes the fetched rows as a styled workbook. The sheet writer is loaded on
// demand so it stays out of the main bundle.
async function writeXlsxExport(rows) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  // v4 API: sheet options are the 2nd argument, font defaults the 3rd, and the
  // destination comes from the returned builder's toFile().
  await writeXlsxFile(
    buildSheetData(rows),
    {
      sheet: 'Products',
      columns: EXPORT_COLUMNS.map((c) => ({ width: c.width })),
      // Keep the header band visible while scrolling long exports.
      stickyRowsCount: 1,
    },
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toFile(exportFileName('xlsx'))
}

const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
]

const exporting = ref(false)
const exportMenuOpen = ref(false)

function closeExportMenu() {
  exportMenuOpen.value = false
}

// Any click outside closes the menu; the wrapper stops its own clicks.
onMounted(() => document.addEventListener('click', closeExportMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeExportMenu))

// Export every row matching the active filters, not just the visible page:
// walk GET /admin/products at per_page=200 until the last page. The fetch is
// shared across formats; only the writer differs.
async function exportProducts(format) {
  if (exporting.value) return
  exportMenuOpen.value = false
  exporting.value = true
  try {
    const { rows, truncated } = await fetchAllFiltered()
    // Apply the same client-side stock split as the table, so the file matches
    // exactly what the filters show.
    const matched = stockLevel.value
      ? rows.filter((row) => deriveStatus(row) === stockLevel.value)
      : rows

    if (!matched.length) {
      window.alert('There is nothing to export for the current filters.')
      return
    }

    const plain = matched.map(toPlainRow)
    if (format === 'csv') {
      downloadCsv(plain, EXPORT_COLUMNS, exportFileName('csv'))
    } else if (format === 'json') {
      downloadJson(plain, exportFileName('json'))
    } else {
      await writeXlsxExport(plain)
    }

    if (truncated) {
      window.alert(
        `Exported the first ${matched.length.toLocaleString()} products only — the export ` +
          `stops after ${EXPORT_MAX_PAGES} pages. Narrow the filters to export the rest.`,
      )
    }
  } catch (err) {
    console.error('Product export failed', err)
    window.alert(err.message || 'Unable to export products.')
  } finally {
    exporting.value = false
  }
}

function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}

/* ------------------------------------------------------------------ *
 * Import
 *
 * There is no import endpoint (docs/products-api-gaps.md), so parsing,
 * column mapping and validation all happen here and each accepted row is
 * created through POST /admin/products. Nothing is sent until the preview
 * is confirmed.
 * ------------------------------------------------------------------ */

const IMPORT_MAX_ROWS = 500

// Accepted header spellings per field. Headers are matched case-insensitively
// with non-alphanumerics collapsed, so "Product Name" == "product_name".
const IMPORT_FIELDS = [
  { key: 'name', headers: ['productname', 'name'], required: true },
  { key: 'sku', headers: ['sku'], required: true },
  { key: 'price', headers: ['price', 'unitprice', 'baseprice'], required: true },
  { key: 'category', headers: ['category', 'categoryname'], required: false },
  { key: 'categoryId', headers: ['categoryid'], required: false },
  { key: 'stock', headers: ['stock', 'stockquantity', 'quantity'], required: false },
  { key: 'minStockAlert', headers: ['minstockalert', 'lowstockthreshold'], required: false },
  { key: 'barcode', headers: ['barcode'], required: false },
  { key: 'costPrice', headers: ['costprice'], required: false },
  { key: 'salePrice', headers: ['saleprice'], required: false },
  { key: 'description', headers: ['description'], required: false },
]

function normaliseHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Minimal RFC-4180 reader: quoted fields, escaped quotes, CRLF or LF.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    row = []
  }

  // Strip a leading BOM (Excel writes one) without putting U+FEFF in the source.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') pushField()
    else if (char === '\r') continue
    else if (char === '\n') pushRow()
    else field += char
  }

  if (field !== '' || row.length) pushRow()
  return rows
}

const importInput = ref(null)
const importPreview = ref(null) // { fileName, rows, validCount, missing }
const importing = ref(false)
const importResult = ref(null) // { created, failures: [{name, message}] }

function pickImportFile() {
  importInput.value?.click()
}

function toNumber(value) {
  const cleaned = String(value ?? '').replace(/[$,\s]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// Category names resolve against the loaded dropdown options.
const categoryByName = computed(() => {
  const map = new Map()
  for (const category of categories.value) {
    map.set(normaliseHeader(category.name), category.id)
  }
  return map
})

function buildImportRow(record, index, seenSkus) {
  const errors = []
  const name = String(record.name ?? '').trim()
  const sku = String(record.sku ?? '').trim()
  const price = toNumber(record.price)

  if (!name) errors.push('Product name is required')
  if (!sku) errors.push('SKU is required')
  else if (!/^[A-Za-z0-9._-]+$/.test(sku)) errors.push('SKU may only contain letters, digits, dot, underscore and dash')
  else if (seenSkus.has(sku.toLowerCase())) errors.push('Duplicate SKU in this file')
  if (price == null) errors.push('Price must be a number')
  else if (price < 0) errors.push('Price cannot be negative')

  // category_id wins; otherwise resolve the name against the dropdown options.
  let resolvedCategoryId = toNumber(record.categoryId)
  const categoryName = String(record.category ?? '').trim()
  if (resolvedCategoryId == null && categoryName) {
    resolvedCategoryId = categoryByName.value.get(normaliseHeader(categoryName)) ?? null
    if (resolvedCategoryId == null) errors.push(`Unknown category "${categoryName}"`)
  } else if (resolvedCategoryId == null) {
    errors.push('Category is required')
  }

  if (sku) seenSkus.add(sku.toLowerCase())

  const stock = toNumber(record.stock)
  const minStockAlert = toNumber(record.minStockAlert)
  const costPrice = toNumber(record.costPrice)
  const salePrice = toNumber(record.salePrice)
  if (salePrice != null && price != null && salePrice > price) {
    errors.push('Sale price must be less than or equal to price')
  }

  const body = {
    category_id: resolvedCategoryId,
    name,
    sku,
    price: price ?? 0,
  }
  if (stock != null) body.stock_quantity = Math.max(0, Math.round(stock))
  if (minStockAlert != null) body.min_stock_alert = Math.max(0, Math.round(minStockAlert))
  if (costPrice != null) body.cost_price = costPrice
  if (salePrice != null) body.sale_price = salePrice
  if (String(record.barcode ?? '').trim()) body.barcode = String(record.barcode).trim()
  if (String(record.description ?? '').trim()) body.description = String(record.description).trim()

  return {
    line: index + 2, // +1 for the header row, +1 for 1-based lines
    name: name || '(no name)',
    sku,
    categoryName: categoryName || (resolvedCategoryId != null ? `#${resolvedCategoryId}` : '—'),
    stock: stock == null ? '—' : Math.max(0, Math.round(stock)),
    price: price == null ? '—' : currency.format(price),
    errors,
    body,
  }
}

async function onImportFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // let the same file be picked again
  if (!file) return

  try {
    const table = parseCsv(await file.text())
    if (table.length < 2) {
      window.alert('That file has no data rows. Download the template for the expected columns.')
      return
    }

    const headers = table[0].map(normaliseHeader)
    const columnFor = {}
    for (const field of IMPORT_FIELDS) {
      const index = headers.findIndex((header) => field.headers.includes(header))
      if (index !== -1) columnFor[field.key] = index
    }

    const missing = IMPORT_FIELDS.filter((f) => f.required && columnFor[f.key] === undefined).map(
      (f) => f.headers[0],
    )
    if (missing.length) {
      window.alert(`This file is missing required column(s): ${missing.join(', ')}.`)
      return
    }

    const seenSkus = new Set()
    const dataRows = table.slice(1, IMPORT_MAX_ROWS + 1)
    const rows = dataRows.map((cells, index) => {
      const record = {}
      for (const [key, column] of Object.entries(columnFor)) record[key] = cells[column]
      return buildImportRow(record, index, seenSkus)
    })

    importResult.value = null
    importPreview.value = {
      fileName: file.name,
      rows,
      validCount: rows.filter((row) => row.errors.length === 0).length,
      skipped: Math.max(0, table.length - 1 - dataRows.length),
    }
  } catch (err) {
    window.alert(err.message || 'Unable to read that file.')
  }
}

function closeImport() {
  if (importing.value) return
  importPreview.value = null
  importResult.value = null
}

// Header spellings the importer accepts, in the order the template writes them.
const IMPORT_TEMPLATE_COLUMNS = [
  { key: 'name', label: 'Product Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'stock', label: 'Stock' },
  { key: 'minStockAlert', label: 'Min Stock Alert' },
  { key: 'price', label: 'Price' },
  { key: 'costPrice', label: 'Cost Price' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'description', label: 'Description' },
]

function downloadImportTemplate() {
  // A real category name where one is loaded, so the sample row imports as-is.
  const sample = {
    name: 'Example Product',
    sku: 'EXAMPLE-001',
    category: categories.value[0]?.name ?? 'Category Name',
    stock: 25,
    minStockAlert: 5,
    price: '199.00',
    costPrice: '150.00',
    barcode: null,
    description: 'Optional description',
  }
  downloadCsv([sample], IMPORT_TEMPLATE_COLUMNS, 'products-import-template.csv')
}

// One POST per accepted row — there is no bulk create endpoint. Rows are sent
// sequentially so a mid-run failure leaves a clear boundary, and every failure
// is reported rather than aborting the run.
async function runImport() {
  const rows = (importPreview.value?.rows ?? []).filter((row) => row.errors.length === 0)
  if (!rows.length || importing.value) return

  importing.value = true
  const failures = []
  let created = 0

  try {
    for (const row of rows) {
      try {
        await apiFetch('/admin/products', {
          method: 'POST',
          token: auth.accessToken,
          body: row.body,
        })
        created += 1
      } catch (err) {
        const detail = Object.values(err.errors ?? {}).flat()[0]
        failures.push({ line: row.line, name: row.name, message: detail || err.message || 'Failed' })
      }
    }
  } finally {
    importing.value = false
    importResult.value = { created, failures }
    if (created) {
      invalidateStatusCache()
      await Promise.all([loadProducts(), loadSummary()])
    }
  }
}
</script>

<template>
  <div class="page">
    <AppHeader title="Products & Inventory" />

    <div class="page__body">
      <!-- Toolbar -->
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input v-model="search" type="search" placeholder="Search by Product Name, SKU, or Serial..." />
        </label>

        <div class="toolbar__actions">
          <Select v-model="categorySelection">
            <SelectTrigger
              :class="[TOOLBAR_SELECT.trigger, 'max-w-[190px]']"
              aria-label="Filter by category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent :class="TOOLBAR_SELECT.content">
              <SelectItem :value="ALL_CATEGORIES" :class="TOOLBAR_SELECT.item">
                All Categories
              </SelectItem>
              <SelectItem
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
                :class="TOOLBAR_SELECT.item"
              >
                {{ category.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="stockSelection">
            <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by stock level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent :class="TOOLBAR_SELECT.content">
              <SelectItem
                v-for="level in STOCK_LEVELS"
                :key="level.value"
                :value="level.value"
                :class="TOOLBAR_SELECT.item"
              >
                {{ level.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <input
            ref="importInput"
            type="file"
            accept=".csv,text/csv"
            class="visually-hidden"
            @change="onImportFileChange"
          />
          <BaseButton
            v-if="auth.hasPermission('products.create')"
            variant="ghost"
            :disabled="importing"
            @click="pickImportFile"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 15V3m0 0L8 7m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
              </svg>
            </template>
            Import
          </BaseButton>
          <div class="export" @click.stop @keydown.esc="closeExportMenu">
            <BaseButton
              variant="ghost"
              :disabled="exporting || loading || total === 0"
              aria-haspopup="menu"
              :aria-expanded="exportMenuOpen"
              @click="exportMenuOpen = !exportMenuOpen"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v12M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </template>
              {{ exporting ? 'Exporting…' : 'Export' }}
              <svg class="export__caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </BaseButton>

            <div v-if="exportMenuOpen" class="export__popup" role="menu">
              <button
                v-for="format in EXPORT_FORMATS"
                :key="format.value"
                type="button"
                class="export__item"
                role="menuitem"
                @click="exportProducts(format.value)"
              >
                {{ format.label }}
              </button>
            </div>
          </div>
          <BaseButton
            v-if="auth.hasPermission('products.create')"
            variant="primary"
            :to="{ name: 'product-create' }"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            Add Product
          </BaseButton>
        </div>
      </section>

      <!-- Stat cards -->
      <section class="stats">
        <article v-for="stat in stats" :key="stat.key" class="stat">
          <span class="stat__icon" :class="`stat__icon--${stat.tone}`" aria-hidden="true">
            <svg v-if="stat.icon === 'box'" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
              <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="stat.icon === 'warning'" viewBox="0 0 24 24" fill="none">
              <path d="M12 3 2 20h20L12 3Z" stroke-linejoin="round" />
              <path d="M12 10v4M12 17h.01" stroke-linecap="round" />
            </svg>
            <svg v-else-if="stat.icon === 'forbidden'" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" />
              <path d="m6 6 12 12" stroke-linecap="round" />
            </svg>
            <svg v-else-if="stat.icon === 'check'" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12 2.4 2.4 4.6-5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.4Z" stroke-linejoin="round" />
              <circle cx="8" cy="8" r="1.3" />
            </svg>
          </span>
          <div class="stat__meta">
            <p class="stat__label">{{ stat.label }}</p>
            <p class="stat__value">{{ stat.value }}</p>
          </div>
        </article>
      </section>

      <!-- The stock filter runs client-side; say so when it stopped early. -->
      <p v-if="filterTruncated" class="notice">
        Stock level was matched against the first {{ (EXPORT_PER_PAGE * EXPORT_MAX_PAGES).toLocaleString() }}
        products only. Add a search term or category to narrow the set.
      </p>

      <!-- Table -->
      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th class="table__check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>Product Details</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Price (Unit)</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="table__state">Loading products…</td>
            </tr>
            <tr v-else-if="error">
              <td colspan="7" class="table__state table__state--error">
                {{ error }}
                <button type="button" class="table__retry" @click="loadProducts">Retry</button>
              </td>
            </tr>
            <tr v-else-if="products.length === 0">
              <td colspan="7" class="table__state">
                {{ hasFilters ? 'No products match the current filters.' : 'No products found.' }}
              </td>
            </tr>
            <tr v-for="product in products" v-else :key="product.id">
              <td class="table__check">
                <input
                  type="checkbox"
                  :checked="selected.has(product.id)"
                  @change="toggleRow(product.id)"
                />
              </td>
              <td>
                <div class="product">
                  <span class="product__thumb" aria-hidden="true">
                    <img
                      v-if="product.thumbnail && !brokenThumbs.has(product.id)"
                      :src="product.thumbnail"
                      alt=""
                      loading="lazy"
                      @error="onThumbError(product.id)"
                    />
                    <template v-else>{{ thumbInitials(product.name) }}</template>
                  </span>
                  <div class="product__meta">
                    <p class="product__name">{{ product.name }}</p>
                    <p class="product__sku">SKU: {{ product.sku }}</p>
                  </div>
                </div>
              </td>
              <td><span class="badge badge--category">{{ product.category }}</span></td>
              <td>
                <p class="stock__count">{{ product.stock }} pcs</p>
              </td>
              <td class="price">{{ product.price }}</td>
              <td>
                <span class="badge" :class="`badge--${product.status}`">
                  {{ statusLabels[product.status] }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    title="View product"
                    aria-label="View product"
                    @click="viewProduct(product)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    v-if="auth.hasPermission('products.update')"
                    type="button"
                    class="icon-btn"
                    title="Edit product"
                    aria-label="Edit product"
                    @click="editProduct(product)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                      <path d="M13.5 6.5l3 3" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    v-if="auth.hasPermission('products.create')"
                    type="button"
                    class="icon-btn"
                    title="Duplicate product"
                    aria-label="Duplicate product"
                    :disabled="duplicatingId !== null"
                    @click="duplicateProduct(product)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h8" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    v-if="auth.hasPermission('products.delete')"
                    type="button"
                    class="icon-btn icon-btn--danger"
                    title="Delete product"
                    aria-label="Delete product"
                    @click="deleteProduct(product)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <footer class="pagination">
          <p class="pagination__info">
            Showing {{ rangeStart }}-{{ rangeEnd }} of {{ total.toLocaleString() }} products
          </p>
          <div class="pagination__controls">
            <button type="button" class="page-btn" :disabled="page <= 1 || loading" @click="prevPage">
              Previous
            </button>
            <button type="button" class="page-btn page-btn--active">{{ page }}</button>
            <button
              type="button"
              class="page-btn"
              :disabled="page >= lastPage || loading"
              @click="nextPage"
            >
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- Import preview -->
    <div v-if="importPreview" class="modal" role="dialog" aria-modal="true" aria-label="Import products">
      <div class="modal__backdrop" @click="closeImport"></div>
      <div class="modal__panel">
        <header class="modal__head">
          <div>
            <h2 class="modal__title">Import products</h2>
            <p class="modal__sub">{{ importPreview.fileName }}</p>
          </div>
          <button type="button" class="modal__close" aria-label="Close" @click="closeImport">
            <svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" /></svg>
          </button>
        </header>

        <div class="modal__body">
          <!-- Result view, shown after the run -->
          <template v-if="importResult">
            <p class="import-summary">
              <strong>{{ importResult.created.toLocaleString() }}</strong> product(s) created.
              <template v-if="importResult.failures.length">
                <strong>{{ importResult.failures.length }}</strong> failed.
              </template>
            </p>
            <ul v-if="importResult.failures.length" class="import-errors">
              <li v-for="failure in importResult.failures" :key="failure.line">
                Line {{ failure.line }} — {{ failure.name }}: {{ failure.message }}
              </li>
            </ul>
          </template>

          <!-- Preview view -->
          <template v-else>
            <p class="import-summary">
              <strong>{{ importPreview.validCount.toLocaleString() }}</strong> of
              {{ importPreview.rows.length.toLocaleString() }} row(s) ready to import.
              <span v-if="importPreview.validCount < importPreview.rows.length">
                Rows with errors are skipped.
              </span>
              <span v-if="importPreview.skipped">
                Only the first {{ IMPORT_MAX_ROWS.toLocaleString() }} rows are read
                ({{ importPreview.skipped.toLocaleString() }} ignored).
              </span>
            </p>

            <div class="modal__scroll">
              <table class="table table--compact">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in importPreview.rows" :key="row.line">
                    <td>{{ row.line }}</td>
                    <td>{{ row.name }}</td>
                    <td>{{ row.sku || '—' }}</td>
                    <td>{{ row.categoryName }}</td>
                    <td>{{ row.stock }}</td>
                    <td>{{ row.price }}</td>
                    <td>
                      <span v-if="!row.errors.length" class="badge badge--in-stock">Ready</span>
                      <span v-else class="import-row-errors">{{ row.errors.join('; ') }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <footer class="modal__foot">
          <BaseButton variant="ghost" size="sm" @click="downloadImportTemplate">
            Download template
          </BaseButton>
          <div class="modal__foot-actions">
            <BaseButton variant="subtle" :disabled="importing" @click="closeImport">
              {{ importResult ? 'Close' : 'Cancel' }}
            </BaseButton>
            <BaseButton
              v-if="!importResult"
              variant="primary"
              :disabled="importing || importPreview.validCount === 0"
              @click="runImport"
            >
              {{ importing ? 'Importing…' : `Import ${importPreview.validCount} product(s)` }}
            </BaseButton>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

/* Stat cards */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;

    svg {
      width: 20px;
      height: 20px;
      stroke-width: 1.8;
    }

    &--neutral {
      background: var(--bg);
      color: var(--text-muted);
      svg { stroke: currentColor; }
    }
    &--warning {
      background: rgb(var(--accent-rgb) / 0.16);
      color: var(--accent-ink);
      svg { stroke: currentColor; }
    }
    &--danger {
      background: var(--danger-bg);
      color: var(--danger);
      svg { stroke: currentColor; }
    }
    &--success {
      background: var(--success-bg);
      color: var(--success);
      svg { stroke: currentColor; }
    }
  }

  &__label {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-subtle);
  }

  &__value {
    margin: 0.15rem 0 0;
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--text-strong);
  }
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within {
      background: var(--surface);
      border-color: var(--border);
    }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
    flex-wrap: wrap;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    &:focus { outline: none; }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }

  &--ghost {
    background: var(--surface);
    border-color: var(--border);
    color: var(--text-body);
    &:hover { background: var(--surface-alt); }
  }
  &--primary {
    background: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
    &:hover { filter: brightness(0.96); border-color: transparent; }
  }
}

/* Export format menu — anchored to the trigger so it drops directly beneath it. */
.export {
  position: relative;

  &__caret {
    width: 14px;
    height: 14px;
    margin-left: 0.1rem;
    stroke: currentColor;
    stroke-width: 1.8;
    opacity: 0.7;
  }

  &__popup {
    position: absolute;
    top: calc(100% + 6px);
    /* Right-aligned: the trigger sits near the end of the toolbar, so a
       left-anchored popup would hang off the edge on narrow screens. */
    right: 0;
    z-index: 20;
    min-width: 168px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(20, 23, 28, 0.12);
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
  }

  &__item {
    width: 100%;
    padding: 0.55rem 0.6rem;
    font-size: 0.84rem;
    font-weight: 500;
    font-family: inherit;
    text-align: left;
    color: var(--text-body);
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
    &:hover { background: var(--surface-alt); }
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.notice {
  margin: 0;
  padding: 0.7rem 1rem;
  font-size: 0.8rem;
  color: var(--accent-ink);
  background: rgb(var(--accent-rgb) / 0.12);
  border: 1px solid rgb(var(--accent-rgb) / 0.4);
  border-radius: 10px;
}

/* Import modal */
.modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: var(--backdrop);
  }

  &__panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(920px, 100%);
    max-height: min(80vh, 720px);
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 18px 50px rgba(20, 24, 31, 0.2);
    overflow: hidden;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__sub {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    color: var(--text-subtle);
  }

  &__close {
    display: inline-flex;
    padding: 0.35rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--bg); color: var(--text-strong); }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__body {
    padding: 1.1rem 1.25rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-height: 0;
  }

  &__scroll {
    overflow: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1.25rem;
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
    flex-wrap: wrap;
  }

  &__foot-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }
}

.import-summary {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-body);

  strong { color: var(--text-strong); }
}

.import-errors {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  color: var(--danger);
  overflow: auto;

  li + li { margin-top: 0.25rem; }
}

.import-row-errors {
  font-size: 0.75rem;
  color: var(--danger);
}

/* Table */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: visible;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1rem;
    vertical-align: middle;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  &__check { width: 44px; }
  /* Needs the element in the selector: `.table th` above is (0,1,1) and would
     otherwise outrank a bare class and keep the label left of its icons. */
  th#{&}__actions-head { text-align: center; }

  /* Import preview: denser rows, header pinned while the list scrolls. */
  &--compact {
    th, td { padding: 0.55rem 0.7rem; font-size: 0.8rem; }
    thead th { position: sticky; top: 0; z-index: 1; }
  }

  &__state {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;

    &--error { color: var(--danger); }
  }

  &__retry {
    margin-left: 0.6rem;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: var(--surface-alt); }
  }

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: rgb(var(--accent-rgb));
    cursor: pointer;
  }
}

.product {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    flex-shrink: 0;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__name {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--accent-ink);
  }

  &__sku {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;

  &--category {
    background: var(--surface-track);
    color: var(--text-muted);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }
  &--in-stock { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}

.stock {
  &__count { margin: 0; font-size: 0.88rem; font-weight: 600; color: var(--text-strong); }
}

.price { font-size: 0.9rem; font-weight: 600; color: var(--text-strong); }

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--surface-alt); color: var(--text-strong); border-color: var(--border); }

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &--danger:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;

  &__info { margin: 0; font-size: 0.82rem; color: var(--text-subtle); }
  &__controls { display: flex; gap: 0.4rem; }
}

.page-btn {
  min-width: 36px;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--surface-alt); }

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &--active {
    background: rgb(var(--accent-rgb));
    border-color: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
  }
}
</style>
