<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import GranularityTabs from './GranularityTabs.vue'
import ReportExportMenu from './ReportExportMenu.vue'
import { fetchSoldProductsReport } from '@/services/reports'
import { useAuthStore } from '@/stores/auth'
import { currency } from '@/lib/format'

const auth = useAuthStore()
const granularity = ref('monthly')
const category = ref('All Categories')

const loading = ref(true)
const error = ref('')
// Base rows for the active granularity, straight from the API. Category
// filtering and ranking happen in `rows` so the table and the summary strip
// always read off the same scoped set.
const reportTable = ref([])

const COLUMNS = [
  { key: 'rank', label: '#' },
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'units', label: 'Units Sold' },
  { key: 'share', label: 'Share', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
]

// Derived from the live data so the filter can never offer a category the
// current period doesn't actually contain.
const productCategories = computed(() => [
  'All Categories',
  ...new Set(reportTable.value.map((row) => row.category)),
])

const rows = computed(() => {
  const scoped =
    category.value === 'All Categories'
      ? reportTable.value
      : reportTable.value.filter((row) => row.category === category.value)

  return [...scoped]
    .sort((a, b) => b.units - a.units)
    .map((row, index) => ({ ...row, rank: index + 1 }))
})

// Summary follows the category filter rather than reporting the whole bucket,
// so the strip and the table below it never disagree.
const summary = computed(() => {
  const unitsByCategory = new Map()
  for (const row of rows.value) {
    unitsByCategory.set(row.category, (unitsByCategory.get(row.category) ?? 0) + row.units)
  }
  const top = [...unitsByCategory.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    units: rows.value.reduce((sum, row) => sum + row.units, 0),
    // The report API doesn't expose order counts, so the strip shows '—' for
    // this stat rather than a fabricated figure.
    orders: null,
    distinctProducts: rows.value.length,
    topCategory: top ? top[0] : '—',
  }
})

const totalUnits = computed(() => rows.value.reduce((sum, row) => sum + row.units, 0))
const unitsPeak = computed(() => Math.max(...rows.value.map((row) => row.units), 1))

function sharePct(units) {
  return totalUnits.value ? Math.round((units / totalUnits.value) * 1000) / 10 : 0
}

async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchSoldProductsReport(
      { granularity: granularity.value },
      auth.accessToken,
    )
    reportTable.value = result.rows

    // A category from a previous period may not exist in the new one; falling
    // back keeps the dashboard legible instead of showing an empty table.
    if (!productCategories.value.includes(category.value)) {
      category.value = 'All Categories'
    }
  } catch (err) {
    reportTable.value = []
    error.value = err.message || 'Unable to load the report. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadReport()
})

watch(granularity, () => {
  loadReport()
})

const EXPORT_COLUMNS = [
  { key: 'rank', label: '#', width: 6, align: 'right', value: (r) => r.rank },
  { key: 'name', label: 'Product', width: 44, value: (r) => r.name },
  { key: 'sku', label: 'SKU', width: 18, value: (r) => r.sku },
  { key: 'category', label: 'Category', width: 20, value: (r) => r.category },
  { key: 'units', label: 'Units Sold', width: 14, align: 'right', format: '#,##0', total: true, value: (r) => r.units },
  { key: 'share', label: 'Share %', width: 12, align: 'right', format: '0.0"%"', value: (r) => sharePct(r.units) },
  { key: 'revenue', label: 'Revenue', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.revenue },
]
</script>

<template>
  <ReportPanel
    title="Sold products"
    subtitle="Units and revenue by product for the selected period."
  >
    <template #actions>
      <GranularityTabs v-model="granularity" />

      <Select v-model="category">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by category">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in productCategories"
            :key="option"
            :value="option"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <ReportExportMenu
        sheet="Sold Products"
        tab="sold-products"
        :suffix="granularity"
        :rows="rows"
        :columns="EXPORT_COLUMNS"
      />
    </template>

    <p v-if="loading" class="state">Loading sold products…</p>

    <p v-else-if="error" class="state state--error">{{ error }}</p>

    <template v-else>
      <!-- Summary strip -->
      <ul class="strip">
        <li>
          <span class="strip__label">Units sold</span>
          <span class="strip__value">{{ summary.units.toLocaleString() }}</span>
        </li>
        <li>
          <span class="strip__label">Orders</span>
          <span class="strip__value">{{ summary.orders === null ? '—' : summary.orders.toLocaleString() }}</span>
        </li>
        <li>
          <span class="strip__label">Products</span>
          <span class="strip__value">{{ summary.distinctProducts.toLocaleString() }}</span>
        </li>
        <li>
          <span class="strip__label">Top category</span>
          <span class="strip__value strip__value--text">{{ summary.topCategory }}</span>
        </li>
      </ul>

      <ReportTable :columns="COLUMNS" :row-count="rows.length">
        <tr v-for="row in rows" :key="row.productId">
          <td><span class="rankbadge">{{ row.rank }}</span></td>
          <td class="cell-name">
            {{ row.name }}
            <span class="cell-sku">{{ row.sku }}</span>
          </td>
          <td><span class="chip">{{ row.category }}</span></td>
          <td>
            <div class="units">
              <span class="units__count">{{ row.units.toLocaleString() }}</span>
              <div class="units__track">
                <div class="units__fill" :style="{ width: (row.units / unitsPeak) * 100 + '%' }"></div>
              </div>
            </div>
          </td>
          <td class="table__right share">{{ sharePct(row.units) }}%</td>
          <td class="table__right money">{{ currency.format(row.revenue) }}</td>
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
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

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

    &--text {
      font-size: 0.95rem;
    }
  }
}

.rankbadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent-ink);
  background: rgb(var(--accent-rgb) / 0.18);
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

.units {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 170px;

  &__count {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-strong);
    width: 48px;
  }

  &__track {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: var(--surface-track);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    background: rgb(var(--accent-rgb));
  }
}

.share {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-strong);
}

.money {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
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
</style>
