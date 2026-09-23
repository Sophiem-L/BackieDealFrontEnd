<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { fetchStockCatalog, createBulkStockMovement } from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const adjustmentTypes = [
  {
    value: 'Inventory Recount',
    label: 'Inventory Recount',
    description: 'Regular count and verification',
    icon: '📋',
    color: 'blue',
  },
  {
    value: 'Damaged Goods',
    label: 'Damaged Goods',
    description: 'Items too damaged to sell',
    icon: '💔',
    color: 'red',
  },
  {
    value: 'Customer Return',
    label: 'Customer Return',
    description: 'Items returned by customers',
    icon: '↩️',
    color: 'orange',
  },
  {
    value: 'Supplier Delivery',
    label: 'Supplier Delivery',
    description: 'Stock received from suppliers',
    icon: '📦',
    color: 'green',
  },
  {
    value: 'Theft / Loss',
    label: 'Theft / Loss',
    description: 'Missing or stolen items',
    icon: '⚠️',
    color: 'red',
  },
  {
    value: 'Correction',
    label: 'Correction',
    description: 'System error correction',
    icon: '✏️',
    color: 'purple',
  },
]

const product = ref(null)
const submitting = ref(false)
const submitError = ref('')
const selectedRows = ref(new Set())
const showAdjustmentDropdown = ref(false)

const form = reactive({
  adjustmentType: 'Inventory Recount',
  reason: '',
})

const selectedAdjustmentType = computed(() =>
  adjustmentTypes.find(t => t.value === form.adjustmentType) || adjustmentTypes[0]
)

function selectAdjustmentType(type) {
  form.adjustmentType = type.value
  showAdjustmentDropdown.value = false
}

const isProductLocked = computed(() => Boolean(route.query.product_id || route.query.id))
const quantityIsValid = computed(
  () => product.value?.adjustments?.length > 0 && product.value.adjustments.every((item) => Number.isInteger(item.quantityChange) && item.quantityChange > 0),
)

const totalStockChange = computed(() => {
  return product.value?.adjustments?.reduce((sum, item) => sum + (Number(item.quantityChange) || 0), 0) || 0
})

const afterUpdateTotal = computed(() => {
  return product.value?.currentStock && totalStockChange.value ? product.value.currentStock + totalStockChange.value : product.value?.currentStock || 0
})

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
        (p) => String(p.id) === String(queryProductId),
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
    name: picked.name,
    sku: picked.sku,
    category: picked.category,
    location: picked.location || 'Main Warehouse',
    currentStock: Number(picked.currentStock ?? 0),
    unitPrice: picked.unitPrice,
    threshold: Number(picked.threshold ?? 0),
    thumbnail: picked.thumbnail,
    variants: picked.variants ?? [],
    adjustments: (picked.variants?.length ? picked.variants : [{
      id: picked.id,
      name: picked.name,
      sku: picked.sku,
      currentStock: picked.currentStock,
      isSerialized: picked.isSerialized,
    }]).map((variant) => ({
      ...variant,
      quantityChange: 1,
      serialNumbers: variant.isSerialized ? [''] : [],
    })),
  }
}

function updateVariantQuantity(item, value) {
  const quantity = Number(value)
  item.quantityChange = Number.isInteger(quantity) && quantity > 0 ? quantity : value
  if (item.isSerialized) {
    item.serialNumbers = Array.from(
      { length: Math.max(0, Number(item.quantityChange) || 0) },
      (_, index) => item.serialNumbers[index] ?? '',
    )
  }
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

  submitting.value = true
  submitError.value = ''

  try {
    const reference = form.reason?.trim() || form.adjustmentType
    await createBulkStockMovement({
      items: product.value.adjustments.map((item) => ({
        stockable_type: product.value.variants.length ? 'variant' : 'product',
        stockable_id: String(item.id),
        movement_type: 'adjust',
        quantity: item.quantityChange,
        reason: form.adjustmentType,
        reference,
        serial_numbers: item.serialNumbers.filter((serial) => serial.trim()),
        metadata: { adjustment_type: form.adjustmentType },
      })),
    }, auth.accessToken)

    // Redirect to stock detail page with refresh flag
    router.push({
      name: 'stock-detail',
      params: { id: product.value.id },
      query: { refresh: Date.now() }
    })
  } catch (err) {
    submitError.value =
      err.errors?.quantity?.[0] ||
      err.message ||
      'Unable to save stock adjustment. Please try again.'
  } finally {
    submitting.value = false
  }
}

function closeAdjustmentDropdown() {
  showAdjustmentDropdown.value = false
}

onMounted(() => {
  loadCatalog()
  document.addEventListener('click', closeAdjustmentDropdown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeAdjustmentDropdown)
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

      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Adjustment Details</h3>
          </div>
          <div v-if="!isProductLocked" class="card__select">
            <label for="productSelect">Select Product</label>
            <div class="select-wrap select-wrap--enhanced">
              <select id="productSelect" :value="product?.id || ''" :disabled="isProductLocked" @change="e => selectProductById(e.target.value)">
                <option value="" disabled>Select a product to adjust...</option>
                <option v-for="item in catalog" :key="item.id" :value="item.id">
                  {{ item.name }} (SKU: {{ item.sku }}) — {{ item.currentStock }} in stock
                </option>
              </select>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </div>
          </div>
        </div>

        <div v-if="product" class="product-header">
          <div class="product-info">
            <img
              v-if="product.thumbnail"
              :src="product.thumbnail"
              :alt="product.name"
              class="product-info__thumb"
            />
            <span v-else class="product-info__thumb product-info__thumb--initials" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
            <div class="product-info__meta">
              <p class="product-info__name">{{ product.name }}</p>
              <p class="product-info__sub">SKU: {{ product.sku }} &nbsp;|&nbsp; Location: {{ product.location }}</p>
            </div>
          </div>
          <div class="adjustment-controls">
            <div class="control-field">
              <label for="adjustmentType">Adjustment Type</label>
              <div class="adjustment-dropdown-wrapper" @click.stop @mousedown.stop>
                <button
                  id="adjustmentType"
                  type="button"
                  class="adjustment-dropdown-btn"
                  :class="`adjustment-dropdown-btn--${selectedAdjustmentType.color}`"
                  @click.stop="showAdjustmentDropdown = !showAdjustmentDropdown"
                >
                  <span class="adjustment-dropdown-btn__icon">{{ selectedAdjustmentType.icon }}</span>
                  <span class="adjustment-dropdown-btn__label">{{ selectedAdjustmentType.label }}</span>
                  <svg class="adjustment-dropdown-btn__chevron" :style="{ transform: showAdjustmentDropdown ? 'rotate(180deg)' : 'rotate(0)' }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>

                <div v-if="showAdjustmentDropdown" class="adjustment-dropdown-menu" @click.stop>
                  <button
                    v-for="type in adjustmentTypes"
                    :key="type.value"
                    type="button"
                    class="adjustment-dropdown-item"
                    :class="{ 'adjustment-dropdown-item--active': form.adjustmentType === type.value }"
                    @click.stop="selectAdjustmentType(type)"
                  >
                    <span class="adjustment-dropdown-item__icon">{{ type.icon }}</span>
                    <div class="adjustment-dropdown-item__content">
                      <div class="adjustment-dropdown-item__label">{{ type.label }}</div>
                      <div class="adjustment-dropdown-item__description">{{ type.description }}</div>
                    </div>
                    <svg v-if="form.adjustmentType === type.value" class="adjustment-dropdown-item__check" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="product?.adjustments?.length" class="table-container">
          <div class="table-header">
            <span class="table-header__summary">Total Stock In Variant: <strong>{{ totalStockChange }}</strong></span>
          </div>

          <table class="stock-table">
            <thead>
              <tr>
                <th class="th-no">No</th>
                <th class="th-sku">SKU</th>
                <th class="th-variant">Variant Info</th>
                <th class="th-current">Current Qty</th>
                <th class="th-stock-in">Stock In Qty</th>
                <th class="th-serialized">Serial</th>
                <th class="th-after">After Update</th>
                <th class="th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in product.adjustments" :key="item.id">
                <td class="td-no">{{ index + 1 }}</td>
                <td class="td-sku">{{ item.sku || 'N/A' }}</td>
                <td class="td-variant">
                  <div class="variant-cell">
                    <img
                      v-if="product.thumbnail"
                      :src="product.thumbnail"
                      :alt="item.name"
                      class="variant-cell__thumb"
                    />
                    <span v-else class="variant-cell__thumb variant-cell__thumb--initials">{{ thumbInitials(item.name) }}</span>
                    <span class="variant-cell__name">{{ item.name }}</span>
                  </div>
                </td>
                <td class="td-current">{{ item.currentStock }}</td>
                <td class="td-stock-in">
                  <div class="quantity-input-cell">
                    <input
                      :id="`quantity-${item.id}`"
                      :value="item.quantityChange"
                      type="number"
                      min="1"
                      step="1"
                      inputmode="numeric"
                      required
                      @input="updateVariantQuantity(item, $event.target.valueAsNumber)"
                    />
                  </div>
                </td>
                <td class="td-serialized">
                  <span v-if="item.isSerialized" class="serialized-badge" title="This variant requires serial numbers">
                    <svg class="serialized-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M9 12h6M9 16h6M9 8h6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    {{ item.serialNumbers?.length || 0 }}/{{ item.quantityChange }}
                  </span>
                  <span v-else class="serialized-none">—</span>
                </td>
                <td class="td-after">{{ (Number(item.currentStock) || 0) + (Number(item.quantityChange) || 0) }}</td>
                <td class="td-action">
                  <input
                    :id="`check-${item.id}`"
                    type="checkbox"
                    :checked="selectedRows.has(item.id)"
                    @change="e => e.target.checked ? selectedRows.add(item.id) : selectedRows.delete(item.id)"
                    class="checkbox"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="product?.adjustments?.some(a => a.isSerialized)" class="serial-section">
            <div class="serial-section__head">
              <h4 class="serial-section__title">Serial Numbers</h4>
              <p class="serial-section__desc">Enter unique serial numbers for each item</p>
            </div>
            <div v-for="item in product.adjustments.filter(a => a.isSerialized)" :key="item.id" class="serial-group">
              <div class="serial-group__header">
                <span class="serial-group__label">{{ item.name }} ({{ item.sku }})</span>
                <span class="serial-group__count">{{ item.serialNumbers.filter(s => s.trim()).length }}/{{ item.quantityChange }} entered</span>
              </div>
              <div class="serial-inputs">
                <div v-for="(_, serialIndex) in item.serialNumbers" :key="`${item.id}-${serialIndex}`" class="serial-input-wrapper">
                  <label :for="`serial-${item.id}-${serialIndex}`" class="serial-input-label">Serial #{{ serialIndex + 1 }}</label>
                  <input
                    :id="`serial-${item.id}-${serialIndex}`"
                    v-model="item.serialNumbers[serialIndex]"
                    type="text"
                    required
                    :placeholder="`e.g., SN-${Date.now().toString().slice(-6)}`"
                    class="serial-input"
                  />
                  <span v-if="item.serialNumbers[serialIndex]?.trim()" class="serial-check">✓</span>
                </div>
              </div>
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

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  &__title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__select {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 0 0 auto;
    width: 320px;

    label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-body);
    }
  }
}

.product-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem;
  background: var(--surface-hover);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.product-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;

  &__thumb {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    object-fit: cover;
    background: var(--border-subtle);
    flex-shrink: 0;

    &--initials {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 700;
    }
  }

  &__meta {
    min-width: 0;
  }

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
}

.adjustment-controls {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;

  @media (max-width: 900px) {
    width: 100%;
  }
}

.adjustment-dropdown-wrapper {
  position: relative;
}

.adjustment-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-strong);
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    border-color: rgb(var(--accent-rgb));
    background: var(--surface-hover);
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  &__icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__chevron {
    width: 18px;
    height: 18px;
    stroke: var(--text-muted);
    stroke-width: 2;
    flex-shrink: 0;
    transition: transform 0.2s ease, stroke 0.2s ease;
  }

  &--blue {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    color: #1e40af;

    .adjustment-dropdown-btn__chevron { stroke: #3b82f6; }

    &:hover {
      border-color: #2563eb;
      background: rgba(59, 130, 246, 0.15);
    }
  }

  &--red {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    color: #991b1b;

    .adjustment-dropdown-btn__chevron { stroke: #ef4444; }

    &:hover {
      border-color: #dc2626;
      background: rgba(239, 68, 68, 0.15);
    }
  }

  &--orange {
    border-color: #f97316;
    background: rgba(249, 115, 22, 0.08);
    color: #9a3412;

    .adjustment-dropdown-btn__chevron { stroke: #f97316; }

    &:hover {
      border-color: #ea580c;
      background: rgba(249, 115, 22, 0.15);
    }
  }

  &--green {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.08);
    color: #166534;

    .adjustment-dropdown-btn__chevron { stroke: #22c55e; }

    &:hover {
      border-color: #16a34a;
      background: rgba(34, 197, 94, 0.15);
    }
  }

  &--purple {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.08);
    color: #6b21a8;

    .adjustment-dropdown-btn__chevron { stroke: #a855f7; }

    &:hover {
      border-color: #9333ea;
      background: rgba(168, 85, 247, 0.15);
    }
  }
}

.adjustment-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 1000;
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.adjustment-dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 1rem;
  border: none;
  background: transparent;
  color: var(--text-body);
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;

  &:last-child { border-bottom: none; }

  &:hover {
    background: var(--surface-hover);
  }

  &--active {
    background: rgb(var(--accent-rgb) / 0.1);
    color: rgb(var(--accent-rgb));
  }

  &__icon {
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__label {
    font-weight: 600;
    color: var(--text-strong);
    margin-bottom: 0.2rem;
  }

  &__description {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  &__check {
    width: 20px;
    height: 20px;
    color: rgb(var(--accent-rgb));
    flex-shrink: 0;
  }
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }
}

.table-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-x: auto;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-subtle);

  &__summary {
    font-size: 0.9rem;
    color: var(--text-body);
    font-weight: 500;

    strong {
      color: var(--text-strong);
      font-weight: 700;
      font-size: 1.1rem;
      margin-left: 0.5rem;
    }
  }
}

.stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  thead {
    background: var(--surface-hover);
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  th {
    padding: 0.9rem 0.75rem;
    text-align: left;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-right: 1px solid var(--border-subtle);

    &:last-child { border-right: none; }
  }

  td {
    padding: 1rem 0.75rem;
    color: var(--text-body);
    border-bottom: 1px solid var(--border-subtle);
    border-right: 1px solid var(--border-subtle);

    &:last-child { border-right: none; }
  }

  tbody tr {
    &:hover { background: var(--surface-hover); }
    &:last-child td { border-bottom: none; }
  }
}

.th-no, .td-no { width: 60px; }
.th-sku, .td-sku { width: 100px; }
.th-variant, .td-variant { min-width: 200px; }
.th-current, .td-current { width: 100px; text-align: center; }
.th-stock-in, .td-stock-in { width: 140px; }
.th-serialized, .td-serialized { width: 100px; text-align: center; }
.th-after, .td-after { width: 100px; text-align: center; }
.th-action, .td-action { width: 60px; text-align: center; }

.variant-cell {
  display: flex;
  align-items: center;
  gap: 0.8rem;

  &__thumb {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--border-subtle);
    flex-shrink: 0;

    &--initials {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 700;
    }
  }

  &__name {
    font-weight: 500;
    color: var(--text-strong);
  }
}

.quantity-input-cell {
  input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.65rem 0.8rem;
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
}

.serialized-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  background: rgb(var(--accent-rgb) / 0.15);
  border: 1px solid rgb(var(--accent-rgb) / 0.3);
  border-radius: 6px;
  color: rgb(var(--accent-rgb));
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.serialized-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5;
}

.serialized-none {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: rgb(var(--accent-rgb));
}

.serial-section {
  padding: 1.5rem;
  background: var(--surface-hover);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);

  &__head {
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0 0 0.3rem;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-strong);
  }

  &__desc {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
}

.serial-group {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  margin-bottom: 1rem;

  &:last-child { margin-bottom: 0; }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-strong);
    flex: 1;
  }

  &__count {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--surface-hover);
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    white-space: nowrap;
  }
}

.serial-inputs {
  display: grid;
  gap: 0.65rem;
}

.serial-input-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.serial-input-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

.serial-input {
  width: 100%;
  padding: 0.65rem 0.8rem;
  padding-right: 2.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-body);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder { color: var(--text-faint); }

  &:focus {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }
}

.serial-check {
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 0.35rem;
  color: var(--success, #22c55e);
  font-weight: 700;
  font-size: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--reason {
    padding-top: 1rem;
    border-top: 1px solid var(--border-subtle);
  }

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

.select-wrap {
  position: relative;

  select {
    appearance: none;
    padding-right: 2.2rem;
    cursor: pointer;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover { border-color: var(--border-subtle); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

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

  &--enhanced select {
    padding-right: 2.5rem;
    border: 2px solid var(--border);
    font-weight: 500;

    &:hover {
      border-color: rgb(var(--accent-rgb) / 0.5);
      background: var(--surface-hover);
    }

    &:focus {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}
</style>
