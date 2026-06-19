<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useDashboardStore } from '@/stores/dashboard'

const router = useRouter()
const dashboard = useDashboardStore()

// Pull live stats on load. If the request fails (e.g. the endpoint isn't
// available yet) the page falls back to SAMPLE below so it never looks broken.
onMounted(() => dashboard.fetchStats())

// Fallback mirrors the GET /admin/dashboard contract, with sample figures in
// the same computer-shop domain as the rest of the admin.
const SAMPLE = {
  total_orders: 142,
  total_revenue: 48320,
  total_products: 1284,
  total_customers: 938,
  today: { orders: 12, revenue: 3840 },
  this_month: { orders: 142, revenue: 48320 },
  this_year: { orders: 1680, revenue: 612400 },
}

const data = computed(() => dashboard.stats ?? SAMPLE)
const usingSample = computed(() => !dashboard.stats)

function money(value) {
  return '$' + (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function count(value) {
  return (Number(value) || 0).toLocaleString('en-US')
}

// KPI cards bound to the backend's top-level totals.
const kpis = computed(() => [
  { key: 'revenue', label: 'Total Revenue', value: money(data.value.total_revenue), icon: 'revenue', tone: 'accent' },
  { key: 'orders', label: 'Total Orders', value: count(data.value.total_orders), icon: 'orders', tone: 'neutral' },
  { key: 'products', label: 'Total Products', value: count(data.value.total_products), icon: 'products', tone: 'neutral' },
  { key: 'customers', label: 'Total Customers', value: count(data.value.total_customers), icon: 'customers', tone: 'neutral' },
])

// Today / this month / this year — each { orders, revenue } from the contract.
const periods = computed(() => [
  { key: 'today', label: 'Today', orders: count(data.value.today?.orders), revenue: money(data.value.today?.revenue) },
  { key: 'month', label: 'This Month', orders: count(data.value.this_month?.orders), revenue: money(data.value.this_month?.revenue) },
  { key: 'year', label: 'This Year', orders: count(data.value.this_year?.orders), revenue: money(data.value.this_year?.revenue) },
])

// Weekly revenue — drives the signature CSS bar chart below.
const week = [
  { day: 'Mon', amount: 3200 },
  { day: 'Tue', amount: 4100 },
  { day: 'Wed', amount: 3800 },
  { day: 'Thu', amount: 5200 },
  { day: 'Fri', amount: 6100 },
  { day: 'Sat', amount: 7400 },
  { day: 'Sun', amount: 5600 },
]
const weekPeak = Math.max(...week.map((d) => d.amount))
const bars = computed(() =>
  week.map((d) => ({
    ...d,
    height: Math.round((d.amount / weekPeak) * 100),
    isPeak: d.amount === weekPeak,
    money: `$${(d.amount / 1000).toFixed(1)}k`,
  })),
)
const weekTotal = computed(
  () => `$${week.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}`,
)

// Order status mix — counts mirror the Orders page tabs (total 142).
const statusTotal = 142
const statuses = [
  { key: 'completed', label: 'Completed', count: 98 },
  { key: 'pending', label: 'Pending', count: 24 },
  { key: 'processing', label: 'Processing', count: 12 },
  { key: 'cancelled', label: 'Cancelled', count: 8 },
]
const statusBreakdown = computed(() =>
  statuses.map((s) => ({ ...s, pct: Math.round((s.count / statusTotal) * 100) })),
)

// Recent orders — a slice of the Orders page data, newest first.
const recentOrders = [
  { id: '#ORD-1042', customer: 'Sarah Jenkins', item: 'Custom PC Build', amount: '$4,299.00', status: 'pending' },
  { id: '#ORD-1041', customer: 'Michael Chen', item: 'Gaming Peripherals', amount: '$249.98', status: 'processing' },
  { id: '#ORD-1040', customer: 'David Smith', item: 'Upgrade Kit', amount: '$385.50', status: 'completed' },
  { id: '#ORD-1039', customer: 'Emma Wilson', item: 'Display Monitor', amount: '$549.00', status: 'pending' },
  { id: '#ORD-1038', customer: 'James Carter', item: 'External Storage', amount: '$199.00', status: 'completed' },
]
const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// Low stock — sourced from the Products page inventory.
const lowStock = [
  { id: 4, name: 'Corsair Dominator Platinum 64GB DDR5', sku: 'COR-DP-64G5', stock: 0 },
  { id: 3, name: 'ASUS ROG Maximus Z790 Dark Hero', sku: 'AS-MAX-Z790', stock: 4 },
  { id: 6, name: 'Logitech G Pro X Superlight', sku: 'LOG-GPX-SL', stock: 6 },
]

function openOrder(order) {
  router.push({ name: 'order-detail', params: { id: order.id.replace(/^#/, '') } })
}
</script>

<template>
  <div class="page">
    <AppHeader title="Dashboard Overview" />

    <div class="page__body">
      <!-- Intro -->
      <section class="intro">
        <div class="intro__text">
          <h2 class="intro__title">Welcome back, Admin</h2>
          <p class="intro__sub">Here's how Beckie Deal is performing.</p>
        </div>
        <div class="intro__actions">
          <span class="status" :class="usingSample ? 'status--sample' : 'status--live'">
            <i></i>{{ dashboard.loading ? 'Loading…' : usingSample ? 'Sample data' : 'Live data' }}
          </span>
          <BaseButton variant="primary" :to="{ name: 'order-create' }">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            New Order
          </BaseButton>
        </div>
      </section>

      <!-- Sample-data notice when the dashboard service can't be reached -->
      <p v-if="usingSample && dashboard.error" class="notice" role="status">
        Showing sample figures — couldn't load live data ({{ dashboard.error }}).
      </p>

      <!-- KPI cards -->
      <section class="stats">
        <article v-for="kpi in kpis" :key="kpi.key" class="stat">
          <span class="stat__icon" :class="`stat__icon--${kpi.tone}`" aria-hidden="true">
            <svg v-if="kpi.icon === 'revenue'" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="kpi.icon === 'orders'" viewBox="0 0 24 24" fill="none">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke-linejoin="round" />
              <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke-linecap="round" />
            </svg>
            <svg v-else-if="kpi.icon === 'products'" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
              <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke-linecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" stroke-linecap="round" />
            </svg>
          </span>
          <p class="stat__value">{{ kpi.value }}</p>
          <p class="stat__label">{{ kpi.label }}</p>
        </article>
      </section>

      <!-- Today / month / year breakdown -->
      <section class="periods">
        <article v-for="p in periods" :key="p.key" class="period-card">
          <p class="period-card__label">{{ p.label }}</p>
          <div class="period-card__rows">
            <div class="period-card__row">
              <span class="period-card__num">{{ p.revenue }}</span>
              <span class="period-card__cap">Revenue</span>
            </div>
            <div class="period-card__row">
              <span class="period-card__num">{{ p.orders }}</span>
              <span class="period-card__cap">Orders</span>
            </div>
          </div>
        </article>
      </section>

      <!-- Revenue chart + status breakdown -->
      <section class="grid grid--split">
        <!-- Signature: pure-CSS weekly revenue chart -->
        <article class="panel">
          <header class="panel__head">
            <div>
              <h3 class="panel__title">Revenue this week</h3>
              <p class="panel__metric">{{ weekTotal }}<span> total</span></p>
            </div>
            <span class="legend"><i></i> Daily revenue</span>
          </header>

          <div class="chart" role="img" aria-label="Daily revenue for the current week">
            <div
              v-for="bar in bars"
              :key="bar.day"
              class="chart__col"
              :class="{ 'is-peak': bar.isPeak }"
            >
              <span class="chart__value">{{ bar.money }}</span>
              <div class="chart__track">
                <div class="chart__bar" :style="{ '--h': bar.height + '%' }"></div>
              </div>
              <span class="chart__day">{{ bar.day }}</span>
            </div>
          </div>
        </article>

        <!-- Order status breakdown -->
        <article class="panel">
          <header class="panel__head">
            <div>
              <h3 class="panel__title">Order status</h3>
              <p class="panel__metric">{{ statusTotal }}<span> orders</span></p>
            </div>
            <RouterLink class="panel__link" :to="{ name: 'orders' }">View all</RouterLink>
          </header>

          <ul class="breakdown">
            <li v-for="s in statusBreakdown" :key="s.key" class="breakdown__row">
              <div class="breakdown__top">
                <span class="breakdown__label">
                  <i class="dot" :class="`dot--${s.key}`"></i>{{ s.label }}
                </span>
                <span class="breakdown__count">{{ s.count }} <em>({{ s.pct }}%)</em></span>
              </div>
              <div class="breakdown__track">
                <div class="breakdown__fill" :class="`breakdown__fill--${s.key}`" :style="{ width: s.pct + '%' }"></div>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <!-- Recent orders + low stock -->
      <section class="grid grid--split">
        <article class="panel">
          <header class="panel__head">
            <h3 class="panel__title">Recent orders</h3>
            <RouterLink class="panel__link" :to="{ name: 'orders' }">View all</RouterLink>
          </header>

          <table class="mini">
            <tbody>
              <tr
                v-for="order in recentOrders"
                :key="order.id"
                tabindex="0"
                @click="openOrder(order)"
                @keyup.enter="openOrder(order)"
              >
                <td>
                  <p class="mini__id">{{ order.id }}</p>
                  <p class="mini__sub">{{ order.customer }}</p>
                </td>
                <td class="mini__item">{{ order.item }}</td>
                <td class="mini__amount">{{ order.amount }}</td>
                <td>
                  <span class="badge" :class="`badge--${order.status}`">{{ statusLabels[order.status] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </article>

        <article class="panel">
          <header class="panel__head">
            <h3 class="panel__title">Low stock alerts</h3>
            <RouterLink class="panel__link" :to="{ name: 'products' }">Manage</RouterLink>
          </header>

          <ul class="alerts">
            <li v-for="item in lowStock" :key="item.id" class="alert">
              <span class="alert__thumb" :class="{ 'alert__thumb--out': item.stock === 0 }" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
                  <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
                </svg>
              </span>
              <div class="alert__meta">
                <p class="alert__name">{{ item.name }}</p>
                <p class="alert__sku">SKU: {{ item.sku }}</p>
              </div>
              <span class="alert__stock" :class="item.stock === 0 ? 'alert__stock--out' : 'alert__stock--low'">
                {{ item.stock === 0 ? 'Out' : item.stock + ' left' }}
              </span>
            </li>
          </ul>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
$accent: #f4c10f;
$accent-ink: #a8850a;
$muted: #8a909c;
$divider: #eef0f3;

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

/* Intro */
.intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: $color-text;
  }

  &__sub {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: $muted;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;

  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &--live { background: #e6f7ee; color: #1f9d57; i { background: #1f9d57; } }
  &--sample { background: #f4f5f7; color: #6b7280; i { background: #b4bac4; } }
}

.notice {
  margin: 0;
  padding: 0.7rem 0.9rem;
  font-size: 0.82rem;
  color: #8a6d0b;
  background: #fff8e1;
  border: 1px solid #f1e3b0;
  border-radius: 10px;
}

/* KPI cards */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

  @media (max-width: 1040px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
}

.stat {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.2rem 1.25rem;

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    flex-shrink: 0;
    margin-bottom: 0.9rem;

    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }

    &--accent { background: rgba($accent, 0.18); color: $accent-ink; }
    &--neutral { background: #f4f5f7; color: #6b7280; }
  }

  &__value {
    margin: 0;
    font-size: 1.7rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: $color-text;
  }

  &__label {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
    font-weight: 600;
    color: #4a5160;
  }
}

/* Today / month / year */
.periods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  @media (max-width: 640px) { grid-template-columns: 1fr; }
}

.period-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__label {
    margin: 0 0 0.85rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: $muted;
  }

  &__rows {
    display: flex;
    gap: 1.75rem;
  }

  &__row { display: flex; flex-direction: column; gap: 0.1rem; }

  &__num {
    font-size: 1.2rem;
    font-weight: 700;
    color: $color-text;
  }

  &__cap {
    font-size: 0.74rem;
    color: $muted;
  }
}

/* Shared panel */
.grid {
  display: grid;
  gap: 1.25rem;

  &--split {
    grid-template-columns: 1.7fr 1fr;
    @media (max-width: 960px) { grid-template-columns: 1fr; }
  }
}

.panel {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.25rem;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.1rem;
  }

  &__title {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 700;
    color: $color-text;
  }

  &__metric {
    margin: 0.35rem 0 0;
    font-size: 1.35rem;
    font-weight: 700;
    color: $color-text;

    span { font-size: 0.8rem; font-weight: 500; color: $muted; }
  }

  &__link {
    font-size: 0.8rem;
    font-weight: 600;
    color: $accent-ink;
    white-space: nowrap;

    &:hover { text-decoration: none; opacity: 0.8; }
  }
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: $muted;

  i { width: 10px; height: 10px; border-radius: 3px; background: $accent; }
}

/* Signature: weekly revenue bar chart */
.chart {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 200px;

  &__col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  &__value {
    font-size: 0.72rem;
    font-weight: 700;
    color: $muted;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }

  &__track {
    width: 100%;
    flex: 1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  &__bar {
    width: 64%;
    max-width: 38px;
    height: var(--h);
    min-height: 6px;
    border-radius: 7px 7px 3px 3px;
    background: rgba($accent, 0.32);
    transform-origin: bottom;
    animation: grow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: background-color 0.18s ease;
  }

  &__day {
    font-size: 0.74rem;
    font-weight: 600;
    color: $muted;
  }

  &__col.is-peak &__bar { background: $accent; }

  &__col:hover &__bar,
  &__col:focus-within &__bar { background: $accent-ink; }

  &__col:hover &__value,
  &__col:focus-within &__value { opacity: 1; transform: translateY(0); }

  &__col.is-peak &__value { opacity: 1; transform: translateY(0); color: $accent-ink; }
}

@keyframes grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* Status breakdown */
.breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.45rem;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: $color-text;
  }

  &__count {
    font-size: 0.82rem;
    font-weight: 700;
    color: $color-text;

    em { font-style: normal; font-weight: 500; color: $muted; }
  }

  &__track {
    height: 8px;
    border-radius: 999px;
    background: #f1f3f5;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    animation: slide 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;

    &--completed { background: #1f9d57; }
    &--pending { background: $accent; }
    &--processing { background: #5b8def; }
    &--cancelled { background: #d14343; }
  }
}

@keyframes slide {
  from { transform: scaleX(0); transform-origin: left; }
  to { transform: scaleX(1); transform-origin: left; }
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;

  &--completed { background: #1f9d57; }
  &--pending { background: $accent; }
  &--processing { background: #5b8def; }
  &--cancelled { background: #d14343; }
}

/* Recent orders mini-table */
.mini {
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 0.7rem 0.5rem;
    vertical-align: middle;
  }

  tr {
    cursor: pointer;
    transition: background-color 0.12s ease;

    & + tr td { border-top: 1px solid $divider; }
    &:hover { background: #fafbfc; }
    &:focus-visible { outline: 2px solid $accent; outline-offset: -2px; border-radius: 8px; }
  }

  &__id { margin: 0; font-size: 0.84rem; font-weight: 700; color: $accent-ink; }
  &__sub { margin: 0.15rem 0 0; font-size: 0.76rem; color: $muted; }
  &__item { font-size: 0.82rem; color: #4a5160; }
  &__amount { font-size: 0.86rem; font-weight: 700; color: $color-text; text-align: right; white-space: nowrap; }

  @media (max-width: 480px) {
    &__item { display: none; }
  }
}

/* Badges — match the Orders/Products pages */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;
  white-space: nowrap;

  &--pending { background: #fff2d6; color: #b8890b; }
  &--processing { background: #eaf1fe; color: #3f6fd6; }
  &--completed { background: #e6f7ee; color: #1f9d57; }
  &--cancelled { background: #fdecec; color: #d14343; }
}

/* Low stock alerts */
.alerts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.7rem 0;

  & + & { border-top: 1px solid $divider; }

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba($accent, 0.16);
    color: $accent-ink;
    flex-shrink: 0;

    svg { width: 19px; height: 19px; stroke: currentColor; stroke-width: 1.7; }

    &--out { background: #fdecec; color: #d14343; }
  }

  &__meta { min-width: 0; flex: 1; }

  &__name {
    margin: 0;
    font-size: 0.84rem;
    font-weight: 600;
    color: $color-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__sku { margin: 0.15rem 0 0; font-size: 0.74rem; color: $muted; }

  &__stock {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;

    &--low { background: rgba($accent, 0.2); color: #b8890b; }
    &--out { background: #fdecec; color: #d14343; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart__bar,
  .breakdown__fill { animation: none; }
  .chart__value { transition: none; }
}
</style>
