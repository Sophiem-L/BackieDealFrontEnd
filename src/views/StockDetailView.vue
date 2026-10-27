<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { fetchStockDetail } from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const item = ref(null)
const history = ref([])
const filterType = ref('all')
const filterFromDate = ref('')
const filterToDate = ref('')
const showSuccessNotice = ref(false)
const successMessage = ref('')

// The detail endpoint labels a healthy product 'healthy'; the list labels the
// same state 'in-stock'. Both read the same here.
const availabilityLabels = {
  healthy: 'In Stock',
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

// A movement's type is free text — either the reason the admin picked or the
// label for its movement kind — so it is matched case-insensitively. Anything
// unrecognised falls back to neutral rather than guessing a colour.
const TYPE_TONES = {
  'inventory recount': 'info',
  'stock adjustment': 'info',
  adjust: 'info',
  'damaged goods': 'danger',
  'theft / loss': 'danger',
  'stock out': 'danger',
  'customer return': 'warning',
  return: 'warning',
  'supplier delivery': 'success',
  restock: 'success',
  correction: 'violet',
  sale: 'violet',
}

function typeTone(type) {
  return TYPE_TONES[String(type ?? '').toLowerCase()] ?? 'neutral'
}

const hasActiveFilters = computed(
  () => filterType.value !== 'all' || Boolean(filterFromDate.value || filterToDate.value),
)

const filteredHistory = computed(() => {
  let result = [...history.value]

  // Filter by type
  if (filterType.value !== 'all') {
    result = result.filter(
      (h) => h.type === filterType.value || h.type?.toLowerCase() === filterType.value.toLowerCase(),
    )
  }

  // Filter by date range
  if (filterFromDate.value) {
    const fromDate = new Date(filterFromDate.value)
    result = result.filter((h) => new Date(h.timestamp || h.date) >= fromDate)
  }

  if (filterToDate.value) {
    const toDate = new Date(filterToDate.value)
    toDate.setHours(23, 59, 59, 999)
    result = result.filter((h) => new Date(h.timestamp || h.date) <= toDate)
  }

  // Newest first
  result.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date))

  return result
})

const uniqueTypes = computed(() => [...new Set(history.value.map((h) => h.type))].filter(Boolean))

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`
}

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

function getInitials(name) {
  return String(name ?? '')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function clearFilters() {
  filterType.value = 'all'
  filterFromDate.value = ''
  filterToDate.value = ''
}

// Falls back to the list when the page was opened directly (a bookmark or a
// pasted link), where history.back() would leave the app.
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'stock' })
}

const brokenThumb = ref(false)
function onThumbError() {
  brokenThumb.value = true
}

async function loadDetail() {
  const id = route.params.id
  if (!id) return

  loading.value = true
  error.value = ''
  try {
    const result = await fetchStockDetail(id, auth.accessToken)
    item.value = result.item

    // Ensure history is always an array with proper data structure
    if (Array.isArray(result.movements)) {
      history.value = result.movements
    } else if (result.movements?.items && Array.isArray(result.movements.items)) {
      history.value = result.movements.items
    } else {
      history.value = []
    }

    // Show success message if coming from adjustment form
    if (route.query.refresh) {
      showSuccessNotice.value = true
      successMessage.value = 'Stock adjustment added successfully!'
      setTimeout(() => {
        showSuccessNotice.value = false
      }, 3000)
    }
  } catch (err) {
    error.value = err.message || 'Unable to load stock details. Please try again.'
    history.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDetail()
})

watch(
  () => route.params.id,
  () => {
    loadDetail()
  },
)

watch(
  () => route.query.refresh,
  () => {
    if (route.query.refresh) {
      loadDetail()
    }
  },
)
</script>

<template>
  <div class="page">
    <AppHeader title="Inventory & Stock Control" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <button type="button" class="back-btn" aria-label="Back to stock management" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <h2 class="subhead__title">{{ item?.name || 'Stock Detail' }}</h2>
        <span v-if="item" class="badge" :class="`badge--${item.availability}`">
          {{ availabilityLabels[item.availability] }}
        </span>
      </div>

      <div v-if="showSuccessNotice" class="notice notice--success" role="status">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ successMessage }}</span>
      </div>

      <section v-if="loading" class="empty">
        <p>Loading stock details…</p>
      </section>

      <section v-else-if="error" class="empty">
        <p class="empty__error" role="alert">{{ error }}</p>
        <div class="empty__actions">
          <BaseButton variant="ghost" @click="loadDetail">Try again</BaseButton>
          <BaseButton variant="ghost" :to="{ name: 'stock' }">Back to Stock</BaseButton>
        </div>
      </section>

      <div v-else-if="item" class="grid">
        <!-- Adjustment history -->
        <section class="card card--flush">
          <header class="card__head">
            <div>
              <h3 class="card__title">Adjustment History</h3>
              <p class="card__subtitle">
                {{ filteredHistory.length }} adjustment{{ filteredHistory.length !== 1 ? 's' : '' }} recorded
              </p>
            </div>

            <div class="filters">
              <button
                type="button"
                class="icon-btn"
                title="Refresh history"
                aria-label="Refresh adjustment history"
                @click="loadDetail"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M21 3v5h-5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M8 16H3v5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>

              <DateRangeFilter
                v-model:from="filterFromDate"
                v-model:to="filterToDate"
                label="Adjustments between"
                from-label="Adjusted from"
                to-label="Adjusted to"
              />

              <Select v-model="filterType">
                <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by adjustment type">
                  <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
                  </svg>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent :class="TOOLBAR_SELECT.content">
                  <SelectItem value="all" :class="TOOLBAR_SELECT.item">All Types</SelectItem>
                  <SelectItem
                    v-for="type in uniqueTypes"
                    :key="type"
                    :value="type"
                    :class="TOOLBAR_SELECT.item"
                  >
                    {{ type }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </header>

          <div v-if="filteredHistory.length === 0" class="state">
            <p class="state__text">
              {{ hasActiveFilters ? 'No adjustments match the selected filters.' : 'No adjustment history available yet.' }}
            </p>
            <p v-if="!hasActiveFilters && item.onHand > 0" class="state__hint">
              Stock is being tracked but movement history is not yet recorded.
            </p>
            <BaseButton v-if="hasActiveFilters" variant="ghost" size="sm" @click="clearFilters">
              Clear all filters
            </BaseButton>
          </div>

          <div v-else class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance</th>
                  <th>Adjusted By</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in filteredHistory" :key="entry.id">
                  <td class="muted">{{ entry.date }}</td>
                  <td>
                    <span class="type-badge" :class="`type-badge--${typeTone(entry.type)}`">
                      <span class="type-badge__dot" aria-hidden="true"></span>
                      {{ entry.displayType || entry.type }}
                    </span>
                  </td>
                  <td>
                    <span class="change" :class="entry.change >= 0 ? 'change--up' : 'change--down'">{{ signed(entry.change) }}</span>
                  </td>
                  <td class="balance">{{ entry.balance }} units</td>
                  <td>
                    <span class="user-cell">
                      <span class="user-avatar" aria-hidden="true">{{ getInitials(entry.by) }}</span>
                      <span class="muted">{{ entry.by }}</span>
                    </span>
                  </td>
                  <td class="muted">{{ entry.reference || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Side column -->
        <div class="col">
          <section class="card">
            <h3 class="card__title">Product Information</h3>
            <div class="product">
              <img
                v-if="item.thumbnail && !brokenThumb"
                :src="item.thumbnail"
                :alt="item.name"
                class="product__thumb product__thumb--img"
                @error="onThumbError"
              />
              <span v-else class="product__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
              <div>
                <p class="product__name">{{ item.name }}</p>
                <p class="product__sku">SKU: {{ item.sku }}</p>
              </div>
            </div>

            <dl class="kv">
              <div class="kv__row"><dt>Category</dt><dd>{{ item.category }}</dd></div>
              <div class="kv__row"><dt>Warehouse Location</dt><dd>{{ item.location }}</dd></div>
              <div class="kv__row"><dt>Start Date</dt><dd>{{ item.startDate }}</dd></div>
              <div class="kv__row"><dt>Last Updated</dt><dd>{{ item.lastUpdated }}</dd></div>
            </dl>
          </section>

          <section class="card">
            <h3 class="card__title">Stock Summary</h3>
            <div class="summary">
              <div class="summary__item">
                <p class="summary__label">On Hand</p>
                <p class="summary__value" :class="`summary__value--${item.availability}`">{{ item.onHand.toLocaleString() }}</p>
              </div>
              <div class="summary__item">
                <p class="summary__label">Alert Level</p>
                <p class="summary__value">{{ item.threshold > 0 ? item.threshold.toLocaleString() : '—' }}</p>
              </div>
            </div>
          </section>
        </div>
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

/* Sub header */
.subhead {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  &__title { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-strong); }
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  flex-shrink: 0;
  background: var(--bg);
  border: none;
  border-radius: 9px;
  color: var(--text-body);
  cursor: pointer;
  &:hover { background: var(--surface-hover); border-color: transparent; }
  svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.9; }
}

/* Layout — history on the left, product details on the right. */
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  /* The history card runs its table edge to edge, so the padding moves to the head. */
  &--flush { padding: 0; overflow: hidden; }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__head &__title { margin: 0 0 0.25rem; }

  &__subtitle { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
}

.filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover { background: var(--surface-alt); color: var(--text-strong); border-color: var(--border); }
  &:focus-visible { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }
  &:active { transform: scale(0.96); }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

/* Table */
.table-wrap { overflow-x: auto; }

.table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.85rem 1.25rem; vertical-align: middle; }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  td {
    font-size: 0.86rem;
    color: var(--text-strong);

    &.muted { color: var(--text-subtle); }
  }
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--surface-track);
  color: var(--text-muted);

  &__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  &--info { background: var(--info-bg); color: var(--info); }
  &--danger { background: var(--danger-bg); color: var(--danger); }
  &--warning { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--success { background: var(--success-bg); color: var(--success); }
  &--violet { background: var(--violet-bg); color: var(--violet); }
}

.change {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  &--up { color: var(--success); }
  &--down { color: var(--danger); }
}

.balance { font-weight: 600; font-variant-numeric: tabular-nums; }

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgb(var(--accent-rgb) / 0.16);
  color: var(--accent-ink);
  font-size: 0.66rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* Empty history */
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2.5rem 1.25rem;
  text-align: center;

  &__text { margin: 0; font-size: 0.88rem; color: var(--text-subtle); }
  &__hint { margin: 0; font-size: 0.8rem; color: var(--text-subtle); }
}

/* Product information */
.product {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 84px;
    height: 84px;
    border-radius: 12px;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-weight: 700;
    flex-shrink: 0;
    overflow: hidden;

    &--img { display: block; object-fit: cover; }
  }

  &__name { margin: 0.15rem 0 0; font-size: 0.95rem; font-weight: 700; line-height: 1.35; color: var(--text-strong); }
  &__sku { margin: 0.2rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }
}

/* Key/value */
.kv {
  margin: 0;
  padding-top: 0.5rem;

  &__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0;

    & + & { border-top: 1px solid var(--border-subtle); }

    dt { margin: 0; font-size: 0.82rem; color: var(--text-subtle); flex-shrink: 0; }
    dd { margin: 0; font-size: 0.86rem; font-weight: 600; color: var(--text-strong); text-align: right; }
  }
}

/* Stock summary */
.summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  &__item {
    padding: 1rem;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    background: var(--surface-sunken);
  }

  &__label {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__value {
    margin: 0.35rem 0 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-strong);

    &--low-stock { color: var(--accent-ink); }
    &--out-of-stock { color: var(--danger); }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.7rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  border-radius: 999px;

  &--healthy,
  &--in-stock { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}

.notice {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  font-size: 0.86rem;
  font-weight: 500;
  border-radius: 10px;
  border: 1px solid;

  svg { width: 18px; height: 18px; flex-shrink: 0; stroke: currentColor; stroke-width: 2; }

  &--success {
    background: var(--success-bg);
    color: var(--success);
    border-color: var(--success-border);
  }
}

/* Loading / error */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  color: var(--text-subtle);
  font-size: 0.9rem;

  p { margin: 0; }

  &__error { color: var(--danger); }
  &__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: center; }
}
</style>
