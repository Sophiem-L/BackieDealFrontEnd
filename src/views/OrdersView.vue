<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const route = useRoute()
const auth = useAuthStore()

/* ---------------------------------------------------------------------------
 * "Just created" highlight
 *
 * OrderCreateView redirects here with ?created=<uuid>. The list is sorted
 * newest-first so that order is the top row; this flags it briefly so the
 * result of the save is obvious. The query is dropped from the URL straight
 * away so a refresh does not highlight it again.
 * ------------------------------------------------------------------------- */
const HIGHLIGHT_MS = 6000
const justCreatedId = ref(String(route.query.created ?? ''))
let highlightTimer

onMounted(() => {
  if (!justCreatedId.value) return

  router.replace({ name: 'orders' })
  highlightTimer = setTimeout(() => {
    justCreatedId.value = ''
  }, HIGHLIGHT_MS)
})

onBeforeUnmount(() => clearTimeout(highlightTimer))

// Customer orders are always scoped to one of four calendar periods — there is
// no unscoped "all dates" view. Daily is the default because the page exists to
// answer "what came in today"; widen to Yearly to reach older orders.
const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]
const DEFAULT_PERIOD = 'daily'

const activeTab = ref('all')
const search = ref('')
const periodFilter = ref(DEFAULT_PERIOD)

/* ---------------------------------------------------------------------------
 * Server data — GET /admin/orders
 *
 * The endpoint returns { items, pagination, filters } so paging, search,
 * status counts and the month list are all driven by the server. One request
 * per page; no client-side slicing.
 * ------------------------------------------------------------------------- */
const PER_PAGE = 10
const EXPORT_PAGE_SIZE = 200
const EXPORT_MAX_PAGES = 25

const orders = ref([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const statusCounts = ref({})
const loading = ref(false)
const error = ref('')
const exportTruncated = ref(false)

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const PAYMENT_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
  stripe: 'Card (Stripe)',
  paypal: 'PayPal',
}

function statusLabel(status) {
  if (!status) return '—'
  return String(status)
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// 'YYYY-MM-DD' from the date's *local* fields. toISOString() would shift the
// day backwards for anyone east of UTC, dropping today's orders from "Daily".
function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// The inclusive date range the API filters on, as the calendar period
// containing `today`: this day, this Mon–Sun week, this month, this year.
function periodRange(period, today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  switch (period) {
    case 'weekly': {
      // getDay() is 0 for Sunday, which belongs to the week that began 6 days
      // earlier rather than starting a new one.
      const offset = (today.getDay() + 6) % 7
      return {
        from: toIsoDate(new Date(year, month, day - offset)),
        to: toIsoDate(new Date(year, month, day - offset + 6)),
      }
    }
    case 'monthly':
      // Day 0 of the next month is the last day of this one.
      return {
        from: toIsoDate(new Date(year, month, 1)),
        to: toIsoDate(new Date(year, month + 1, 0)),
      }
    case 'yearly':
      return {
        from: toIsoDate(new Date(year, 0, 1)),
        to: toIsoDate(new Date(year, 11, 31)),
      }
    default: {
      const iso = toIsoDate(today)
      return { from: iso, to: iso }
    }
  }
}

function formatMoney(value, code) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  if (!code || code === 'USD') return currency.format(amount)
  // Unknown/other currency: let Intl try, falling back to a plain suffix.
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

function mapOrder(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : []
  const parsed = raw?.created_at ? new Date(raw.created_at) : null
  const placedAtDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
  const method = raw?.payment?.method

  return {
    // Route binding is by uuid, and the resource's `id` *is* the uuid.
    id: String(raw?.id ?? ''),
    reference: raw?.order_number || (raw?.id ? `#${String(raw.id).slice(0, 8).toUpperCase()}` : '—'),
    placedAtDate,
    placedAt: placedAtDate ? dateTimeFormat.format(placedAtDate) : '—',
    customer: raw?.customer?.name || raw?.customer?.email || '—',
    item:
      items.length === 0
        ? '—'
        : items.length === 1
          ? (items[0]?.product?.name ?? '—')
          : `${items.length} items`,
    spec:
      items.map((i) => `${i?.qty ?? 0} × ${i?.product?.name ?? 'Unknown product'}`).join(', ') ||
      '—',
    payment: method ? (PAYMENT_METHOD_LABELS[method] ?? statusLabel(method)) : '—',
    paymentIcon: method === 'stripe' || method === 'paypal' ? 'qr' : 'card',
    paymentStatus: raw?.payment?.status ? statusLabel(raw.payment.status) : '',
    amount: formatMoney(raw?.total, raw?.currency),
    status: raw?.status ?? 'unknown',
  }
}

// Query string shared by the list request and the export request.
function buildQuery({ page: p, perPage }) {
  const params = new URLSearchParams({ page: String(p), per_page: String(perPage) })
  if (activeTab.value !== 'all') params.set('status', activeTab.value)
  const q = search.value.trim()
  if (q) params.set('q', q)
  // A period is always selected, so every request carries a date range.
  const { from, to } = periodRange(periodFilter.value)
  params.set('date_from', from)
  params.set('date_to', to)
  return params.toString()
}

// Guards against an earlier slow response overwriting a newer one.
let requestId = 0

async function loadOrders() {
  const id = ++requestId
  loading.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/admin/orders?${buildQuery({ page: page.value, perPage: PER_PAGE })}`, {
      token: auth.accessToken,
    })
    if (id !== requestId) return

    const data = response?.data ?? {}
    orders.value = (data.items ?? []).map(mapOrder)
    // Ids from the previous result set no longer refer to visible rows.
    clearSelection()

    const pagination = data.pagination ?? {}
    total.value = pagination.total ?? orders.value.length
    lastPage.value = Math.max(1, pagination.last_page ?? 1)

    const filters = data.filters ?? {}
    statusCounts.value = filters.status_counts ?? {}

    // A deletion can empty the last page; step back onto a page with rows.
    if (orders.value.length === 0 && page.value > lastPage.value) {
      page.value = lastPage.value
      await loadOrders()
    }
  } catch (err) {
    if (id !== requestId) return
    error.value = err.message || 'Unable to load orders. Please try again.'
    orders.value = []
    total.value = 0
    lastPage.value = 1
    statusCounts.value = {}
  } finally {
    if (id === requestId) loading.value = false
  }
}

onMounted(loadOrders)

// The canonical order statuses — the only four the UI offers. Matches the
// dropdown in OrderDetailView and is enforced server-side by
// Store/UpdateOrderRequest. Tabs always show all four, even at zero, so the
// filter bar does not reshuffle as data changes.
const ORDER_STATUSES = [
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const tabs = computed(() => {
  const counts = statusCounts.value ?? {}
  // "All" sums every count the API reports, so the total stays honest even if a
  // legacy row carries a status outside the four.
  const scopedTotal = Object.values(counts).reduce((sum, n) => sum + Number(n ?? 0), 0)

  return [
    { key: 'all', label: 'All Orders', count: scopedTotal },
    ...ORDER_STATUSES.map((status) => ({
      ...status,
      count: Number(counts[status.key] ?? 0),
    })),
  ]
})

/* ---------------------------------------------------------------------------
 * Empty-state wording
 *
 * A period is always applied, so an empty table almost never means "no orders
 * exist" — it means "none in the selected period". A bare "No orders" next to a
 * Daily filter reads as a broken filter on any quiet day, so name the period
 * and offer the widest one as the way out.
 * ------------------------------------------------------------------------- */

// Ranges are built by toIsoDate() from local fields, so parse back to local
// ones — new Date('2026-08-04') would be parsed as UTC and shift the day.
function parseIsoDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const dayNoYearFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const monthOnlyFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

// The selected period as a readable span: 'Aug 4, 2026', 'Aug 3 – Aug 9, 2026',
// 'August 2026', '2026'.
const periodSpanLabel = computed(() => {
  const { from, to } = periodRange(periodFilter.value)
  const start = parseIsoDate(from)

  switch (periodFilter.value) {
    case 'weekly':
      return `${dayNoYearFormat.format(start)} – ${dayFormat.format(parseIsoDate(to))}`
    case 'monthly':
      return monthOnlyFormat.format(start)
    case 'yearly':
      return String(start.getFullYear())
    default:
      return dayFormat.format(start)
  }
})

// Status and search narrow the result set on top of the period.
const hasNarrowingFilters = computed(() => activeTab.value !== 'all' || search.value.trim() !== '')

const emptyMessage = computed(() =>
  hasNarrowingFilters.value
    ? `No orders match your filters in ${periodSpanLabel.value}.`
    : `No orders in ${periodSpanLabel.value}.`,
)

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PER_PAGE + 1))
const rangeEnd = computed(() => (page.value - 1) * PER_PAGE + orders.value.length)

// Filter changes restart at page 1 and refetch. Page state is not watched —
// goToPage triggers the load itself, so a reset never fires two requests.
function resetAndLoad() {
  page.value = 1
  loadOrders()
}

watch([activeTab, periodFilter], resetAndLoad)

let searchTimer
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(resetAndLoad, 350)
})

// The selected status can vanish from the counts (month filter changed, last
// order of that status deleted). Fall back to "all" rather than showing nothing.
watch(tabs, (list) => {
  if (!loading.value && !list.some((tab) => tab.key === activeTab.value)) activeTab.value = 'all'
})

// Page buttons: every page when the range is short, otherwise first/last plus a
// window around the current page with '…' standing in for the gaps.
const pageItems = computed(() => {
  const last = lastPage.value
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)

  const items = [1]
  const start = Math.max(2, page.value - 1)
  const end = Math.min(last - 1, page.value + 1)
  if (start > 2) items.push('…')
  for (let i = start; i <= end; i += 1) items.push(i)
  if (end < last - 1) items.push('…')
  items.push(last)
  return items
})

function goToPage(target) {
  const next = Math.min(Math.max(1, target), lastPage.value)
  if (next === page.value) return
  page.value = next
  loadOrders()
}
function prevPage() {
  goToPage(page.value - 1)
}
function nextPage() {
  goToPage(page.value + 1)
}

// Actions — `id` is the order uuid, which is what the API routes bind on.
function viewOrder(order) {
  router.push({ name: 'order-detail', params: { id: order.id } })
}
function editOrder(order) {
  router.push({
    name: 'order-detail',
    params: { id: order.id },
    query: { edit: '1' },
  })
}

/* ---------------------------------------------------------------------------
 * Row selection + bulk delete
 *
 * Keyed by uuid. The selection is cleared whenever the visible rows change
 * (page, filter, refetch) because ids from a previous page are meaningless.
 * ------------------------------------------------------------------------- */
const selected = ref(new Set())
const bulkDeleting = ref(false)

const allSelected = computed(
  () => orders.value.length > 0 && selected.value.size === orders.value.length,
)

function toggleRow(id) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(orders.value.map((o) => o.id))
}

function clearSelection() {
  if (selected.value.size) selected.value = new Set()
}

// There is no bulk endpoint, so this fans out one DELETE per order and reports
// how many failed rather than silently dropping errors.
async function deleteSelected() {
  const ids = [...selected.value]
  if (ids.length === 0 || bulkDeleting.value) return

  const label = ids.length === 1 ? 'this order' : `these ${ids.length} orders`
  if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return

  bulkDeleting.value = true
  try {
    const results = await Promise.allSettled(
      ids.map((id) =>
        apiFetch(`/admin/orders/${id}`, { method: 'DELETE', token: auth.accessToken }),
      ),
    )
    const failed = results.filter((r) => r.status === 'rejected')

    // Refetch either way — some may have succeeded before others failed.
    await loadOrders()

    if (failed.length) {
      const reason = failed[0].reason?.message || 'Unknown error'
      window.alert(
        `${failed.length} of ${ids.length} orders could not be deleted.\nFirst error: ${reason}`,
      )
    }
  } finally {
    bulkDeleting.value = false
  }
}

const deleting = ref('')

async function deleteOrder(order) {
  if (!window.confirm(`Delete order ${order.reference}? This action cannot be undone.`)) return

  deleting.value = order.id
  try {
    await apiFetch(`/admin/orders/${order.id}`, {
      method: 'DELETE',
      token: auth.accessToken,
    })
    // Refetch so the page backfills from the server and the counts stay right.
    await loadOrders()
  } catch (err) {
    window.alert(err.message || 'Could not delete this order. Please try again.')
  } finally {
    deleting.value = ''
  }
}
const printing = ref('')

// The row only holds display strings, so the invoice is built from a fresh
// fetch — that is where the totals breakdown, phone and address live.
async function printOrder(order) {
  if (printing.value) return

  printing.value = order.id
  try {
    const response = await apiFetch(`/admin/orders/${order.id}`, { token: auth.accessToken })
    const { printOrderDocument } = await import('@/services/printOrder')
    await printOrderDocument(response?.data ?? {})
  } catch (err) {
    window.alert(err.message || 'Could not prepare this invoice for printing.')
  } finally {
    printing.value = ''
  }
}

/* ---------------------------------------------------------------------------
 * Excel export
 *
 * Palette is lifted from the page's own SCSS so the sheet reads as part of the
 * same product rather than a generic dump.
 * ------------------------------------------------------------------------- */
const XL_HEADER_FILL = '#F4C10F'
const XL_HEADER_TEXT = '#1F242D'
const XL_ZEBRA_FILL = '#FAFBFC'
const XL_TOTAL_FILL = '#F4F5F7'
const XL_GRID = '#E6E8EC'
const XL_RULE = '#C9CDD4'

// Mirrors the on-screen status badge colours; anything unexpected stays default.
const XL_STATUS_TEXT = {
  pending: '#B8890B',
  processing: '#A8780A',
  completed: '#1F9D57',
  cancelled: '#D14343',
}

const EXPORT_COLUMNS = [
  { key: 'reference', label: 'Order ID', width: 14 },
  { key: 'placedAt', label: 'Placed At', width: 24, format: 'mmm d, yyyy h:mm AM/PM' },
  { key: 'customer', label: 'Customer', width: 20 },
  { key: 'item', label: 'Item', width: 24 },
  { key: 'spec', label: 'Specification', width: 38 },
  { key: 'payment', label: 'Payment', width: 22 },
  { key: 'amount', label: 'Amount', width: 15, align: 'right', format: '$#,##0.00' },
  { key: 'status', label: 'Status', width: 14, align: 'center' },
]

// '$4,299.00' -> 4299 so Excel can sum and sort the column. Returns null for a
// missing amount so the cell stays blank instead of reading as a real $0.00.
function amountValue(amount) {
  const cleaned = String(amount ?? '').replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// The writer derives the Excel serial from the date's UTC fields, so a local
// 10:30 AM in UTC+7 would otherwise be written as 3:30 AM. Shifting by the
// offset makes the UTC fields match the wall-clock time the table shows.
function toExcelDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
}

// e.g. orders-pending-daily-2026-08-04.xlsx — the range is in the name because
// two exports of the same period taken on different days differ in content.
function exportFileName(extension) {
  const { from } = periodRange(periodFilter.value)
  return `orders-${activeTab.value}-${periodFilter.value}-${from}.${extension}`
}

const exporting = ref(false)

/* ---------------------------------------------------------------------------
 * Export format menu
 *
 * All three formats export the same rows and the same eight columns; only the
 * writer differs, so the menu picks a writer rather than a different query.
 * ------------------------------------------------------------------------- */
const EXPORT_FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
]

const exportMenuOpen = ref(false)

function closeExportMenu() {
  exportMenuOpen.value = false
}

onMounted(() => document.addEventListener('click', closeExportMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeExportMenu))

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

// Builds the styled sheet: a filled header band, zebra-striped rows and a bold
// totals row. Exported shape is [row][cell] as write-excel-file expects.
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

  const body = rows.map((order, index) => {
    // Stripe every other row so long rows stay easy to track across.
    const base = bodyCellBase(index % 2 === 1 ? XL_ZEBRA_FILL : undefined)

    return EXPORT_COLUMNS.map((c) => {
      const cell = { ...base, align: c.align ?? 'left' }

      if (c.key === 'amount') {
        const amount = amountValue(order.amount)
        // A null value would still need a type; emit a blank string instead.
        return amount === null
          ? { ...cell, type: String, value: '' }
          : { ...cell, type: Number, format: c.format, value: amount }
      }
      if (c.key === 'placedAt') {
        const date = toExcelDate(order.placedAtDate)
        return date
          ? { ...cell, type: Date, format: c.format, value: date }
          : { ...cell, type: String, value: order.placedAt ?? '' }
      }
      if (c.key === 'status') {
        return {
          ...cell,
          type: String,
          value: statusLabel(order.status),
          textColor: XL_STATUS_TEXT[order.status],
          fontWeight: 'bold',
        }
      }
      return { ...cell, type: String, value: order[c.key] ?? '' }
    })
  })

  // Rounded so float drift doesn't store 6071.469999999999 in the cell.
  const total =
    Math.round(rows.reduce((sum, order) => sum + (amountValue(order.amount) ?? 0), 0) * 100) / 100
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
      value: `Total — ${rows.length} order${rows.length === 1 ? '' : 's'}`,
      align: 'left',
      columnSpan: 2,
    },
    null,
    ...EXPORT_COLUMNS.slice(2).map((c) =>
      c.key === 'amount'
        ? { ...totalBase, type: Number, format: c.format, value: total, align: 'right' }
        : { ...totalBase, type: String, value: '' },
    ),
  ]

  return [header, ...body, totalRow]
}

/* ---------------------------------------------------------------------------
 * CSV / JSON rows
 *
 * The same eight columns as the workbook, but carrying values a parser can use:
 * a formatted '$4,299.00' and a localised 'Aug 4, 2026 10:30 AM' do not survive
 * being read back by another tool. No totals row — that is a reading aid.
 * ------------------------------------------------------------------------- */

// 'YYYY-MM-DDTHH:MM:SS' from the date's local fields, matching the wall-clock
// time the table shows. Deliberately not toISOString(), which would shift it.
function toIsoDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${toIsoDate(date)}T${time}`
}

function toPlainRow(order) {
  return {
    reference: order.reference,
    // Falls back to the display string if the date failed to parse, so the
    // cell is never silently empty.
    placedAt: toIsoDateTime(order.placedAtDate) ?? order.placedAt ?? null,
    customer: order.customer,
    item: order.item,
    spec: order.spec,
    payment: order.payment,
    // null rather than 0 for a missing amount — the two must not look alike.
    amount: amountValue(order.amount),
    status: statusLabel(order.status),
  }
}

// The table only holds the current page, so the export refetches every row
// matching the active filters. last_page makes this an exact loop rather than a
// guess — usually a single request.
async function fetchAllMatchingOrders() {
  const rows = []
  exportTruncated.value = false

  for (let p = 1; p <= EXPORT_MAX_PAGES; p += 1) {
    const response = await apiFetch(
      `/admin/orders?${buildQuery({ page: p, perPage: EXPORT_PAGE_SIZE })}`,
      { token: auth.accessToken },
    )
    const data = response?.data ?? {}
    rows.push(...(data.items ?? []))

    const last = Math.max(1, data.pagination?.last_page ?? 1)
    if (p >= last) return rows.map(mapOrder)
    if (p === EXPORT_MAX_PAGES) exportTruncated.value = true
  }

  return rows.map(mapOrder)
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
      sheet: 'Orders',
      columns: EXPORT_COLUMNS.map((c) => ({ width: c.width })),
      // Keep the header band visible while scrolling long exports.
      stickyRowsCount: 1,
    },
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toFile(exportFileName('xlsx'))
}

// Export every order matching the current filters in the chosen format. The
// fetch is shared; only the writer differs.
async function exportOrders(format) {
  if (exporting.value) return
  exportMenuOpen.value = false
  exporting.value = true
  try {
    const rows = await fetchAllMatchingOrders()
    if (rows.length === 0) {
      window.alert('There are no orders to export for the current filters.')
      return
    }

    if (format === 'csv') {
      downloadCsv(rows.map(toPlainRow), EXPORT_COLUMNS, exportFileName('csv'))
    } else if (format === 'json') {
      downloadJson(rows.map(toPlainRow), exportFileName('json'))
    } else {
      await writeXlsxExport(rows)
    }

    if (exportTruncated.value) {
      window.alert(
        `The export was capped at ${rows.length.toLocaleString()} rows. Narrow the filters to export the rest.`,
      )
    }
  } catch (err) {
    console.error('Order export failed', err)
    window.alert('Sorry, the export could not be generated. Please try again.')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader title="Orders Management" />

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
          <input
            v-model="search"
            type="search"
            placeholder="Search by Order ID, Customer, or Product..."
          />
        </label>

        <Select v-model="activeTab">
          <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter status">
            <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
            </svg>
            <SelectValue />
          </SelectTrigger>
          <SelectContent :class="TOOLBAR_SELECT.content">
            <SelectItem
              v-for="tab in tabs"
              :key="tab.key"
              :value="tab.key"
              :class="TOOLBAR_SELECT.item"
            >
              {{ tab.key === 'all' ? 'All Statuses' : tab.label }} ({{ tab.count }})
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="periodFilter">
          <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by period">
            <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" stroke-linecap="round" />
            </svg>
            <SelectValue />
          </SelectTrigger>
          <SelectContent :class="TOOLBAR_SELECT.content">
            <SelectItem
              v-for="opt in PERIODS"
              :key="opt.value"
              :value="opt.value"
              :class="TOOLBAR_SELECT.item"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="export" @click.stop @keydown.esc="closeExportMenu">
          <BaseButton
            variant="ghost"
            :disabled="total === 0 || loading || exporting"
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
              @click="exportOrders(format.value)"
            >
              {{ format.label }}
            </button>
          </div>
        </div>

        <BaseButton variant="primary" :to="{ name: 'order-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          Create New Order
        </BaseButton>
      </section>

      <!-- Table card with status tabs -->
      <section class="table-card">
        <header class="tabs">
          <nav class="tabs__list">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="tabs__tab"
              :class="{ 'is-active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              {{ tab.label }} ({{ tab.count }})
            </button>
          </nav>
        </header>

        <!-- Bulk actions, shown only while rows are selected -->
        <div v-if="selected.size > 0" class="bulkbar">
          <p class="bulkbar__count">
            {{ selected.size }} order{{ selected.size === 1 ? '' : 's' }} selected
          </p>
          <div class="bulkbar__actions">
            <button type="button" class="bulkbar__clear" @click="clearSelection">Clear</button>
            <button
              type="button"
              class="bulkbar__delete"
              :disabled="bulkDeleting"
              @click="deleteSelected"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18" stroke-linecap="round" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke-linecap="round" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ bulkDeleting ? 'Deleting…' : `Delete selected (${selected.size})` }}
            </button>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th class="table__check">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :disabled="orders.length === 0"
                  aria-label="Select all orders on this page"
                  @change="toggleAll"
                />
              </th>
              <th>Order ID</th>
              <th>Items &amp; Specs</th>
              <th>Payment</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in orders"
              :key="order.id"
              :class="{
                'is-selected': selected.has(order.id),
                'is-new': order.id === justCreatedId,
              }"
            >
              <td class="table__check">
                <input
                  type="checkbox"
                  :checked="selected.has(order.id)"
                  :aria-label="`Select order ${order.reference}`"
                  @change="toggleRow(order.id)"
                />
              </td>
              <td>
                <p class="order__id" :title="order.id">
                  {{ order.reference }}
                  <span v-if="order.id === justCreatedId" class="new-flag">New</span>
                </p>
              </td>
              <td>
                <!-- Truncated to one line; the full list is in the tooltip. -->
                <p class="item__spec" :title="order.spec">{{ order.spec }}</p>
              </td>
              <td>
                <div class="payment">
                  <span class="payment__icon" aria-hidden="true">
                    <svg v-if="order.paymentIcon === 'qr'" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3M21 21v.01M17 21h.01M21 17v.01" stroke-linecap="round" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none">
                      <rect x="2.5" y="5" width="19" height="14" rx="2" />
                      <path d="M2.5 9.5h19" stroke-linecap="round" />
                    </svg>
                  </span>
                  <span class="payment__label">{{ order.payment }}</span>
                </div>
              </td>
              <td class="amount">{{ order.amount }}</td>
              <td>
                <span class="badge" :class="`badge--${order.status}`">
                  {{ statusLabel(order.status) }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    title="View order"
                    aria-label="View order"
                    @click="viewOrder(order)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    title="Edit order"
                    aria-label="Edit order"
                    @click="editOrder(order)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 20h9" stroke-linecap="round" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    :title="printing === order.id ? 'Preparing invoice…' : 'Print order'"
                    aria-label="Print order"
                    :disabled="printing === order.id"
                    @click="printOrder(order)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M6 9V3h12v6" stroke-linejoin="round" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" stroke-linejoin="round" />
                      <rect x="6" y="14" width="12" height="7" rx="1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    title="Delete order"
                    aria-label="Delete order"
                    :disabled="deleting === order.id"
                    @click="deleteOrder(order)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18" stroke-linecap="round" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke-linecap="round" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M10 11v6M14 11v6" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="loading">
              <td colspan="7" class="table__empty">Loading orders…</td>
            </tr>
            <tr v-else-if="error">
              <td colspan="7" class="table__empty table__empty--error">
                {{ error }}
                <button type="button" class="retry-btn" @click="loadOrders">Retry</button>
              </td>
            </tr>
            <tr v-else-if="orders.length === 0">
              <td colspan="7" class="table__empty">{{ emptyMessage }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <footer class="pagination">
          <p class="pagination__info">
            Showing {{ rangeStart }} to {{ rangeEnd }} of {{ total }} orders
          </p>
          <div class="pagination__controls">
            <button type="button" class="page-btn" :disabled="page <= 1" @click="prevPage">
              Previous
            </button>
            <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
              <span v-if="item === '…'" class="page-ellipsis">…</span>
              <button
                v-else
                type="button"
                class="page-btn"
                :class="{ 'page-btn--active': item === page }"
                :aria-current="item === page ? 'page' : undefined"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
            </template>
            <button type="button" class="page-btn" :disabled="page >= lastPage" @click="nextPage">
              Next
            </button>
          </div>
        </footer>
      </section>
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

  /* The only growing item in the row, so it absorbs all the free space and
     pushes the filters and buttons into one group against the right edge. */
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
    /* Right-aligned: the trigger sits at the end of the toolbar, so a
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

/* Table card */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: visible;
}

/* Status tabs */
.tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 1rem 0;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;

  &__list {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  &__tab {
    position: relative;
    padding: 0.7rem 0.85rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-subtle);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;

    &:hover { color: var(--text-strong); }

    &.is-active {
      color: var(--text-strong);
      border-bottom-color: rgb(var(--accent-rgb));
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding-bottom: 0.5rem;
  }

  &__count { font-size: 0.78rem; color: var(--text-subtle); }

  &__nav { display: flex; gap: 0.3rem; }
}

/* Bulk action bar */
.bulkbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.7rem 1rem;
  background: rgb(var(--accent-rgb) / 0.1);
  border-bottom: 1px solid rgb(var(--accent-rgb) / 0.35);

  &__count {
    margin: 0;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent-ink);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__clear {
    padding: 0.45rem 0.75rem;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-body);
    background: transparent;
    border: 1px solid rgb(var(--accent-rgb) / 0.5);
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: rgba(var(--surface), 0.6); }
  }

  &__delete {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--ink-on-solid);
    background: var(--danger-solid);
    border: 1px solid var(--danger-solid);
    border-radius: 8px;
    cursor: pointer;

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.8; }

    &:hover:not(:disabled) { background: var(--danger-solid); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
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
  /* Selected rows win over the hover tint so the selection stays visible. */
  tbody tr.is-selected td { background: rgb(var(--accent-rgb) / 0.08); }

  /* A just-created order, flagged for a few seconds after saving. Declared
     after .is-selected so it wins if the row is also ticked. */
  tbody tr.is-new td {
    background: var(--success-bg);
    box-shadow: inset 0 0 0 9999px rgb(var(--success-rgb) / 0.04);
  }
  tbody tr.is-new td:first-child { border-left: 3px solid var(--success); }

  &__check { width: 44px; }
  /* Needs the element in the selector: `.table th` above is (0,1,1) and would
     otherwise outrank a bare class and keep the label left of its icons. */
  th#{&}__actions-head { text-align: center; }

  &__empty {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;

    &--error { color: var(--danger); }
  }

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: rgb(var(--accent-rgb));
    cursor: pointer;
  }
}

.new-flag {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.1rem 0.35rem;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-on-solid);
  background: var(--success-solid);
  border-radius: 4px;
  vertical-align: middle;
}

/* Order ID cell */
.order {
  &__id {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--accent-ink);
    /* Without the date/customer lines the column is narrow enough that the
       reference would wrap mid-token. */
    white-space: nowrap;
  }
}

/* Items cell — the product breakdown is the only line now, so it carries the
   primary text treatment rather than reading as a subtitle. */
.item {
  &__spec {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-body);
    line-height: 1.45;

    /* Capped so a long product list cannot wrap and stretch the row. The cap
       lives on the paragraph rather than the cell because `max-width` on a
       table-cell is ignored under automatic table layout. Full text is in the
       element's title attribute. */
    max-width: 26rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* Payment cell */
.payment {
  display: flex;
  align-items: center;
  gap: 0.55rem;

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--bg);
    color: var(--text-muted);
    flex-shrink: 0;
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.7; }
  }

  &__label { font-size: 0.84rem; color: var(--text-body); }
}

.amount { font-size: 0.9rem; font-weight: 700; color: var(--text-strong); }

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;

  /* `status` is a plain string column, so a legacy value outside the four still
     gets a readable neutral chip rather than an unstyled one. */
  background: var(--border-subtle);
  color: var(--text-muted);

  &--pending { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-ink); }
  &--processing { background: rgb(var(--accent-rgb) / 0.22); color: var(--accent-ink); }
  &--completed { background: var(--success-bg); color: var(--success); }
  &--cancelled { background: var(--danger-bg); color: var(--danger); }
}

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

  &:hover { background: var(--surface-alt); color: var(--text-strong); border-color: var(--border); }

  &--danger:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }

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
  &__warning { color: var(--accent-ink); }
  &__controls { display: flex; align-items: center; gap: 0.4rem; }
}

.retry-btn {
  margin-left: 0.6rem;
  padding: 0.35rem 0.7rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: var(--surface-alt); }
}

.page-ellipsis { color: var(--text-subtle); padding: 0 0.2rem; }

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
