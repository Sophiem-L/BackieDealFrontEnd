<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { products as catalog } from '@/data/products'

const route = useRoute()
const router = useRouter()

// Display name comes from the grid link (query), with a title-cased fallback
// derived from the :id slug if the page is opened directly.
const categoryName = computed(() => {
  if (typeof route.query.name === 'string' && route.query.name) return route.query.name
  return String(route.params.id || 'Category')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
})

const search = ref('')

const products = ref([
  { name: 'NVIDIA RTX 4090 FE', sku: 'NV-RTX4090-FE', price: '$1,599', stock: 8, status: 'active' },
  { name: 'ASUS ROG Strix RTX 4080', sku: 'AS-RTX4080-ST', price: '$1,199', stock: 12, status: 'active' },
  { name: 'MSI Ventus 3X RTX 4070', sku: 'MSI-RTX4070-VN', price: '$599', stock: 24, status: 'active' },
  { name: 'EVGA XC3 RTX 3080', sku: 'EV-RTX3080-XC', price: '$329', stock: 0, status: 'out-of-stock' },
  { name: 'Gigabyte Eagle RTX 4060', sku: 'GB-RTX4060-EG', price: '$299', stock: 15, status: 'active' },
])

const statusLabels = { 'in-stock': 'In Stock', 'out-of-stock': 'Out of Stock' }

// Status reflects availability, derived from stock on hand.
function stockStatus(product) {
  return product.stock > 0 ? 'in-stock' : 'out-of-stock'
}

const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter(
    (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  )
})

function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}

function money(value) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// --- Add Product to Category picker ---------------------------------------
const pickerOpen = ref(false)
const pickerSearch = ref('')
// SKUs ticked in the picker; multiple products can be added at once.
const selectedSkus = ref([])

// Catalog products that aren't already part of this category, filtered by search.
const availableProducts = computed(() => {
  const inCategory = new Set(products.value.map((p) => p.sku))
  const q = pickerSearch.value.trim().toLowerCase()
  return catalog.filter((p) => {
    if (inCategory.has(p.sku)) return false
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })
})

function toggleSku(sku) {
  const i = selectedSkus.value.indexOf(sku)
  if (i === -1) selectedSkus.value.push(sku)
  else selectedSkus.value.splice(i, 1)
}

function openPicker() {
  pickerSearch.value = ''
  selectedSkus.value = []
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
}

function addSelectedProducts() {
  const picked = catalog.filter((p) => selectedSkus.value.includes(p.sku))
  if (picked.length === 0) return
  // No backend yet — add the chosen products to the in-memory list. Stock isn't
  // allocated to the category yet, so each starts at zero / out of stock.
  for (const p of picked) {
    products.value.push({
      name: p.name,
      sku: p.sku,
      price: money(p.price),
      stock: 0,
      status: 'out-of-stock',
    })
  }
  closePicker()
}
</script>

<template>
  <div class="page">
    <AppHeader :title="`Category: ${categoryName}`" />

    <div class="page__body">
      <!-- Page heading -->
      <section class="lead">
        <div class="lead__text">
          <RouterLink class="lead__crumb" :to="{ name: 'categories' }">All Categories</RouterLink>
          <div class="lead__row">
            <button type="button" class="lead__back" aria-label="Back to categories" @click="router.back()">
              <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <h2 class="lead__title">{{ categoryName }}</h2>
          </div>
        </div>
        <div class="lead__actions">
          <BaseButton variant="primary" @click="openPicker">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            Add Product to Category
          </BaseButton>
        </div>
      </section>

      <!-- Products content card -->
      <section class="table-card">
        <header class="table-head">
          <h3 class="table-head__title">Products in Category</h3>
          <label class="table-head__search">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" stroke-linecap="round" />
              </svg>
            </span>
            <input v-model="search" type="search" placeholder="Search within category..." />
          </label>
        </header>

        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th class="table__status-head">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in filteredProducts" :key="product.sku">
              <td>
                <div class="product">
                  <span class="product__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
                  <span class="product__name">{{ product.name }}</span>
                </div>
              </td>
              <td class="sku">{{ product.sku }}</td>
              <td class="price">{{ product.price }}</td>
              <td>
                <span class="stock" :class="{ 'stock--out': product.stock === 0 }">{{ product.stock }} pcs</span>
              </td>
              <td>
                <span class="badge" :class="`badge--${stockStatus(product)}`">{{ statusLabels[stockStatus(product)] }}</span>
              </td>
            </tr>
            <tr v-if="filteredProducts.length === 0">
              <td colspan="5" class="table__empty">No products match your search.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Add product to category picker -->
    <Teleport to="body">
      <div v-if="pickerOpen" class="modal" @click.self="closePicker">
        <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="addProductTitle">
          <header class="modal__header">
            <h3 id="addProductTitle" class="modal__title">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
                <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
              </svg>
              Add Product to {{ categoryName }}
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
              <input v-model="pickerSearch" type="search" placeholder="Search products to add..." />
            </label>

            <ul class="picker-list">
              <li v-for="product in availableProducts" :key="product.sku">
                <label
                  class="picker-item"
                  :class="{ 'is-selected': selectedSkus.includes(product.sku) }"
                >
                  <input
                    type="checkbox"
                    class="picker-item__checkbox"
                    :value="product.sku"
                    :checked="selectedSkus.includes(product.sku)"
                    @change="toggleSku(product.sku)"
                  />
                  <span class="picker-item__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
                  <span class="picker-item__meta">
                    <span class="picker-item__name">{{ product.name }}</span>
                    <span class="picker-item__sub">{{ product.sku }} · {{ product.category }}</span>
                  </span>
                  <span class="picker-item__price">{{ money(product.price) }}</span>
                </label>
              </li>
              <li v-if="availableProducts.length === 0" class="picker-empty">
                {{ pickerSearch ? 'No matching products found.' : 'All products are already in this category.' }}
              </li>
            </ul>
          </div>

          <footer class="modal__footer">
            <BaseButton variant="ghost" @click="closePicker">Cancel</BaseButton>
            <BaseButton variant="primary" :disabled="selectedSkus.length === 0" @click="addSelectedProducts">
              {{ selectedSkus.length ? `Add ${selectedSkus.length} Product${selectedSkus.length > 1 ? 's' : ''}` : 'Add Products' }}
            </BaseButton>
          </footer>
        </div>
      </div>
    </Teleport>
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

/* Heading */
.lead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__crumb {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $muted;
    &:hover { color: #4a5160; text-decoration: none; }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #4a5160;
    cursor: pointer;
    &:hover { background: #eceef1; border-color: transparent; }
    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__title { margin: 0; font-size: 1.4rem; font-weight: 700; color: $color-text; }

  &__actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
}

/* Products table card */
.table-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
}

.table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.9rem;
  border-bottom: 1px solid $divider;
  flex-wrap: wrap;

  &__title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: $color-text;
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.7rem;
    background: #f4f5f7;
    border: 1px solid transparent;
    border-radius: 9px;
    &:focus-within { background: #fff; border-color: #e6e8ec; }

    span { display: inline-flex; color: $muted; }
    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

    input {
      width: 360px;
      max-width: 60vw;
      border: none;
      background: transparent;
      padding: 0.5rem 0;
      font-size: 0.82rem;
      font-family: inherit;
      color: $color-text;
      &:focus { outline: none; }
    }
  }
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.9rem 1rem; vertical-align: middle; }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9099a6;
    border-bottom: 1px solid $divider;
    background: #fafbfc;
  }

  tbody tr + tr td { border-top: 1px solid $divider; }
  tbody tr:hover { background: #fafbfc; }

  &__status-head { text-align: left; }

  &__empty { text-align: center; color: $muted; font-size: 0.88rem; padding: 2.5rem 1rem; }
}

.product {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__name { font-size: 0.88rem; font-weight: 600; color: $color-text; }
}

.sku { font-size: 0.82rem; color: $muted; font-variant-numeric: tabular-nums; }
.price { font-size: 0.9rem; font-weight: 700; color: $color-text; }

.stock {
  font-size: 0.86rem;
  font-weight: 600;
  color: #4a5160;
  &--out { color: #d14343; }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;

  &--in-stock { background: #e6f7ee; color: #1f9d57; }
  &--out-of-stock { background: #fdecec; color: #d14343; }
}

/* Add product modal */
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(17, 22, 30, 0.5);
  backdrop-filter: blur(2px);

  &__dialog {
    width: 100%;
    max-width: 520px;
    background: #fff;
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
    border-bottom: 1px solid $divider;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: $color-text;

    svg { width: 18px; height: 18px; stroke: $accent; stroke-width: 1.8; }
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
    color: $muted;
    cursor: pointer;

    &:hover { background: #f4f5f7; color: $color-text; }
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
    border-top: 1px solid $divider;
  }
}

.picker-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.7rem;
  margin-bottom: 0.85rem;
  background: #f4f5f7;
  border: 1px solid transparent;
  border-radius: 9px;
  &:focus-within { background: #fff; border-color: #e6e8ec; }

  span { display: inline-flex; color: $muted; }
  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

  input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 0.55rem 0;
    font-size: 0.85rem;
    font-family: inherit;
    color: $color-text;
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
  background: #fff;
  border: 1.5px solid #eef0f3;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover { border-color: #d7dae0; background: #fafbfc; }

  &.is-selected {
    border-color: $accent;
    background: rgba($accent, 0.1);
  }

  &__checkbox {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    accent-color: $accent;
    cursor: pointer;
  }

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__meta { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  &__name { font-size: 0.86rem; font-weight: 600; color: $color-text; }
  &__sub { font-size: 0.74rem; color: $muted; }
  &__price { font-size: 0.86rem; font-weight: 700; color: $color-text; white-space: nowrap; }
}

.picker-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.86rem;
  color: $muted;
}
</style>
