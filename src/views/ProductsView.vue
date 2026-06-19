<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

const router = useRouter()

const stats = [
  { key: 'total', label: 'Total Products', value: '1,284', icon: 'box', tone: 'neutral' },
  { key: 'low', label: 'Low Stock', value: '14', icon: 'warning', tone: 'warning' },
  { key: 'out', label: 'Out of Stock', value: '3', icon: 'forbidden', tone: 'danger' },
  { key: 'categories', label: 'Categories', value: '24', icon: 'tag', tone: 'neutral' },
]

const products = ref([
  {
    id: 1,
    name: 'NVIDIA GeForce RTX 4090 Founders Edition',
    sku: 'NV-RTX4090-FE',
    category: 'Graphics Cards',
    stock: 8,
    reorder: false,
    price: '$1,599.00',
    status: 'in-stock',
  },
  {
    id: 2,
    name: 'Intel Core i9-14900K Processor',
    sku: 'INT-I9-14900K',
    category: 'Processors',
    stock: 15,
    reorder: false,
    price: '$589.00',
    status: 'in-stock',
  },
  {
    id: 3,
    name: 'ASUS ROG Maximus Z790 Dark Hero',
    sku: 'AS-MAX-Z790',
    category: 'Motherboards',
    stock: 4,
    reorder: true,
    price: '$699.00',
    status: 'low-stock',
  },
  {
    id: 4,
    name: 'Corsair Dominator Platinum 64GB DDR5',
    sku: 'COR-DP-64G5',
    category: 'Memory',
    stock: 0,
    reorder: true,
    price: '$299.00',
    status: 'out-of-stock',
  },
  {
    id: 5,
    name: 'Samsung 980 Pro 2TB NVMe SSD',
    sku: 'SAM-980P-2TB',
    category: 'Storage',
    stock: 42,
    reorder: false,
    price: '$179.99',
    status: 'in-stock',
  },
])

const statusLabels = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

// Row selection
const selected = ref(new Set())
const allSelected = computed(
  () => products.value.length > 0 && selected.value.size === products.value.length,
)
function toggleRow(id) {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
function toggleAll() {
  selected.value = allSelected.value
    ? new Set()
    : new Set(products.value.map((p) => p.id))
}

// 3-dot action menu
const openMenu = ref(null)
function toggleMenu(id) {
  openMenu.value = openMenu.value === id ? null : id
}
function closeMenu() {
  openMenu.value = null
}
onMounted(() => document.addEventListener('click', closeMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))

// Actions
function editProduct(product) {
  closeMenu()
  router.push({ name: 'product-edit', params: { id: product.id } })
}
function duplicateProduct(product) {
  const copy = {
    ...product,
    id: Math.max(0, ...products.value.map((p) => p.id)) + 1,
    name: `${product.name} (Copy)`,
  }
  products.value.splice(products.value.indexOf(product) + 1, 0, copy)
  closeMenu()
}
function deleteProduct(product) {
  products.value = products.value.filter((p) => p.id !== product.id)
  closeMenu()
}

function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="page">
    <AppHeader title="Products & Inventory" />

    <div class="page__body">
      <!-- Stat cards -->
      <section class="stats">
        <article v-for="stat in stats" :key="stat.key" class="stat">
          <span class="stat__icon" :class="`stat__icon--${stat.tone}`" aria-hidden="true">
            <svg v-if="stat.icon === 'box'" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
              <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="stat.icon === 'warning'" viewBox="0 0 24 24" fill="none">
              <path d="M12 3 2 20h20L12 3Z" stroke-linejoin="round" />
              <path d="M12 10v4M12 17h.01" stroke-linecap="round" />
            </svg>
            <svg v-else-if="stat.icon === 'forbidden'" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" />
              <path d="m6 6 12 12" stroke-linecap="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.4Z" stroke-linejoin="round" />
              <circle cx="8" cy="8" r="1.3" />
            </svg>
          </span>
          <div class="stat__meta">
            <p class="stat__label">{{ stat.label }}</p>
            <p class="stat__value">{{ stat.value }}</p>
          </div>
        </article>
      </section>

      <!-- Toolbar -->
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input type="search" placeholder="Search by Product Name, SKU, or Serial..." />
        </label>

        <div class="select">
          All Categories
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>
        <div class="select">
          Stock Level
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="ghost">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 15V3m0 0L8 7m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
            </svg>
          </template>
          Import
        </BaseButton>
        <BaseButton variant="primary" :to="{ name: 'product-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          Add Product
        </BaseButton>
      </section>

      <!-- Table -->
      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th class="table__check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>Product Details</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Price (Unit)</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id">
              <td class="table__check">
                <input
                  type="checkbox"
                  :checked="selected.has(product.id)"
                  @change="toggleRow(product.id)"
                />
              </td>
              <td>
                <div class="product">
                  <span class="product__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
                  <div class="product__meta">
                    <p class="product__name">{{ product.name }}</p>
                    <p class="product__sku">SKU: {{ product.sku }}</p>
                  </div>
                </div>
              </td>
              <td><span class="badge badge--category">{{ product.category }}</span></td>
              <td>
                <p class="stock__count">{{ product.stock }} pcs</p>
                <p v-if="product.reorder" class="stock__reorder">Reorder Soon</p>
              </td>
              <td class="price">{{ product.price }}</td>
              <td>
                <span class="badge" :class="`badge--${product.status}`">
                  {{ statusLabels[product.status] }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    title="Edit product"
                    aria-label="Edit product"
                    @click="editProduct(product)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                      <path d="M13.5 6.5l3 3" stroke-linecap="round" />
                    </svg>
                  </button>

                  <div class="menu">
                    <button
                      type="button"
                      class="icon-btn"
                      title="More actions"
                      aria-label="More actions"
                      :aria-expanded="openMenu === product.id"
                      @click.stop="toggleMenu(product.id)"
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    </button>

                    <div v-if="openMenu === product.id" class="menu__popup" @click.stop>
                      <button type="button" class="menu__item" @click="duplicateProduct(product)">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h8" stroke-linecap="round" />
                        </svg>
                        Duplicate Product
                      </button>
                      <button type="button" class="menu__item menu__item--danger" @click="deleteProduct(product)">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        Delete Product
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <footer class="pagination">
          <p class="pagination__info">Showing 1-{{ products.length }} of 1,284 products</p>
          <div class="pagination__controls">
            <button type="button" class="page-btn">Previous</button>
            <button type="button" class="page-btn page-btn--active">1</button>
            <button type="button" class="page-btn">2</button>
            <button type="button" class="page-btn">Next</button>
          </div>
        </footer>
      </section>
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

/* Stat cards */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;

    svg {
      width: 20px;
      height: 20px;
      stroke-width: 1.8;
    }

    &--neutral {
      background: #f4f5f7;
      color: #6b7280;
      svg { stroke: currentColor; }
    }
    &--warning {
      background: rgba($accent, 0.16);
      color: #b8890b;
      svg { stroke: currentColor; }
    }
    &--danger {
      background: #fdecec;
      color: #d14343;
      svg { stroke: currentColor; }
    }
  }

  &__label {
    margin: 0;
    font-size: 0.78rem;
    color: $muted;
  }

  &__value {
    margin: 0.15rem 0 0;
    font-size: 1.45rem;
    font-weight: 700;
    color: $color-text;
  }
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: #f4f5f7;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within {
      background: #fff;
      border-color: #e6e8ec;
    }
  }

  &__search-icon {
    display: inline-flex;
    color: $muted;
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__spacer { flex: 1; }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: $color-text;
    &:focus { outline: none; }
  }
}

.select {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: #4a5160;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;

  svg { width: 14px; height: 14px; stroke: $muted; stroke-width: 1.8; }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }

  &--ghost {
    background: #fff;
    border-color: #e6e8ec;
    color: #4a5160;
    &:hover { background: #f6f7f9; }
  }
  &--primary {
    background: $accent;
    color: #1f242d;
    &:hover { filter: brightness(0.96); border-color: transparent; }
  }
}

/* Table */
.table-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  overflow: visible;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1rem;
    vertical-align: middle;
  }

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

  &__check { width: 44px; }
  &__actions-head { text-align: right; }

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: $accent;
    cursor: pointer;
  }
}

.product {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.72rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__name {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 600;
    color: #a8850a;
  }

  &__sku {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: $muted;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;

  &--category {
    background: #f1f3f5;
    color: #5b6472;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
  }
  &--in-stock { background: #e6f7ee; color: #1f9d57; }
  &--low-stock { background: rgba($accent, 0.2); color: #b8890b; }
  &--out-of-stock { background: #fdecec; color: #d14343; }
}

.stock {
  &__count { margin: 0; font-size: 0.88rem; font-weight: 600; color: $color-text; }
  &__reorder {
    margin: 0.15rem 0 0;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #b8890b;
  }
}

.price { font-size: 0.9rem; font-weight: 600; color: $color-text; }

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
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

  &:hover { background: #f6f7f9; color: $color-text; border-color: #dfe2e7; }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

.menu {
  position: relative;

  &__popup {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 20;
    min-width: 184px;
    background: #fff;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(20, 23, 28, 0.12);
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.55rem 0.6rem;
    font-size: 0.84rem;
    font-weight: 500;
    text-align: left;
    color: #4a5160;
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;

    &:hover { background: #f6f7f9; }

    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }

    &--danger {
      color: #d14343;
      &:hover { background: #fdf2f2; }
    }
  }
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid $divider;
  flex-wrap: wrap;

  &__info { margin: 0; font-size: 0.82rem; color: $muted; }
  &__controls { display: flex; gap: 0.4rem; }
}

.page-btn {
  min-width: 36px;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  color: #4a5160;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: #f6f7f9; }

  &--active {
    background: $accent;
    border-color: $accent;
    color: #1f242d;
  }
}
</style>
