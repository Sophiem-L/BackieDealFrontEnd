<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { products as catalog, findProduct } from '@/data/products'
import { customers as customerList, findCustomer } from '@/data/customers'

const router = useRouter()

// Blank order — everything starts empty for the user to fill in.
// `productId` ties a row to a catalog product; SKU + unit price auto-fill.
const items = ref([{ productId: '', sku: '', qty: 1, unitPrice: null }])

const fees = ref({ assembly: null, delivery: null })

const customer = ref({ id: '', name: '', email: '', phone: '', address: '' })
const technician = ref({ name: '', role: '' })
const payment = ref({ method: '', transactionId: '' })
const shipping = ref({ courier: '', tracking: '', eta: '' })
const note = ref('')

const paymentMethods = ['Online (QR Code)', 'Cash on Delivery', 'Bank Transfer', 'Credit Card']
const couriers = ['DHL Express', 'FedEx', 'UPS', 'Local Courier']

// Live totals
const subtotal = computed(() =>
  items.value.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0),
)
const total = computed(
  () => subtotal.value + (Number(fees.value.assembly) || 0) + (Number(fees.value.delivery) || 0),
)

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`
}

function addItem() {
  items.value.push({ productId: '', sku: '', qty: 1, unitPrice: null })
}
function removeItem(index) {
  items.value.splice(index, 1)
  if (items.value.length === 0) addItem()
}

// When a product is picked, auto-fill its SKU and unit price (still editable).
function onProductSelect(item) {
  const product = findProduct(item.productId)
  if (product) {
    item.sku = product.sku
    item.unitPrice = product.price
  }
}

// Single customer per order — selecting one fills the contact details below.
function onCustomerSelect() {
  const found = findCustomer(customer.value.id)
  if (found) {
    customer.value = { ...found }
  }
}

function cancel() {
  router.push({ name: 'orders' })
}

function createOrder() {
  // No backend yet — assemble the payload and return to the list.
  const payload = {
    items: items.value,
    fees: fees.value,
    customer: customer.value,
    technician: technician.value,
    payment: payment.value,
    shipping: shipping.value,
    note: note.value,
    total: total.value,
  }
  console.log('Create order payload:', payload)
  window.alert(`Order created — Total ${money(total.value)}`)
  router.push({ name: 'orders' })
}
</script>

<template>
  <div class="page">
    <AppHeader title="Create New Order" />

    <form class="page__body" @submit.prevent="createOrder">
      <!-- Sub header -->
      <section class="subhead">
        <div class="subhead__lead">
          <button type="button" class="back-btn" aria-label="Back to orders" @click="cancel">
            <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <div>
            <h2 class="subhead__id">New Order</h2>
            <p class="subhead__meta">Fill in the details below to create an order.</p>
          </div>
        </div>
        <div class="subhead__actions">
          <BaseButton variant="ghost" type="button" @click="cancel">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            Create Order
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
                  <th class="items__qty">Qty</th>
                  <th class="items__price">Unit Price</th>
                  <th class="items__num">Subtotal</th>
                  <th class="items__remove"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in items" :key="i">
                  <td>
                    <select
                      v-model.number="item.productId"
                      class="field"
                      @change="onProductSelect(item)"
                    >
                      <option value="" disabled>Select a product</option>
                      <option v-for="p in catalog" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                    <p v-if="item.sku" class="item-sku">SKU: {{ item.sku }}</p>
                  </td>
                  <td class="items__qty">
                    <input v-model.number="item.qty" class="field field--center" type="number" min="1" />
                  </td>
                  <td class="items__price">
                    <input v-model.number="item.unitPrice" class="field field--right" type="number" min="0" step="0.01" placeholder="0.00" />
                  </td>
                  <td class="items__num items__strong">
                    {{ money((Number(item.qty) || 0) * (Number(item.unitPrice) || 0)) }}
                  </td>
                  <td class="items__remove">
                    <button type="button" class="icon-btn icon-btn--danger" title="Remove item" aria-label="Remove item" @click="removeItem(i)">
                      <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <button type="button" class="add-row" @click="addItem">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
              Add Item
            </button>

            <dl class="summary">
              <div class="summary__row"><dt>Subtotal</dt><dd>{{ money(subtotal) }}</dd></div>
              <div class="summary__row">
                <dt>Assembly Fee</dt>
                <dd><input v-model.number="fees.assembly" class="field field--right field--inline" type="number" min="0" step="0.01" placeholder="0.00" /></dd>
              </div>
              <div class="summary__row">
                <dt>Delivery</dt>
                <dd><input v-model.number="fees.delivery" class="field field--right field--inline" type="number" min="0" step="0.01" placeholder="0.00" /></dd>
              </div>
              <div class="summary__row summary__row--total"><dt>Total</dt><dd>{{ money(total) }}</dd></div>
            </dl>
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
            </header>
            <div class="form-grid form-grid--3">
              <label class="field-group">
                <span class="field-group__label">Courier</span>
                <select v-model="shipping.courier" class="field">
                  <option value="" disabled>Select courier</option>
                  <option v-for="c in couriers" :key="c" :value="c">{{ c }}</option>
                </select>
              </label>
              <label class="field-group">
                <span class="field-group__label">Tracking No.</span>
                <input v-model="shipping.tracking" class="field" type="text" placeholder="e.g. 88241502" />
              </label>
              <label class="field-group">
                <span class="field-group__label">Est. Delivery</span>
                <input v-model="shipping.eta" class="field" type="date" />
              </label>
            </div>
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
            <div class="form-stack">
              <label class="field-group">
                <span class="field-group__label">Select Customer</span>
                <select v-model.number="customer.id" class="field" @change="onCustomerSelect">
                  <option value="" disabled>Choose a customer</option>
                  <option v-for="c in customerList" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </label>
              <label class="field-group">
                <span class="field-group__label">Full Name</span>
                <input v-model="customer.name" class="field" type="text" placeholder="e.g. Mike Robertson" />
              </label>
              <label class="field-group">
                <span class="field-group__label">Email</span>
                <input v-model="customer.email" class="field" type="email" placeholder="name@example.com" />
              </label>
              <label class="field-group">
                <span class="field-group__label">Phone</span>
                <input v-model="customer.phone" class="field" type="tel" placeholder="+1 (555) 000-0000" />
              </label>
              <label class="field-group">
                <span class="field-group__label">Address</span>
                <textarea v-model="customer.address" class="field" rows="2" placeholder="Street, City, State ZIP"></textarea>
              </label>
            </div>
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
            <div class="form-stack">
              <label class="field-group">
                <span class="field-group__label">Name</span>
                <input v-model="technician.name" class="field" type="text" placeholder="e.g. Mike R." />
              </label>
              <label class="field-group">
                <span class="field-group__label">Role</span>
                <input v-model="technician.role" class="field" type="text" placeholder="e.g. Senior Technician" />
              </label>
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
            <div class="form-stack">
              <label class="field-group">
                <span class="field-group__label">Method</span>
                <select v-model="payment.method" class="field">
                  <option value="" disabled>Select method</option>
                  <option v-for="m in paymentMethods" :key="m" :value="m">{{ m }}</option>
                </select>
              </label>
              <label class="field-group">
                <span class="field-group__label">Transaction ID</span>
                <input v-model="payment.transactionId" class="field" type="text" placeholder="e.g. #TXN-8842-CC" />
              </label>
            </div>
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
            </header>
            <textarea v-model="note" class="field" rows="3" placeholder="Add an internal note (optional)"></textarea>
          </section>
        </div>
      </div>
    </form>
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

  @media (max-width: 980px) { grid-template-columns: 1fr; }
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

/* Shared form field */
.field {
  width: 100%;
  padding: 0.5rem 0.65rem;
  font-size: 0.85rem;
  font-family: inherit;
  color: $color-text;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 8px;

  &::placeholder { color: #b3b8c2; }
  &:focus { outline: none; border-color: $accent; box-shadow: 0 0 0 3px rgba($accent, 0.18); }

  &--sub { margin-top: 0.35rem; font-size: 0.78rem; }
  &--center { text-align: center; }
  &--right { text-align: right; }
  &--inline { width: 110px; }
}

.item-sku {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: $muted;
}

textarea.field { resize: vertical; }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  &__label {
    font-size: 0.74rem;
    font-weight: 600;
    color: #6b7280;
  }
}

.form-stack { display: flex; flex-direction: column; gap: 0.8rem; }

.form-grid {
  display: grid;
  gap: 0.8rem;

  &--3 {
    grid-template-columns: repeat(3, 1fr);
    @media (max-width: 640px) { grid-template-columns: 1fr; }
  }
}

/* Order items */
.items {
  width: 100%;
  border-collapse: collapse;

  th, td { padding: 0.55rem 0.4rem; text-align: left; vertical-align: top; }

  thead th {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9099a6;
    border-bottom: 1px solid $divider;
  }

  tbody td { vertical-align: middle; }

  &__qty { width: 70px; }
  &__price { width: 120px; }
  &__num { text-align: right; white-space: nowrap; }
  &__strong { font-weight: 700; color: $color-text; }
  &__remove { width: 44px; text-align: right; }
}

.add-row {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  color: #a8850a;
  background: rgba($accent, 0.12);
  border: 1px dashed rgba($accent, 0.6);
  border-radius: 9px;
  cursor: pointer;
  &:hover { background: rgba($accent, 0.2); }
  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2; }
}

.summary {
  margin: 1rem 0 0;
  padding-top: 0.5rem;
  border-top: 1px solid $divider;

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

/* Buttons */
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
  &:hover { background: #f6f7f9; color: $color-text; }
  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }

  &--danger:hover { background: #fdf2f2; color: #d14343; border-color: #f0c9c9; }
}
</style>
