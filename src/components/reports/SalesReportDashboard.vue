<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { TrendingDown, TrendingUp } from '@lucide/vue'
import ReportExportMenu from './ReportExportMenu.vue'
import ReportRangeFilter from './ReportRangeFilter.vue'
import { fetchSalesReport, normalizeSalesReportPayload } from '@/services/reports'
import { useReportRange } from '@/composables/useReportRange'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const range = useReportRange()
const period = ref('weekly')
const loading = ref(true)
const error = ref('')
const report = ref(normalizeSalesReportPayload({}))
const periods = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
]

const selectedPeriod = computed(() => periods.find((item) => item.key === period.value))
const meta = computed(() => report.value.meta ?? {})
const summary = computed(() => report.value.summary)

// A single day is split by hour, so there is no weekday spread to show for it.
const isHourly = computed(() => meta.value.unit === 'hour')
const UNIT_LABELS = { hour: 'Hour', day: 'Day', week: 'Week', month: 'Month', year: 'Year' }
const UNIT_ADVERBS = { hour: 'Hourly', day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }
const periodColumn = computed(() => UNIT_LABELS[meta.value.unit] ?? 'Period')
const tableTitle = computed(() => `${UNIT_ADVERBS[meta.value.unit] ?? 'Period'} Summary Table`)

// "Today's Revenue" for the daily view, "Weekly Revenue" / "Monthly Revenue" otherwise,
// and a neutral "Period" once the dates are chosen by hand.
const periodPrefix = computed(() => {
  if (range.applied.value) return 'Period'
  return period.value === 'daily' ? "Today's" : selectedPeriod.value.label
})

const dateRangeLabel = computed(() => {
  const { date_from: from, date_to: to } = meta.value
  return from && to ? (from === to ? from : `${from} — ${to}`) : 'Current reporting period'
})
const comparisonLabel = computed(() => {
  const { previous_date_from: from, previous_date_to: to } = meta.value
  return from && to ? `Compared with ${from} — ${to}` : 'Compared with the previous period'
})

const chartBars = computed(() => {
  const points = report.value.chart
  const peak = Math.max(...points.map((point) => point.revenue), 1)
  // Thirty daily bars would print thirty overlapping labels; show every nth.
  const labelEvery = Math.max(1, Math.ceil(points.length / 12))

  return points.map((point, index) => ({
    ...point,
    revenueHeight: (Math.max(point.revenue, 0) / peak) * 100,
    profitHeight: (Math.max(point.profit, 0) / peak) * 100,
    showLabel: index % labelEvery === 0,
    tip: `${point.title}: ${money(point.revenue)} revenue · ${money(point.profit)} profit · ${point.orders} orders`,
  }))
})

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)
}

/**
 * How a figure moved against the period before. Null means there was nothing to
 * compare with, which reads as a dash rather than a flat 0%. A cost going up is
 * the bad direction, hence `inverse`.
 */
function delta(value, { inverse = false, suffix = '%' } = {}) {
  if (value === null || value === undefined) return { text: '—', tone: 'neutral' }

  const up = value > 0
  const down = value < 0
  const good = inverse ? down : up
  const bad = inverse ? up : down

  return {
    text: `${up ? '+' : ''}${value.toFixed(1)}${suffix}`,
    tone: good ? 'positive' : bad ? 'negative' : 'neutral',
    icon: up ? TrendingUp : down ? TrendingDown : null,
  }
}

const cards = computed(() => {
  const s = summary.value

  return [
    { key: 'revenue', label: `${periodPrefix.value} Revenue`, value: money(s.revenue), delta: delta(s.revenueChange) },
    { key: 'cogs', label: `${periodPrefix.value} Cost (COGS)`, value: money(s.cogs), delta: delta(s.cogsChange, { inverse: true }) },
    { key: 'profit', label: `${periodPrefix.value} Profit`, value: money(s.profit), delta: delta(s.profitChange) },
    { key: 'margin', label: `${periodPrefix.value} Margin`, value: `${s.margin.toFixed(1)}%`, delta: delta(s.marginChange, { suffix: 'pp' }) },
    {
      key: 'orders',
      label: `${periodPrefix.value} Orders`,
      value: s.orders.toLocaleString(),
      delta: delta(s.ordersChange),
      note: `Avg. order ${money(s.averageOrderValue)}`,
    },
  ]
})

const EXPORT_COLUMNS = [
  { key: 'period', label: 'Period', width: 22, value: (r) => r.period },
  { key: 'dateRange', label: 'Date Range', width: 26, value: (r) => r.dateRange },
  { key: 'orders', label: 'Orders', width: 12, align: 'right', format: '#,##0', total: true, value: (r) => r.orders },
  { key: 'revenue', label: 'Total Sales', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.revenue },
  { key: 'cogs', label: 'Total COGS', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.cogs },
  { key: 'profit', label: 'Gross Profit', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.profit },
  { key: 'margin', label: 'Margin %', width: 12, align: 'right', format: '0.0"%"', value: (r) => r.margin },
  { key: 'revenueChange', label: 'vs Previous %', width: 14, align: 'right', format: '0.0"%"', value: (r) => r.revenueChange },
]

// The ranking shown on the page, as a table of its own in the PDF and the workbook.
const RANKING_COLUMNS = [
  { key: 'rank', label: 'Rank', width: 8, align: 'right', format: '#,##0', value: (r) => r.rank },
  { key: 'name', label: 'Product', width: 40, value: (r) => r.name },
  { key: 'units', label: 'Units Sold', width: 14, align: 'right', format: '#,##0', total: true, value: (r) => r.units },
  { key: 'revenue', label: 'Sales', width: 16, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.revenue },
  { key: 'share', label: 'Share %', width: 12, align: 'right', format: '0.0"%"', value: (r) => r.share },
]

const extraTables = computed(() => [
  { title: 'Top Products', columns: RANKING_COLUMNS, rows: report.value.topProducts },
])

const exportSuffix = computed(() =>
  [period.value, range.suffix.value].filter(Boolean).join('-'),
)

const pdfSubtitle = computed(() => `${selectedPeriod.value.label} · ${dateRangeLabel.value}`)

const pdfSummary = computed(() => [
  { label: 'Revenue', value: money(summary.value.revenue) },
  { label: 'Cost (COGS)', value: money(summary.value.cogs) },
  { label: 'Profit', value: money(summary.value.profit) },
  { label: 'Margin', value: `${summary.value.margin.toFixed(1)}%` },
  { label: 'Orders', value: summary.value.orders.toLocaleString() },
])

// The JSON file carries what the table alone can't: the headline figures and the
// ranking. Keys mirror the API's own.
const jsonDocument = computed(() => ({
  report: 'Sales',
  period: period.value,
  date_from: meta.value.date_from ?? null,
  date_to: meta.value.date_to ?? null,
  timezone: meta.value.timezone ?? null,
  summary: {
    revenue: summary.value.revenue,
    cogs: summary.value.cogs,
    profit: summary.value.profit,
    margin: summary.value.margin,
    orders: summary.value.orders,
    average_order_value: summary.value.averageOrderValue,
  },
  top_products: report.value.topProducts.map(({ rank, name, units, revenue, share }) => ({
    rank,
    name,
    units,
    revenue,
    share,
  })),
}))

// Only the newest request may fill the page: with a slow response for an earlier
// tab or range still in flight, it would otherwise overwrite the one just chosen.
let latestRequest = 0

async function loadReport() {
  const request = ++latestRequest
  loading.value = true
  error.value = ''
  try {
    const result = await fetchSalesReport(
      { granularity: period.value, ...(range.applied.value ?? {}) },
      auth.accessToken,
    )
    if (request === latestRequest) report.value = result
  } catch (err) {
    if (request === latestRequest) error.value = err.message || 'Unable to load sales report.'
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

onMounted(loadReport)
watch([period, range.key], loadReport)
</script>

<template>
  <div class="sales-page">
    <div class="sales-page__body">
      <div class="report-heading">
        <div>
          <p class="eyebrow">Performance overview</p>
          <h1>{{ selectedPeriod.label }} Sales & Profit Report</h1>
          <p class="report-heading__sub">
            {{ range.applied.value ? 'Custom date range' : period === 'daily' ? 'Selected day cash flows' : `${selectedPeriod.label} metrics and tracking` }}
          </p>
        </div>
        <ReportExportMenu
          sheet="Sales"
          tab="sales"
          :suffix="exportSuffix"
          :rows="report.table"
          :columns="EXPORT_COLUMNS"
          pdf-title="Sales Report"
          :pdf-subtitle="pdfSubtitle"
          :summary="pdfSummary"
          :json-document="jsonDocument"
          :extra-tables="extraTables"
        />
      </div>

      <section class="toolbar" aria-label="Report filters">
        <div class="segmented" role="group" aria-label="Report period">
          <button
            v-for="item in periods"
            :key="item.key"
            type="button"
            :class="{ active: period === item.key }"
            @click="period = item.key"
          >
            {{ item.label }}
          </button>
        </div>
        <ReportRangeFilter
          v-model:from="range.from.value"
          v-model:to="range.to.value"
          :error="range.error.value"
          @clear="range.clear"
        />
        <span class="comparison">{{ comparisonLabel }}</span>
      </section>

      <p v-if="loading" class="state">Loading sales report…</p>
      <p v-else-if="error" class="state state--error">{{ error }}</p>

      <template v-else>
        <section class="metric-grid" aria-label="Sales summary">
          <article v-for="card in cards" :key="card.key" class="metric-card">
            <span class="metric-card__label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <span class="metric-card__delta" :class="card.delta.tone">
              <component :is="card.delta.icon" v-if="card.delta.icon" :size="11" />
              {{ card.delta.text }} <small>vs previous period</small>
            </span>
            <small v-if="card.note" class="metric-card__note">{{ card.note }}</small>
          </article>
        </section>

        <section class="top-grid" :class="{ 'top-grid--single': isHourly }">
          <article class="panel chart-panel">
            <header class="panel__header">
              <div>
                <h2>{{ isHourly ? 'Hourly Sales Distribution' : `${selectedPeriod.label} Revenue & Profit` }}</h2>
                <p>{{ dateRangeLabel }}</p>
              </div>
              <div class="legend">
                <span><i class="legend__revenue"></i> Revenue</span>
                <span><i class="legend__profit"></i> Profit</span>
              </div>
            </header>
            <div class="bar-chart">
              <div class="bar-chart__grid"><span></span><span></span><span></span><span></span></div>
              <div v-for="bar in chartBars" :key="bar.title" class="bar-group" :title="bar.tip">
                <div class="bar-group__bars">
                  <span class="bar bar--revenue" :style="{ height: `${bar.revenueHeight}%` }"></span>
                  <span class="bar bar--profit" :style="{ height: `${bar.profitHeight}%` }"></span>
                </div>
                <small>{{ bar.showLabel ? bar.label : '' }}</small>
              </div>
            </div>
          </article>

          <article v-if="!isHourly" class="panel breakdown-panel">
            <header class="panel__header">
              <h2>Revenue by Weekday</h2>
            </header>
            <div class="daily-list">
              <div class="daily-row daily-row--head">
                <span>Day</span><span>Revenue</span><span>Profit</span>
              </div>
              <div v-for="row in report.dailyBreakdown" :key="row.label" class="daily-row">
                <strong>{{ row.label }}</strong><span>{{ money(row.revenue) }}</span><b>{{ money(row.profit) }}</b>
              </div>
            </div>
          </article>
        </section>

        <section class="panel rank-panel">
          <header class="panel__header">
            <div>
              <h2>Top Products</h2>
              <p>Ranked by sales value in this period</p>
            </div>
          </header>
          <p v-if="report.topProducts.length === 0" class="state state--inline">No products sold in this period.</p>
          <ol v-else class="rank-list">
            <li v-for="product in report.topProducts" :key="product.rank" class="rank-row">
              <span class="rank-row__rank" :class="{ 'rank-row__rank--top': product.rank <= 3 }">{{ product.rank }}</span>
              <div class="rank-row__name">
                <strong>{{ product.name }}</strong>
                <small>{{ product.units.toLocaleString() }} units sold</small>
              </div>
              <span class="rank-row__track" aria-hidden="true">
                <span class="rank-row__fill" :style="{ width: `${Math.max(product.share, 2)}%` }"></span>
              </span>
              <b class="rank-row__revenue">{{ money(product.revenue) }}</b>
              <small class="rank-row__share">{{ product.share.toFixed(1) }}%</small>
            </li>
          </ol>
        </section>

        <section class="panel summary-panel">
          <header class="panel__header">
            <div>
              <h2>{{ tableTitle }}</h2>
              <p>Revenue, cost and profit by reporting period</p>
            </div>
          </header>
          <div class="table-wrap">
            <table>
              <thead><tr><th>{{ periodColumn }}</th><th>Date Range</th><th>Orders</th><th>Total Sales</th><th>Total COGS</th><th>Gross Profit</th><th>Margin</th><th>vs Previous</th></tr></thead>
              <tbody>
                <tr v-for="row in report.table" :key="row.period + row.dateRange">
                  <td class="week">{{ row.period }}</td>
                  <td>{{ row.dateRange }}</td>
                  <td>{{ row.orders }}</td>
                  <td>{{ money(row.revenue) }}</td>
                  <td>{{ money(row.cogs) }}</td>
                  <td class="profit">{{ money(row.profit) }}</td>
                  <td>{{ row.margin.toFixed(1) }}%</td>
                  <td :class="delta(row.revenueChange).tone">{{ delta(row.revenueChange).text }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.report-heading, .toolbar, .panel__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.report-heading { margin-bottom: 1.35rem; }
.eyebrow { margin: 0 0 0.2rem; color: var(--accent-ink); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 0.15rem; color: var(--text-strong); font-size: clamp(1.25rem, 2vw, 1.65rem); letter-spacing: 0; }
.report-heading__sub, .panel__header p { margin: 0; color: var(--text-subtle); font-size: 0.75rem; }
.toolbar { justify-content: flex-start; flex-wrap: wrap; align-items: flex-start; margin-bottom: 1.35rem; min-height: 42px; }
.segmented { display: inline-flex; gap: 0.15rem; padding: 3px; border-radius: 8px; background: var(--surface-track); }
.segmented button { padding: 0.42rem 0.8rem; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); font-size: 0.74rem; font-weight: 700; cursor: pointer; }
.segmented button.active { background: var(--surface); color: var(--accent-ink); box-shadow: 0 1px 3px rgb(31 36 45 / 0.1); }
.comparison { margin-left: auto; align-self: center; color: var(--text-subtle); font-size: 0.72rem; }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.9rem; margin-bottom: 1rem; }
.metric-card, .panel { border: 1px solid var(--border-subtle); border-radius: 9px; background: var(--surface); box-shadow: 0 2px 7px rgb(31 36 45 / 0.025); }
.metric-card { min-width: 0; padding: 0.9rem 1rem; }
.metric-card__label { display: block; margin-bottom: 0.35rem; color: var(--text-muted); font-size: 0.68rem; }
.metric-card strong { display: block; color: var(--text-strong); font-size: 1.15rem; letter-spacing: 0; }
.metric-card__delta { display: inline-flex; align-items: center; gap: 0.15rem; margin-top: 0.35rem; font-size: 0.64rem; font-weight: 700; }
.metric-card__delta small { color: var(--text-subtle); font-weight: 500; }
.metric-card__note { display: block; margin-top: 0.25rem; color: var(--text-subtle); font-size: 0.62rem; }
.positive, .profit { color: var(--success); }
.negative, .loss { color: var(--danger); }
.neutral { color: var(--text-subtle); }
.top-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.95fr); gap: 1rem; margin-bottom: 1rem; }
.top-grid--single { grid-template-columns: minmax(0, 1fr); }
.panel { padding: 1rem; }
.panel__header { align-items: flex-start; margin-bottom: 0.9rem; }
.panel__header h2 { margin: 0; color: var(--text-strong); font-size: 0.82rem; }
.legend { display: flex; gap: 0.75rem; color: var(--text-subtle); font-size: 0.63rem; }
.legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.legend i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
.legend__revenue { background: var(--violet); }.legend__profit { background: var(--success); }
.bar-chart { position: relative; display: flex; align-items: flex-end; justify-content: space-around; height: 235px; padding: 1rem 0 0.1rem; overflow: hidden; }
.bar-chart__grid { position: absolute; inset: 0 0 1.4rem; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
.bar-chart__grid span { border-top: 1px dashed var(--border-subtle); }
.bar-group { z-index: 1; display: flex; flex: 1; min-width: 0; height: 100%; flex-direction: column; justify-content: flex-end; align-items: center; gap: 0.45rem; }
.bar-group__bars { display: flex; align-items: flex-end; gap: 2px; height: 100%; }
.bar { display: block; width: clamp(3px, 0.8vw, 12px); min-height: 3px; border-radius: 3px 3px 0 0; }
.bar--revenue { background: var(--violet); }.bar--profit { background: var(--success); }
.bar-group small { min-height: 0.9rem; color: var(--text-subtle); font-size: 0.6rem; white-space: nowrap; }
.daily-list { display: flex; flex-direction: column; gap: 0.1rem; }
.daily-row { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.47rem 0.35rem; color: var(--text-body); font-size: 0.7rem; }.daily-row:nth-child(even) { background: var(--surface-sunken); }.daily-row b { color: var(--success); text-align: right; }.daily-row span { text-align: right; }
.daily-row--head { color: var(--text-subtle); font-size: 0.58rem; font-weight: 800; text-transform: uppercase; background: transparent !important; }
.daily-row--head span:first-child { text-align: left; }
.rank-panel { margin-bottom: 1rem; }
.rank-list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.rank-row { display: grid; grid-template-columns: 1.7rem minmax(0, 1.4fr) minmax(60px, 1fr) 6.5rem 3.2rem; align-items: center; gap: 0.75rem; padding: 0.55rem 0; border-bottom: 1px solid var(--border-subtle); }
.rank-row:last-child { border-bottom: 0; }
.rank-row__rank { display: inline-flex; align-items: center; justify-content: center; width: 1.45rem; height: 1.45rem; border-radius: 50%; background: var(--surface-track); color: var(--text-muted); font-size: 0.68rem; font-weight: 800; }
.rank-row__rank--top { background: rgb(var(--accent-rgb) / 0.25); color: var(--accent-ink); }
.rank-row__name { min-width: 0; }
.rank-row__name strong, .rank-row__name small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-row__name strong { color: var(--text-body); font-size: 0.74rem; }
.rank-row__name small { color: var(--text-subtle); font-size: 0.62rem; }
.rank-row__track { display: block; height: 5px; border-radius: 99px; background: var(--surface-track); overflow: hidden; }
.rank-row__fill { display: block; height: 100%; border-radius: inherit; background: var(--violet); }
.rank-row__revenue { color: var(--success); font-size: 0.72rem; white-space: nowrap; text-align: right; }
.rank-row__share { color: var(--text-subtle); font-size: 0.65rem; text-align: right; }
.state { margin: 0; padding: 1.5rem 1rem; text-align: center; font-size: 0.85rem; color: var(--text-subtle); }
.state--error { color: var(--danger); }
.state--inline { padding: 1rem; font-size: 0.78rem; }
.summary-panel { padding-bottom: 0.55rem; }.table-wrap { overflow-x: auto; } table { width: 100%; min-width: 760px; border-collapse: collapse; } th, td { padding: 0.58rem 0.55rem; border-bottom: 1px solid var(--border-subtle); text-align: left; white-space: nowrap; font-size: 0.67rem; } th { color: var(--text-subtle); font-size: 0.58rem; font-weight: 800; text-transform: uppercase; } tbody tr:nth-child(odd) { background: var(--surface-sunken); } tbody tr:last-child td { border-bottom: 0; }.week { color: var(--info); font-weight: 700; }.profit { font-weight: 700; }
@media (max-width: 800px) { .metric-grid { grid-template-columns: repeat(2, 1fr); }.top-grid { grid-template-columns: 1fr; }.comparison { display: none; } .rank-row { grid-template-columns: 1.7rem minmax(0, 1fr) auto; }.rank-row__track, .rank-row__share { display: none; } }
@media (max-width: 520px) { .report-heading { align-items: flex-start; }.toolbar { flex-wrap: wrap; }.metric-card { padding: 0.8rem; }.metric-card strong { font-size: 1rem; }.panel { padding: 0.8rem; }.bar-chart { height: 190px; } }
</style>
