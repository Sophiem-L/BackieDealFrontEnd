<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { currency } from '@/lib/format'
import { fetchPromotionProducts, previewDiscount, productBasePrice } from '@/services/promotions'

// The product target of a promotion: a searchable, filterable, paged table.
// Selection is a list of ids, so it survives search, filter and page changes;
// the details of every product ever shown are kept so the selected list can
// still name a product that is no longer on the current page.
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  // Product records already known, e.g. the saved selection on edit.
  known: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  // { type: 'percentage'|'fixed', value, maxDiscount } — drives the preview.
  discount: { type: Object, default: () => ({}) },
  token: { type: String, default: null },
  error: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const search = ref('')
const categoryId = ref('')
const page = ref(1)
const lastPage = ref(1)
const total = ref(null)
const rows = ref([])
const loading = ref(false)
const loadError = ref('')
const details = ref(new Map())

let requestId = 0
let searchTimer = null

const selectedIds = computed(() => new Set(props.modelValue.map(String)))
const selectedProducts = computed(() =>
  props.modelValue.map((id) => details.value.get(String(id)) ?? { id: String(id), name: `Product ${id}` }),
)
const allOnPageSelected = computed(
  () => rows.value.length > 0 && rows.value.every((product) => selectedIds.value.has(String(product.id))),
)

function remember(products) {
  const next = new Map(details.value)
  for (const product of products) next.set(String(product.id), product)
  details.value = next
}

watch(() => props.known, (products) => remember(products ?? []), { immediate: true })

async function load() {
  const current = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const result = await fetchPromotionProducts(props.token, search.value, page.value, categoryId.value || null)
    // A slower, older response must not overwrite a newer search.
    if (current !== requestId) return
    rows.value = result.items
    lastPage.value = Math.max(1, result.lastPage)
    total.value = result.total ?? null
    remember(result.items)
  } catch (err) {
    if (current !== requestId) return
    rows.value = []
    loadError.value = err.message || 'Could not load products.'
  } finally {
    if (current === requestId) loading.value = false
  }
}

function resetAndLoad() {
  page.value = 1
  load()
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(resetAndLoad, 300)
}

function goTo(target) {
  if (target < 1 || target > lastPage.value || target === page.value) return
  page.value = target
  load()
}

function toggle(product) {
  const id = String(product.id)
  emit('update:modelValue', selectedIds.value.has(id)
    ? props.modelValue.filter((selected) => String(selected) !== id)
    : [...props.modelValue.map(String), id])
}

function togglePage() {
  const pageIds = rows.value.map((product) => String(product.id))
  if (allOnPageSelected.value) {
    const onPage = new Set(pageIds)
    emit('update:modelValue', props.modelValue.map(String).filter((id) => !onPage.has(id)))
  } else {
    emit('update:modelValue', [...new Set([...props.modelValue.map(String), ...pageIds])])
  }
}

function remove(id) {
  emit('update:modelValue', props.modelValue.map(String).filter((selected) => selected !== String(id)))
}

function clearAll() {
  emit('update:modelValue', [])
}

function priceOf(product) {
  const base = productBasePrice(product)
  return { base, preview: base === null ? null : previewDiscount(base, props.discount) }
}

const money = (amount) => (amount == null ? '—' : currency.format(amount))

onMounted(load)
onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<template>
  <div class="ptargets">
    <div class="ptargets__filters">
      <input
        id="productSearch"
        v-model="search"
        type="search"
        placeholder="Search products by name"
        aria-label="Search products"
        @input="onSearch"
      />
      <select id="productCategory" v-model="categoryId" aria-label="Filter by category" @change="resetAndLoad">
        <option value="">All categories</option>
        <option v-for="category in categories" :key="category.id" :value="String(category.id)">
          {{ category.name }}
        </option>
      </select>
    </div>

    <p v-if="loadError" class="ptargets__error" role="alert">
      {{ loadError }}
      <button type="button" class="ptargets__link" @click="load">Retry</button>
    </p>

    <div class="ptargets__table-wrap" :class="{ 'ptargets__table-wrap--loading': loading && rows.length }">
      <table class="ptargets__table">
        <thead>
          <tr>
            <th class="ptargets__check">
              <input
                type="checkbox"
                :checked="allOnPageSelected"
                :disabled="!rows.length"
                aria-label="Select every product on this page"
                @change="togglePage"
              />
            </th>
            <th>Product</th>
            <th class="ptargets__hide-sm">Category</th>
            <th class="ptargets__num">Base price</th>
            <th class="ptargets__num">Discount</th>
            <th class="ptargets__num">After discount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !rows.length">
            <td colspan="6" class="ptargets__state">Loading products…</td>
          </tr>
          <tr v-else-if="!rows.length && !loadError">
            <td colspan="6" class="ptargets__state">No products match these filters.</td>
          </tr>
          <tr
            v-for="product in rows"
            :key="product.id"
            class="ptargets__row"
            :class="{ 'ptargets__row--selected': selectedIds.has(String(product.id)) }"
            @click="toggle(product)"
          >
            <td class="ptargets__check" @click.stop>
              <input
                type="checkbox"
                :checked="selectedIds.has(String(product.id))"
                :aria-label="`Select ${product.name}`"
                @change="toggle(product)"
              />
            </td>
            <td>
              <div class="ptargets__product">
                <img v-if="product.thumbnail" :src="product.thumbnail" alt="" class="ptargets__thumb" loading="lazy" />
                <span v-else class="ptargets__thumb ptargets__thumb--empty" aria-hidden="true">
                  {{ (product.name || '?').charAt(0) }}
                </span>
                <span class="ptargets__text">
                  <span class="ptargets__name">{{ product.name }}</span>
                  <span v-if="product.short_description" class="ptargets__desc">{{ product.short_description }}</span>
                </span>
              </div>
            </td>
            <td class="ptargets__hide-sm">{{ product.category?.name ?? '—' }}</td>
            <td class="ptargets__num">
              {{ money(priceOf(product).base) }}
              <s v-if="product.sale_price != null && product.price != null" class="ptargets__was">{{ money(product.price) }}</s>
            </td>
            <td class="ptargets__num ptargets__off">
              {{ priceOf(product).preview ? `−${money(priceOf(product).preview.discount)}` : '—' }}
            </td>
            <td class="ptargets__num ptargets__final">{{ money(priceOf(product).preview?.finalPrice) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ptargets__pager">
      <span>Page {{ page }} of {{ lastPage }}<template v-if="total !== null"> · {{ total }} products</template></span>
      <span class="ptargets__pager-buttons">
        <button type="button" :disabled="page <= 1 || loading" @click="goTo(page - 1)">Previous</button>
        <button type="button" :disabled="page >= lastPage || loading" @click="goTo(page + 1)">Next</button>
      </span>
    </div>

    <div class="ptargets__selected">
      <div class="ptargets__selected-head">
        <strong>{{ modelValue.length }} {{ modelValue.length === 1 ? 'product' : 'products' }} selected</strong>
        <button v-if="modelValue.length" type="button" class="ptargets__link" @click="clearAll">Clear all</button>
      </div>
      <ul v-if="modelValue.length" class="ptargets__chips">
        <li v-for="product in selectedProducts" :key="product.id" class="ptargets__chip">
          <span>{{ product.name }}</span>
          <button type="button" :aria-label="`Remove ${product.name}`" @click="remove(product.id)">×</button>
        </li>
      </ul>
      <p v-else class="ptargets__hint">Select at least one product from the table.</p>
    </div>

    <p class="ptargets__hint">
      Preview per unit. Final prices are recalculated at checkout, where minimum spend and usage limits also apply.
    </p>
    <span v-if="error" class="field-error">{{ error }}</span>
  </div>
</template>

<style scoped lang="scss">
.ptargets {
  display: grid;
  gap: 0.75rem;

  &__filters {
    display: grid;
    grid-template-columns: 1fr minmax(0, 220px);
    gap: 0.6rem;

    @media (max-width: 560px) { grid-template-columns: 1fr; }

    input, select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.6rem 0.8rem;
      font: inherit;
      font-size: 0.85rem;
      color: var(--text-strong);
      background: var(--surface);

      &:focus {
        outline: none;
        border-color: rgb(var(--accent-rgb));
        box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
      }
    }
  }

  &__table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    transition: opacity 0.15s ease;

    &--loading { opacity: 0.6; }
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;

    th {
      padding: 0.55rem 0.7rem;
      text-align: left;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted);
      background: var(--bg);
      white-space: nowrap;
    }

    td {
      padding: 0.55rem 0.7rem;
      border-top: 1px solid var(--border-subtle);
      color: var(--text-body);
      vertical-align: middle;
    }

    input[type='checkbox'] { accent-color: rgb(var(--accent-rgb)); }
  }

  &__row {
    cursor: pointer;

    &:hover td { background: var(--surface-hover); }

    &--selected td { background: rgb(var(--accent-rgb) / 0.08); }
    &--selected:hover td { background: rgb(var(--accent-rgb) / 0.12); }
  }

  &__check { width: 2.25rem; }
  &__num { text-align: right !important; white-space: nowrap; }
  &__off { color: var(--danger); }
  &__final { font-weight: 700; color: var(--text-strong); }
  &__was { display: block; font-size: 0.72rem; color: var(--text-subtle); }

  &__hide-sm {
    @media (max-width: 640px) { display: none; }
  }

  &__product { display: flex; align-items: center; gap: 0.6rem; min-width: 200px; }

  &__thumb {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--bg);

    &--empty {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-subtle);
    }
  }

  &__text { display: flex; flex-direction: column; min-width: 0; }
  &__name { font-weight: 600; color: var(--text-strong); }

  &__desc {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }

  &__state { padding: 1.25rem 0.7rem !important; text-align: center; color: var(--text-subtle); }

  &__pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
    color: var(--text-subtle);

    button {
      padding: 0.35rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text-body);
      font: inherit;
      cursor: pointer;

      &:disabled { opacity: 0.45; cursor: default; }
    }
  }

  &__pager-buttons { display: flex; gap: 0.4rem; }

  &__selected {
    padding: 0.75rem;
    border-radius: 10px;
    background: var(--bg);
  }

  &__selected-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-strong);
  }

  &__chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0 0; padding: 0; list-style: none; }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.35rem 0.25rem 0.6rem;
    border: 1px solid rgb(var(--accent-rgb) / 0.35);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.76rem;
    color: var(--text-body);

    button {
      width: 20px;
      height: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-subtle);
      cursor: pointer;
      line-height: 1;

      &:hover { background: var(--danger); color: var(--ink-on-solid); }
    }
  }

  &__link { padding: 0; border: 0; background: transparent; color: rgb(var(--accent-rgb)); font: inherit; font-size: 0.78rem; cursor: pointer; }
  &__hint { margin: 0.4rem 0 0; font-size: 0.75rem; color: var(--text-subtle); }
  &__error { margin: 0; font-size: 0.78rem; color: var(--danger); }
}

.field-error { font-size: 0.75rem; color: var(--danger); }
</style>
