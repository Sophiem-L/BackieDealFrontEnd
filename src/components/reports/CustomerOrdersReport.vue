<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import GranularityTabs from './GranularityTabs.vue'
import TrendChart from './TrendChart.vue'
import ReportExportMenu from './ReportExportMenu.vue'
import ReportRangeFilter from './ReportRangeFilter.vue'
import { fetchCustomerOrdersReport, normalizeCustomerOrdersPayload } from '@/services/reports'
import { useReportRange } from '@/composables/useReportRange'
import { currency } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const range = useReportRange()
const granularity = ref('monthly')
const loading = ref(true)
const error = ref('')
const report = ref(normalizeCustomerOrdersPayload({}))

const COLUMNS = [
  { key: 'period', label: 'Period' },
  { key: 'orders', label: 'Orders', align: 'right' },
  { key: 'uniqueCustomers', label: 'Unique Customers', align: 'right' },
  { key: 'newCustomers', label: 'New', align: 'right' },
  { key: 'returningCustomers', label: 'Returning', align: 'right' },
  { key: 'split', label: 'New vs Returning' },
  { key: 'avgItems', label: 'Avg. Items / Order', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
]

const rows = computed(() => report.value.rows)

// `label` is the short axis text; the longer period name shows in the tooltip.
const points = computed(() =>
  rows.value.map((row) => ({ label: row.label, title: row.period, value: row.orders })),
)

// From the backend, not summed from the rows: a customer who ordered in three
// periods is one customer, however many rows they appear in.
const totals = computed(() => report.value.totals)

function plural(count, noun) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}

function newPct(row) {
  const unique = row.uniqueCustomers
  return unique ? (row.newCustomers / unique) * 100 : 0
}

// Only the newest request may fill the page, so a slow earlier response for a
// different period or range can't overwrite the one just chosen.
let latestRequest = 0

async function loadReport() {
  const request = ++latestRequest
  loading.value = true
  error.value = ''
  try {
    const result = await fetchCustomerOrdersReport(
      { granularity: granularity.value, ...(range.applied.value ?? {}) },
      auth.accessToken,
    )
    if (request === latestRequest) report.value = result
  } catch (err) {
    if (request === latestRequest) {
      report.value = normalizeCustomerOrdersPayload({})
      error.value = err.message || 'Unable to load the report. Please try again.'
    }
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

onMounted(loadReport)
watch([granularity, range.key], loadReport)

const EXPORT_COLUMNS = [
  { key: 'period', label: 'Period', width: 22, value: (r) => r.period },
  { key: 'dateRange', label: 'Date Range', width: 26, value: (r) => r.dateRange },
  { key: 'orders', label: 'Orders', width: 12, align: 'right', format: '#,##0', total: true, value: (r) => r.orders },
  { key: 'uniqueCustomers', label: 'Unique Customers', width: 20, align: 'right', format: '#,##0', total: true, value: (r) => r.uniqueCustomers },
  { key: 'newCustomers', label: 'New Customers', width: 18, align: 'right', format: '#,##0', total: true, value: (r) => r.newCustomers },
  { key: 'returningCustomers', label: 'Returning', width: 14, align: 'right', format: '#,##0', total: true, value: (r) => r.returningCustomers },
  { key: 'avgItems', label: 'Avg. Items / Order', width: 18, align: 'right', format: '0.0', value: (r) => r.avgItems },
  { key: 'revenue', label: 'Revenue', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.revenue },
]

const exportSuffix = computed(() =>
  [granularity.value, range.suffix.value].filter(Boolean).join('-'),
)

const pdfSubtitle = computed(() => {
  const { date_from: from, date_to: to } = report.value.meta
  const label = granularity.value.charAt(0).toUpperCase() + granularity.value.slice(1)
  return from && to ? `${label} · ${from} — ${to}` : label
})

// Customers are counted once across the whole range here, which is why these
// come from the backend and are not the PDF table's own totals row.
const pdfSummary = computed(() => [
  { label: 'Orders', value: totals.value.orders.toLocaleString() },
  { label: 'Unique customers', value: totals.value.uniqueCustomers.toLocaleString() },
  { label: 'New customers', value: totals.value.newCustomers.toLocaleString() },
  { label: 'Returning customers', value: totals.value.returningCustomers.toLocaleString() },
  { label: 'Revenue', value: currency.format(totals.value.revenue) },
])

const jsonDocument = computed(() => ({
  report: 'Customer Orders',
  period: granularity.value,
  date_from: report.value.meta.date_from ?? null,
  date_to: report.value.meta.date_to ?? null,
  timezone: report.value.meta.timezone ?? null,
  totals: {
    orders: totals.value.orders,
    unique_customers: totals.value.uniqueCustomers,
    new_customers: totals.value.newCustomers,
    returning_customers: totals.value.returningCustomers,
    revenue: totals.value.revenue,
  },
}))
</script>

<template>
  <div class="stack">
    <ReportPanel title="Customer orders" subtitle="Order volume across the selected period.">
      <template #actions>
        <GranularityTabs v-model="granularity" />
        <ReportRangeFilter
          v-model:from="range.from.value"
          v-model:to="range.to.value"
          :error="range.error.value"
          @clear="range.clear"
        />
        <span class="legend"><i></i> Orders</span>
      </template>

      <p v-if="loading" class="state">Loading customer orders…</p>

      <p v-else-if="error" class="state state--error">{{ error }}</p>

      <template v-else>
        <p class="metric">
          {{ totals.orders.toLocaleString() }}<span> orders from {{ plural(totals.uniqueCustomers, 'customer') }}
            across {{ plural(rows.length, 'period') }}</span>
        </p>

        <TrendChart :points="points" unit="orders" />
      </template>
    </ReportPanel>

    <ReportPanel title="Breakdown" subtitle="New versus returning customers per period.">
      <template #actions>
        <ReportExportMenu
          sheet="Customer Orders"
          tab="customer-orders"
          :suffix="exportSuffix"
          :rows="rows"
          :columns="EXPORT_COLUMNS"
          pdf-title="Customer Order Report"
          :pdf-subtitle="pdfSubtitle"
          :summary="pdfSummary"
          :json-document="jsonDocument"
        />
      </template>

      <p v-if="loading" class="state">Loading breakdown…</p>

      <p v-else-if="error" class="state state--error">{{ error }}</p>

      <template v-else>
        <ReportTable :columns="COLUMNS" :row-count="rows.length">
          <tr v-for="row in rows" :key="row.period">
            <td class="cell-period">{{ row.period }}</td>
            <td class="table__right num">{{ row.orders.toLocaleString() }}</td>
            <td class="table__right num">{{ row.uniqueCustomers.toLocaleString() }}</td>
            <td class="table__right num">{{ row.newCustomers.toLocaleString() }}</td>
            <td class="table__right num">{{ row.returningCustomers.toLocaleString() }}</td>
            <td>
              <div
                class="split"
                :title="`${row.newCustomers} new · ${row.returningCustomers} returning`"
              >
                <div class="split__new" :style="{ width: newPct(row) + '%' }"></div>
              </div>
            </td>
            <td class="table__right num">{{ row.avgItems.toFixed(1) }}</td>
            <td class="table__right num">{{ currency.format(row.revenue) }}</td>
          </tr>
        </ReportTable>

        <p class="footnote">
          <i class="dot dot--new"></i> New
          <i class="dot dot--ret"></i> Returning
          <span>· a customer is new in the period of their first order, and returning in every later one</span>
        </p>
      </template>
    </ReportPanel>
  </div>
</template>

<style scoped lang="scss">

.stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.metric {
  margin: 0 0 1rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-strong);

  span {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-subtle);
  }
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: var(--text-subtle);

  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: rgb(var(--accent-rgb));
  }
}

.cell-period {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.num {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

/* Proportional new-vs-returning bar: the track is the returning share, the fill
   the new share, so the two always read as one whole. */
.split {
  min-width: 120px;
  height: 8px;
  border-radius: 999px;
  background: var(--info);
  overflow: hidden;

  &__new {
    height: 100%;
    border-radius: 999px 0 0 999px;
    background: rgb(var(--accent-rgb));
  }
}

.footnote {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 1rem 0 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-subtle);

  span {
    font-weight: 500;
  }
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;

  &--new {
    background: rgb(var(--accent-rgb));
  }

  &--ret {
    background: var(--info);
    margin-left: 0.5rem;
  }
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
