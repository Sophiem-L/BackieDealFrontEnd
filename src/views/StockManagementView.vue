<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, ArrowUp } from '@lucide/vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/services/api'
import {
  deriveStockStatus,
  fetchStockSummary,
  formatStockDate,
  usableImage,
} from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const PER_PAGE = 20
// A status filter can't be pushed to the endpoint, so it's applied client-side by
// walking the search result. Cap the walk so a huge catalog can't hang the page.
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
const filterOpen = ref(false)
const filterTruncated = ref(false)

const updatedFrom = ref('')
const updatedTo = ref('')
const sortBy = ref('updated_at')
const sortDirection = ref('desc')

const summary = ref({ total: null, low: null, out: null, inStock: null })

const availabilityOptions = [
  { value: 'all', label: 'All Stock' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
]

const availabilityLabels = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

const filterLabel = computed(
  () =>
    availabilityOptions.find((option) => option.value === availability.value)?.label ??
    'All Stock',
)

function countLabel(value) {
  return value == null ? '—' : Number(value).toLocaleString()
}
// The stat cards format their raw counts through this.
const formatCount = countLabel

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

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

function mapItem(row) {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name ?? '',
    sku: row.sku ?? '',
    startDate: formatStockDate(row.created_at),
    lastUpdated: formatStockDate(row.updated_at),
    onHand: Number(row.stock_quantity ?? 0),
    threshold: Number(row.min_stock_alert ?? 0),
    availability: deriveStockStatus(row),
    thumbnail: usableImage(row.thumbnail),
  }
}

// GET /admin/stock accepts `search`, `sort`/`direction`, and an updated-at range.
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

// Walk every page of the current search, for the client-side status filter.
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

// Paging inside a client-filtered set shouldn't refetch on every page step.
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
      // The endpoint has no stock-status parameter, so narrow client-side and
      // page over the result — that keeps the total and the page count honest
      // rather than paginating a server set the table then filters down.
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

// Any filter change resets to page 1. Reload directly only when already on
// page 1, otherwise the page watcher does it (avoids a double fetch).
function applyFilters() {
  if (page.value !== 1) {
    page.value = 1
  } else {
    loadItems()
  }
}

function setFilter(value) {
  availability.value = value
  filterOpen.value = false
}

// Debounce search; the dropdown applies immediately through its watcher.
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

function closeMenus() {
  filterOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeMenus)
  loadItems()
  loadSummary()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenus)
  clearTimeout(searchTimer)
})

// NOTE: StockDetailView still renders from its own hardcoded records keyed by
// 1..6, so it falls back to the first record whatever it is handed. The uuid is
// what a wired-up detail page would need — it is the API's route key.
function openItem(uuid) {
  router.push({ name: 'stock-detail', params: { id: uuid } })
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
          />
        </label>

        <div class="toolbar__actions">
        <div class="filter" @click.stop>
          <button
            type="button"
            class="select"
            :class="{ 'select--active': availability !== 'all' }"
            :aria-expanded="filterOpen"
            @click="filterOpen = !filterOpen"
          >
            <span class="select__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3 2 20h20L12 3Z" stroke-linejoin="round" />
                <path d="M12 10v4M12 17h.01" stroke-linecap="round" />
              </svg>
            </span>
            {{ filterLabel }}
            <svg class="select__caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div v-if="filterOpen" class="filter__popup" role="listbox">
            <button
              v-for="option in availabilityOptions"
              :key="option.value"
              type="button"
              class="filter__item"
              :class="{ 'filter__item--selected': availability === option.value }"
              role="option"
              :aria-selected="availability === option.value"
              @click="setFilter(option.value)"
            >
              {{ option.label }}
              <svg
                v-if="availability === option.value"
                class="filter__check"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path d="m5 12.5 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div class="toolbar__dates">
          <input type="date" v-model="updatedFrom" placeholder="Updated From" class="date-input" title="Last updated from" />
          <span>-</span>
          <input type="date" v-model="updatedTo" placeholder="Updated To" class="date-input" title="Last updated to" />
        </div>

        <div class="toolbar__sort">
          <select v-model="sortBy" class="select-input">
            <option value="updated_at">Sort by Updated</option>
            <option value="created_at">Sort by Created</option>
            <option value="name">Sort by Name</option>
            <option value="stock_quantity">Sort by Stock</option>
          </select>
          <Button
            variant="outline"
            size="icon"
            type="button"
            :title="sortDirection === 'desc' ? 'Sorted descending — click for ascending' : 'Sorted ascending — click for descending'"
            :aria-label="sortDirection === 'desc' ? 'Sort ascending' : 'Sort descending'"
            @click="sortDirection = sortDirection === 'desc' ? 'asc' : 'desc'"
          >
            <ArrowDown v-if="sortDirection === 'desc'" />
            <ArrowUp v-else />
          </Button>
        </div>

        <BaseButton variant="primary" :to="{ name: 'stock-adjustment-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          Add Stock Adjustment
        </BaseButton>
        </div>
      </section>

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
              <path d="m8.5 12 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
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

      <section class="table-card">
        <div v-if="error" class="table__alert table__alert--error">
          <span>{{ error }}</span>
          <button type="button" class="table__retry" @click="loadItems">Retry</button>
        </div>

        <p v-if="filterTruncated" class="table__alert table__alert--warning">
          Too many matches to filter in full — showing a partial list. Narrow your search to see everything.
        </p>

        <table class="table">
          <thead>
            <tr>
              <th>Product &amp; SKU</th>
              <th>Start-Date</th>
              <th>Last Updated</th>
              <th>On Hand</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && items.length === 0">
              <td colspan="4" class="table__empty">Loading inventory data...</td>
            </tr>
            <tr
              v-for="item in items"
              v-else
              :key="item.id"
              class="table__row"
              @click="openItem(item.uuid)"
            >
              <td>
                <div class="product">
                  <img
                    v-if="item.thumbnail && !brokenThumbs.has(item.id)"
                    :src="item.thumbnail"
                    :alt="item.name"
                    class="product__thumb product__thumb--img"
                    @error="onThumbError(item.id)"
                  />
                  <span v-else class="product__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
                  <div class="product__meta">
                    <p class="product__name">{{ item.name }}</p>
                    <p class="product__sku">{{ item.sku }}</p>
                  </div>
                </div>
              </td>
              <td class="start-date">{{ item.startDate }}</td>
              <td class="start-date">{{ item.lastUpdated || '—' }}</td>
              <td>
                <span class="onhand" :class="`onhand--${item.availability}`">{{ item.onHand }}</span>
                <span class="onhand__unit">units</span>
              </td>
              <td>
                <span class="badge" :class="`badge--${item.availability}`">
                  {{ availabilityLabels[item.availability] }}
                </span>
              </td>
            </tr>
            <tr v-if="!loading && items.length === 0 && !error">
              <td colspan="4" class="table__empty">No products match your filters.</td>
            </tr>
          </tbody>
        </table>

        <footer v-if="total > 0" class="pagination">
          <p class="pagination__range">
            Showing <strong>{{ rangeStart }}</strong> to <strong>{{ rangeEnd }}</strong> of
            <strong>{{ total.toLocaleString() }}</strong> products
          </p>
          <div class="pagination__pages">
            <button
              type="button"
              class="page-btn"
              :disabled="page <= 1 || loading"
              @click="prevPage"
            >
              Previous
            </button>
            <span class="pagination__info">Page {{ page }} of {{ lastPage }}</span>
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

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
    flex-wrap: wrap;
  }

  &__dates {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-subtle);
  }

  &__sort {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .date-input, .select-input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.45rem 0.6rem;
    font-size: 0.8rem;
    color: var(--text-strong);
    font-family: inherit;
    &:focus { outline: none; border-color: var(--accent-ink); }
  }

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

.filter { position: relative; }

.select {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;

  &__icon {
    display: inline-flex;
    color: var(--accent-ink);
    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__caret { width: 14px; height: 14px; stroke: var(--text-subtle); stroke-width: 1.8; }

  &--active { border-color: rgb(var(--accent-rgb) / 0.7); background: rgb(var(--accent-rgb) / 0.08); }
}

.filter__popup {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
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

.filter__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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
  &:hover { background: var(--surface-alt); }

  &--selected { color: var(--accent-ink); font-weight: 600; }
}

.filter__check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  stroke: currentColor;
  stroke-width: 2.2;
}

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

    &--neutral { background: var(--surface-track); color: var(--text-muted); }
    &--warning { background: rgb(var(--accent-rgb) / 0.16); color: var(--accent-ink); }
    &--danger { background: var(--danger-bg); color: var(--danger); }
    &--success { background: var(--success-bg); color: var(--success); }
  }

  &__label {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__value {
    margin: 0.2rem 0 0;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__note {
    margin: 0.1rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }
}

.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1.25rem;
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

  &__row { cursor: pointer; }

  &__empty {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2rem 1rem;
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

    &--img {
      object-fit: cover;
    }
  }

  &__name {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__sku {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }
}

.table__alert {
  padding: 0.85rem 1.25rem;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);

  &--error {
    background: var(--danger-bg);
    color: var(--danger);
  }

  &--warning {
    background: rgb(var(--accent-rgb) / 0.14);
    color: var(--accent-ink);
  }
}

.table__retry {
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface);
  flex-wrap: wrap;

  &__range {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-subtle);

    strong {
      color: var(--text-strong);
    }
  }

  &__pages {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  &__info {
    font-size: 0.82rem;
    color: var(--text-body);
  }
}

.page-btn {
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-body);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    color: var(--text-strong);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.start-date {
  font-size: 0.85rem;
  color: var(--text-body);
}

.onhand {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-strong);

  &--low-stock { color: var(--accent-ink); }
  &--out-of-stock { color: var(--danger); }

  &__unit {
    margin-left: 0.3rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
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

  &--in-stock { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}
</style>
