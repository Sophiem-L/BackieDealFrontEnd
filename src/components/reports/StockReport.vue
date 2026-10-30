<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
import { currency } from '@/lib/format'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import ReportExportMenu from './ReportExportMenu.vue'
import { fetchStockReport } from '@/services/reports'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const truncated = ref(false)
// Every tracked product, straight from the API. Search, status and category
// filtering happen in `rows` so the summary strip and the table read off the
// same scoped set.
const allRows = ref([])

const query = ref('')
const status = ref('all')
const category = ref('All Categories')

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Stock' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
]

const STATUS_LABELS = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
}

// The report is a "what needs attention" view, so the products that need a
// restock lead the table rather than being buried in alphabetical order.
const STATUS_RANK = { 'out-of-stock': 0, 'low-stock': 1, 'in-stock': 2 }

const COLUMNS = [
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'onHand', label: 'On Hand' },
  { key: 'threshold', label: 'Alert At', align: 'right' },
  { key: 'unitCost', label: 'Unit Cost', align: 'right' },
  { key: 'stockValue', label: 'Stock Value', align: 'right' },
  { key: 'status', label: 'Status' },
]

// Derived from the live data so the filter can never offer a category the
// catalogue doesn't contain.
const categories = computed(() => [
  'All Categories',
  ...new Set(allRows.value.map((row) => row.category)),
])

const rows = computed(() => {
  const needle = query.value.trim().toLowerCase()

  return allRows.value
    .filter((row) => status.value === 'all' || row.status === status.value)
    .filter((row) => category.value === 'All Categories' || row.category === category.value)
    .filter(
      (row) =>
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.sku.toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
    )
})

const summary = computed(() => ({
  products: rows.value.length,
  units: rows.value.reduce((sum, row) => sum + Math.max(row.onHand, 0), 0),
  // Rows with no cost price contribute nothing, rather than a made-up $0 each.
  value: rows.value.reduce((sum, row) => sum + (row.stockValue ?? 0), 0),
  uncosted: rows.value.filter((row) => row.stockValue === null).length,
  low: rows.value.filter((row) => row.status === 'low-stock').length,
  out: rows.value.filter((row) => row.status === 'out-of-stock').length,
}))

const hasFilters = computed(() =>
  Boolean(query.value.trim() || status.value !== 'all' || category.value !== 'All Categories'),
)

// Same meter the Inventory page draws: full at twice the alert level, so a
// product sitting on its threshold reads half full. No alert level set means
// there is nothing to compare against, so any stock reads as full.
function stockLevel(row) {
  if (row.onHand <= 0) return 0
  if (row.threshold <= 0) return 100
  return Math.min(100, Math.max(6, Math.round((row.onHand / (row.threshold * 2)) * 100)))
}

async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchStockReport(auth.accessToken)
    allRows.value = result.rows
    truncated.value = result.truncated
  } catch (err) {
    allRows.value = []
    truncated.value = false
    error.value = err.message || 'Unable to load the stock report. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadReport)

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Product', width: 44, value: (r) => r.name },
  { key: 'sku', label: 'SKU', width: 18, value: (r) => r.sku },
  { key: 'category', label: 'Category', width: 20, value: (r) => r.category },
  { key: 'brand', label: 'Brand', width: 18, value: (r) => r.brand },
  { key: 'onHand', label: 'On Hand', width: 12, align: 'right', format: '#,##0', total: true, value: (r) => r.onHand },
  { key: 'threshold', label: 'Alert At', width: 12, align: 'right', format: '#,##0', value: (r) => r.threshold },
  { key: 'unitCost', label: 'Unit Cost', width: 14, align: 'right', format: '$#,##0.00', value: (r) => r.unitCost },
  { key: 'stockValue', label: 'Stock Value (Cost)', width: 20, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.stockValue },
  { key: 'retailValue', label: 'Retail Value', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.retailValue },
  { key: 'status', label: 'Status', width: 14, value: (r) => STATUS_LABELS[r.status] },
]
</script>

<template>
  <ReportPanel
    title="Stock report"
    subtitle="Current inventory levels, value and restock risk for every tracked product."
  >
    <template #actions>
      <label class="searchbox">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" stroke-linecap="round" />
        </svg>
        <input v-model="query" type="search" placeholder="Search product or SKU" aria-label="Search stock" />
      </label>

      <Select v-model="status">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by availability">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in STATUS_OPTIONS"
            :key="option.value"
            :value="option.value"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="category">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by category">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in categories"
            :key="option"
            :value="option"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <ReportExportMenu
        sheet="Stock"
        tab="stock"
        :suffix="status === 'all' ? '' : status"
        :rows="rows"
        :columns="EXPORT_COLUMNS"
      />
    </template>

    <p v-if="loading" class="state">Loading stock report…</p>

    <p v-else-if="error" class="state state--error">
      {{ error }}
      <button type="button" class="retry" @click="loadReport">Retry</button>
    </p>

    <template v-else>
      <!-- The whole catalogue is filtered client-side; say so when it stopped early. -->
      <p v-if="truncated" class="notice">
        The catalogue is too large to load in full — showing a partial list.
      </p>

      <!-- Summary strip -->
      <ul class="strip">
        <li>
          <span class="strip__label">Products</span>
          <span class="strip__value">{{ summary.products.toLocaleString() }}</span>
        </li>
        <li>
          <span class="strip__label">Units on hand</span>
          <span class="strip__value">{{ summary.units.toLocaleString() }}</span>
        </li>
        <li>
          <span class="strip__label">Stock value (at cost)</span>
          <span class="strip__value">{{ currency.format(summary.value) }}</span>
          <span v-if="summary.uncosted" class="strip__note">
            {{ summary.uncosted }} without a cost price
          </span>
        </li>
        <li>
          <span class="strip__label">Low stock</span>
          <span class="strip__value strip__value--warning">{{ summary.low.toLocaleString() }}</span>
        </li>
        <li>
          <span class="strip__label">Out of stock</span>
          <span class="strip__value strip__value--danger">{{ summary.out.toLocaleString() }}</span>
        </li>
      </ul>

      <ReportTable
        :columns="COLUMNS"
        :row-count="rows.length"
        :empty="hasFilters ? 'No products match your filters.' : 'No tracked products yet.'"
      >
        <tr v-for="row in rows" :key="row.id">
          <td class="cell-name">
            {{ row.name }}
            <span class="cell-sku">{{ row.sku }}</span>
          </td>
          <td><span class="chip">{{ row.category }}</span></td>
          <td>
            <div class="onhand" :title="`${row.onHand} on hand · alert at ${row.threshold}`">
              <span class="onhand__count">{{ row.onHand.toLocaleString() }}</span>
              <div class="meter" :class="`meter--${row.status}`" aria-hidden="true">
                <span class="meter__fill" :style="{ width: `${stockLevel(row)}%` }"></span>
              </div>
            </div>
          </td>
          <td class="table__right num">{{ row.threshold ? row.threshold.toLocaleString() : '—' }}</td>
          <td class="table__right num">{{ row.unitCost === null ? '—' : currency.format(row.unitCost) }}</td>
          <td class="table__right num">{{ row.stockValue === null ? '—' : currency.format(row.stockValue) }}</td>
          <td>
            <span class="badge" :class="`badge--${row.status}`">{{ STATUS_LABELS[row.status] }}</span>
          </td>
        </tr>
      </ReportTable>
    </template>
  </ReportPanel>
</template>

<style scoped lang="scss">

.strip {
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, 1fr);
  }

  li {
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 0.85rem 1rem;
  }

  &__label {
    display: block;
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-subtle);
    margin-bottom: 0.3rem;
  }

  &__value {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-strong);

    &--warning {
      color: var(--accent-ink);
    }

    &--danger {
      color: var(--danger);
    }
  }

  &__note {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.68rem;
    color: var(--text-subtle);
  }
}

.cell-name {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.cell-sku {
  display: block;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-subtle);
  margin-top: 0.15rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-track);
  border-radius: 999px;
}

.num {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
}

.onhand {
  min-width: 130px;

  &__count {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--text-strong);
    font-variant-numeric: tabular-nums;
  }
}

.meter {
  height: 5px;
  max-width: 120px;
  border-radius: 999px;
  background: var(--surface-track);
  overflow: hidden;

  &__fill {
    display: block;
    height: 100%;
    border-radius: inherit;
  }

  &--in-stock .meter__fill {
    background: var(--success-solid);
  }

  &--low-stock .meter__fill {
    background: rgb(var(--accent-rgb));
  }

  &--out-of-stock .meter__fill {
    background: var(--danger-solid);
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
  white-space: nowrap;
  border-radius: 999px;

  &--in-stock {
    background: var(--success-bg);
    color: var(--success);
  }

  &--low-stock {
    background: rgb(var(--accent-rgb) / 0.2);
    color: var(--accent-ink);
  }

  &--out-of-stock {
    background: var(--danger-bg);
    color: var(--danger);
  }
}

.notice {
  margin: 0 0 1rem;
  padding: 0.7rem 1rem;
  font-size: 0.8rem;
  color: var(--accent-ink);
  background: rgb(var(--accent-rgb) / 0.12);
  border: 1px solid rgb(var(--accent-rgb) / 0.4);
  border-radius: 10px;
}

.state {
  margin: 0;
  padding: 1.5rem 1rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-subtle);

  &--error {
    color: var(--danger);
  }
}

.retry {
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

  &:hover {
    background: var(--surface-alt);
  }
}
</style>
