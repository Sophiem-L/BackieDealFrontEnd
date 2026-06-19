<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()

// Order id comes from the route (/orders/:id); mock content below stands in
// for what an API would return. 'new' (Create New Order) shows the sample.
const rawId = route.params.id
const orderId = !rawId || rawId === 'new' ? '#ORD-1041' : `#${String(rawId).replace(/^#/, '')}`

const order = ref({
  id: orderId,
  status: 'processing',
  createdAt: 'Oct 15, 2024 @ 10:32 AM',
  updatedAgo: '2 hours ago',
})

const items = ref([
  { id: 1, name: 'NVIDIA RTX 4070 Founders Edition', sku: 'NV-4070-FE', qty: 1, unitPrice: 599.0 },
  { id: 2, name: 'Intel Core i7-13700K', sku: 'INT-13700K', qty: 1, unitPrice: 399.0 },
  { id: 3, name: 'Corsair Vengeance 32GB DDR5', sku: 'COR-32G5', qty: 2, unitPrice: 89.0 },
  { id: 4, name: 'Samsung 990 Pro 1TB NVMe', sku: 'SAM-990-1T', qty: 1, unitPrice: 109.0 },
])

const totals = {
  subtotal: '$1,285.00',
  assemblyFee: '$50.00',
  delivery: '$15.00',
  total: '$1,350.00',
}

const build = {
  stageLabel: 'Assembly',
  stagePercent: 80,
  overallPercent: 60,
  steps: [
    { label: 'Parts Gathered', state: 'done' },
    { label: 'Assembly', state: 'done' },
    { label: 'OS Install', state: 'upcoming' },
    { label: 'QA Testing', state: 'upcoming' },
    { label: 'Ready to Ship', state: 'upcoming' },
  ],
}

const delivery = {
  status: 'Awaiting Dispatch',
  courier: 'DHL Express',
  tracking: '88241502',
  eta: 'Oct 27, 2024',
  timeline: [
    { label: 'Label Created', state: 'done', at: 'Oct 25, 10:32 AM' },
    { label: 'Picked Up by Courier', state: 'pending', at: 'Pending' },
    { label: 'In Transit', state: 'pending', at: 'Pending' },
    { label: 'Out for Delivery', state: 'pending', at: 'Pending' },
    { label: 'Delivered', state: 'pending', at: 'Pending' },
  ],
}

const customer = {
  name: 'Mike Robertson',
  email: 'mike.r@example.com',
  phone: '+1 (555) 204-8812',
  address: '14 Elmwood Drive, Austin, TX 78701',
}

const technician = { name: 'Mike R.', role: 'Senior Technician' }

const payment = {
  method: 'QR Code (Paid)',
  status: 'Confirmed',
  transactionId: '#TXN-8842-CC',
  totalPaid: '$1,350.00',
}

const notes = ref([
  {
    id: 1,
    body: 'Customer requested cable management to be neat. Prefers white zip ties if available.',
    author: 'Mike R.',
    at: 'Oct 25, 11:08 AM',
  },
])

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function money(value) {
  return `$${value.toFixed(2)}`
}

function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'orders' })
}

function markComplete() {
  order.value.status = 'completed'
}

function printInvoice() {
  window.print()
}
</script>

<template>
  <div class="page">
    <AppHeader title="Order Detail" />

    <div class="page__body">
      <!-- Sub header -->
      <section class="subhead">
        <div class="subhead__lead">
          <button type="button" class="back-btn" aria-label="Back to orders" @click="goBack">
            <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <div>
            <div class="subhead__title-row">
              <h2 class="subhead__id">{{ order.id }}</h2>
              <span class="badge" :class="`badge--${order.status}`">{{ statusLabels[order.status] }}</span>
            </div>
            <p class="subhead__meta">
              Created on {{ order.createdAt }} · Last updated {{ order.updatedAgo }}
            </p>
          </div>
        </div>
        <div class="subhead__actions">
          <BaseButton variant="ghost" @click="printInvoice">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9V3h12v6" stroke-linejoin="round" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" stroke-linejoin="round" />
                <rect x="6" y="14" width="12" height="7" rx="1" />
              </svg>
            </template>
            Print Invoice
          </BaseButton>
          <BaseButton
            variant="primary"
            :disabled="order.status === 'completed'"
            @click="markComplete"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </template>
            {{ order.status === 'completed' ? 'Completed' : 'Mark as Complete' }}
          </BaseButton>
        </div>
      </section>

      <div class="grid">
        <!-- Main column -->
        <div class="col col--main">
          <!-- Order items -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
                  <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
                </svg>
                Order Items
              </h3>
            </header>
            <table class="items">
              <thead>
                <tr>
                  <th>Product</th>
                  <th class="items__num">Qty</th>
                  <th class="items__num">Unit Price</th>
                  <th class="items__num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="item.id">
                  <td>
                    <div class="product">
                      <span class="product__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
                      <div>
                        <p class="product__name">{{ item.name }}</p>
                        <p class="product__sku">{{ item.sku }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="items__num">{{ item.qty }}</td>
                  <td class="items__num items__muted">{{ money(item.unitPrice) }}</td>
                  <td class="items__num items__strong">{{ money(item.unitPrice * item.qty) }}</td>
                </tr>
              </tbody>
            </table>

            <dl class="summary">
              <div class="summary__row"><dt>Subtotal</dt><dd>{{ totals.subtotal }}</dd></div>
              <div class="summary__row"><dt>Assembly Fee</dt><dd>{{ totals.assemblyFee }}</dd></div>
              <div class="summary__row"><dt>Delivery</dt><dd>{{ totals.delivery }}</dd></div>
              <div class="summary__row summary__row--total"><dt>Total</dt><dd>{{ totals.total }}</dd></div>
            </dl>
          </section>

          <!-- Build progress -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6V21h3.3l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.6-.7-.7-2.6 2.3-2.3Z" stroke-linejoin="round" />
                </svg>
                Build Progress
              </h3>
              <span class="card__aside">{{ build.stageLabel }} — {{ build.stagePercent }}%</span>
            </header>

            <div class="progress">
              <div class="progress__head">
                <span>Overall Progress</span>
                <span class="progress__pct">{{ build.overallPercent }}%</span>
              </div>
              <div class="progress__track">
                <div class="progress__fill" :style="{ width: build.overallPercent + '%' }"></div>
              </div>
            </div>

            <ol class="steps">
              <li
                v-for="(step, i) in build.steps"
                :key="step.label"
                class="step"
                :class="`step--${step.state}`"
              >
                <span class="step__dot">
                  <svg v-if="step.state === 'done'" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span v-else>{{ i + 1 }}</span>
                </span>
                <span class="step__label">{{ step.label }}</span>
              </li>
            </ol>
          </section>

          <!-- Delivery & courier -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" stroke-linejoin="round" />
                  <circle cx="7" cy="18" r="1.6" />
                  <circle cx="17.5" cy="18" r="1.6" />
                </svg>
                Delivery &amp; Courier
              </h3>
              <span class="pill pill--warning">{{ delivery.status }}</span>
            </header>

            <div class="ship-meta">
              <div>
                <p class="ship-meta__label">Courier</p>
                <p class="ship-meta__value">{{ delivery.courier }}</p>
              </div>
              <div>
                <p class="ship-meta__label">Tracking No.</p>
                <p class="ship-meta__value">{{ delivery.tracking }}</p>
              </div>
              <div>
                <p class="ship-meta__label">Est. Delivery</p>
                <p class="ship-meta__value">{{ delivery.eta }}</p>
              </div>
            </div>

            <p class="timeline__heading">Shipment Timeline</p>
            <ul class="timeline">
              <li
                v-for="event in delivery.timeline"
                :key="event.label"
                class="timeline__item"
                :class="{ 'is-done': event.state === 'done' }"
              >
                <span class="timeline__dot"></span>
                <span class="timeline__label">{{ event.label }}</span>
                <span class="timeline__at">{{ event.at }}</span>
              </li>
            </ul>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <!-- Customer -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round" />
                </svg>
                Customer
              </h3>
            </header>
            <div class="customer">
              <span class="customer__avatar">{{ thumbInitials(customer.name) }}</span>
              <div>
                <p class="customer__name">{{ customer.name }}</p>
                <p class="customer__email">{{ customer.email }}</p>
              </div>
            </div>
            <ul class="info">
              <li>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 19l5 2v-3a16 16 0 0 1-14-14H4Z" stroke-linejoin="round" /></svg>
                {{ customer.phone }}
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" stroke-linejoin="round" /><circle cx="12" cy="10" r="2.5" /></svg>
                {{ customer.address }}
              </li>
            </ul>
            <a href="#" class="link" @click.prevent>View Customer Profile →</a>
          </section>

          <!-- Assigned technician -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6V21h3.3l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.6-.7-.7-2.6 2.3-2.3Z" stroke-linejoin="round" />
                </svg>
                Assigned Technician
              </h3>
            </header>
            <div class="tech">
              <span class="customer__avatar">{{ thumbInitials(technician.name) }}</span>
              <div class="tech__meta">
                <p class="customer__name">{{ technician.name }}</p>
                <p class="customer__email">{{ technician.role }}</p>
              </div>
              <button type="button" class="icon-btn" title="Reassign technician" aria-label="Reassign technician">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h11l-3-3M20 17H9l3 3" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            </div>
          </section>

          <!-- Payment -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2.5" y="5" width="19" height="14" rx="2" />
                  <path d="M2.5 9.5h19" stroke-linecap="round" />
                </svg>
                Payment
              </h3>
            </header>
            <dl class="kv">
              <div class="kv__row"><dt>Method</dt><dd>{{ payment.method }}</dd></div>
              <div class="kv__row"><dt>Status</dt><dd class="kv__ok">{{ payment.status }}</dd></div>
              <div class="kv__row"><dt>Transaction ID</dt><dd class="kv__mono">{{ payment.transactionId }}</dd></div>
              <div class="kv__row kv__row--total"><dt>Total Paid</dt><dd class="kv__total">{{ payment.totalPaid }}</dd></div>
            </dl>
          </section>

          <!-- Internal notes -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 3h9l4 4v14H6Z" stroke-linejoin="round" />
                  <path d="M9 12h7M9 16h4" stroke-linecap="round" />
                </svg>
                Internal Notes
              </h3>
              <a href="#" class="link" @click.prevent>+ Add Note</a>
            </header>
            <div v-for="note in notes" :key="note.id" class="note">
              <p class="note__body">{{ note.body }}</p>
              <p class="note__by">{{ note.author }} · {{ note.at }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$accent: #f4c10f;
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

/* Sub header */
.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  flex-wrap: wrap;

  &__lead { display: flex; align-items: center; gap: 0.85rem; }

  &__title-row { display: flex; align-items: center; gap: 0.7rem; }

  &__id { margin: 0; font-size: 1.15rem; font-weight: 700; color: $color-text; }

  &__meta { margin: 0.2rem 0 0; font-size: 0.78rem; color: $muted; }

  &__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  flex-shrink: 0;
  background: #f4f5f7;
  border: none;
  border-radius: 9px;
  color: #4a5160;
  cursor: pointer;
  &:hover { background: #eceef1; }
  svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.9; }
}

/* Layout */
.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

/* Card */
.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.9rem;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;

    svg { width: 16px; height: 16px; stroke: $muted; stroke-width: 1.8; }
  }

  &__aside { font-size: 0.78rem; font-weight: 600; color: #a8850a; }
}

/* Status badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;

  &--pending { background: #fff2d6; color: #b8890b; }
  &--processing { background: rgba($accent, 0.22); color: #a8780a; }
  &--completed { background: #e6f7ee; color: #1f9d57; }
  &--cancelled { background: #fdecec; color: #d14343; }
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 999px;

  &--warning { background: #fff2d6; color: #b8890b; }
}

/* Order items */
.items {
  width: 100%;
  border-collapse: collapse;

  th, td { padding: 0.7rem 0.4rem; text-align: left; vertical-align: middle; }

  thead th {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9099a6;
    border-bottom: 1px solid $divider;
  }

  tbody tr + tr td { border-top: 1px solid $divider; }

  &__num { text-align: right; white-space: nowrap; }
  &__muted { color: $muted; }
  &__strong { font-weight: 700; color: $color-text; }
}

.product {
  display: flex;
  align-items: center;
  gap: 0.7rem;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__name { margin: 0; font-size: 0.85rem; font-weight: 600; color: $color-text; }
  &__sku { margin: 0.1rem 0 0; font-size: 0.72rem; color: $muted; }
}

.summary {
  margin: 0.5rem 0 0;
  padding-top: 0.5rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.4rem;
    font-size: 0.86rem;

    dt { margin: 0; color: $muted; }
    dd { margin: 0; font-weight: 600; color: $color-text; }

    &--total {
      margin-top: 0.3rem;
      border-top: 1px solid $divider;
      padding-top: 0.7rem;

      dt { font-weight: 700; color: $color-text; font-size: 0.95rem; }
      dd { font-weight: 800; font-size: 1.1rem; color: #a8850a; }
    }
  }
}

/* Build progress */
.progress {
  margin-bottom: 1.4rem;

  &__head {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: $muted;
    margin-bottom: 0.45rem;
  }

  &__pct { font-weight: 700; color: $color-text; }

  &__track {
    height: 8px;
    background: #f0f1f4;
    border-radius: 999px;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    background: $accent;
    border-radius: 999px;
    transition: width 0.3s ease;
  }
}

.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  text-align: center;

  &__dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 700;
    background: #f0f1f4;
    color: #9099a6;

    svg { width: 16px; height: 16px; stroke: #1f242d; stroke-width: 2.2; }
  }

  &__label { font-size: 0.7rem; color: $muted; line-height: 1.2; }

  &--done .step__dot { background: $accent; color: #1f242d; }
  &--done .step__label { color: $color-text; font-weight: 600; }
}

/* Delivery */
.ship-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.1rem;

  &__label { margin: 0; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: $muted; }
  &__value { margin: 0.25rem 0 0; font-size: 0.88rem; font-weight: 600; color: $color-text; }
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;

  &__heading {
    margin: 0 0 0.6rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: $muted;
  }

  &__item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.5rem 0 0.5rem 0.2rem;
    font-size: 0.85rem;
    color: $muted;

    &:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 5px;
      top: 1.4rem;
      bottom: -0.4rem;
      width: 2px;
      background: $divider;
    }

    &.is-done { color: $color-text; font-weight: 600; }
    &.is-done .timeline__dot { background: $accent; border-color: $accent; }
  }

  &__dot {
    position: relative;
    z-index: 1;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #d7dae0;
    flex-shrink: 0;
  }

  &__label { flex: 1; }
  &__at { font-size: 0.74rem; font-weight: 400; color: $muted; white-space: nowrap; }
}

/* Customer / technician */
.customer,
.tech {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.9rem;
}

.tech { margin-bottom: 0; }
.tech__meta { flex: 1; min-width: 0; }

.customer__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #35495e;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.customer__name { margin: 0; font-size: 0.9rem; font-weight: 700; color: $color-text; }
.customer__email { margin: 0.1rem 0 0; font-size: 0.78rem; color: $muted; }

.info {
  list-style: none;
  margin: 0 0 0.9rem;
  padding: 0;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.35rem 0;
    font-size: 0.82rem;
    color: #4a5160;

    svg { width: 16px; height: 16px; stroke: $muted; stroke-width: 1.7; flex-shrink: 0; margin-top: 1px; }
  }
}

.link {
  font-size: 0.8rem;
  font-weight: 600;
  color: #a8850a;
  &:hover { text-decoration: underline; }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  flex-shrink: 0;
  &:hover { background: #f6f7f9; color: $color-text; }
  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

/* Payment key/value */
.kv {
  margin: 0;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
    font-size: 0.84rem;

    dt { margin: 0; color: $muted; }
    dd { margin: 0; font-weight: 600; color: $color-text; }

    &--total {
      margin-top: 0.3rem;
      border-top: 1px solid $divider;
      padding-top: 0.7rem;
    }
  }

  &__ok { color: #1f9d57 !important; font-weight: 700 !important; }
  &__mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  &__total { color: #a8850a !important; font-weight: 800 !important; font-size: 1rem; }
}

/* Notes */
.note {
  background: #fafbfc;
  border: 1px solid $divider;
  border-radius: 10px;
  padding: 0.75rem 0.85rem;

  &__body { margin: 0; font-size: 0.82rem; color: #4a5160; line-height: 1.45; }
  &__by { margin: 0.5rem 0 0; font-size: 0.72rem; color: $muted; }
}
</style>
