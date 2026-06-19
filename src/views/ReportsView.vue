<script setup>
import { computed, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

// Report period — presentational for now (no backend report endpoint).
const ranges = ['Last 7 days', 'Last 30 days', 'This year']
const range = ref('This year')

// Headline metrics — volume only, no currency.
const kpis = [
  { key: 'orders', label: 'Total Orders', value: '1,820', delta: '+9.4%', trend: 'up', icon: 'orders', tone: 'accent' },
  { key: 'units', label: 'Units Sold', value: '4,200', delta: '+12.1%', trend: 'up', icon: 'units', tone: 'neutral' },
  { key: 'items', label: 'Avg. Items / Order', value: '2.5', delta: '+1.2%', trend: 'up', icon: 'items', tone: 'neutral' },
  { key: 'fulfil', label: 'Fulfillment Rate', value: '96.4%', delta: '+0.8%', trend: 'up', icon: 'fulfil', tone: 'neutral' },
]

// Monthly orders — drives the signature area chart.
const monthly = [
  { short: 'Jan', value: 96 },
  { short: 'Feb', value: 112 },
  { short: 'Mar', value: 104 },
  { short: 'Apr', value: 128 },
  { short: 'May', value: 141 },
  { short: 'Jun', value: 152 },
  { short: 'Jul', value: 146 },
  { short: 'Aug', value: 168 },
  { short: 'Sep', value: 182 },
  { short: 'Oct', value: 174 },
  { short: 'Nov', value: 198 },
  { short: 'Dec', value: 219 },
]
const peak = Math.max(...monthly.map((m) => m.value))

// Normalised 0–100 coordinates so the SVG (preserveAspectRatio="none") and the
// HTML dot/label overlays share one coordinate space and stay aligned.
const PLOT_TOP = 10
const PLOT_BOTTOM = 92
const points = computed(() =>
  monthly.map((m, i) => {
    const nx = (i / (monthly.length - 1)) * 100
    const ny = PLOT_TOP + (1 - m.value / peak) * (PLOT_BOTTOM - PLOT_TOP)
    return { ...m, nx, ny }
  }),
)
const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.nx} ${p.ny}`).join(' '),
)
const areaPath = computed(() => `${linePath.value} L 100 100 L 0 100 Z`)
const yearTotal = computed(() =>
  monthly.reduce((sum, m) => sum + m.value, 0).toLocaleString(),
)

// Orders by category — share of all orders.
const categories = [
  { name: 'Graphics Cards', orders: 473, pct: 26 },
  { name: 'Processors', orders: 346, pct: 19 },
  { name: 'Storage', orders: 328, pct: 18 },
  { name: 'Peripherals', orders: 273, pct: 15 },
  { name: 'Memory', orders: 237, pct: 13 },
  { name: 'Monitors', orders: 163, pct: 9 },
]

// Orders by status.
const statuses = [
  { key: 'completed', label: 'Completed', orders: 1420, pct: 78 },
  { key: 'pending', label: 'Pending', orders: 164, pct: 9 },
  { key: 'processing', label: 'Processing', orders: 146, pct: 8 },
  { key: 'cancelled', label: 'Cancelled', orders: 90, pct: 5 },
]

// Top sellers by units — same catalogue as the Products page, no revenue.
const topProducts = [
  { rank: 1, name: 'Samsung 980 Pro 2TB NVMe SSD', category: 'Storage', units: 420, share: 10 },
  { rank: 2, name: 'NVIDIA GeForce RTX 4090 FE', category: 'Graphics Cards', units: 312, share: 7 },
  { rank: 3, name: 'Intel Core i9-14900K', category: 'Processors', units: 268, share: 6 },
  { rank: 4, name: 'Corsair Dominator Platinum 64GB DDR5', category: 'Memory', units: 198, share: 5 },
  { rank: 5, name: 'ASUS ROG Maximus Z790 Dark Hero', category: 'Motherboards', units: 154, share: 4 },
]
const unitsPeak = Math.max(...topProducts.map((p) => p.units))
</script>

<template>
  <div class="page">
    <AppHeader title="Reports" />

    <div class="page__body">
      <!-- Intro -->
      <section class="intro">
        <div class="intro__text">
          <h2 class="intro__title">Order & Sales Volume</h2>
          <p class="intro__sub">Orders, units and fulfillment across {{ range.toLowerCase() }}.</p>
        </div>
        <div class="intro__actions">
          <label class="rangepick">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" stroke-linecap="round" />
            </svg>
            <select v-model="range">
              <option v-for="r in ranges" :key="r" :value="r">{{ r }}</option>
            </select>
            <svg class="rangepick__caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </label>
          <BaseButton variant="ghost">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
              </svg>
            </template>
            Export
          </BaseButton>
        </div>
      </section>

      <!-- KPI cards -->
      <section class="stats">
        <article v-for="kpi in kpis" :key="kpi.key" class="stat">
          <div class="stat__top">
            <span class="stat__icon" :class="`stat__icon--${kpi.tone}`" aria-hidden="true">
              <svg v-if="kpi.icon === 'orders'" viewBox="0 0 24 24" fill="none">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke-linejoin="round" />
                <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke-linecap="round" />
              </svg>
              <svg v-else-if="kpi.icon === 'units'" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
                <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="kpi.icon === 'items'" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 2 7l10 5 10-5-10-5Z" stroke-linejoin="round" />
                <path d="m2 12 10 5 10-5M2 17l10 5 10-5" stroke-linejoin="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="trend" :class="`trend--${kpi.trend}`">
              <svg v-if="kpi.trend === 'up'" viewBox="0 0 24 24" fill="none"><path d="M5 15l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <svg v-else viewBox="0 0 24 24" fill="none"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" /></svg>
              {{ kpi.delta }}
            </span>
          </div>
          <p class="stat__value">{{ kpi.value }}</p>
          <p class="stat__label">{{ kpi.label }}</p>
        </article>
      </section>

      <!-- Signature: orders trend area chart -->
      <article class="panel">
        <header class="panel__head">
          <div>
            <h3 class="panel__title">Orders trend</h3>
            <p class="panel__metric">{{ yearTotal }}<span> orders this year</span></p>
          </div>
          <span class="legend"><i></i> Monthly orders</span>
        </header>

        <div class="trend">
          <div class="trend__plot">
            <svg class="trend__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#f4c10f" stop-opacity="0.32" />
                  <stop offset="100%" stop-color="#f4c10f" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="areaPath" fill="url(#ordersFill)" />
              <path
                :d="linePath"
                fill="none"
                stroke="#f4c10f"
                stroke-width="2.5"
                vector-effect="non-scaling-stroke"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            </svg>
            <div class="trend__dots">
              <span
                v-for="p in points"
                :key="p.short"
                class="trend__dot"
                tabindex="0"
                :style="{ left: p.nx + '%', top: p.ny + '%' }"
              >
                <span class="trend__tip">{{ p.short }} · {{ p.value }} orders</span>
              </span>
            </div>
          </div>
          <div class="trend__axis">
            <span v-for="p in points" :key="p.short" :style="{ left: p.nx + '%' }">{{ p.short }}</span>
          </div>
        </div>
      </article>

      <!-- Orders by category + by status -->
      <section class="grid grid--split">
        <article class="panel">
          <header class="panel__head">
            <h3 class="panel__title">Orders by category</h3>
          </header>
          <ul class="ranked">
            <li v-for="cat in categories" :key="cat.name" class="ranked__row">
              <div class="ranked__top">
                <span class="ranked__name">{{ cat.name }}</span>
                <span class="ranked__value">{{ cat.orders.toLocaleString() }} <em>{{ cat.pct }}%</em></span>
              </div>
              <div class="ranked__track">
                <div class="ranked__fill" :style="{ width: cat.pct + '%' }"></div>
              </div>
            </li>
          </ul>
        </article>

        <article class="panel">
          <header class="panel__head">
            <h3 class="panel__title">Orders by status</h3>
          </header>
          <ul class="ranked">
            <li v-for="s in statuses" :key="s.key" class="ranked__row">
              <div class="ranked__top">
                <span class="ranked__name"><i class="swatch" :class="`swatch--${s.key}`"></i>{{ s.label }}</span>
                <span class="ranked__value">{{ s.orders.toLocaleString() }} <em>{{ s.pct }}%</em></span>
              </div>
              <div class="ranked__track">
                <div class="ranked__fill" :class="`ranked__fill--${s.key}`" :style="{ width: s.pct + '%' }"></div>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <!-- Top products by units -->
      <article class="panel">
        <header class="panel__head">
          <h3 class="panel__title">Top products by units sold</h3>
          <RouterLink class="panel__link" :to="{ name: 'products' }">View all</RouterLink>
        </header>

        <table class="table">
          <thead>
            <tr>
              <th class="table__rank">#</th>
              <th>Product</th>
              <th>Category</th>
              <th>Units Sold</th>
              <th class="table__num">Share</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in topProducts" :key="product.rank">
              <td class="table__rank"><span class="rankbadge">{{ product.rank }}</span></td>
              <td class="cell-name">{{ product.name }}</td>
              <td><span class="chip">{{ product.category }}</span></td>
              <td>
                <div class="units">
                  <span class="units__count">{{ product.units }}</span>
                  <div class="units__track">
                    <div class="units__fill" :style="{ width: (product.units / unitsPeak) * 100 + '%' }"></div>
                  </div>
                </div>
              </td>
              <td class="table__num share">{{ product.share }}%</td>
            </tr>
          </tbody>
        </table>
      </article>
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

  &__title { margin: 0; font-size: 1.3rem; font-weight: 700; color: $color-text; }
  &__sub { margin: 0.25rem 0 0; font-size: 0.85rem; color: $muted; }

  &__actions { display: flex; align-items: center; gap: 0.6rem; }
}

.rangepick {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.7rem 0 0.8rem;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  color: #4a5160;

  > svg { width: 14px; height: 14px; stroke: $muted; stroke-width: 1.8; flex-shrink: 0; }
  &__caret { pointer-events: none; }

  select {
    appearance: none;
    border: none;
    background: transparent;
    padding: 0.55rem 0;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    color: #4a5160;
    cursor: pointer;
    &:focus { outline: none; }
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
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.2rem 1.25rem;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    flex-shrink: 0;

    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }

    &--accent { background: rgba($accent, 0.18); color: $accent-ink; }
    &--neutral { background: #f4f5f7; color: #6b7280; }
  }

  &__value { margin: 0; font-size: 1.7rem; font-weight: 700; letter-spacing: -0.01em; color: $color-text; }
  &__label { margin: 0.3rem 0 0; font-size: 0.82rem; font-weight: 600; color: #4a5160; }

  /* delta chip */
  .trend {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.22rem 0.5rem 0.22rem 0.4rem;
    font-size: 0.74rem;
    font-weight: 700;
    border-radius: 999px;

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2.2; }

    &--up { background: #e6f7ee; color: #1f9d57; }
    &--down { background: #fdecec; color: #d14343; }
  }
}

/* Panels */
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

  &__title { margin: 0; font-size: 0.98rem; font-weight: 700; color: $color-text; }

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

.grid {
  display: grid;
  gap: 1.25rem;
  &--split {
    grid-template-columns: 1fr 1fr;
    @media (max-width: 860px) { grid-template-columns: 1fr; }
  }
}

/* Signature: orders area chart */
.trend {
  &__plot {
    position: relative;
    height: 240px;
  }

  &__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  &__dots { position: absolute; inset: 0; }

  &__dot {
    position: absolute;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #fff;
    border: 2.5px solid $accent;
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: transform 0.15s ease;

    &:hover, &:focus-visible {
      transform: translate(-50%, -50%) scale(1.25);
      background: $accent;
      outline: none;
    }

    &:hover .trend__tip,
    &:focus-visible .trend__tip { opacity: 1; transform: translate(-50%, -8px); }
  }

  &__tip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%, 0);
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    padding: 0.3rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    background: #1f242d;
    border-radius: 7px;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  &__axis {
    position: relative;
    height: 20px;
    margin-top: 0.6rem;

    span {
      position: absolute;
      transform: translateX(-50%);
      font-size: 0.72rem;
      font-weight: 600;
      color: $muted;
      white-space: nowrap;
    }
  }
}

/* Ranked bar lists (categories + statuses) */
.ranked {
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
    gap: 0.75rem;
    margin-bottom: 0.45rem;
  }

  &__name {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: $color-text;
  }

  &__value {
    font-size: 0.82rem;
    font-weight: 700;
    color: $color-text;
    white-space: nowrap;
    em { font-style: normal; font-weight: 500; color: $muted; margin-left: 0.3rem; }
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
    background: $accent;
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

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;

  &--completed { background: #1f9d57; }
  &--pending { background: $accent; }
  &--processing { background: #5b8def; }
  &--cancelled { background: #d14343; }
}

/* Top products table */
.table {
  width: 100%;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.85rem 0.75rem; vertical-align: middle; }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9099a6;
    border-bottom: 1px solid $divider;
  }

  tbody tr + tr td { border-top: 1px solid $divider; }
  tbody tr:hover { background: #fafbfc; }

  &__rank { width: 44px; }
  &__num { text-align: right; }
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
  color: $accent-ink;
  background: rgba($accent, 0.18);
}

.cell-name { font-size: 0.86rem; font-weight: 600; color: $color-text; }

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #5b6472;
  background: #f1f3f5;
  border-radius: 999px;
  white-space: nowrap;
}

.units {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 150px;

  &__count { font-size: 0.86rem; font-weight: 600; color: $color-text; width: 34px; }

  &__track {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: #f1f3f5;
    overflow: hidden;
  }

  &__fill { height: 100%; border-radius: 999px; background: $accent; }
}

.share { font-size: 0.9rem; font-weight: 700; color: $color-text; white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .ranked__fill { animation: none; }
  .trend__dot, .trend__tip { transition: none; }
}
</style>
