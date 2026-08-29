<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const dashboard = useDashboardStore()
const auth = useAuthStore()

// Low stock comes from the stock API, which manager and staff cannot call.
// Gate the request as well as the panel so those roles never trigger a 403.
const canSeeStock = computed(() => auth.hasPermission('stock.view'))

onMounted(() => {
  dashboard.fetchStats()
  if (canSeeStock.value) dashboard.fetchLowStock()
})

const stats = computed(() => dashboard.stats)
const loading = computed(() => dashboard.loading)
const error = computed(() => dashboard.error)
// Only the first load shows the skeleton; a refresh keeps the old figures up.
const showSkeleton = computed(() => loading.value && !stats.value)

function money(value) {
  return '$' + (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function count(value) {
  return (Number(value) || 0).toLocaleString('en-US')
}

// KPI cards bound to the backend's top-level totals, in display order.
const kpis = computed(() => [
  { key: 'products', label: 'Total Products', value: count(stats.value?.total_products), icon: 'products', tone: 'neutral' },
  { key: 'customers', label: 'Total Customers', value: count(stats.value?.total_customers), icon: 'customers', tone: 'neutral' },
  { key: 'orders', label: 'Total Orders', value: count(stats.value?.total_orders), icon: 'orders', tone: 'neutral' },
  // A count, not a currency amount — formatted with count() rather than money().
  { key: 'promotions', label: 'Total Promotions', value: count(stats.value?.total_promotions), icon: 'promotions', tone: 'accent' },
])

// Today / this month / this year — each { orders, revenue } from the contract.
const periods = computed(() => [
  { key: 'today', label: 'Today', orders: count(stats.value?.today?.orders), revenue: money(stats.value?.today?.revenue) },
  { key: 'month', label: 'This Month', orders: count(stats.value?.this_month?.orders), revenue: money(stats.value?.this_month?.revenue) },
  { key: 'year', label: 'This Year', orders: count(stats.value?.this_year?.orders), revenue: money(stats.value?.this_year?.revenue) },
])

/* ---------------------------------------------------------------------------
 * Orders created per day, Mon -> Sun — the signature CSS bar chart.
 * The API zero-fills quiet days, so the series is always seven long and the
 * columns keep their positions even in a week with no orders.
 * ------------------------------------------------------------------------- */
const week = computed(() => stats.value?.orders_per_day ?? [])
const weekPeak = computed(() => Math.max(...week.value.map((d) => d.orders), 0))
const bars = computed(() =>
  week.value.map((d) => ({
    ...d,
    // A week with no orders has peak 0; every bar is then flat rather than NaN.
    height: weekPeak.value > 0 ? Math.round((d.orders / weekPeak.value) * 100) : 0,
    isPeak: weekPeak.value > 0 && d.orders === weekPeak.value,
  })),
)
const weekTotal = computed(() => count(week.value.reduce((sum, d) => sum + d.orders, 0)))

/* ---------------------------------------------------------------------------
 * Order status mix — a donut, because the job is part-to-whole across four
 * states that together account for every order.
 *
 * Colours are the *status* palette, not a categorical one, so they are fixed by
 * meaning: green = completed, amber = pending, blue = in progress, red =
 * cancelled. Green and red are inherently close under deuteranopia and no
 * re-stepping fixes that while keeping the good/bad convention, so colour never
 * carries meaning alone here: every segment is also named, counted and
 * percentaged in the legend, and the arcs are separated by a visible gap.
 *
 * These steps were checked with the palette validator against a white surface:
 * all four sit inside the lightness band, clear the chroma floor, clear 3:1
 * contrast, and the closest normal-vision pair is deltaE 16.6 (floor is 15).
 *
 * The steps now live in _tokens.scss so they can be re-lightened for the dark
 * surface, where the white-validated values fall below 3:1. Consumed via inline
 * `style` rather than the SVG `stroke` attribute, because var() is not reliably
 * supported in SVG presentation attributes.
 * ------------------------------------------------------------------------- */
const STATUS_COLORS = {
  completed: 'var(--chart-completed)',
  pending: 'var(--chart-pending)',
  processing: 'var(--chart-processing)',
  cancelled: 'var(--chart-cancelled)',
}
const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const statuses = computed(() => stats.value?.status_breakdown ?? [])
const statusTotal = computed(() => statuses.value.reduce((sum, s) => sum + s.count, 0))

const statusBreakdown = computed(() =>
  statuses.value.map((s) => ({
    key: s.status,
    label: statusLabels[s.status] ?? s.status,
    count: s.count,
    color: STATUS_COLORS[s.status],
    // Guard the empty case: no orders means no share, not a division by zero.
    pct: statusTotal.value > 0 ? Math.round((s.count / statusTotal.value) * 100) : 0,
  })),
)

// Donut geometry. RADIUS/THICKNESS are in the SVG's own units, which equal
// pixels at the rendered size, so GAP reads as the spec's 2px surface gap.
const RADIUS = 56
const THICKNESS = 18
const GAP = 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// One dash-segment per status, laid out clockwise from 12 o'clock.
const donutSegments = computed(() => {
  let cursor = 0

  return statusBreakdown.value.map((s) => {
    const arc = statusTotal.value > 0 ? (s.count / statusTotal.value) * CIRCUMFERENCE : 0
    // Shorten each arc by the gap so neighbours never touch. Tiny slices keep a
    // sliver rather than collapsing to nothing — but a status with no orders at
    // all draws nothing.
    const drawn = s.count > 0 ? Math.max(arc - GAP, 1) : 0
    const segment = {
      ...s,
      dash: `${drawn} ${CIRCUMFERENCE - drawn}`,
      offset: -cursor,
    }
    cursor += arc
    return segment
  })
})

// Hovering a segment (or its legend row) swaps the centre readout, so the donut
// needs no floating tooltip.
const activeStatus = ref('')
const centreReadout = computed(() => {
  const active = statusBreakdown.value.find((s) => s.key === activeStatus.value)
  return active
    ? { value: count(active.count), caption: active.label }
    : { value: count(statusTotal.value), caption: 'orders' }
})

// Recent orders — the newest five, already flattened by the API.
const recentOrders = computed(() =>
  (stats.value?.recent_orders ?? []).map((order) => ({
    ...order,
    label: '#' + order.order_number,
    amountLabel: money(order.amount),
  })),
)

const lowStock = computed(() => dashboard.lowStock)

// `id` is the order's uuid, which is what the detail route resolves on.
function openOrder(order) {
  router.push({ name: 'order-detail', params: { id: order.id } })
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
      </section>

      <!-- The dashboard is read-only, so a failure is reported and left there:
           there is nothing for the user to retry beyond reloading. -->
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-else-if="showSkeleton" class="notice" role="status">Loading dashboard…</p>

      <!-- KPI cards -->
      <section class="stats">
        <article v-for="kpi in kpis" :key="kpi.key" class="stat">
          <span class="stat__icon" :class="`stat__icon--${kpi.tone}`" aria-hidden="true">
            <svg v-if="kpi.icon === 'products'" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
              <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="kpi.icon === 'customers'" viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke-linecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" stroke-linecap="round" />
            </svg>
            <svg v-else-if="kpi.icon === 'orders'" viewBox="0 0 24 24" fill="none">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke-linejoin="round" />
              <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke-linecap="round" />
            </svg>
            <!-- Promotions (percent), matching the sidebar's icon. -->
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M5 19 19 5" stroke-linecap="round" />
              <circle cx="7.5" cy="7.5" r="2.5" />
              <circle cx="16.5" cy="16.5" r="2.5" />
            </svg>
          </span>
          <p class="stat__value">{{ kpi.value }}</p>
          <p class="stat__label">{{ kpi.label }}</p>
        </article>
      </section>

      <!-- Today / this month / this year, each { orders, revenue } -->
      <section class="periods">
        <article v-for="period in periods" :key="period.key" class="period-card">
          <p class="period-card__label">{{ period.label }}</p>
          <div class="period-card__rows">
            <div class="period-card__row">
              <span class="period-card__num">{{ period.orders }}</span>
              <span class="period-card__cap">Orders</span>
            </div>
            <div class="period-card__row">
              <span class="period-card__num">{{ period.revenue }}</span>
              <span class="period-card__cap">Revenue</span>
            </div>
          </div>
        </article>
      </section>

      <!-- Orders trend + status breakdown -->
      <section class="grid grid--split">
        <!-- Signature: pure-CSS weekly orders chart -->
        <article class="panel">
          <header class="panel__head">
            <div>
              <h3 class="panel__title">Orders This Week</h3>
              <p class="panel__metric">{{ weekTotal }}<span> orders</span></p>
            </div>
            <span class="legend"><i></i> Orders per day</span>
          </header>

          <div class="chart" role="img" aria-label="Number of orders created each day this week">
            <div
              v-for="bar in bars"
              :key="bar.day"
              class="chart__col"
              :class="{ 'is-peak': bar.isPeak }"
            >
              <span class="chart__value">{{ bar.orders }}</span>
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

          <div class="mix">
            <!-- Donut. The legend below carries the same numbers as text, so the
                 chart is never the only way to read this. -->
            <div class="mix__chart" @mouseleave="activeStatus = ''">
              <svg
                class="donut"
                viewBox="0 0 140 140"
                role="img"
                :aria-label="`Order status mix of ${statusTotal} orders: ${statusBreakdown.map((s) => `${s.label} ${s.count}, ${s.pct} percent`).join('; ')}`"
              >
                <g transform="translate(70,70) rotate(-90)">
                  <circle
                    class="donut__track"
                    :r="RADIUS"
                    fill="none"
                    :stroke-width="THICKNESS"
                  />
                  <circle
                    v-for="s in donutSegments"
                    :key="s.key"
                    class="donut__arc"
                    :class="{ 'is-dimmed': activeStatus && activeStatus !== s.key }"
                    :r="RADIUS"
                    fill="none"
                    :style="{ stroke: s.color }"
                    :stroke-width="THICKNESS"
                    :stroke-dasharray="s.dash"
                    :stroke-dashoffset="s.offset"
                    @mouseenter="activeStatus = s.key"
                  />
                </g>
              </svg>
              <!-- Not a hero figure: the KPI row above leads the page. -->
              <div class="donut__centre" aria-hidden="true">
                <p class="donut__value">{{ centreReadout.value }}</p>
                <p class="donut__caption">{{ centreReadout.caption }}</p>
              </div>
            </div>

            <ul class="legend">
              <li
                v-for="s in statusBreakdown"
                :key="s.key"
                class="legend__row"
                :class="{ 'is-active': activeStatus === s.key }"
                @mouseenter="activeStatus = s.key"
                @mouseleave="activeStatus = ''"
              >
                <span class="legend__swatch" :style="{ background: s.color }" aria-hidden="true"></span>
                <span class="legend__label">{{ s.label }}</span>
                <span class="legend__count">{{ s.count }}</span>
                <span class="legend__pct">{{ s.pct }}%</span>
              </li>
            </ul>
          </div>
        </article>
      </section>

      <!-- Recent orders + low stock -->
      <section class="grid grid--split">
        <article class="panel">
          <header class="panel__head">
            <h3 class="panel__title">Recent orders</h3>
            <RouterLink class="panel__link" :to="{ name: 'orders' }">View all</RouterLink>
          </header>

          <table v-if="recentOrders.length" class="mini">
            <tbody>
              <tr
                v-for="order in recentOrders"
                :key="order.id"
                tabindex="0"
                @click="openOrder(order)"
                @keyup.enter="openOrder(order)"
              >
                <td>
                  <p class="mini__id">{{ order.label }}</p>
                  <p class="mini__sub">{{ order.customer }}</p>
                </td>
                <td class="mini__item">{{ order.item }}</td>
                <td class="mini__amount">{{ order.amountLabel }}</td>
                <td>
                  <span class="badge" :class="`badge--${order.status}`">{{ statusLabels[order.status] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else-if="!showSkeleton" class="panel__empty">No orders yet.</p>
        </article>

        <!-- Stock is an admin-only API; manager and staff never see this panel. -->
        <article v-if="canSeeStock" class="panel">
          <header class="panel__head">
            <h3 class="panel__title">Low stock alerts</h3>
            <RouterLink class="panel__link" :to="{ name: 'products' }">Manage</RouterLink>
          </header>

          <p v-if="!lowStock.length" class="panel__empty">Every product is above its stock threshold.</p>
          <ul v-else class="alerts">
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

.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  // Set locally rather than inherited from body: the global default stays the
  // light literal so the 35 unconverted views keep dark type on their white
  // cards. A converted view opts in here.
  //
  // --text-strong, not --text-body: it has to match what body previously
  // supplied ($color-text / #2c3e50), or light mode shifts.
  color: var(--text-strong);

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
    color: var(--text-strong);
  }

  &__sub {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
}

.notice {
  margin: 0;
  padding: 0.7rem 0.9rem;
  font-size: 0.82rem;
  color: var(--accent-ink);
  background: rgb(var(--accent-rgb) / 0.12);
  border: 1px solid rgb(var(--accent-rgb) / 0.4);
  border-radius: 10px;

  &--error {
    color: var(--danger);
    background: var(--danger-bg);
    border-color: var(--danger);
  }
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
  background: var(--surface);
  border: 1px solid var(--border-subtle);
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

    &--accent { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-ink); }
    &--neutral { background: var(--bg); color: var(--text-muted); }
  }

  &__value {
    margin: 0;
    font-size: 1.7rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-strong);
  }

  &__label {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-body);
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
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__label {
    margin: 0 0 0.85rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__rows {
    display: flex;
    gap: 1.75rem;
  }

  &__row { display: flex; flex-direction: column; gap: 0.1rem; }

  &__num {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__cap {
    font-size: 0.74rem;
    color: var(--text-subtle);
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
  background: var(--surface);
  border: 1px solid var(--border-subtle);
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
    color: var(--text-strong);
  }

  &__metric {
    margin: 0.35rem 0 0;
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-strong);

    span { font-size: 0.8rem; font-weight: 500; color: var(--text-subtle); }
  }

  &__link {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent-ink);
    white-space: nowrap;

    &:hover { text-decoration: none; opacity: 0.8; }
  }

  &__empty {
    margin: 0;
    padding: 1.5rem 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: var(--text-subtle);

  i { width: 10px; height: 10px; border-radius: 3px; background: rgb(var(--accent-rgb)); }
}

/* Signature: weekly orders bar chart */
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
    color: var(--text-subtle);
    transition: color 0.18s ease;
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
    background: rgb(var(--accent-rgb) / 0.32);
    transform-origin: bottom;
    animation: grow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
    transition: background-color 0.18s ease;
  }

  &__day {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-subtle);
  }

  &__col.is-peak &__bar { background: rgb(var(--accent-rgb)); }

  &__col:hover &__bar,
  &__col:focus-within &__bar { background: var(--accent-ink); }

  &__col:hover &__value,
  &__col:focus-within &__value { color: var(--accent-ink); }

  &__col.is-peak &__value { color: var(--accent-ink); }
}

@keyframes grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* Order status mix — donut + legend */
.mix {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;

  &__chart {
    position: relative;
    width: 140px;
    height: 140px;
    flex-shrink: 0;
  }
}

.donut {
  width: 100%;
  height: 100%;
  display: block;

  &__track { stroke: var(--border-subtle); }

  &__arc {
    /* Butt caps keep each arc's ends square so the 2px gap stays exactly 2px. */
    stroke-linecap: butt;
    transition: opacity 0.15s ease;
    cursor: default;
  }

  /* Hovering one segment recedes the others rather than moving anything. */
  &__arc.is-dimmed { opacity: 0.28; }

  &__centre {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    text-align: center;
  }

  &__value {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--text-strong);
  }

  &__caption {
    margin: 0.1rem 0 0;
    font-size: 0.72rem;
    color: var(--text-subtle);
  }
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 190px;
  display: flex;
  flex-direction: column;

  &__row {
    display: grid;
    /* swatch · label · count · percent — the numbers stay in aligned columns. */
    grid-template-columns: 10px 1fr auto 3.2rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.4rem;
    border-radius: 8px;
    transition: background 0.15s ease;

    & + & { border-top: 1px solid var(--border-subtle); }
    &.is-active { background: var(--surface-sunken); }
  }

  &__swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  /* Numbers wear ink, never the series colour; the swatch carries identity. */
  &__count {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-strong);
    font-variant-numeric: tabular-nums;
  }

  &__pct {
    font-size: 0.8rem;
    color: var(--text-subtle);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
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

    & + tr td { border-top: 1px solid var(--border-subtle); }
    &:hover { background: var(--surface-sunken); }
    &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: -2px; border-radius: 8px; }
  }

  &__id { margin: 0; font-size: 0.84rem; font-weight: 700; color: var(--accent-ink); }
  &__sub { margin: 0.15rem 0 0; font-size: 0.76rem; color: var(--text-subtle); }
  &__item { font-size: 0.82rem; color: var(--text-body); }
  &__amount { font-size: 0.86rem; font-weight: 700; color: var(--text-strong); text-align: right; white-space: nowrap; }

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

  &--pending { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-ink); }
  &--processing { background: var(--info-bg); color: var(--info); }
  &--completed { background: var(--success-bg); color: var(--success); }
  &--cancelled { background: var(--danger-bg); color: var(--danger); }
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

  & + & { border-top: 1px solid var(--border-subtle); }

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgb(var(--accent-rgb) / 0.16);
    color: var(--accent-ink);
    flex-shrink: 0;

    svg { width: 19px; height: 19px; stroke: currentColor; stroke-width: 1.7; }

    &--out { background: var(--danger-bg); color: var(--danger); }
  }

  &__meta { min-width: 0; flex: 1; }

  &__name {
    margin: 0;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-strong);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__sku { margin: 0.15rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }

  &__stock {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;

    &--low { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
    &--out { background: var(--danger-bg); color: var(--danger); }
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart__bar { animation: none; }
  .chart__value,
  .donut__arc,
  .legend__row { transition: none; }
}
</style>
