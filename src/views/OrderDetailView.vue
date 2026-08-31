<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// The list links here with the order uuid (routes bind on it server-side).
const orderUuid = String(route.params.id ?? '')

// The Orders list opens this page with ?edit=1 for editing; without it, it's read-only view.
const isEditMode = computed(() => Boolean(route.query.edit))

// Approving an order is how a manager moves it through its statuses, so
// orders.approve unlocks the status dropdown and Save alongside orders.update.
// Payment state is not part of that — Mark as paid stays on orders.update.
const canEditStatus = computed(() => auth.hasAnyPermission(['orders.update', 'orders.approve']))

// The canonical statuses, matching OrdersView's tabs and UpdateOrderRequest.
const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const PAYMENT_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
  stripe: 'Card (Stripe)',
  paypal: 'PayPal',
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const order = ref({ id: '—', status: '', createdAt: '—', updatedAgo: '—' })
const items = ref([])
const totals = ref({ subtotal: '—', discount: '—', tax: '—', shipping: '—', total: '—' })
// The coupon / promotion applied at checkout, or null. `code` is always set
// when one was used; `name`/`type`/`value` are null once the coupon is deleted.
const coupon = ref(null)
const customer = ref({ name: '—', email: '—', phone: '—', address: '—' })
const payment = ref({ method: '—', status: '—', transactionId: '—', totalPaid: '—' })
// `notes` has no column on the orders table, so there is nothing to load yet.
const notes = ref([])

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—'
}

// 'a few seconds/minutes/hours/days ago' from an ISO timestamp.
function relativeTime(iso) {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return '—'
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// address_snapshot is a JSON blob; flatten whatever parts of it exist.
function formatAddress(snapshot) {
  if (!snapshot) return '—'
  if (typeof snapshot === 'string') return snapshot
  const parts = [
    snapshot.line1 ?? snapshot.address_line_1 ?? snapshot.street,
    snapshot.line2 ?? snapshot.address_line_2,
    snapshot.city,
    snapshot.state ?? snapshot.province,
    snapshot.postal_code ?? snapshot.zip,
    snapshot.country,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

// Kept so Print Order can render from the API payload rather than the
// display-formatted refs.
const rawOrder = ref(null)

function applyOrder(data) {
  rawOrder.value = data ?? null

  const created = data?.created_at ? new Date(data.created_at) : null
  const createdValid = created && !Number.isNaN(created.getTime())

  order.value = {
    id: data?.order_number || (data?.id ? `#${String(data.id).slice(0, 8).toUpperCase()}` : '—'),
    uuid: data?.id ?? '',
    status: data?.status ?? '',
    createdAt: createdValid ? dateTimeFormat.format(created) : '—',
    updatedAgo: data?.updated_at ? relativeTime(data.updated_at) : '—',
  }

  items.value = (Array.isArray(data?.items) ? data.items : []).map((item) => ({
    id: item?.id,
    name: item?.product?.name ?? 'Unknown product',
    sku: item?.product?.sku ?? '—',
    qty: Number(item?.qty ?? 0),
    unitPrice: Number(item?.unit_price ?? 0),
    salePrice: item?.sale_price == null ? null : Number(item.sale_price),
    discount: Number(item?.discount ?? 0),
    lineTotal: Number(item?.line_total ?? 0),
  }))

  coupon.value = data?.coupon?.code
    ? {
        code: data.coupon.code,
        name: data.coupon.name || '',
        // 'fixed' → "$10", 'percentage' → "20%"; blank when the coupon is gone.
        rate:
          data.coupon.type === 'percentage'
            ? `${Number(data.coupon.value)}%`
            : data.coupon.type === 'fixed'
              ? money(data.coupon.value)
              : '',
        discount: money(data.coupon.discount_total ?? data?.discount_total),
      }
    : null

  totals.value = {
    subtotal: money(data?.subtotal),
    discount: money(data?.discount_total),
    tax: money(data?.tax_total),
    shipping: money(data?.shipping_total),
    total: money(data?.total),
  }

  customer.value = {
    id: data?.customer?.id ?? null,
    name: data?.customer?.name || data?.customer?.email || '—',
    email: data?.customer?.email || '—',
    phone: data?.customer?.phone || '—',
    address: formatAddress(data?.shipping_address),
  }

  const method = data?.payment?.method
  const paid = data?.payment?.status === 'paid'
  payment.value = {
    method: method ? (PAYMENT_METHOD_LABELS[method] ?? method) : '—',
    status: data?.payment?.status ? statusLabel(data.payment.status) : '—',
    isPaid: paid,
    transactionId: data?.payment?.transaction_id || '—',
    totalPaid: paid ? money(data?.total) : '—',
  }

  savedStatus.value = order.value.status
}

function statusLabel(value) {
  if (!value) return '—'
  return String(value)
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

async function loadOrder() {
  if (!orderUuid) {
    error.value = 'No order was specified.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/orders/${orderUuid}`, { token: auth.accessToken })
    applyOrder(response?.data ?? {})
  } catch (err) {
    error.value =
      err.status === 404
        ? 'That order no longer exists.'
        : err.message || 'Unable to load this order. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadOrder)

// A legacy row could still hold a status outside the four; show something
// readable rather than a blank chip. The dropdown still only offers the four.
const orderStatusLabel = computed(
  () => statusLabels[order.value.status] ?? statusLabel(order.value.status),
)

// Snapshot of the loaded status; Save enables only when it changes.
const savedStatus = ref('')
const isDirty = computed(() => Boolean(order.value.status) && order.value.status !== savedStatus.value)

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

function thumbInitials(name) {
  return name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'orders' })
}

function viewCustomer() {
  // Open this customer's page in the Customers section. `customer.id` is the
  // users row, which the API nulls out once the account behind an order is
  // deleted — there is no page to open then, so fall back to the directory.
  if (!customer.value.id) {
    router.push({ name: 'customers' })
    return
  }

  router.push({ name: 'customer-detail', params: { id: customer.value.id } })
}

/* ---------------------------------------------------------------------------
 * Recording payment
 *
 * Payment state is set here rather than on the create form: a new order cannot
 * already be paid (cash is collected on delivery, gateways confirm later).
 * ------------------------------------------------------------------------- */
const markingPaid = ref(false)
const canMarkPaid = computed(
  () => Boolean(rawOrder.value) && rawOrder.value?.payment?.status !== 'paid',
)

async function markAsPaid() {
  if (!canMarkPaid.value || markingPaid.value) return
  if (!window.confirm(`Mark ${order.value.id} as paid?`)) return

  markingPaid.value = true
  try {
    const response = await apiFetch(`/admin/orders/${orderUuid}`, {
      method: 'PATCH',
      body: { payment_status: 'paid' },
      token: auth.accessToken,
    })
    applyOrder(response?.data ?? {})
  } catch (err) {
    window.alert(err.message || 'Could not record the payment. Please try again.')
  } finally {
    markingPaid.value = false
  }
}

const printing = ref(false)

// Prints just this order, not the surrounding admin chrome.
async function printOrder() {
  if (!rawOrder.value || printing.value) return

  printing.value = true
  try {
    const { printOrderDocument } = await import('@/services/printOrder')
    await printOrderDocument(rawOrder.value)
  } finally {
    printing.value = false
  }
}

// Persist the status change. Only `status` is editable here, and the API
// accepts just the four canonical values.
async function editOrder() {
  if (!isDirty.value || saving.value) return

  saving.value = true
  try {
    const response = await apiFetch(`/admin/orders/${orderUuid}`, {
      method: 'PATCH',
      body: { status: order.value.status },
      token: auth.accessToken,
    })
    applyOrder(response?.data ?? {})
    router.push({ name: 'orders' })
  } catch (err) {
    window.alert(err.message || 'Could not update this order. Please try again.')
  } finally {
    saving.value = false
  }
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
              <span class="badge" :class="`badge--${order.status}`">{{ orderStatusLabel }}</span>
            </div>
            <p class="subhead__meta">
              Created on {{ order.createdAt }} · Last updated {{ order.updatedAgo }}
            </p>
          </div>
        </div>
        <div class="subhead__actions">
          <BaseButton variant="ghost" :disabled="!rawOrder || printing" @click="printOrder">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 9V3h12v6" stroke-linejoin="round" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" stroke-linejoin="round" />
                <rect x="6" y="14" width="12" height="7" rx="1" />
              </svg>
            </template>
            {{ printing ? 'Preparing…' : 'Print Order' }}
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
                        <p v-if="item.discount > 0" class="product__promo">
                          Promo −{{ money(item.discount) }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="items__num">{{ item.qty }}</td>
                  <td class="items__num items__muted">{{ money(item.unitPrice) }}</td>
                  <td class="items__num items__strong">{{ money(item.lineTotal) }}</td>
                </tr>
                <tr v-if="loading">
                  <td colspan="4" class="items__empty">Loading order…</td>
                </tr>
                <tr v-else-if="error">
                  <td colspan="4" class="items__empty items__empty--error">
                    {{ error }}
                    <button type="button" class="retry-btn" @click="loadOrder">Retry</button>
                  </td>
                </tr>
                <tr v-else-if="items.length === 0">
                  <td colspan="4" class="items__empty">This order has no line items.</td>
                </tr>
              </tbody>
            </table>

            <dl class="summary">
              <div class="summary__row"><dt>Subtotal</dt><dd>{{ totals.subtotal }}</dd></div>
              <div class="summary__row">
                <dt>
                  Discount
                  <span v-if="coupon" class="summary__coupon">
                    {{ coupon.code }}<template v-if="coupon.rate"> · {{ coupon.rate }}</template>
                  </span>
                </dt>
                <dd>{{ totals.discount }}</dd>
              </div>
              <div class="summary__row"><dt>Tax</dt><dd>{{ totals.tax }}</dd></div>
              <div class="summary__row"><dt>Shipping</dt><dd>{{ totals.shipping }}</dd></div>
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
            <p v-if="!isEditMode || !canEditStatus" class="status-text" :class="`status-text--${order.status}`">
              <span class="status-text__dot" aria-hidden="true"></span>
              {{ orderStatusLabel }}
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
                <span class="status-dd__value">{{ orderStatusLabel }}</span>
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
              <div class="kv__row">
                <dt>Status</dt>
                <dd :class="payment.isPaid ? 'kv__ok' : 'kv__pending'">{{ payment.status }}</dd>
              </div>
              <div class="kv__row"><dt>Transaction ID</dt><dd class="kv__mono">{{ payment.transactionId }}</dd></div>
              <div class="kv__row kv__row--total"><dt>Total Paid</dt><dd class="kv__total">{{ payment.totalPaid }}</dd></div>
            </dl>

            <!-- Payment is recorded here, not at creation time. -->
            <button
              v-if="canMarkPaid && auth.hasPermission('orders.update')"
              type="button"
              class="mark-paid"
              :disabled="markingPaid"
              @click="markAsPaid"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ markingPaid ? 'Recording…' : 'Mark as paid' }}
            </button>
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
            <!-- The orders table has no notes column yet, so this stays empty. -->
            <p v-if="notes.length === 0" class="note note__empty">No notes on this order.</p>
          </section>

          <div v-if="isEditMode && canEditStatus" class="detail-actions">
            <BaseButton
              variant="primary"
              block
              :disabled="!isDirty || saving || loading"
              @click="editOrder"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 20h9" stroke-linecap="round" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </template>
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "sass:list";

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
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1rem 1.25rem;
  flex-wrap: wrap;

  &__lead { display: flex; align-items: center; gap: 0.85rem; }

  &__title-row { display: flex; align-items: center; gap: 0.7rem; }

  &__id { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-strong); }

  &__meta { margin: 0.2rem 0 0; font-size: 0.78rem; color: var(--text-subtle); }

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
  background: var(--bg);
  border: none;
  border-radius: 9px;
  color: var(--text-body);
  cursor: pointer;
  &:hover { background: var(--surface-hover); }
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
  background: var(--surface);
  border: 1px solid var(--border-subtle);
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
    color: var(--text-muted);

    svg { width: 16px; height: 16px; stroke: var(--text-subtle); stroke-width: 1.8; }
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

  &--pending { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-ink); }
  &--processing { background: rgb(var(--accent-rgb) / 0.22); color: var(--accent-ink); }
  &--completed { background: var(--success-bg); color: var(--success); }
  &--cancelled { background: var(--danger-bg); color: var(--danger); }
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
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }

  &__num { text-align: right; white-space: nowrap; }
  &__muted { color: var(--text-subtle); }
  &__strong { font-weight: 700; color: var(--text-strong); }

  &__empty {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2rem 1rem;

    &--error { color: var(--danger); }
  }
}

.retry-btn {
  margin-left: 0.6rem;
  padding: 0.35rem 0.7rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: var(--surface-alt); }
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
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__name { margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--text-strong); }
  &__sku { margin: 0.1rem 0 0; font-size: 0.72rem; color: var(--text-subtle); }
  &__promo {
    display: inline-block;
    margin: 0.25rem 0 0;
    padding: 0.05rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 700;
    border-radius: 999px;
    background: var(--success-bg);
    color: var(--success);
  }
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

    dt { margin: 0; color: var(--text-subtle); }
    dd { margin: 0; font-weight: 600; color: var(--text-strong); }

    &--total {
      margin-top: 0.3rem;
      border-top: 1px solid var(--border-subtle);
      padding-top: 0.7rem;

      dt { font-weight: 700; color: var(--text-strong); font-size: 0.95rem; }
      dd { font-weight: 800; font-size: 1.1rem; color: var(--accent-ink); }
    }
  }

  &__coupon {
    display: inline-flex;
    align-items: center;
    margin-left: 0.45rem;
    padding: 0.05rem 0.45rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    border-radius: 999px;
    background: rgb(var(--accent-rgb) / 0.16);
    color: var(--accent-ink);
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
    background: var(--surface-alt);

    .customer__name { color: var(--accent-ink); text-decoration: underline; }
  }
}

.customer__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--secondary);
  color: var(--surface);
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.customer__name { margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--text-strong); }
.customer__email { margin: 0.1rem 0 0; font-size: 0.78rem; color: var(--text-subtle); }

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
    color: var(--text-body);

    svg { width: 16px; height: 16px; stroke: var(--text-subtle); stroke-width: 1.7; flex-shrink: 0; margin-top: 1px; }
  }
}

/* Order status */
$status-colors: (
  'pending': (var(--accent-ink), rgb(var(--accent-rgb) / 0.18), rgb(var(--accent-rgb))),
  'processing': (var(--accent-ink), rgb(var(--accent-rgb) / 0.22), rgb(var(--accent-rgb))),
  'completed': (var(--success), var(--success-bg), var(--success)),
  'cancelled': (var(--danger), var(--danger-bg), var(--danger)),
);

/* Edit mode: custom status dropdown */
.status-dd {
  position: relative;

  &__dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--text-faint);
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
    color: var(--text-body);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

    &:hover { border-color: var(--border); }
    &:focus-visible { outline: none; box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.25); }
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
    $text: list.nth($c, 1);
    $bg: list.nth($c, 2);
    $dot: list.nth($c, 3);

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
    background: var(--surface);
    border: 1px solid var(--border-subtle);
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
    color: var(--text-body);
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: var(--surface-alt); }
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
    $text: list.nth($c, 1);
    $bg: list.nth($c, 2);
    $dot: list.nth($c, 3);

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

  &--pending { color: var(--accent-ink); }
  &--processing { color: var(--accent-ink); }
  &--completed { color: var(--success); }
  &--cancelled { color: var(--danger); }
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

    dt { margin: 0; color: var(--text-subtle); }
    dd { margin: 0; font-weight: 600; color: var(--text-strong); }

    &--total {
      margin-top: 0.3rem;
      border-top: 1px solid var(--border-subtle);
      padding-top: 0.7rem;
    }
  }

  &__ok { color: var(--success) !important; font-weight: 700 !important; }
  &__pending { color: var(--accent-ink) !important; font-weight: 700 !important; }
}

.mark-paid {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  margin-top: 0.85rem;
  padding: 0.55rem 0.8rem;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--success-ink);
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 9px;
  cursor: pointer;

  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2.2; }

  &:hover:not(:disabled) { background: var(--success-bg); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &__mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  &__total { color: var(--accent-ink) !important; font-weight: 800 !important; font-size: 1rem; }
}

/* Notes */
.note {
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 0.75rem 0.85rem;

  &__body { margin: 0; font-size: 0.82rem; color: var(--text-body); line-height: 1.45; }
  &__by { margin: 0.5rem 0 0; font-size: 0.72rem; color: var(--text-subtle); }
  &__empty { margin: 0; font-size: 0.82rem; color: var(--text-subtle); text-align: center; }
}
</style>
