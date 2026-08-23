<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// `per_page` is capped at 200 by IndexProductsRequest. The table takes a single
// page at that size and flags any remainder instead of truncating silently.
const TABLE_PER_PAGE = 200
// The picker pages separately and leans on server-side search instead.
const PICKER_PER_PAGE = 50
const SEARCH_DEBOUNCE_MS = 300

// The grid links with the real numeric id; anything else can't be fetched.
const categoryId = computed(() => {
  const id = Number(route.params.id)
  return Number.isInteger(id) && id > 0 ? id : null
})

// The grid also passes ?name=, so the heading has something to show while
// GET /admin/categories/{id} is in flight.
const categoryName = ref(typeof route.query.name === 'string' ? route.query.name : 'Category')
const categoryMissing = ref(false)

const search = ref('')
const products = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const statusLabels = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

// The API has no explicit list status; derive it the same way the backend's
// `low_stock` filter does (stock_quantity vs min_stock_alert).
function deriveStatus(item) {
  const stock = Number(item.stock_quantity ?? 0)
  if (stock <= 0) return 'out-of-stock'
  if (item.min_stock_alert != null && stock <= Number(item.min_stock_alert)) return 'low-stock'
  return 'in-stock'
}

// Product thumbnails are Cloudinary `secure_url` values (see MediaController),
// so only absolute/rooted URLs are renderable — a bare storage path can't be
// resolved from here and keeps the initials tile instead.
function usableImage(value) {
  const url = String(value ?? '').trim()
  return /^(https?:\/\/|data:|blob:|\/)/.test(url) ? url : ''
}

function mapProduct(item) {
  return {
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    sku: item.sku,
    categoryId: item.category?.id ?? null,
    categoryName: item.category?.name ?? 'Uncategorized',
    stock: Number(item.stock_quantity ?? 0),
    price: item.price != null ? currency.format(item.price) : '—',
    status: deriveStatus(item),
    thumbnail: usableImage(item.thumbnail),
  }
}

// Thumbnails that fail to load fall back to the initials tile.
const brokenThumbs = ref(new Set())
function onThumbError(uuid) {
  const next = new Set(brokenThumbs.value)
  next.add(uuid)
  brokenThumbs.value = next
}

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

async function loadCategory() {
  if (categoryId.value == null) {
    categoryMissing.value = true
    return
  }
  try {
    const response = await apiFetch(`/admin/categories/${categoryId.value}`, {
      token: auth.accessToken,
    })
    const row = response?.data
    if (row?.name) categoryName.value = row.name
  } catch (err) {
    // A 404 means the category is gone; anything else leaves the ?name= heading
    // in place, since the products list carries its own error state.
    if (err.status === 404) categoryMissing.value = true
  }
}

async function loadProducts() {
  if (categoryId.value == null) {
    categoryMissing.value = true
    return
  }
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      category_id: String(categoryId.value),
      page: '1',
      per_page: String(TABLE_PER_PAGE),
      sort: 'name',
      direction: 'asc',
    })
    const response = await apiFetch(`/admin/products?${params.toString()}`, {
      token: auth.accessToken,
    })
    const data = response?.data ?? {}
    products.value = (data.items ?? []).map(mapProduct)
    brokenThumbs.value = new Set()
    total.value = data.pagination?.total ?? products.value.length
  } catch (err) {
    error.value = err.message || 'Unable to load products. Please try again.'
    products.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// True when the category holds more products than one page can show.
const truncated = computed(() => total.value > products.value.length)

onMounted(() => {
  loadCategory()
  loadProducts()
})

const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter(
    (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  )
})

// --- Add Product to Category picker ---------------------------------------
// A product belongs to exactly one category (products.category_id), so "adding"
// one here is a PUT that moves it out of whatever category it was in. That also
// makes the exclusion rule trivial: a product is already in this category iff
// its category id matches, so the fetched list just filters those out.
const pickerOpen = ref(false)
const pickerSearch = ref('')
const pickerItems = ref([])
const pickerLoading = ref(false)
const pickerError = ref('')
const submitting = ref(false)
const submitError = ref('')

// Keyed by uuid and holding the whole row: the search re-fetches and replaces
// the visible list, so an id-only selection would lose the names needed for the
// footer count and the failure message.
const selected = ref(new Map())
const selectedCount = computed(() => selected.value.size)

function isSelected(uuid) {
  return selected.value.has(uuid)
}

function toggleProduct(product) {
  const next = new Map(selected.value)
  if (next.has(product.uuid)) next.delete(product.uuid)
  else next.set(product.uuid, product)
  selected.value = next
}

// Only the newest request may write to the list. The debounce delays scheduling,
// not overlapping requests: type, pause, type again, and a slow first fetch can
// resolve after the second one and leave stale results on screen.
let pickerRequestId = 0

async function loadPickerProducts() {
  const requestId = ++pickerRequestId
  pickerLoading.value = true
  pickerError.value = ''
  try {
    const params = new URLSearchParams({
      page: '1',
      per_page: String(PICKER_PER_PAGE),
      sort: 'name',
      direction: 'asc',
    })
    const q = pickerSearch.value.trim()
    if (q) params.set('q', q)

    const response = await apiFetch(`/admin/products?${params.toString()}`, {
      token: auth.accessToken,
    })
    const items = (response?.data?.items ?? []).map(mapProduct)
    if (requestId !== pickerRequestId) return
    // Drop anything already filed under this category.
    pickerItems.value = items.filter((item) => item.categoryId !== categoryId.value)
  } catch (err) {
    if (requestId !== pickerRequestId) return
    pickerError.value = err.message || 'Unable to load products. Please try again.'
    pickerItems.value = []
  } finally {
    if (requestId === pickerRequestId) pickerLoading.value = false
  }
}

let searchTimer = null
watch(pickerSearch, () => {
  if (!pickerOpen.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadPickerProducts, SEARCH_DEBOUNCE_MS)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

function openPicker() {
  pickerItems.value = []
  pickerError.value = ''
  submitError.value = ''
  selected.value = new Map()
  pickerOpen.value = true
  loadPickerProducts()
}

function closePicker() {
  clearTimeout(searchTimer)
  pickerOpen.value = false
  // Cleared on close, not on open: resetting it here means the watcher sees a
  // closed picker and bails, so reopening doesn't queue a duplicate fetch.
  pickerSearch.value = ''
}

async function addSelectedProducts() {
  const picked = [...selected.value.values()]
  if (picked.length === 0 || submitting.value) return

  submitting.value = true
  submitError.value = ''
  try {
    const results = await Promise.allSettled(
      picked.map((product) =>
        apiFetch(`/admin/products/${product.uuid}`, {
          method: 'PUT',
          body: { category_id: categoryId.value },
          token: auth.accessToken,
        }),
      ),
    )

    const failed = picked.filter((_, i) => results[i].status === 'rejected')

    // The table reloads either way, so a partial success is visible immediately.
    await loadProducts()

    if (failed.length === 0) {
      closePicker()
      return
    }

    // Keep only the failures selected so a retry doesn't re-send the successes.
    selected.value = new Map(failed.map((product) => [product.uuid, product]))
    // Surface the server's reason too — a validation error is otherwise invisible.
    const reason = results.find((r) => r.status === 'rejected')?.reason?.message
    const names = failed.map((p) => p.name).join(', ')
    submitError.value = reason ? `Couldn't add ${names} — ${reason}` : `Couldn't add: ${names}`
    await loadPickerProducts()
  } finally {
    submitting.value = false
  }
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
        <div v-if="!categoryMissing" class="lead__actions">
          <BaseButton variant="primary" @click="openPicker">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
            </template>
            Add Product to Category
          </BaseButton>
        </div>
      </section>

      <!-- The :id in the URL must be a real category id; slug links can't resolve. -->
      <section v-if="categoryMissing" class="table-card">
        <p class="missing">
          This category no longer exists.
          <RouterLink :to="{ name: 'categories' }">Back to all categories</RouterLink>
        </p>
      </section>

      <!-- Products content card -->
      <section v-else class="table-card">
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
            <tr v-if="loading">
              <td colspan="5" class="table__empty">Loading products…</td>
            </tr>
            <tr v-else-if="error">
              <td colspan="5" class="table__empty table__empty--error">
                {{ error }}
                <button type="button" class="table__retry" @click="loadProducts">Retry</button>
              </td>
            </tr>
            <tr v-else-if="filteredProducts.length === 0">
              <td colspan="5" class="table__empty">
                {{ search ? 'No products match your search.' : 'No products in this category yet.' }}
              </td>
            </tr>
            <tr v-for="product in filteredProducts" v-else :key="product.uuid">
              <td>
                <div class="product">
                  <span class="product__thumb" aria-hidden="true">
                    <img
                      v-if="product.thumbnail && !brokenThumbs.has(product.uuid)"
                      :src="product.thumbnail"
                      alt=""
                      loading="lazy"
                      @error="onThumbError(product.uuid)"
                    />
                    <template v-else>{{ thumbInitials(product.name) }}</template>
                  </span>
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
          </tbody>
        </table>

        <p v-if="truncated" class="table-foot">
          Showing the first {{ products.length }} of {{ total.toLocaleString() }} products.
        </p>
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

            <p v-if="submitError" class="picker-error">{{ submitError }}</p>

            <p v-if="pickerLoading" class="picker-empty">Loading products…</p>
            <p v-else-if="pickerError" class="picker-empty picker-empty--error">
              {{ pickerError }}
              <button type="button" class="table__retry" @click="loadPickerProducts">Retry</button>
            </p>
            <p v-else-if="pickerItems.length === 0" class="picker-empty">
              {{ pickerSearch ? 'No matching products found.' : 'All products are already in this category.' }}
            </p>
            <ul v-else class="picker-list">
              <li v-for="product in pickerItems" :key="product.uuid">
                <label class="picker-item" :class="{ 'is-selected': isSelected(product.uuid) }">
                  <input
                    type="checkbox"
                    class="picker-item__checkbox"
                    :checked="isSelected(product.uuid)"
                    @change="toggleProduct(product)"
                  />
                  <span class="picker-item__thumb" aria-hidden="true">
                    <img
                      v-if="product.thumbnail && !brokenThumbs.has(product.uuid)"
                      :src="product.thumbnail"
                      alt=""
                      loading="lazy"
                      @error="onThumbError(product.uuid)"
                    />
                    <template v-else>{{ thumbInitials(product.name) }}</template>
                  </span>
                  <span class="picker-item__meta">
                    <!-- Current category is shown because adding moves the
                         product out of it — one category per product. -->
                    <span class="picker-item__name">{{ product.name }}</span>
                    <span class="picker-item__sub">{{ product.sku }} · {{ product.categoryName }}</span>
                  </span>
                  <span class="picker-item__price">{{ product.price }}</span>
                </label>
              </li>
            </ul>
          </div>

          <footer class="modal__footer">
            <BaseButton variant="ghost" :disabled="submitting" @click="closePicker">Cancel</BaseButton>
            <BaseButton
              variant="primary"
              :disabled="selectedCount === 0 || submitting"
              @click="addSelectedProducts"
            >
              <template v-if="submitting">Adding…</template>
              <template v-else-if="selectedCount">
                Add {{ selectedCount }} Product{{ selectedCount > 1 ? 's' : '' }}
              </template>
              <template v-else>Add Products</template>
            </BaseButton>
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
    color: var(--text-subtle);
    &:hover { color: var(--text-body); text-decoration: none; }
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
    color: var(--text-body);
    cursor: pointer;
    &:hover { background: var(--surface-hover); border-color: transparent; }
    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__title { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-strong); }

  &__actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
}

/* Products table card */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
}

.table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;

  &__title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.7rem;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 9px;
    &:focus-within { background: var(--surface); border-color: var(--border); }

    span { display: inline-flex; color: var(--text-subtle); }
    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

    input {
      width: 360px;
      max-width: 60vw;
      border: none;
      background: transparent;
      padding: 0.5rem 0;
      font-size: 0.82rem;
      font-family: inherit;
      color: var(--text-strong);
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
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  &__status-head { text-align: left; }

  &__empty {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;

    &--error { color: var(--danger); }
  }

  &__retry {
    margin-left: 0.6rem;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: var(--surface-alt); }
  }
}

/* Truncation note — the table takes one 200-row page, no pager. */
.table-foot {
  margin: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.78rem;
  color: var(--text-subtle);
}

.missing {
  margin: 0;
  padding: 3rem 1rem;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-subtle);

  a { margin-left: 0.35rem; font-weight: 600; }
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
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
    overflow: hidden;

    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }

  &__name { font-size: 0.88rem; font-weight: 600; color: var(--text-strong); }
}

.sku { font-size: 0.82rem; color: var(--text-subtle); font-variant-numeric: tabular-nums; }
.price { font-size: 0.9rem; font-weight: 700; color: var(--text-strong); }

.stock {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-body);
  &--out { color: var(--danger); }
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

  &--in-stock { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
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

  &__checkbox {
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
    overflow: hidden;

    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }

  &__meta { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  &__name { font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  &__sub { font-size: 0.74rem; color: var(--text-subtle); }
  &__price { font-size: 0.86rem; font-weight: 700; color: var(--text-strong); white-space: nowrap; }
}

.picker-empty {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.86rem;
  color: var(--text-subtle);

  &--error { color: var(--danger); }
}

/* Partial-failure notice: some PUTs landed, some didn't. */
.picker-error {
  margin: 0 0 0.85rem;
  padding: 0.6rem 0.8rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 9px;
  font-size: 0.82rem;
  color: var(--danger);
}
</style>
