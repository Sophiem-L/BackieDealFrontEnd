<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import DateRangeFilter from '@/components/DateRangeFilter.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
import { apiFetch } from '@/services/api'
import { deriveStockStatus, fetchStockSummary, usableImage } from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const PER_PAGE = 20
const FILTER_PER_PAGE = 100
const FILTER_MAX_PAGES = 20

const items = ref([])
const loading = ref(false)
const error = ref('')

const page = ref(1)
const lastPage = ref(1)
const total = ref(0)

const query = ref('')
const availability = ref('all')
const filterTruncated = ref(false)

const updatedFrom = ref('')
const updatedTo = ref('')
const sortBy = ref('updated_at')
const sortDirection = ref('desc')

const summary = ref({ total: null, low: null, out: null, inStock: null })

const canViewStock = computed(() => auth.hasPermission('stock.view'))
const canAdjustStock = computed(() => auth.hasPermission('stock.update'))

const availabilityOptions = [
  { value: 'all', label: 'All Stock' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
]

const availabilityLabels = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
}

// The sortable columns, in table order. Every sort the API offers is reachable
// from a header, so there is no separate sort control in the toolbar.
const sortableColumns = [
  { key: 'name', label: 'Product' },
  { key: 'created_at', label: 'Added on', class: 'col-added' },
  { key: 'updated_at', label: 'Last updated' },
  { key: 'stock_quantity', label: 'On hand' },
]

const hasFilters = computed(() =>
  Boolean(
    query.value.trim() || availability.value !== 'all' || updatedFrom.value || updatedTo.value,
  ),
)

function formatCount(value) {
  return value == null ? '—' : Number(value).toLocaleString()
}

const stats = computed(() => [
  {
    key: 'total',
    label: 'Total Items',
    value: summary.value.total,
    note: 'All tracked products',
    icon: 'box',
    tone: 'neutral',
  },
  {
    key: 'low',
    label: 'Low Stock Items',
    value: summary.value.low,
    note: 'Action required',
    icon: 'warning',
    tone: 'warning',
  },
  {
    key: 'out',
    label: 'Out of Stock',
    value: summary.value.out,
    note: 'Inactive listings',
    icon: 'forbidden',
    tone: 'danger',
  },
  {
    key: 'in-stock',
    label: 'In Stock',
    value: summary.value.inStock,
    note: 'Available to sell',
    icon: 'check',
    tone: 'success',
  },
])

function formatDisplayDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatRelativeTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`

  const diffYears = Math.round(diffMonths / 12)
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
}

// The cell shows "3 days ago"; the tooltip carries the exact moment.
function formatDateTooltip(value) {
  if (!value) return 'No date available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

// How full the meter under "On hand" reads. It hits 100% at twice the alert
// level, so a product sitting exactly on its threshold shows half full and a
// healthy one fills the bar. Products with no alert level set have nothing to
// compare against, so any stock reads as full. A product with stock never
// drops below a sliver, which would otherwise look the same as out of stock.
function stockLevel(item) {
  if (item.onHand <= 0) return 0
  if (item.threshold <= 0) return 100
  return Math.min(100, Math.max(6, Math.round((item.onHand / (item.threshold * 2)) * 100)))
}

function levelTitle(item) {
  return item.threshold > 0
    ? `${item.onHand} on hand · low-stock alert at ${item.threshold}`
    : `${item.onHand} on hand · no low-stock alert set`
}

function mapItem(row) {
  const status = deriveStockStatus(row)

  return {
    id: row.id,
    uuid: row.id,
    name: row.name ?? '',
    sku: row.sku ?? '',
    startDate: formatDisplayDate(row.created_at),
    lastUpdated: row.updated_at,
    lastUpdatedLabel: formatRelativeTime(row.updated_at),
    onHand: Number(row.stock_quantity ?? 0),
    threshold: Number(row.min_stock_alert ?? 0),
    availability: status,
    thumbnail: usableImage(
      row.thumbnail || row.image || row.image_url || row.product?.thumbnail,
    ),
  }
}

function listParams({ page: targetPage = page.value, perPage = PER_PAGE } = {}) {
  const params = new URLSearchParams({
    page: String(targetPage),
    per_page: String(perPage),
    sort: sortBy.value,
    direction: sortDirection.value,
  })
  const q = query.value.trim()
  if (q) params.set('search', q)
  if (updatedFrom.value) params.set('updated_from', updatedFrom.value)
  if (updatedTo.value) params.set('updated_to', updatedTo.value)
  return params
}

async function fetchAllMatching() {
  const rows = []
  let current = 1
  let last
  do {
    const response = await apiFetch(
      `/admin/stock?${listParams({ page: current, perPage: FILTER_PER_PAGE }).toString()}`,
      { token: auth.accessToken },
    )
    const data = response?.data ?? {}
    rows.push(...(data.items ?? []))
    last = data.pagination?.last_page ?? 1
    current += 1
  } while (current <= last && current <= FILTER_MAX_PAGES)

  return { rows, truncated: last > FILTER_MAX_PAGES }
}

let statusCache = { key: '', rows: [] }

function invalidateStatusCache() {
  statusCache = { key: '', rows: [] }
}

function statusCacheKey() {
  return JSON.stringify([
    query.value.trim(),
    availability.value,
    updatedFrom.value,
    updatedTo.value,
    sortBy.value,
    sortDirection.value,
  ])
}

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    if (availability.value === 'all') {
      const response = await apiFetch(`/admin/stock?${listParams().toString()}`, {
        token: auth.accessToken,
      })
      const data = response?.data ?? {}
      items.value = (data.items ?? []).map(mapItem)

      const pagination = data.pagination ?? {}
      total.value = pagination.total ?? items.value.length
      lastPage.value = pagination.last_page ?? 1
      filterTruncated.value = false
    } else {
      const key = statusCacheKey()
      if (statusCache.key !== key) {
        const { rows, truncated } = await fetchAllMatching()
        statusCache = {
          key,
          rows: rows.filter((row) => deriveStockStatus(row) === availability.value),
        }
        filterTruncated.value = truncated
      }

      const matched = statusCache.rows
      const start = (page.value - 1) * PER_PAGE
      items.value = matched.slice(start, start + PER_PAGE).map(mapItem)
      total.value = matched.length
      lastPage.value = Math.max(1, Math.ceil(matched.length / PER_PAGE))
    }
  } catch (err) {
    error.value = err.message || 'Unable to load stock. Please try again.'
    items.value = []
    total.value = 0
    lastPage.value = 1
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    summary.value = await fetchStockSummary({
      token: auth.accessToken,
      totalPath: '/admin/stock?page=1&per_page=1',
    })
  } catch {
    summary.value = { total: null, low: null, out: null, inStock: null }
  }
}

function applyFilters() {
  if (page.value !== 1) {
    page.value = 1
  } else {
    loadItems()
  }
}

function toggleSort(columnKey) {
  if (sortBy.value === columnKey) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortBy.value = columnKey
  sortDirection.value = columnKey === 'name' ? 'asc' : 'desc'
}

function isSorted(columnKey) {
  return sortBy.value === columnKey
}

// Lets assistive tech announce which column the list is ordered by.
function ariaSort(columnKey) {
  if (!isSorted(columnKey)) return undefined
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

let searchTimer
watch(query, () => {
  invalidateStatusCache()
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 350)
})

watch(availability, () => {
  invalidateStatusCache()
  applyFilters()
})

watch(page, loadItems)

watch([updatedFrom, updatedTo, sortBy, sortDirection], () => {
  invalidateStatusCache()
  applyFilters()
})

onMounted(() => {
  loadItems()
  loadSummary()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
})

function openItem(id) {
  router.push({ name: 'stock-detail', params: { id } })
}

function openAdjustment(id) {
  router.push({ name: 'stock-adjustment-create', query: { product_id: id } })
}

const brokenThumbs = ref(new Set())
function onThumbError(id) {
  const next = new Set(brokenThumbs.value)
  next.add(id)
  brokenThumbs.value = next
}

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PER_PAGE + 1))
const rangeEnd = computed(() =>
  Math.min(total.value, (page.value - 1) * PER_PAGE + items.value.length),
)

function prevPage() {
  if (page.value > 1) page.value -= 1
}

function nextPage() {
  if (page.value < lastPage.value) page.value += 1
}
</script>

<template>
  <div class="page">
    <AppHeader title="Inventory & Stock Control" />

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
            v-model="query"
            type="search"
            placeholder="Search by SKU, product name or serial..."
            aria-label="Search stock"
          />
        </label>

        <div class="toolbar__actions">
          <Select v-model="availability">
            <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by availability">
              <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
              </svg>
              <SelectValue />
            </SelectTrigger>
            <SelectContent :class="TOOLBAR_SELECT.content">
              <SelectItem
                v-for="option in availabilityOptions"
                :key="option.value"
                :value="option.value"
                :class="TOOLBAR_SELECT.item"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <DateRangeFilter
            v-model:from="updatedFrom"
            v-model:to="updatedTo"
            label="Last updated between"
            from-label="Updated from"
            to-label="Updated to"
          />

          <BaseButton
            v-if="canAdjustStock"
            variant="primary"
            :to="{ name: 'stock-adjustment-create' }"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            Add Stock Adjustment
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
            <svg v-else-if="stat.icon === 'check'" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12 2.4 2.4 4.6-5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" />
              <path d="m6 6 12 12" stroke-linecap="round" />
            </svg>
          </span>
          <div class="stat__meta">
            <p class="stat__label">{{ stat.label }}</p>
            <p class="stat__value">{{ formatCount(stat.value) }}</p>
            <p class="stat__note">{{ stat.note }}</p>
          </div>
        </article>
      </section>

      <!-- The status filter runs client-side; say so when it stopped early. -->
      <p v-if="filterTruncated" class="notice">
        Too many matches to filter in full — showing a partial list. Narrow your search to see
        everything.
      </p>

      <!-- Table -->
      <section class="table-card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th
                  v-for="column in sortableColumns"
                  :key="column.key"
                  :class="column.class"
                  :aria-sort="ariaSort(column.key)"
                >
                  <button type="button" class="th-sort" @click="toggleSort(column.key)">
                    {{ column.label }}
                    <svg
                      class="th-sort__icon"
                      :class="{ 'th-sort__icon--idle': !isSorted(column.key) }"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path v-if="!isSorted(column.key)" d="m7 15 5 5 5-5M7 9l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
                      <path v-else-if="sortDirection === 'asc'" d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
                      <path v-else d="M12 5v14M19 12l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </th>
                <th>Availability</th>
                <th class="table__actions-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && items.length === 0">
                <td colspan="6" class="table__state">Loading stock…</td>
              </tr>
              <tr v-else-if="error">
                <td colspan="6" class="table__state table__state--error">
                  {{ error }}
                  <button type="button" class="table__retry" @click="loadItems">Retry</button>
                </td>
              </tr>
              <tr v-else-if="items.length === 0">
                <td colspan="6" class="table__state">
                  {{ hasFilters ? 'No inventory matches your filters.' : 'No stock records yet.' }}
                </td>
              </tr>
              <template v-else>
                <tr
                  v-for="item in items"
                  :key="item.id"
                  class="table__row"
                  :class="{ 'table__row--loading': loading }"
                  @click="openItem(item.id)"
                >
                  <td>
                    <div class="product">
                      <span class="product__thumb" aria-hidden="true">
                        <img
                          v-if="item.thumbnail && !brokenThumbs.has(item.id)"
                          :src="item.thumbnail"
                          alt=""
                          loading="lazy"
                          @error="onThumbError(item.id)"
                        />
                        <template v-else>{{ thumbInitials(item.name) }}</template>
                      </span>
                      <div class="product__meta">
                        <p class="product__name">{{ item.name }}</p>
                        <p class="product__sku">SKU: {{ item.sku }}</p>
                        <p class="product__submeta">
                          <span>Added on {{ item.startDate }}</span>
                          <span aria-hidden="true">•</span>
                          <span>{{ item.lastUpdatedLabel }}</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  <td class="col-added">{{ item.startDate }}</td>

                  <td class="col-updated">
                    <span :title="formatDateTooltip(item.lastUpdated)" class="updated-text">{{ item.lastUpdatedLabel }}</span>
                  </td>

                  <td class="col-onhand">
                    <div class="onhand" :title="levelTitle(item)">
                      <p class="onhand__count">
                        <strong>{{ item.onHand.toLocaleString() }}</strong>
                        <span>{{ item.onHand === 1 ? 'unit' : 'units' }}</span>
                      </p>
                      <div class="meter" :class="`meter--${item.availability}`" aria-hidden="true">
                        <span class="meter__fill" :style="{ width: `${stockLevel(item)}%` }"></span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span class="badge" :class="`badge--${item.availability}`">
                      {{ availabilityLabels[item.availability] }}
                    </span>
                  </td>

                  <td class="col-actions">
                    <div v-if="canViewStock || canAdjustStock" class="row-actions">
                      <button
                        v-if="canViewStock"
                        type="button"
                        class="icon-btn"
                        :title="`View details: ${item.name}`"
                        :aria-label="`View details for ${item.name}`"
                        @click.stop="openItem(item.id)"
                      >
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linejoin="round" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        v-if="canAdjustStock"
                        type="button"
                        class="icon-btn"
                        :title="`Adjust stock: ${item.name}`"
                        :aria-label="`Adjust stock for ${item.name}`"
                        @click.stop="openAdjustment(item.id)"
                      >
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <footer v-if="total > 0" class="pagination">
          <p class="pagination__info">
            Showing {{ rangeStart }}-{{ rangeEnd }} of {{ total.toLocaleString() }} products
          </p>
          <div class="pagination__controls">
            <button type="button" class="page-btn" :disabled="page <= 1 || loading" @click="prevPage">
              Previous
            </button>
            <button type="button" class="page-btn page-btn--active" :aria-label="`Page ${page} of ${lastPage}`" aria-current="page">
              {{ page }}
            </button>
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
}

/* Stat cards */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
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

    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }

    &--neutral { background: var(--bg); color: var(--text-muted); }
    &--warning { background: rgb(var(--accent-rgb) / 0.16); color: var(--accent-ink); }
    &--danger { background: var(--danger-bg); color: var(--danger); }
    &--success { background: var(--success-bg); color: var(--success); }
  }

  &__label { margin: 0; font-size: 0.78rem; color: var(--text-subtle); }
  &__value { margin: 0.15rem 0 0; font-size: 1.45rem; font-weight: 700; color: var(--text-strong); }
  &__note { margin: 0.1rem 0 0; font-size: 0.72rem; color: var(--text-subtle); }
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

/* Table */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}

.table-wrap { overflow-x: auto; }

.table {
  width: 100%;
  min-width: 820px;
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
    white-space: nowrap;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);

    &.table__actions-head { text-align: center; }
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  &__row { cursor: pointer; }
  /* A refetch keeps the previous rows on screen rather than blanking the table. */
  &__row--loading { opacity: 0.6; pointer-events: none; }

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

    &:hover { background: var(--surface-alt); border-color: var(--border); }
  }
}

/* Sortable header — a real button inside the th so it is keyboard-reachable. */
.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;

  &:hover { color: var(--text-strong); border-color: transparent; }
  &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 3px; }

  &__icon { width: 14px; height: 14px; stroke: var(--accent-ink); stroke-width: 2; }

  /* A column that is not the active sort hints at being sortable on hover or
     focus, and stays out of the way otherwise. */
  &__icon--idle { stroke: currentColor; opacity: 0; transition: opacity 0.15s ease; }
  &:hover &__icon--idle,
  &:focus-visible &__icon--idle { opacity: 0.6; }
}

.product {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 240px;

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

    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }

  &__meta { min-width: 0; }
  /* Same accent ink as the product name on the Products screen. */
  &__name { margin: 0; font-size: 0.88rem; font-weight: 600; color: var(--accent-ink); }
  &__sku { margin: 0.15rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }

  /* Stands in for the two date columns once they are hidden on narrow screens. */
  &__submeta {
    display: none;
    margin: 0.3rem 0 0;
    gap: 0.45rem;
    align-items: center;
    font-size: 0.72rem;
    color: var(--text-subtle);
  }
}

.col-added { color: var(--text-subtle); font-size: 0.86rem; white-space: nowrap; }
.col-updated { min-width: 120px; font-size: 0.86rem; color: var(--text-body); }
.updated-text { cursor: help; }
.col-onhand { min-width: 150px; }

.onhand {
  &__count {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    margin: 0 0 0.4rem;

    strong { font-size: 0.95rem; font-weight: 700; color: var(--text-strong); font-variant-numeric: tabular-nums; }
    span { font-size: 0.74rem; color: var(--text-subtle); }
  }
}

.meter {
  height: 5px;
  max-width: 120px;
  border-radius: 999px;
  background: var(--surface-track);
  overflow: hidden;

  &__fill { display: block; height: 100%; border-radius: inherit; transition: width 0.2s ease; }

  &--in-stock .meter__fill { background: var(--success-solid); }
  &--low-stock .meter__fill { background: rgb(var(--accent-rgb)); }
  &--out-of-stock .meter__fill { background: var(--danger-solid); }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  border-radius: 999px;

  &--in-stock { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}

.col-actions { width: 112px; }

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
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover { background: var(--surface-alt); color: var(--text-strong); border-color: var(--border); }
  &:focus-visible { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }

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

  &:hover:not(:disabled) { background: var(--surface-alt); border-color: var(--border); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &--active,
  &--active:hover:not(:disabled) {
    background: rgb(var(--accent-rgb));
    border-color: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
    cursor: default;
  }
}

@media (max-width: 768px) {
  .page__body { padding: 1rem; }

  .table { min-width: 0; }
  .table thead { display: none; }

  .table tbody tr {
    display: block;
    padding: 0.75rem 0.8rem;
  }

  .table tbody tr + tr { border-top: 1px solid var(--border-subtle); }

  .table tbody td {
    display: block;
    padding: 0.35rem 0;
    border: none;
  }

  .table tbody tr + tr td { border-top: none; }

  .product { min-width: 0; }
  .product__submeta { display: inline-flex; flex-wrap: wrap; }

  /* Needs the td in the selector: `.table tbody td` above would otherwise win. */
  .table tbody td.col-added,
  .table tbody td.col-updated { display: none; }

  .col-actions { width: auto; padding-top: 0.75rem; }
  .row-actions { justify-content: flex-start; }

  .pagination { flex-direction: column; align-items: flex-start; }
}
</style>
