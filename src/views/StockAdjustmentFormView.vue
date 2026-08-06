<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { products as catalog } from '@/data/products'

const router = useRouter()

const adjustmentTypes = [
  'Inventory Recount',
  'Damaged Goods',
  'Customer Return',
  'Supplier Delivery',
  'Theft / Loss',
  'Correction',
]

// No product until one is chosen via the Browse Product picker.
const product = ref(null)

const form = reactive({
  adjustmentType: 'Inventory Recount',
  quantityChange: 2,
  reason: '',
})

function step(delta) {
  // Never let the resulting on-hand quantity go negative.
  const next = form.quantityChange + delta
  if (product.value.currentStock + next < 0) return
  form.quantityChange = next
}

const signedChange = computed(() =>
  form.quantityChange > 0 ? `+${form.quantityChange}` : `${form.quantityChange}`,
)

function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}

// --- Browse Product picker (single select) --------------------------------
const pickerOpen = ref(false)
const pickerSearch = ref('')
const selectedSku = ref('')

const availableProducts = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase()
  if (!q) return catalog
  return catalog.filter(
    (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  )
})

function openPicker() {
  pickerSearch.value = ''
  selectedSku.value = product.value?.sku || ''
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
}

function confirmSelect() {
  const picked = catalog.find((p) => p.sku === selectedSku.value)
  if (!picked) return
  // Map the catalog entry onto the adjustment product shape. Stock/location
  // aren't part of the catalog, so they start blank until a backend provides them.
  product.value = {
    name: picked.name,
    sku: picked.sku,
    location: '—',
    currentStock: 0,
    unitPrice: picked.price,
    threshold: 5,
  }
  form.quantityChange = 0
  closePicker()
}

function cancel() {
  router.push('/stock')
}
function complete() {
  // TODO: POST the adjustment to the inventory API.
  router.push('/stock')
}
</script>

<template>
  <div class="page">
    <AppHeader title="Stock Adjustment" />

    <div class="page__body">
      <!-- Sub header -->
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

      <div class="grid">
        <!-- Main column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">Product Details</h3>

            <!-- Product picker (shown until a product is selected) -->
            <div v-if="!product" class="picker">
              <span class="picker__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.2-3.2" stroke-linecap="round" />
                </svg>
              </span>
              <p class="picker__text">Search and select a product to adjust</p>
              <BaseButton variant="ghost" size="sm" @click="openPicker">Browse Product</BaseButton>
            </div>

            <!-- Selected product + adjustment controls (after a product is chosen) -->
            <template v-if="product">
            <div class="selected">
              <span class="selected__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
              <div class="selected__meta">
                <p class="selected__name">{{ product.name }}</p>
                <p class="selected__sub">SKU: {{ product.sku }} &nbsp;|&nbsp; Location: {{ product.location }}</p>
              </div>
              <div class="selected__stock">
                <p class="selected__stock-label">Current Stock</p>
                <p class="selected__stock-value">{{ product.currentStock }} Units</p>
              </div>
              <button type="button" class="selected__change" @click="openPicker">Change</button>
            </div>

            <!-- Adjustment controls -->
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
                <label>Quantity Change</label>
                <div class="stepper">
                  <button type="button" class="stepper__btn" aria-label="Decrease" @click="step(-1)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke-linecap="round" /></svg>
                  </button>
                  <span class="stepper__value" :class="{ 'stepper__value--neg': form.quantityChange < 0 }">{{ signedChange }}</span>
                  <button type="button" class="stepper__btn" aria-label="Increase" @click="step(1)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
                  </button>
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
            </template>
          </section>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="actions">
        <BaseButton variant="ghost" @click="cancel">Cancel</BaseButton>
        <BaseButton variant="primary" :disabled="!product" @click="complete">Create</BaseButton>
      </div>
    </div>

    <!-- Browse product picker -->
    <Teleport to="body">
      <div v-if="pickerOpen" class="modal" @click.self="closePicker">
        <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="browseProductTitle">
          <header class="modal__header">
            <h3 id="browseProductTitle" class="modal__title">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
                <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
              </svg>
              Browse Product
            </h3>
            <button type="button" class="modal__close" aria-label="Close" @click="closePicker">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="modal__body">
            <label class="picker-search">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.2-3.2" stroke-linecap="round" />
                </svg>
              </span>
              <input v-model="pickerSearch" type="search" placeholder="Search products..." />
            </label>

            <ul class="picker-list">
              <li v-for="item in availableProducts" :key="item.sku">
                <label
                  class="picker-item"
                  :class="{ 'is-selected': selectedSku === item.sku }"
                >
                  <input
                    type="radio"
                    class="picker-item__radio"
                    name="browse-product"
                    :value="item.sku"
                    :checked="selectedSku === item.sku"
                    @change="selectedSku = item.sku"
                  />
                  <span class="picker-item__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
                  <span class="picker-item__meta">
                    <span class="picker-item__name">{{ item.name }}</span>
                    <span class="picker-item__sub">{{ item.sku }} · {{ item.category }}</span>
                  </span>
                </label>
              </li>
              <li v-if="availableProducts.length === 0" class="picker-empty">
                No matching products found.
              </li>
            </ul>
          </div>

          <footer class="modal__footer">
            <BaseButton variant="ghost" @click="closePicker">Cancel</BaseButton>
            <BaseButton variant="primary" :disabled="!selectedSku" @click="confirmSelect">Select Product</BaseButton>
          </footer>
        </div>
      </div>
    </Teleport>
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

/* Product picker */
.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.6rem 1rem;
  border: 1px dashed var(--switch-track);
  border-radius: 12px;
  background: var(--surface-sunken);
  text-align: center;

  &__icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg { width: 26px; height: 26px; stroke: currentColor; stroke-width: 1.6; }
  }

  &__text {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }
}

/* Selected product */
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

/* Controls */
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

/* Quantity stepper */
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

/* Footer actions */
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* Browse product modal */
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: var(--backdrop);
  backdrop-filter: blur(2px);

  &__dialog {
    width: 100%;
    max-width: 520px;
    background: var(--surface);
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(15, 20, 30, 0.25);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2.5rem);
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-strong);

    svg { width: 18px; height: 18px; stroke: rgb(var(--accent-rgb)); stroke-width: 1.8; }
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--bg); color: var(--text-strong); }
    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__body {
    padding: 1.25rem 1.5rem;
    overflow-y: auto;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-subtle);
  }
}

.picker-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.7rem;
  margin-bottom: 0.85rem;
  background: var(--bg);
  border: 1px solid transparent;
  border-radius: 9px;
  &:focus-within { background: var(--surface); border-color: var(--border); }

  span { display: inline-flex; color: var(--text-subtle); }
  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

  input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 0.55rem 0;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    &:focus { outline: none; }
  }
}

.picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.picker-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.7rem;
  background: var(--surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover { border-color: var(--border); background: var(--surface-sunken); }

  &.is-selected {
    border-color: rgb(var(--accent-rgb));
    background: rgb(var(--accent-rgb) / 0.1);
  }

  &__radio {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    accent-color: rgb(var(--accent-rgb));
    cursor: pointer;
  }

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__meta { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  &__name { font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  &__sub { font-size: 0.74rem; color: var(--text-subtle); }
}

.picker-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.86rem;
  color: var(--text-subtle);
}
</style>
