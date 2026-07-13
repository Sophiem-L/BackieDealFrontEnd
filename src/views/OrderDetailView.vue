<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()

// Order id comes from the route (/orders/:id); mock content below stands in
// for what an API would return. 'new' (Create New Order) shows the sample.
const rawId = route.params.id
const orderId = !rawId || rawId === 'new' ? '#ORD-1041' : `#${String(rawId).replace(/^#/, '')}`

// The Orders list opens this page with ?edit=1 for editing; without it, it's read-only view.
const isEditMode = computed(() => Boolean(route.query.edit))

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

const customer = {
  name: 'Mike Robertson',
  email: 'mike.r@example.com',
  phone: '+1 (555) 204-8812',
  address: '14 Elmwood Drive, Austin, TX 78701',
}

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

// Snapshot of the loaded status; the Edit button enables only when it changes.
const savedStatus = ref(order.value.status)
const isDirty = computed(() => order.value.status !== savedStatus.value)

// Custom status dropdown (edit mode).
const statusOpen = ref(false)
function selectStatus(value) {
  order.value.status = value
  statusOpen.value = false
}
function closeStatus() {
  statusOpen.value = false
}
onMounted(() => document.addEventListener('click', closeStatus))
onBeforeUnmount(() => document.removeEventListener('click', closeStatus))

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

function viewCustomer() {
  // Open the customer in the Customers section for full detail.
  router.push({ name: 'customers' })
}

function printInvoice() {
  window.print()
}

function editOrder() {
  // No backend yet — persist the current edits (e.g. status) and return to the list.
  savedStatus.value = order.value.status
  window.alert(`Order ${order.value.id} updated.`)
  router.push({ name: 'orders' })
}
</script>

<template>
  <div class="page">
    <AppHeader :title="isEditMode ? 'Edit Order' : 'Order Detail'" />

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

        </div>

        <!-- Side column -->
        <div class="col col--side">
          <!-- Order status -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 11l3 3 8-8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Order Status
              </h3>
            </header>

            <!-- View mode: read-only status text -->
            <p v-if="!isEditMode" class="status-text" :class="`status-text--${order.status}`">
              <span class="status-text__dot" aria-hidden="true"></span>
              {{ statusLabels[order.status] }}
            </p>

            <!-- Edit mode: custom dropdown to update the status -->
            <div v-else class="status-dd" :class="{ 'is-open': statusOpen }" @click.stop>
              <button
                type="button"
                class="status-dd__trigger"
                :class="`status-dd__trigger--${order.status}`"
                :aria-expanded="statusOpen"
                @click="statusOpen = !statusOpen"
              >
                <span class="status-dd__dot" aria-hidden="true"></span>
                <span class="status-dd__value">{{ statusLabels[order.status] }}</span>
                <svg class="status-dd__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>

              <ul v-if="statusOpen" class="status-dd__menu" role="listbox">
                <li
                  v-for="(label, value) in statusLabels"
                  :key="value"
                  class="status-dd__option"
                  :class="[`status-dd__option--${value}`, { 'is-selected': order.status === value }]"
                  role="option"
                  :aria-selected="order.status === value"
                  @click="selectStatus(value)"
                >
                  <span class="status-dd__dot" aria-hidden="true"></span>
                  <span class="status-dd__label">{{ label }}</span>
                  <svg
                    v-if="order.status === value"
                    class="status-dd__check"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </li>
              </ul>
            </div>
          </section>

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
            <button
              type="button"
              class="customer customer--link"
              title="View customer details"
              @click="viewCustomer"
            >
              <span class="customer__avatar">{{ thumbInitials(customer.name) }}</span>
              <div>
                <p class="customer__name">{{ customer.name }}</p>
                <p class="customer__email">{{ customer.email }}</p>
              </div>
            </button>
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
                Notes
              </h3>
            </header>
            <div v-for="note in notes" :key="note.id" class="note">
              <p class="note__body">{{ note.body }}</p>
              <p class="note__by">{{ note.author }} · {{ note.at }}</p>
            </div>
          </section>

          <div v-if="isEditMode" class="detail-actions">
            <BaseButton variant="primary" block :disabled="!isDirty" @click="editOrder">
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 20h9" stroke-linecap="round" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </template>
              Edit Order
            </BaseButton>
          </div>
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

/* Customer */
.customer {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.9rem;
}

.customer--link {
  width: 100%;
  text-align: left;
  padding: 0.4rem;
  margin: -0.4rem -0.4rem 0.5rem;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: #f6f7f9;

    .customer__name { color: #a8850a; text-decoration: underline; }
  }
}

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

/* Order status */
$status-colors: (
  'pending': (#b8890b, #fff2d6, #e0a815),
  'processing': (#a8780a, rgba($accent, 0.22), $accent),
  'completed': (#1f9d57, #e6f7ee, #1f9d57),
  'cancelled': (#d14343, #fdecec, #d14343),
);

/* Edit mode: custom status dropdown */
.status-dd {
  position: relative;

  &__dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #c4c9d2;
    flex-shrink: 0;
  }

  &__trigger {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.7rem 0.85rem;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    color: #4a5160;
    background: #fff;
    border: 1.5px solid #e6e8ec;
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

    &:hover { border-color: #d7dae0; }
    &:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba($accent, 0.25); }
  }

  &__value { flex: 1; text-align: left; }

  &__chevron {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 2;
    transition: transform 0.18s ease;
  }

  &.is-open &__chevron { transform: rotate(180deg); }

  // Trigger reflects the selected status colour.
  @each $name, $c in $status-colors {
    $text: nth($c, 1);
    $bg: nth($c, 2);
    $dot: nth($c, 3);

    &__trigger--#{$name} {
      color: $text;
      border-color: $dot;
      background: $bg;
      .status-dd__dot { background: $dot; }
    }
  }

  &__menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.35rem;
    list-style: none;
    background: #fff;
    border: 1px solid #e9ebef;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(20, 23, 28, 0.14);
  }

  &__option {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.55rem 0.6rem;
    font-size: 0.86rem;
    font-weight: 600;
    color: #4a5160;
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: #f6f7f9; }
  }

  &__label { flex: 1; }

  &__check {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    stroke-width: 2.4;
    flex-shrink: 0;
  }

  // Each option carries its own status colour dot; selected row is tinted.
  @each $name, $c in $status-colors {
    $text: nth($c, 1);
    $bg: nth($c, 2);
    $dot: nth($c, 3);

    &__option--#{$name} .status-dd__dot { background: $dot; }

    &__option--#{$name}.is-selected {
      color: $text;
      background: $bg;
    }
  }
}

/* Read-only status (view mode) */
.status-text {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  &--pending { color: #b8890b; }
  &--processing { color: #a8780a; }
  &--completed { color: #1f9d57; }
  &--cancelled { color: #d14343; }
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
