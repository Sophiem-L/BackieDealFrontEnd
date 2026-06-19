<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

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

const stats = [
  { key: 'products', label: 'Total Products', value: '42', icon: 'box' },
  { key: 'inventory', label: 'Total Inventory', value: '158 Units', icon: 'layers' },
  { key: 'sales', label: 'Monthly Sales', value: '$124,500', icon: 'chart' },
  { key: 'subs', label: 'Sub-Categories', value: '3', icon: 'tag' },
]

const tabs = [
  { key: 'products', label: 'Products in Category' },
  { key: 'attributes', label: 'Attributes & Filters' },
  { key: 'seo', label: 'SEO & Meta' },
]
const activeTab = ref('products')

const search = ref('')

const products = ref([
  { name: 'NVIDIA RTX 4090 FE', sku: 'NV-RTX4090-FE', price: '$1,599', stock: 8, status: 'active' },
  { name: 'ASUS ROG Strix RTX 4080', sku: 'AS-RTX4080-ST', price: '$1,199', stock: 12, status: 'active' },
  { name: 'MSI Ventus 3X RTX 4070', sku: 'MSI-RTX4070-VN', price: '$599', stock: 24, status: 'active' },
  { name: 'EVGA XC3 RTX 3080', sku: 'EV-RTX3080-XC', price: '$329', stock: 0, status: 'out-of-stock' },
  { name: 'Gigabyte Eagle RTX 4060', sku: 'GB-RTX4060-EG', price: '$299', stock: 15, status: 'active' },
])

const statusLabels = { active: 'Active', 'out-of-stock': 'Out of Stock' }

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
          <BaseButton variant="ghost">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2.5l1.6 2.3 2.8-.5.6 2.8 2.6 1.2-1 2.6 1 2.6-2.6 1.2-.6 2.8-2.8-.5L12 21.5l-1.6-2.3-2.8.5-.6-2.8-2.6-1.2 1-2.6-1-2.6 2.6-1.2.6-2.8 2.8.5L12 2.5Z" stroke-linejoin="round" />
              </svg>
            </template>
            Category Settings
          </BaseButton>
          <BaseButton variant="primary">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            Add Product to Category
          </BaseButton>
        </div>
      </section>

      <!-- Stat cards -->
      <section class="stats">
        <article v-for="stat in stats" :key="stat.key" class="stat">
          <span class="stat__icon" aria-hidden="true">
            <svg v-if="stat.icon === 'box'" viewBox="0 0 24 24" fill="none">
              <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
              <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="stat.icon === 'layers'" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 2 7l10 5 10-5-10-5Z" stroke-linejoin="round" />
              <path d="m2 12 10 5 10-5M2 17l10 5 10-5" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="stat.icon === 'chart'" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l6-6 4 4 7-7" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M14 7h6v6" stroke-linecap="round" stroke-linejoin="round" />
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

      <!-- Tabbed content card -->
      <section class="table-card">
        <header class="tabs">
          <nav class="tabs__list">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="tabs__tab"
              :class="{ 'is-active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </nav>
          <label v-if="activeTab === 'products'" class="tabs__search">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" stroke-linecap="round" />
              </svg>
            </span>
            <input v-model="search" type="search" placeholder="Search within category..." />
          </label>
        </header>

        <!-- Products tab -->
        <table v-if="activeTab === 'products'" class="table">
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
                <span class="badge" :class="`badge--${product.status}`">{{ statusLabels[product.status] }}</span>
              </td>
            </tr>
            <tr v-if="filteredProducts.length === 0">
              <td colspan="5" class="table__empty">No products match your search.</td>
            </tr>
          </tbody>
        </table>

        <!-- Placeholder tabs -->
        <div v-else class="placeholder">
          <p class="placeholder__title">
            {{ activeTab === 'attributes' ? 'Attributes & Filters' : 'SEO & Meta' }}
          </p>
          <p class="placeholder__sub">
            {{ activeTab === 'attributes'
              ? 'Define the filterable attributes shoppers can use to narrow this category.'
              : 'Set the meta title, description and slug used for this category page.' }}
          </p>
        </div>
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

/* Stat cards */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 480px) { grid-template-columns: 1fr; }
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
    border-radius: 12px;
    background: #f4f5f7;
    color: #6b7280;
    flex-shrink: 0;
    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__label { margin: 0; font-size: 0.74rem; color: $muted; }
  &__value { margin: 0.2rem 0 0; font-size: 1.35rem; font-weight: 700; color: $color-text; }
}

/* Tabbed table card */
.table-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
}

.tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 1rem 0;
  border-bottom: 1px solid $divider;
  flex-wrap: wrap;

  &__list { display: flex; gap: 0.25rem; flex-wrap: wrap; }

  &__tab {
    padding: 0.8rem 0.85rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    color: $muted;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    &:hover { color: $color-text; }
    &.is-active { color: #1f242d; border-bottom-color: $accent; }
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
    padding: 0 0.7rem;
    background: #f4f5f7;
    border: 1px solid transparent;
    border-radius: 9px;
    &:focus-within { background: #fff; border-color: #e6e8ec; }

    span { display: inline-flex; color: $muted; }
    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

    input {
      width: 200px;
      max-width: 40vw;
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

  &--active { background: #e6f7ee; color: #1f9d57; }
  &--out-of-stock { background: #fdecec; color: #d14343; }
}

.placeholder {
  padding: 3rem 1.5rem;
  text-align: center;

  &__title { margin: 0; font-size: 1rem; font-weight: 700; color: $color-text; }
  &__sub { margin: 0.4rem auto 0; max-width: 420px; font-size: 0.86rem; color: $muted; }
}
</style>
