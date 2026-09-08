<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { fetchStockCatalog, createStockMovement } from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const adjustmentTypes = [
  'Inventory Recount',
  'Damaged Goods',
  'Customer Return',
  'Supplier Delivery',
  'Theft / Loss',
  'Correction',
]

const product = ref(null)
const submitting = ref(false)
const submitError = ref('')

const form = reactive({
  adjustmentType: 'Inventory Recount',
  quantityChange: 1,
  reason: '',
})

const isProductLocked = computed(() => Boolean(route.query.product_id || route.query.id))
const quantityIsValid = computed(
  () => Number.isInteger(form.quantityChange) && form.quantityChange > 0,
)

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

const catalog = ref([])
const pickerLoading = ref(false)

async function loadCatalog() {
  pickerLoading.value = true
  try {
    catalog.value = await fetchStockCatalog(100, auth.accessToken)

    const queryProductId = route.query.product_id || route.query.id
    if (queryProductId && !product.value) {
      const match = catalog.value.find(
        (p) => String(p.id) === String(queryProductId) || p.uuid === String(queryProductId),
      )
      if (match) {
        selectProduct(match)
      }
    }
  } catch (err) {
    console.error('Failed to load products catalog:', err)
  } finally {
    pickerLoading.value = false
  }
}

function selectProduct(picked) {
  product.value = {
    id: picked.id,
    uuid: picked.uuid,
    name: picked.name,
    sku: picked.sku,
    category: picked.category,
    location: picked.location || 'Main Warehouse',
    currentStock: Number(picked.currentStock ?? 0),
    unitPrice: picked.unitPrice,
    threshold: Number(picked.threshold ?? 0),
    thumbnail: picked.thumbnail,
  }
  form.quantityChange = 1
}

function selectProductById(id) {
  const picked = catalog.value.find((p) => String(p.id) === String(id))
  if (!picked) return
  selectProduct(picked)
}

function cancel() {
  router.push('/stock')
}

async function complete() {
  if (!product.value) return
  if (!quantityIsValid.value) {
    submitError.value = 'Quantity must be a positive whole number.'
    return
  }

  if (product.value.currentStock + form.quantityChange < 0) {
    submitError.value = `Stock adjustment cannot result in negative stock (current on hand: ${product.value.currentStock}).`
    return
  }

  submitting.value = true
  submitError.value = ''

  try {
    await createStockMovement({
      stockable_type: 'product',
      stockable_id: product.value.id,
      movement_type: 'adjust',
      quantity: form.quantityChange,
      reason: form.adjustmentType,
      reference: form.reason?.trim() || form.adjustmentType,
      metadata: {
        adjustment_type: form.adjustmentType,
      },
    }, auth.accessToken)

    router.push('/stock')
  } catch (err) {
    submitError.value =
      err.errors?.quantity?.[0] ||
      err.message ||
      'Unable to save stock adjustment. Please try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadCatalog()
})
</script>

<template>
  <div class="page">
    <AppHeader title="Stock Adjustment" />

    <div class="page__body">
      <div class="subhead">
        <RouterLink to="/stock" class="subhead__back" aria-label="Back to Stock Management">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
        <div>
          <h2 class="subhead__title">New Stock Adjustment</h2>
          <p class="subhead__desc">Manually adjust inventory levels for damages, returns, or corrections.</p>
        </div>
      </div>

      <div v-if="submitError" class="alert alert--error">
        {{ submitError }}
      </div>

      <div class="grid">
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">Adjustment Details</h3>

            <div v-if="!isProductLocked" class="field">
              <label for="productSelect">Select Product</label>
              <div class="select-wrap">
                <select id="productSelect" :value="product?.id || ''" :disabled="isProductLocked" @change="e => selectProductById(e.target.value)">
                  <option value="" disabled>Select a product to adjust...</option>
                  <option v-for="item in catalog" :key="item.id" :value="item.id">
                    {{ item.name }} (SKU: {{ item.sku }}) — {{ item.currentStock }} in stock
                  </option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </div>
            </div>

            <div class="selected" v-if="product">
              <img
                v-if="product.thumbnail"
                :src="product.thumbnail"
                :alt="product.name"
                class="selected__thumb selected__thumb--img"
              />
              <span v-else class="selected__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
              <div class="selected__meta">
                <p class="selected__name">{{ product.name }}</p>
                <p class="selected__sub">SKU: {{ product.sku }} &nbsp;|&nbsp; Location: {{ product.location }}</p>
              </div>
              <div class="selected__stock">
                <p class="selected__stock-label">Current Stock</p>
                <p class="selected__stock-value">{{ product.currentStock }} Units</p>
              </div>
            </div>

            <div class="controls">
              <div class="field">
                <label for="adjustmentType">Adjustment Type</label>
                <div class="select-wrap">
                  <select id="adjustmentType" v-model="form.adjustmentType">
                    <option v-for="type in adjustmentTypes" :key="type" :value="type">{{ type }}</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
              </div>

              <div class="field">
                <label for="quantityChange">Quantity Change</label>
                <div class="quantity-input">
                  <input
                    id="quantityChange"
                    v-model.number="form.quantityChange"
                    type="number"
                    min="1"
                    step="1"
                    inputmode="numeric"
                    required
                  />
                  <span>units</span>
                </div>
              </div>
            </div>

            <div class="field field--reason">
              <label for="reason">Reason for Adjustment</label>
              <textarea
                id="reason"
                v-model="form.reason"
                rows="3"
                placeholder="Monthly inventory recount. Found 2 additional units in warehouse back-shelf."
              ></textarea>
            </div>

          </section>
        </div>
      </div>

      <div class="actions">
        <BaseButton variant="ghost" :disabled="submitting" @click="cancel">Cancel</BaseButton>
        <BaseButton variant="primary" :disabled="!product || !quantityIsValid || submitting" @click="complete">
          {{ submitting ? 'Saving...' : 'Create' }}
        </BaseButton>
      </div>
    </div>
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

.subhead {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-body);
    flex-shrink: 0;

    &:hover { background: var(--surface-alt); text-decoration: none; }

    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__desc {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }
}

.alert {
  padding: 0.85rem 1.1rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 500;

  &--error {
    background: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
}

.selected {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;

    &--img {
      object-fit: cover;
    }
  }

  &__meta { flex: 1; min-width: 0; }

  &__name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__sub {
    margin: 0.2rem 0 0;
    font-size: 0.75rem;
    color: var(--text-subtle);
  }

  &__stock { text-align: right; flex-shrink: 0; }

  &__stock-label {
    margin: 0;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__stock-value {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__change {
    flex-shrink: 0;
    padding: 0.4rem 0.7rem;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--bg);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    &:hover { background: var(--surface-hover); }
  }
}

.controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1.25rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--reason { margin-top: 1.25rem; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  textarea { resize: vertical; }
}

.quantity-input {
  position: relative;

  input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 4rem 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    appearance: textfield;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button { appearance: none; margin: 0; }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  span {
    position: absolute;
    top: 50%;
    right: 0.85rem;
    transform: translateY(-50%);
    color: var(--text-subtle);
    font-size: 0.78rem;
    pointer-events: none;
  }
}

.select-wrap {
  position: relative;

  select { appearance: none; padding-right: 2.2rem; cursor: pointer; }

  svg {
    position: absolute;
    top: 50%;
    right: 0.8rem;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    stroke: var(--text-subtle);
    stroke-width: 1.8;
    pointer-events: none;
  }
}

.stepper {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    border: none;
    color: var(--text-body);
    cursor: pointer;

    &:hover { background: var(--surface-hover); }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; }
  }

  &__value {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 700;
    color: var(--success);
    padding: 0.65rem 0;

    &--neg { color: var(--danger); }
  }
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
