<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarDays, Download, MoreHorizontal, TrendingUp } from '@lucide/vue'
import AppHeader from '@/components/AppHeader.vue'
import { fetchSalesReport } from '@/services/reports'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const period = ref('weekly')
const loading = ref(true)
const error = ref('')
const report = ref({ summary: {}, chart: [], dailyBreakdown: [], topProducts: [], table: [], meta: {} })
const periods = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

const selectedPeriod = computed(() => periods.find((item) => item.key === period.value))
const dateRangeLabel = computed(() => {
  const from = report.value.meta.date_from
  const to = report.value.meta.date_to
  return from && to ? `${from} — ${to}` : 'Current reporting period'
})
const chartBars = computed(() => {
  const points = report.value.chart
  const peak = Math.max(...points.map((point) => point.revenue), 1)
  return points.map((point) => ({
    ...point,
    revenueHeight: (point.revenue / peak) * 100,
    profitHeight: (point.profit / peak) * 100,
  }))
})
const isDaily = computed(() => period.value === 'daily')

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)
}

function percent(value) {
  return `${value > 0 ? '+' : ''}${Number(value ?? 0).toFixed(1)}%`
}

async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    report.value = await fetchSalesReport({ granularity: period.value }, auth.accessToken)
  } catch (err) {
    error.value = err.message || 'Unable to load sales report.'
  } finally {
    loading.value = false
  }
}

onMounted(loadReport)
watch(period, loadReport)
</script>

<template>
  <div class="sales-page">
    <AppHeader title="Sales & Profit Report" />

    <main class="sales-page__body">
      <div class="report-heading">
        <div>
          <p class="eyebrow">Performance overview</p>
          <h1>{{ isDaily ? 'Daily Sales & Profit Report' : 'Weekly Sales & Profit Report' }}</h1>
          <p class="report-heading__sub">{{ isDaily ? 'Selected day cash flows' : 'Weekly metrics and tracking' }}</p>
        </div>
        <button class="icon-button" type="button" title="Export report" aria-label="Export report">
          <Download :size="16" />
        </button>
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
        <div class="date-control">
          <CalendarDays :size="14" />
          <span>{{ dateRangeLabel }}</span>
        </div>
        <span class="comparison">Compare to previous year</span>
      </section>

      <p v-if="loading" class="state">Loading sales report…</p>
      <p v-else-if="error" class="state state--error">{{ error }}</p>

      <template v-else>
      <section class="metric-grid" aria-label="Sales summary">
        <article class="metric-card">
          <span class="metric-card__label">{{ isDaily ? "Today's" : 'Weekly' }} Revenue</span>
          <strong>{{ money(report.summary.revenue) }}</strong>
          <span class="metric-card__delta positive"><TrendingUp :size="11" /> {{ percent(report.summary.revenueChange) }} <small>vs previous period</small></span>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">{{ isDaily ? "Today's" : 'Weekly' }} Cost (COGS)</span>
          <strong>{{ money(report.summary.cogs) }}</strong>
          <span class="metric-card__delta negative">{{ percent(report.summary.cogsChange) }} <small>vs previous period</small></span>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">{{ isDaily ? "Today's" : 'Weekly' }} Profit</span>
          <strong>{{ money(report.summary.profit) }}</strong>
          <span class="metric-card__delta positive"><TrendingUp :size="11" /> {{ percent(report.summary.profitChange) }} <small>vs previous period</small></span>
        </article>
        <article class="metric-card">
          <span class="metric-card__label">{{ isDaily ? "Today's" : 'Weekly' }} Margin</span>
          <strong>{{ report.summary.margin.toFixed(1) }}%</strong>
          <span class="metric-card__delta positive">{{ report.summary.marginChange > 0 ? '+' : '' }}{{ report.summary.marginChange.toFixed(1) }}pp <small>vs previous period</small></span>
        </article>
      </section>

      <section class="top-grid">
        <article class="panel chart-panel">
          <header class="panel__header">
            <div>
              <h2>{{ isDaily ? 'Hourly Sales Distribution' : 'Weekly Revenue & Profit' }}</h2>
              <p v-if="!isDaily">Last 12 weeks</p>
            </div>
            <div v-if="!isDaily" class="legend">
              <span><i class="legend__revenue"></i> Revenue</span>
              <span><i class="legend__profit"></i> Profit</span>
            </div>
          </header>
          <div class="bar-chart">
            <div class="bar-chart__grid"><span></span><span></span><span></span><span></span></div>
            <div v-for="bar in chartBars" :key="bar.label" class="bar-group">
              <div class="bar-group__bars">
                <span class="bar bar--revenue" :style="{ height: `${bar.revenueHeight}%` }"></span>
                <span class="bar bar--profit" :style="{ height: `${bar.profitHeight}%` }"></span>
              </div>
              <small>{{ bar.label }}</small>
            </div>
          </div>
        </article>

        <article class="panel breakdown-panel">
          <header class="panel__header">
            <h2>{{ isDaily ? 'Top Products Today' : 'Daily Breakdown This Week' }}</h2>
            <button v-if="!isDaily" class="more-button" type="button" aria-label="More breakdown options"><MoreHorizontal :size="16" /></button>
          </header>
          <div v-if="isDaily" class="product-list">
            <div v-for="(product, index) in report.topProducts" :key="product.name" class="product-row">
              <div><strong>{{ product.name }}</strong><small>{{ product.units }} units sold</small></div>
              <span class="product-row__line" :style="{ width: `${100 - index * 18}%` }"></span>
              <b>{{ money(product.revenue) }}</b>
            </div>
          </div>
          <div v-else class="daily-list">
            <div v-for="row in report.dailyBreakdown" :key="row.label" class="daily-row">
              <strong>{{ row.label }}</strong><span>{{ money(row.revenue) }}</span><b>{{ money(row.profit) }}</b>
            </div>
          </div>
        </article>
      </section>

      <section v-if="!isDaily" class="panel summary-panel">
        <header class="panel__header">
          <div><h2>{{ selectedPeriod.label }} Summary Table</h2><p>Revenue, cost and profit by reporting period</p></div>
          <button class="more-button" type="button" aria-label="More table options"><MoreHorizontal :size="16" /></button>
        </header>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Week</th><th>Date Range</th><th>Orders</th><th>Total Sales</th><th>Total COGS</th><th>Gross Profit</th><th>Margin</th><th>vs Prev Week</th></tr></thead>
            <tbody>
              <tr v-for="row in report.table" :key="row.period"><td class="week">{{ row.period }}</td><td>{{ row.dateRange }}</td><td>{{ row.orders }}</td><td>{{ money(row.revenue) }}</td><td>{{ money(row.cogs) }}</td><td class="profit">{{ money(row.profit) }}</td><td>{{ row.margin.toFixed(1) }}%</td><td class="positive">—</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      </template>
    </main>
  </div>
</template>

<style scoped lang="scss">
.sales-page { min-height: 100vh; background: var(--bg); }
.sales-page__body { max-width: 1440px; margin: 0 auto; padding: 1.6rem 1.5rem 2.5rem; }
.report-heading, .toolbar, .panel__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.report-heading { margin-bottom: 1.35rem; }
.eyebrow { margin: 0 0 0.2rem; color: var(--accent-ink); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 0.15rem; color: var(--text-strong); font-size: clamp(1.25rem, 2vw, 1.65rem); letter-spacing: 0; }
.report-heading__sub, .panel__header p { margin: 0; color: var(--text-subtle); font-size: 0.75rem; }
.icon-button, .more-button { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
.icon-button { width: 34px; height: 34px; border-radius: 8px; }
.more-button { padding: 0.35rem; border-radius: 6px; }
.toolbar { justify-content: flex-start; margin-bottom: 1.35rem; min-height: 42px; }
.segmented { display: inline-flex; gap: 0.15rem; padding: 3px; border-radius: 8px; background: var(--surface-track); }
.segmented button { padding: 0.42rem 0.8rem; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); font-size: 0.74rem; font-weight: 700; cursor: pointer; }
.segmented button.active { background: var(--surface); color: var(--accent-ink); box-shadow: 0 1px 3px rgb(31 36 45 / 0.1); }
.date-control { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 0.75rem; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-body); font-size: 0.75rem; }
.date-control svg { color: var(--accent-ink); }
.comparison { margin-left: auto; color: var(--text-subtle); font-size: 0.72rem; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.9rem; margin-bottom: 1rem; }
.metric-card, .panel { border: 1px solid var(--border-subtle); border-radius: 9px; background: var(--surface); box-shadow: 0 2px 7px rgb(31 36 45 / 0.025); }
.metric-card { min-width: 0; padding: 0.9rem 1rem; }
.metric-card__label { display: block; margin-bottom: 0.35rem; color: var(--text-muted); font-size: 0.68rem; }
.metric-card strong { display: block; color: var(--text-strong); font-size: 1.15rem; letter-spacing: 0; }
.metric-card__delta { display: inline-flex; align-items: center; gap: 0.15rem; margin-top: 0.35rem; font-size: 0.64rem; font-weight: 700; }
.metric-card__delta small { color: var(--text-subtle); font-weight: 500; }
.positive, .profit { color: var(--success); }
.negative, .loss { color: var(--danger); }
.top-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.95fr); gap: 1rem; margin-bottom: 1rem; }
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
.bar-group { z-index: 1; display: flex; flex: 1; min-width: 30px; height: 100%; flex-direction: column; justify-content: flex-end; align-items: center; gap: 0.45rem; }
.bar-group__bars { display: flex; align-items: flex-end; gap: 3px; height: 100%; }
.bar { display: block; width: clamp(5px, 1.1vw, 12px); min-height: 3px; border-radius: 3px 3px 0 0; }
.bar--revenue { background: var(--violet); }.bar--profit { background: var(--success); }
.bar-group small { color: var(--text-subtle); font-size: 0.6rem; }
.daily-list, .product-list { display: flex; flex-direction: column; gap: 0.1rem; }
.daily-row { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0.47rem 0.35rem; color: var(--text-body); font-size: 0.7rem; }.daily-row:nth-child(odd) { background: var(--surface-sunken); }.daily-row b { color: var(--success); text-align: right; }.daily-row span { text-align: right; }
.product-row { display: grid; grid-template-columns: minmax(0, 1.45fr) 0.75fr auto; align-items: center; gap: 0.55rem; padding: 0.48rem 0; }.product-row div { min-width: 0; }.product-row strong, .product-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.product-row strong { color: var(--text-body); font-size: 0.68rem; }.product-row small { color: var(--text-subtle); font-size: 0.58rem; }.product-row__line { height: 3px; border-radius: 99px; background: var(--violet); }.product-row b { color: var(--success); font-size: 0.65rem; white-space: nowrap; }
.summary-panel { padding-bottom: 0.55rem; }.table-wrap { overflow-x: auto; } table { width: 100%; min-width: 760px; border-collapse: collapse; } th, td { padding: 0.58rem 0.55rem; border-bottom: 1px solid var(--border-subtle); text-align: left; white-space: nowrap; font-size: 0.67rem; } th { color: var(--text-subtle); font-size: 0.58rem; font-weight: 800; text-transform: uppercase; } tbody tr:nth-child(odd) { background: var(--surface-sunken); } tbody tr:last-child td { border-bottom: 0; }.week { color: var(--info); font-weight: 700; }.profit { font-weight: 700; }
@media (max-width: 800px) { .metric-grid { grid-template-columns: repeat(2, 1fr); }.top-grid { grid-template-columns: 1fr; }.comparison { display: none; } }
@media (max-width: 520px) { .sales-page__body { padding-inline: 0.9rem; }.report-heading { align-items: flex-start; }.toolbar { flex-wrap: wrap; }.date-control { order: 3; width: 100%; }.metric-card { padding: 0.8rem; }.metric-card strong { font-size: 1rem; }.panel { padding: 0.8rem; }.bar-chart { height: 190px; } }
</style>
