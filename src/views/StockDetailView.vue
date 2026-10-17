<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { fetchStockDetail } from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const item = ref(null)
const history = ref([])
const expandedItems = ref(new Set())
const filterType = ref('all')
const filterFromDate = ref('')
const filterToDate = ref('')
const showSuccessNotice = ref(false)
const successMessage = ref('')
const sortBy = ref('date') // 'date' or other fields
const sortOrder = ref('desc') // 'asc' or 'desc'

const availabilityLabels = {
  healthy: 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

const typeIcons = {
  'Inventory Recount': '📋',
  'Damaged Goods': '💔',
  'Customer Return': '↩️',
  'Supplier Delivery': '📦',
  'Theft / Loss': '⚠️',
  'Correction': '✏️',
  'adjust': '📋',
  'sale': '🛒',
  'return': '↩️',
  'restock': '📦',
}

const typeColors = {
  'Inventory Recount': '#3b82f6',
  'Damaged Goods': '#ef4444',
  'Customer Return': '#f97316',
  'Supplier Delivery': '#22c55e',
  'Theft / Loss': '#ef4444',
  'Correction': '#a855f7',
  'adjust': '#3b82f6',
  'sale': '#9333ea',
  'return': '#f97316',
  'restock': '#22c55e',
}

const filteredHistory = computed(() => {
  let result = [...history.value]

  // Filter by type
  if (filterType.value !== 'all') {
    result = result.filter(h => h.type === filterType.value || h.type?.toLowerCase() === filterType.value.toLowerCase())
  }

  // Filter by date range
  if (filterFromDate.value) {
    const fromDate = new Date(filterFromDate.value)
    result = result.filter(h => {
      const movementDate = new Date(h.timestamp || h.date)
      return movementDate >= fromDate
    })
  }

  if (filterToDate.value) {
    const toDate = new Date(filterToDate.value)
    toDate.setHours(23, 59, 59, 999)
    result = result.filter(h => {
      const movementDate = new Date(h.timestamp || h.date)
      return movementDate <= toDate
    })
  }

  // Sort by date (latest first by default)
  result.sort((a, b) => {
    const dateA = new Date(a.timestamp || a.date)
    const dateB = new Date(b.timestamp || b.date)
    return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB
  })

  return result
})

const uniqueTypes = computed(() => {
  return [...new Set(history.value.map(h => h.type))]
})

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
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function toggleExpanded(id) {
  if (expandedItems.value.has(id)) {
    expandedItems.value.delete(id)
  } else {
    expandedItems.value.add(id)
  }
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

    // Debug: Log if history is empty after loading
    if (history.value.length === 0 && item.value?.onHand > 0) {
      console.info('Stock detail loaded but no movements found. Item stock:', item.value.onHand)
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

function refreshHistory() {
  loadDetail()
}

onMounted(() => {
  loadDetail()
})

watch(() => route.params.id, () => {
  loadDetail()
})

watch(() => route.query.refresh, () => {
  if (route.query.refresh) {
    loadDetail()
  }
})
</script>

<template>
  <div class="page">
    <AppHeader title="Inventory & Stock Control" />

    <div class="page__body">
      <div v-if="showSuccessNotice" class="notice notice--success">
        <div class="notice__content">
          <svg class="notice__icon" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>{{ successMessage }}</span>
        </div>
      </div>

      <div v-if="loading" class="lead">
        <p class="muted">Loading stock details...</p>
      </div>

      <div v-else-if="error" class="lead">
        <div class="lead__row">
          <button type="button" class="lead__back" aria-label="Back to stock management" @click="router.back()">
            <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <p class="error-text">{{ error }}</p>
        </div>
      </div>

      <template v-else-if="item">
        <section class="lead">
          <div class="lead__text">
            <div class="lead__row">
              <button type="button" class="lead__back" aria-label="Back to stock management" @click="router.back()">
                <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              <h2 class="lead__title">{{ item.name }}</h2>
              <span class="badge" :class="`badge--${item.availability}`">{{ availabilityLabels[item.availability] }}</span>
            </div>
          </div>
        </section>

        <div class="grid">
          <section class="history-card">
            <header class="history-card__head">
              <div>
                <h3 class="history-card__title">Adjustment History</h3>
                <p class="history-card__subtitle">{{ filteredHistory.length }} adjustment{{ filteredHistory.length !== 1 ? 's' : '' }} recorded</p>
              </div>
              <div class="history-controls">
                <button
                  type="button"
                  class="refresh-btn"
                  @click="refreshHistory"
                  title="Refresh history"
                  aria-label="Refresh adjustment history"
                >
                  <svg viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6M4 10a8 8 0 0 1 15.3-1m-1.3 13a8 8 0 0 1-15.3 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <div class="filter-group">
                  <label for="filter-from-date" class="filter-label">From:</label>
                  <input
                    id="filter-from-date"
                    v-model="filterFromDate"
                    type="date"
                    class="filter-input"
                    title="Filter from this date"
                  />
                </div>
                <div class="filter-group">
                  <label for="filter-to-date" class="filter-label">To:</label>
                  <input
                    id="filter-to-date"
                    v-model="filterToDate"
                    type="date"
                    class="filter-input"
                    title="Filter to this date"
                  />
                </div>
                <div class="filter-group">
                  <select v-model="filterType" class="filter-select">
                    <option value="all">All Types</option>
                    <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
                  </select>
                </div>
              </div>
            </header>

            <div v-if="filteredHistory.length === 0" class="history-empty">
              <div class="history-empty__icon">📋</div>
              <p v-if="filterType !== 'all' || filterFromDate || filterToDate" class="history-empty__text">No adjustments matching the selected filters.</p>
              <p v-else class="history-empty__text">No adjustment history available yet.</p>
              <p v-if="item?.onHand > 0" class="history-empty__hint">Stock is being tracked but movement history is not yet recorded.</p>
              <button v-if="filterType !== 'all' || filterFromDate || filterToDate" type="button" class="history-empty__reset" @click="() => { filterType = 'all'; filterFromDate = ''; filterToDate = '' }">
                Clear all filters
              </button>
            </div>

            <!-- Table View -->
            <table v-else class="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance</th>
                  <th>Adjusted By</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in filteredHistory" :key="entry.id" class="table-row">
                  <td class="muted">{{ entry.date }}</td>
                  <td>
                    <span class="type-badge" :style="{ backgroundColor: typeColors[entry.type] + '20', borderColor: typeColors[entry.type], color: typeColors[entry.type] }">
                      <span class="type-badge__icon">{{ typeIcons[entry.type] || '📌' }}</span>
                      {{ entry.displayType || entry.type }}
                    </span>
                  </td>
                  <td>
                    <span class="change" :class="entry.change >= 0 ? 'change--up' : 'change--down'">{{ signed(entry.change) }}</span>
                  </td>
                  <td class="balance">{{ entry.balance }} units</td>
                  <td>
                    <span class="user-cell">
                      <span class="user-avatar-small">{{ getInitials(entry.by) }}</span>
                      <span class="muted">{{ entry.by }}</span>
                    </span>
                  </td>
                  <td class="muted">{{ entry.reference || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </section>

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

            <dl class="info">
              <div class="info__row"><dt>Category</dt><dd>{{ item.category }}</dd></div>
              <div class="info__row"><dt>Warehouse Location</dt><dd>{{ item.location }}</dd></div>
              <div class="info__row"><dt>Start Date</dt><dd>{{ item.startDate }}</dd></div>
              <div class="info__row"><dt>Last Updated</dt><dd>{{ item.lastUpdated }}</dd></div>
            </dl>
          </section>
        </div>
      </template>
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

.lead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.4rem;
  }

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-body);
    cursor: pointer;
    &:hover { background: var(--surface-hover); }
    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__title { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-strong); }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.history-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;

  &__head {
    padding: 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0 0 0.25rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__subtitle {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
}

.history-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-body);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:hover { border-color: var(--border-subtle); }
  &:focus { outline: none; border-color: rgb(var(--accent-rgb)); }
}

.filter-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-body);
  font-size: 0.85rem;
  max-width: 140px;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &:hover { border-color: var(--border-subtle); }
  &:focus { outline: none; border-color: rgb(var(--accent-rgb)); }
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  select,
  input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-body);
    font-size: 0.85rem;
    transition: border-color 0.2s ease;

    &:hover { border-color: var(--border-subtle); }
    &:focus { outline: none; border-color: rgb(var(--accent-rgb)); }
  }

  select { cursor: pointer; }

  input[type="date"] {
    max-width: 140px;
    font-family: inherit;
  }
}

.filter-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.view-toggle {
  display: flex;
  gap: 0.25rem;
  background: var(--surface-hover);
  border-radius: 8px;
  padding: 0.25rem;

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;

    svg { width: 18px; height: 18px; stroke-width: 1.5; }

    &:hover {
      color: var(--text-body);
      background: var(--surface);
    }

    &--active {
      color: rgb(var(--accent-rgb));
      background: var(--surface);
      font-weight: 600;
    }
  }
}

.history-empty {
  padding: 3rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  &__icon {
    font-size: 3rem;
    opacity: 0.5;
  }

  &__text {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  &__hint {
    margin: 0;
    color: var(--text-subtle);
    font-size: 0.85rem;
  }

  &__reset {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-body);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s ease;
    margin-top: 0.5rem;

    &:hover {
      background: var(--surface-hover);
      border-color: var(--border-subtle);
    }
  }
}

.timeline {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.timeline-item {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.timeline-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.2rem;

  &__icon {
    font-size: 1.2rem;
  }
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.timeline-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.timeline-date {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.timeline-details {
  display: grid;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.detail-label {
  color: var(--text-muted);
  font-weight: 500;
  flex: 0 0 auto;
  min-width: 80px;
}

.detail-value {
  color: var(--text-body);
  font-weight: 500;
}

.detail-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-body);
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgb(var(--accent-rgb) / 0.15);
  color: rgb(var(--accent-rgb));
  font-size: 0.75rem;
  font-weight: 700;
}

.user-avatar-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgb(var(--accent-rgb) / 0.15);
  color: rgb(var(--accent-rgb));
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;

  &__icon {
    font-size: 1rem;
  }
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.85rem 1.25rem; vertical-align: middle; }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody {
    .table-row {
      border-top: 1px solid var(--border-subtle);
      transition: background-color 0.15s ease;

      &:hover { background: var(--surface-sunken); }
    }
  }

  td {
    font-size: 0.86rem;
    color: var(--text-strong);

    &.muted { color: var(--text-subtle); }
  }
}

.change {
  font-weight: 700;
  &--up { color: var(--success); }
  &--down { color: var(--danger); }
}

.balance { font-weight: 600; }

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
}

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

    &--img {
      display: block;
      object-fit: cover;
    }
  }

  &__name { margin: 0.15rem 0 0; font-size: 0.95rem; font-weight: 700; line-height: 1.35; color: var(--text-strong); }
  &__sku { margin: 0.2rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }
}

.error-text {
  color: var(--danger);
  font-size: 0.9rem;
  margin: 0;
}

.info {
  margin: 0;
  padding-top: 0.5rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0;

    & + & { border-top: 1px solid var(--border-subtle); }

    dt { font-size: 0.82rem; color: var(--text-subtle); }
    dd { margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--text-strong); }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;

  &--healthy { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}

.notice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  border: 1px solid;
  animation: slideDown 0.3s ease-out;

  &__content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  &--success {
    background: var(--success-bg);
    color: var(--success);
    border-color: var(--success);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 2;
  }

  &:hover {
    color: var(--text-body);
    border-color: var(--border-subtle);
    background: var(--surface-hover);
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>
