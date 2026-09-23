<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, ArrowUp, Eye, SlidersHorizontal } from '@lucide/vue'
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

const filterLabel = computed(
  () =>
    availabilityOptions.find((option) => option.value === availability.value)?.label ??
    'All Stock',
)

function countLabel(value) {
  return value == null ? '—' : Number(value).toLocaleString()
}
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

function formatDateTooltip(value) {
  if (!value) return 'No date available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
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

function setFilter(value) {
  availability.value = value
  filterOpen.value = false
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

function getSortIcon(columnKey) {
  if (!isSorted(columnKey)) return 'neutral'
  return sortDirection.value === 'asc' ? 'asc' : 'desc'
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

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th class="sortable" @click="toggleSort('name')" role="button" tabindex="0" @keydown.enter.prevent="toggleSort('name')" @keydown.space.prevent="toggleSort('name')">
                  <span class="thead-label">Product</span>
                  <span v-if="getSortIcon('name') !== 'neutral'" class="sort-indicator" aria-hidden="true">
                    <ArrowUp v-if="sortDirection === 'asc'" />
                    <ArrowDown v-else />
                  </span>
                </th>
                <th class="added-on">Added on</th>
                <th class="sortable" @click="toggleSort('updated_at')" role="button" tabindex="0" @keydown.enter.prevent="toggleSort('updated_at')" @keydown.space.prevent="toggleSort('updated_at')">
                  <span class="thead-label">Last updated</span>
                  <span v-if="getSortIcon('updated_at') !== 'neutral'" class="sort-indicator" aria-hidden="true">
                    <ArrowUp v-if="sortDirection === 'asc'" />
                    <ArrowDown v-else />
                  </span>
                </th>
                <th class="sortable" @click="toggleSort('stock_quantity')" role="button" tabindex="0" @keydown.enter.prevent="toggleSort('stock_quantity')" @keydown.space.prevent="toggleSort('stock_quantity')">
                  <span class="thead-label">On hand</span>
                  <span v-if="getSortIcon('stock_quantity') !== 'neutral'" class="sort-indicator" aria-hidden="true">
                    <ArrowUp v-if="sortDirection === 'asc'" />
                    <ArrowDown v-else />
                  </span>
                </th>
                <th>Availability</th>
                <th class="table__actions-header" aria-label="Actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="loading && items.length === 0">
                <tr>
                  <td colspan="6" class="table__empty">
                    <div class="skeleton-row" v-for="n in 5" :key="n" aria-hidden="true">
                      <span class="skeleton skeleton--thumb" />
                      <span class="skeleton skeleton--line wide" />
                      <span class="skeleton skeleton--line" />
                      <span class="skeleton skeleton--line short" />
                      <span class="skeleton skeleton--line short" />
                      <span class="skeleton skeleton--tiny" />
                    </div>
                  </td>
                </tr>
              </template>

              <tr
                v-else-if="items.length > 0"
                v-for="item in items"
                :key="item.id"
                class="table__row"
                @click="openItem(item.id)"
              >
                <td>
                  <div class="product">
                    <img
                      v-if="item.thumbnail && !brokenThumbs.has(item.id)"
                      :src="item.thumbnail"
                      :alt="item.name"
                      class="product__thumb product__thumb--img"
                      loading="lazy"
                      @error="onThumbError(item.id)"
                    />
                    <span v-else class="product__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
                    <div class="product__meta">
                      <p class="product__name">{{ item.name }}</p>
                      <p class="product__sku">{{ item.sku }}</p>
                      <p class="product__submeta">
                        <span class="product__added">Added on {{ item.startDate }}</span>
                        <span class="product__divider">•</span>
                        <span class="product__updated">{{ item.lastUpdatedLabel }}</span>
                      </p>
                    </div>
                  </div>
                </td>

                <td class="added-on-cell">{{ item.startDate }}</td>

                <td class="updated-cell">
                  <span :title="formatDateTooltip(item.lastUpdated)" class="updated-text">{{ item.lastUpdatedLabel }}</span>
                </td>

                <td class="onhand-cell">
                  <div class="onhand-wrap">
                    <span class="onhand" :class="`onhand--${item.availability}`">{{ item.onHand }}</span>
                    <span class="onhand__unit">units</span>
                  </div>
                  <div class="stock-bar" :class="`stock-bar--${item.availability}`" aria-label="Stock level indicator">
                    <span class="stock-bar__fill"></span>
                  </div>
                </td>

                <td>
                  <span class="status-chip" :class="`status-chip--${item.availability}`">
                    <span class="status-chip__dot" aria-hidden="true"></span>
                    {{ availabilityLabels[item.availability] }}
                  </span>
                </td>

                <td class="table__actions cell-actions">
                  <div v-if="canViewStock || canAdjustStock" class="action-buttons">
                    <button
                      v-if="canViewStock"
                      type="button"
                      class="icon-button icon-button--view"
                      :title="`View details: ${item.name}`"
                      :aria-label="`View details for ${item.name}`"
                      @click.stop="openItem(item.id)"
                    >
                      <Eye :size="18" :stroke-width="1.75" stroke="currentColor" fill="none" aria-hidden="true" />
                    </button>
                    <button
                      v-if="canAdjustStock"
                      type="button"
                      class="icon-button icon-button--adjust"
                      :title="`Adjust stock: ${item.name}`"
                      :aria-label="`Adjust stock for ${item.name}`"
                      @click.stop="openAdjustment(item.id)"
                    >
                      <SlidersHorizontal :size="18" :stroke-width="1.75" stroke="currentColor" fill="none" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!loading && items.length === 0 && !error">
                <td colspan="6" class="table__empty">
                  <div class="empty-state">
                    <div class="empty-state__icon" aria-hidden="true">◌</div>
                    <strong>No inventory matches your filters.</strong>
                    <span>Try a different search or reset the stock filters.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

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

  &__label { } 
  &__value { }
  &__note { }
}

.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  overflow: hidden;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 820px;

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: rgba(15, 20, 27, 0.96);
    color: var(--text-subtle);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.8rem 0.9rem;
    border-bottom: 1px solid var(--border-subtle);
    text-align: left;
  }

  tbody td {
    padding: 0.9rem 0.9rem;
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
    color: var(--text-body);
  }

  tbody tr {
    transition: background-color 150ms ease;
    &:hover { background: rgba(255,255,255,0.02); }
  }
}

.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  .thead-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
}

.sort-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  color: var(--accent-ink);

  svg {
    width: 0.9rem;
    height: 0.9rem;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
  }
}

.table__actions-header {
  text-align: right;
  width: 120px;
}

.product {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 260px;
}

.product__thumb {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: var(--text-strong);
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  overflow: hidden;
}

.product__thumb--img {
  object-fit: cover;
}

.product__meta {
  min-width: 0;
}

.product__name {
  margin: 0;
  color: var(--text-strong);
  font-weight: 700;
  line-height: 1.4;
}

.product__sku {
  margin: 0.1rem 0 0;
  color: var(--text-subtle);
  font-size: 0.76rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.product__submeta {
  display: none;
  margin: 0.3rem 0 0;
  gap: 0.45rem;
  align-items: center;
  color: var(--text-subtle);
  font-size: 0.72rem;
}

.product__divider { opacity: 0.65; }

.added-on,
.added-on-cell {
  color: var(--text-subtle);
  white-space: nowrap;
}

.updated-cell {
  min-width: 120px;
}

.updated-text {
  display: inline-flex;
  align-items: center;
  color: var(--text-body);
  cursor: help;
}

.onhand-cell {
  min-width: 150px;
}

.onhand-wrap {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
}

.onhand {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-strong);
  letter-spacing: -0.02em;
}

.onhand__unit {
  font-size: 0.72rem;
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stock-bar {
  position: relative;
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: rgba(255,255,255,0.07);
  overflow: hidden;
  max-width: 120px;
}

.stock-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  display: block;
  border-radius: inherit;
}

.stock-bar--in-stock .stock-bar__fill { background: linear-gradient(90deg, #34d399, #22c55e); }
.stock-bar--low-stock .stock-bar__fill { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.stock-bar--out-of-stock .stock-bar__fill { background: linear-gradient(90deg, #f87171, #ef4444); }

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font-size: 0.74rem;
  font-weight: 700;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  white-space: nowrap;
}

.status-chip__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.status-chip--in-stock {
  color: #9ae6b4;
  background: rgba(34, 197, 94, 0.09);
  .status-chip__dot { background: #34d399; }
}

.status-chip--low-stock {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.09);
  .status-chip__dot { background: #f59e0b; }
}

.status-chip--out-of-stock {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.09);
  .status-chip__dot { background: #f87171; }
}

.cell-actions {
  width: 112px;
  text-align: right;
}

.action-buttons {
  display: inline-flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
}

.icon-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    border-color: rgb(var(--accent-rgb));
    color: rgb(var(--accent-rgb));
    background: rgba(var(--accent-rgb), 0.1);
  }

  &:active {
    transform: scale(0.96);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgb(var(--accent-rgb)), 0 0 0 4px rgba(var(--accent-rgb), 0.2);
    border-color: rgb(var(--accent-rgb));
  }

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
  }
}

.icon-button--view {
  color: rgba(255, 255, 255, 0.72);
  background: transparent;
}

.icon-button--adjust {
  color: rgb(var(--accent-rgb));
  border-color: rgba(var(--accent-rgb), 0.5);
  background: transparent;
}

.table__empty {
  padding: 1.1rem !important;
  text-align: center;
}

.skeleton-row {
  display: grid;
  grid-template-columns: 44px 1.6fr 1fr 1fr 1fr 52px;
  gap: 0.9rem;
  align-items: center;
  padding: 0.4rem 0;
}

.skeleton {
  display: block;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

.skeleton--thumb {
  width: 42px;
  height: 42px;
  border-radius: 10px;
}

.skeleton--line {
  width: 100%;
  height: 12px;
}

.skeleton--line.wide { width: 90%; }
.skeleton--line.short { width: 55%; }
.skeleton--tiny { width: 36px; height: 36px; border-radius: 8px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 2.2rem 1rem;
  color: var(--text-subtle);

  strong {
    color: var(--text-strong);
  }
}

.empty-state__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.08);
  display: grid;
  place-items: center;
  color: var(--accent-ink);
  font-size: 1.2rem;
  background: rgba(var(--accent-rgb), 0.08);
}

.table__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.85rem;
}

.table__alert--error {
  color: #fecaca;
  background: rgba(239, 68, 68, 0.08);
}

.table__alert--warning {
  color: #fcd34d;
  background: rgba(245, 158, 11, 0.07);
}

.table__retry {
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: var(--text-strong);
  border-radius: 8px;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 1.2rem;
  color: var(--text-subtle);
}

.pagination__range {
  margin: 0;
}

.pagination__pages {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-btn {
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-strong);
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 768px) {
  .page__body { padding: 1rem; }

  .table {
    min-width: 0;
  }

  .table thead {
    display: none;
  }

  .table tbody tr {
    display: block;
    padding: 0.75rem 0.8rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .table tbody td {
    display: block;
    padding: 0.35rem 0;
    border: none;
  }

  .product {
    min-width: 0;
  }

  .product__submeta {
    display: inline-flex;
    flex-wrap: wrap;
  }

  .added-on-cell,
  .updated-cell {
    display: none;
  }

  .onhand-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .table__actions.cell-actions {
    text-align: left;
    padding-top: 0.75rem;
  }

  .pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
