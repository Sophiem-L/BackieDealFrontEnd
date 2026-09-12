<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORM_SELECT } from '@/lib/selectPresets'
import { apiFetch } from '@/services/api'
import { fetchCustomers } from '@/services/customers'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// Blank order — everything starts empty for the user to fill in.
// `productId` ties a row to a real product id; the unit price auto-fills.
const items = ref([{ productId: '', qty: 1, unitPrice: null }])

// Order-level amounts, matching the columns the API persists.
const fees = ref({ tax: null, shipping: null })

const customerId = ref('')
// Only the method is set at creation. payment_status defaults to `pending`
// server-side, and transaction_id comes from the gateway — neither is typed here.
const payment = ref({ method: '' })
const note = ref('')

// The two methods an admin can record. The orders table also documents `stripe`
// and `paypal`, but those belong to a gateway checkout, not to an order typed in
// by hand — the list and detail pages still label them for existing orders.
const PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

/* ---------------------------------------------------------------------------
 * Reference data — the pickers are populated from the API, not fixtures.
 * ------------------------------------------------------------------------- */
const catalog = ref([])
const customerList = ref([])
const loadingRefs = ref(false)
const refsError = ref('')

// Customers come through the same service the Customers directory uses, so the
// picker offers the whole directory rather than the first page the bare
// endpoint returns. See docs/orders-api-gaps.md for the paging limitation that
// still applies to the orders list.
async function loadReferenceData() {
  loadingRefs.value = true
  refsError.value = ''
  try {
    const [productsRes, customers] = await Promise.all([
      apiFetch('/admin/products?per_page=200&sort=name&direction=asc', {
        token: auth.accessToken,
      }),
      fetchCustomers(auth.accessToken),
    ])

    // Products come back as { items, pagination }.
    const productItems = productsRes?.data?.items ?? productsRes?.data ?? []
    catalog.value = productItems.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
    }))

    // fetchCustomers already flattens the resource — name, email, phone and a
    // formatted address — so nothing is re-mapped here.
    customerList.value = customers.map((c) => ({
      id: c.id,
      name: c.name || c.email,
      email: c.email,
      phone: c.phone,
      address: c.address,
    }))
  } catch (err) {
    refsError.value = err.message || 'Could not load products and customers.'
  } finally {
    loadingRefs.value = false
  }
}

onMounted(loadReferenceData)

const selectedCustomer = computed(
  () => customerList.value.find((c) => c.id === customerId.value) ?? null,
)

// The Select speaks strings; `customerId` stays the number the API expects and
// `selectedCustomer` matches on. This is the .number modifier the native
// <select> used to apply, made explicit.
const customerChoice = computed({
  get: () => (customerId.value === '' ? undefined : String(customerId.value)),
  set: (value) => {
    customerId.value = value === undefined || value === '' ? '' : Number(value)
  },
})

// Live totals — mirrors how the API computes grand_total.
const subtotal = computed(() =>
  items.value.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0),
)
// No discount is entered here, so this can never go negative.
const total = computed(
  () => subtotal.value + (Number(fees.value.tax) || 0) + (Number(fees.value.shipping) || 0),
)

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`
}

function addItem() {
  items.value.push({ productId: '', qty: 1, unitPrice: null })
}
function removeItem(index) {
  items.value.splice(index, 1)
  if (items.value.length === 0) addItem()
}

// When a product is picked, auto-fill its unit price.
function onProductSelect(item) {
  const product = catalog.value.find((p) => p.id === item.productId)
  if (product) {
    item.unitPrice = product.price
  }
}

function cancel() {
  router.push({ name: 'orders' })
}

/* ---------------------------------------------------------------------------
 * Submit — POST /admin/orders
 * ------------------------------------------------------------------------- */
const saving = ref(false)
const submitError = ref('')
// Field-level messages keyed the way the API returns them, e.g. items.0.qty.
const fieldErrors = ref({})

const completeItems = computed(() =>
  items.value.filter((i) => i.productId && (Number(i.qty) || 0) > 0),
)
// A customer, a payment method and at least one line item are all required
// before the order can be saved.
const isComplete = computed(
  () =>
    Boolean(customerId.value) && Boolean(payment.value.method) && completeItems.value.length > 0,
)
const canSubmit = computed(() => isComplete.value && !saving.value)

function errorFor(path) {
  const messages = fieldErrors.value[path]
  return Array.isArray(messages) ? messages[0] : messages
}

async function createOrder() {
  if (!canSubmit.value) return

  saving.value = true
  submitError.value = ''
  fieldErrors.value = {}

  // Only send what the API accepts; blank optional fields are omitted.
  const payload = {
    customer_id: customerId.value,
    items: completeItems.value.map((i) => ({
      product_id: i.productId,
      qty: Number(i.qty),
      unit_price: Number(i.unitPrice) || 0,
    })),
  }
  if (Number(fees.value.tax)) payload.tax_total = Number(fees.value.tax)
  if (Number(fees.value.shipping)) payload.shipping_total = Number(fees.value.shipping)
  if (payment.value.method) payload.payment_method = payment.value.method
  if (note.value.trim()) payload.notes = note.value.trim()

  try {
    const response = await apiFetch('/admin/orders', {
      method: 'POST',
      body: payload,
      token: auth.accessToken,
    })

    // Back to the list, which is sorted newest-first, so the new order is the
    // top row. The id is passed along so that row can be highlighted.
    const created = response?.data
    router.push({
      name: 'orders',
      query: created?.id ? { created: created.id } : undefined,
    })
  } catch (err) {
    fieldErrors.value = err.errors ?? {}
    submitError.value =
      err.status === 422
        ? 'Please correct the highlighted fields and try again.'
        : err.message || 'Could not create this order. Please try again.'
  } finally {
    saving.value = false
  }
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
      </section>

      <!-- Without products and customers the form cannot be completed. -->
      <p v-if="refsError" class="load-error">
        {{ refsError }}
        <button type="button" class="retry-btn" @click="loadReferenceData">Retry</button>
      </p>

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
                      :class="{ 'field--invalid': errorFor(`items.${i}.product_id`) }"
                      :disabled="loadingRefs"
                      @change="onProductSelect(item)"
                    >
                      <option value="" disabled>
                        {{ loadingRefs ? 'Loading products…' : 'Select a product' }}
                      </option>
                      <option v-for="p in catalog" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                    <span v-if="errorFor(`items.${i}.product_id`)" class="field-error">
                      {{ errorFor(`items.${i}.product_id`) }}
                    </span>
                  </td>
                  <td class="items__qty">
                    <input
                      v-model.number="item.qty"
                      class="field field--center"
                      :class="{ 'field--invalid': errorFor(`items.${i}.qty`) }"
                      type="number"
                      min="1"
                    />
                  </td>
                  <td class="items__price items__num items__muted">
                    {{ money(item.unitPrice) }}
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

            <!-- These map to the tax_total / shipping_total columns the API
                 persists. Discount is not set here; the API still supports it
                 and the detail page shows it for orders that have one. -->
            <dl class="summary">
              <div class="summary__row"><dt>Subtotal</dt><dd>{{ money(subtotal) }}</dd></div>
              <div class="summary__row">
                <dt>Tax</dt>
                <dd><input v-model.number="fees.tax" class="field field--right field--inline" type="number" min="0" step="0.01" placeholder="0.00" /></dd>
              </div>
              <div class="summary__row">
                <dt>Shipping</dt>
                <dd><input v-model.number="fees.shipping" class="field field--right field--inline" type="number" min="0" step="0.01" placeholder="0.00" /></dd>
              </div>
              <div class="summary__row summary__row--total"><dt>Total</dt><dd>{{ money(total) }}</dd></div>
            </dl>
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
              <div class="field-group">
                <label class="field-group__label" for="customer">Select Customer *</label>
                <Select v-model="customerChoice" :disabled="loadingRefs">
                  <SelectTrigger
                    id="customer"
                    :class="[FORM_SELECT.trigger, { 'field--invalid': errorFor('customer_id') }]"
                  >
                    <SelectValue
                      :placeholder="loadingRefs ? 'Loading customers…' : 'Choose a customer'"
                    />
                  </SelectTrigger>
                  <SelectContent :class="FORM_SELECT.content">
                    <SelectItem
                      v-for="c in customerList"
                      :key="c.id"
                      :value="String(c.id)"
                      :class="FORM_SELECT.item"
                    >
                      {{ c.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span v-if="errorFor('customer_id')" class="field-error">
                  {{ errorFor('customer_id') }}
                </span>
              </div>

              <!-- Contact details come from the chosen customer record; the
                   order stores only customer_id, so these are not editable. -->
              <dl v-if="selectedCustomer" class="picked">
                <div class="picked__row"><dt>Email</dt><dd>{{ selectedCustomer.email || '—' }}</dd></div>
                <div class="picked__row"><dt>Phone</dt><dd>{{ selectedCustomer.phone || '—' }}</dd></div>
                <div class="picked__row picked__row--stack">
                  <dt>Address</dt>
                  <dd>
                    {{ selectedCustomer.address || 'No address on file' }}
                  </dd>
                </div>
              </dl>
              <p v-else class="picked__hint">Pick a customer to see their contact details.</p>
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
              <div class="field-group">
                <label class="field-group__label" for="payment-method">Method *</label>
                <Select v-model="payment.method">
                  <SelectTrigger id="payment-method" :class="FORM_SELECT.trigger">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent :class="FORM_SELECT.content">
                    <SelectItem
                      v-for="m in PAYMENT_METHODS"
                      :key="m.value"
                      :value="m.value"
                      :class="FORM_SELECT.item"
                    >
                      {{ m.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <!-- No Payment Status or Transaction ID here. A new order is
                   always payment-pending: cash is collected on delivery, and a
                   transaction id is issued by the gateway. Payment is recorded
                   later with "Mark as paid" on the order detail page. -->
            </div>
          </section>

          <!-- Notes -->
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
            <textarea v-model="note" class="field" rows="3" placeholder="Add a note (optional)"></textarea>
          </section>

          <div class="form-actions">
            <p v-if="submitError" class="submit-error">{{ submitError }}</p>
            <p v-else-if="!isComplete" class="submit-hint">
              Choose a customer, a payment method and at least one product to save.
            </p>
            <BaseButton variant="ghost" type="button" block :disabled="saving" @click="cancel">
              Cancel
            </BaseButton>
            <BaseButton variant="primary" type="submit" block :disabled="!canSubmit">
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </template>
              {{ saving ? 'Saving…' : 'Save Order' }}
            </BaseButton>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">

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
  &__id { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-strong); }
  &__meta { margin: 0.2rem 0 0; font-size: 0.78rem; color: var(--text-subtle); }
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

/* Shared form field */
.field {
  width: 100%;
  padding: 0.5rem 0.65rem;
  font-size: 0.85rem;
  font-family: inherit;
  color: var(--text-strong);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;

  &::placeholder { color: var(--text-faint); }
  &:focus { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }

  &--sub { margin-top: 0.35rem; font-size: 0.78rem; }
  &--center { text-align: center; }
  &--right { text-align: right; }
  &--inline { width: 110px; }

  /* Server-side validation failure on this field. */
  &--invalid {
    border-color: var(--danger-border);
    background: var(--danger-bg);
    &:focus { border-color: var(--danger); box-shadow: 0 0 0 3px rgb(var(--danger-rgb) / 0.15); }
  }

  &:disabled { background: var(--surface-alt); color: var(--text-subtle); cursor: not-allowed; }
}

textarea.field { resize: vertical; }

.field-error {
  font-size: 0.72rem;
  color: var(--danger);
}

/* Selected customer's read-only contact details */
.picked {
  margin: 0;
  padding: 0.6rem 0.7rem;
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.78rem;

    dt { color: var(--text-subtle); }
    dd { margin: 0; color: var(--text-strong); }

    /* An address is too long to sit opposite its label. */
    &--stack {
      flex-direction: column;
      gap: 0.15rem;
      margin-top: 0.35rem;
      padding-top: 0.35rem;
      border-top: 1px solid var(--border-subtle);

      dd { line-height: 1.45; }
    }
  }

  &__hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-subtle);
  }
}

.load-error {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  padding: 0.7rem 1rem;
  font-size: 0.82rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
}

.retry-btn {
  padding: 0.3rem 0.65rem;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: var(--surface-alt); }
}

.submit-error,
.submit-hint {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.76rem;
}
.submit-error { color: var(--danger); }
.submit-hint { color: var(--text-subtle); }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  &__label {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-muted);
  }
}

.form-stack { display: flex; flex-direction: column; gap: 0.8rem; }

.form-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
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
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  tbody td { vertical-align: middle; }

  &__qty { width: 70px; }
  &__price { width: 120px; }
  &__num { text-align: right; white-space: nowrap; }
  &__muted { color: var(--text-subtle); }
  &__strong { font-weight: 700; color: var(--text-strong); }
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
  color: var(--accent-ink);
  background: rgb(var(--accent-rgb) / 0.12);
  border: 1px dashed rgb(var(--accent-rgb) / 0.6);
  border-radius: 9px;
  cursor: pointer;
  &:hover { background: rgb(var(--accent-rgb) / 0.2); }
  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2; }
}

.summary {
  margin: 1rem 0 0;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);

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
}

/* Buttons */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  &:hover { background: var(--surface-alt); color: var(--text-strong); }
  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }

  &--danger:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }
}
</style>
