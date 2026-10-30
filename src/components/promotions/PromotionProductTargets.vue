<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { currency } from '@/lib/format'
import { fetchAllPromotionProducts, fetchPromotionProducts, previewDiscount, productBasePrice } from '@/services/promotions'

// The product target of a promotion: a searchable, filterable, paged table.
// Selection lives in `targets` (usePromotionTargets) as ids, so it survives
// search, filter and page changes. Each selected product is either targeted
// whole or narrowed to specific variants, which are picked in the variant
// section below.
const props = defineProps({
  targets: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  // { type: 'percentage'|'fixed', value, maxDiscount } — drives the preview.
  discount: { type: Object, default: () => ({}) },
  token: { type: String, default: null },
  error: { type: String, default: '' },
})

const PAGE_SIZE = 10

const search = ref('')
const categoryId = ref('')
// 'all' pages through the catalogue; 'selected' shows only the selection.
const view = ref('all')
const page = ref(1)
const lastPage = ref(1)
const total = ref(null)
const rows = ref([])
const loading = ref(false)
const loadError = ref('')
const bulkBusy = ref(false)
const bulkNote = ref('')
const confirmingClear = ref(false)

let requestId = 0
let searchTimer = null

const summary = computed(() => props.targets.summary.value)
const selectedCount = computed(() => summary.value.products)

// The selected view filters the selection on the client: no request needed.
const selectedMatches = computed(() => {
  const term = search.value.trim().toLowerCase()
  return props.targets.selectedProductIds.value
    .map((id) => props.targets.productOf(id))
    .filter((product) => !term || `${product.name ?? ''} ${product.sku ?? ''}`.toLowerCase().includes(term))
    .filter((product) => !categoryId.value || String(product.category?.id ?? product.category_id ?? '') === categoryId.value)
})

const visibleRows = computed(() =>
  view.value === 'selected'
    ? selectedMatches.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
    : rows.value,
)
const pageCount = computed(() =>
  view.value === 'selected' ? Math.max(1, Math.ceil(selectedMatches.value.length / PAGE_SIZE)) : lastPage.value,
)
const matchCount = computed(() => (view.value === 'selected' ? selectedMatches.value.length : total.value))

const pageState = computed(() => {
  const modes = visibleRows.value.map((product) => props.targets.modeOf(product.id))
  const picked = modes.filter((mode) => mode !== 'none').length
  return { all: modes.length > 0 && picked === modes.length, some: picked > 0 && picked < modes.length }
})

async function load() {
  if (view.value === 'selected') return
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
    props.targets.rememberProducts(result.items)
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
  bulkNote.value = ''
  load()
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(resetAndLoad, 300)
}

function setView(next) {
  if (view.value === next) return
  view.value = next
  resetAndLoad()
}

function goTo(target) {
  if (target < 1 || target > pageCount.value || target === page.value) return
  page.value = target
  load()
}

function togglePage() {
  const ids = visibleRows.value.map((product) => product.id)
  if (pageState.value.all) props.targets.deselectProducts(ids)
  else props.targets.selectProducts(ids)
}

// Adds every product matching the current search and category, across pages.
async function selectAllMatching() {
  bulkBusy.value = true
  bulkNote.value = ''
  loadError.value = ''
  try {
    const items = await fetchAllPromotionProducts(props.token, search.value, categoryId.value || null)
    props.targets.rememberProducts(items)
    const added = props.targets.selectProducts(items.map((product) => product.id))
    bulkNote.value = added
      ? `Added ${added} ${added === 1 ? 'product' : 'products'} as whole products.`
      : 'Every matching product is already selected.'
  } catch (err) {
    loadError.value = err.message || 'Could not select the matching products.'
  } finally {
    bulkBusy.value = false
  }
}

function clearSelection() {
  props.targets.clearProducts()
  confirmingClear.value = false
  bulkNote.value = ''
  if (view.value === 'selected') page.value = 1
}

// Keeps the selected view on a page that still exists as products are removed.
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

function priceOf(product) {
  const base = productBasePrice(product)
  return { base, preview: base === null ? null : previewDiscount(base, props.discount) }
}

const money = (amount) => (amount == null ? '—' : currency.format(amount))
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

function variantCountLabel(product) {
  const count = props.targets.groupState(product.id).total
  return count == null ? '—' : String(count)
}

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
        placeholder="Search by product name or SKU"
        aria-label="Search products by name or SKU"
        @input="onSearch"
      />
      <select id="productCategory" v-model="categoryId" aria-label="Filter by category" @change="resetAndLoad">
        <option value="">All categories</option>
        <option v-for="category in categories" :key="category.id" :value="String(category.id)">
          {{ category.name }}
        </option>
      </select>
      <div class="ptargets__views" role="group" aria-label="Show products">
        <button type="button" :aria-pressed="view === 'all'" @click="setView('all')">All</button>
        <button type="button" :aria-pressed="view === 'selected'" @click="setView('selected')">
          Selected <span class="ptargets__count">{{ selectedCount }}</span>
        </button>
      </div>
    </div>

    <div class="ptargets__bulk">
      <span class="ptargets__bulk-text" aria-live="polite">
        <template v-if="matchCount !== null">{{ plural(matchCount, 'product', 'products') }}{{ view === 'selected' ? ' selected' : ' match' }}</template>
        <template v-if="bulkNote"> · {{ bulkNote }}</template>
      </span>
      <span class="ptargets__bulk-actions">
        <button
          v-if="view === 'all'"
          type="button"
          class="ptargets__action"
          :disabled="bulkBusy || loading || !total"
          @click="selectAllMatching"
        >
          {{ bulkBusy ? 'Selecting…' : `Select all ${total ?? ''} matching` }}
        </button>
        <template v-if="selectedCount">
          <span v-if="confirmingClear" class="ptargets__confirm" role="alert">
            Remove all {{ plural(selectedCount, 'product', 'products') }} and their variant picks?
            <button type="button" class="ptargets__action ptargets__action--danger" @click="clearSelection">Remove all</button>
            <button type="button" class="ptargets__action" @click="confirmingClear = false">Keep</button>
          </span>
          <button v-else type="button" class="ptargets__action" @click="confirmingClear = true">Clear selection</button>
        </template>
      </span>
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
                :checked="pageState.all"
                :indeterminate="pageState.some"
                :disabled="!visibleRows.length"
                aria-label="Select every product on this page"
                @change="togglePage"
              />
            </th>
            <th>Product</th>
            <th class="ptargets__hide-sm">Category</th>
            <th class="ptargets__num ptargets__hide-sm">Variants</th>
            <th class="ptargets__num">Price</th>
            <th>Targeting</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !visibleRows.length">
            <td colspan="6" class="ptargets__state">Loading products…</td>
          </tr>
          <tr v-else-if="!visibleRows.length && !loadError">
            <td colspan="6" class="ptargets__state">
              {{ view === 'selected'
                ? (selectedCount ? 'No selected products match these filters.' : 'No products selected yet. Switch to All to pick some.')
                : 'No products match these filters.' }}
            </td>
          </tr>
          <tr
            v-for="product in visibleRows"
            :key="product.id"
            class="ptargets__row"
            :class="{
              'ptargets__row--selected': targets.modeOf(product.id) === 'whole',
              'ptargets__row--partial': targets.modeOf(product.id) === 'variants',
            }"
            @click="targets.toggleProduct(product.id)"
          >
            <td class="ptargets__check" @click.stop>
              <input
                type="checkbox"
                :checked="targets.modeOf(product.id) === 'whole'"
                :indeterminate="targets.modeOf(product.id) === 'variants'"
                :aria-label="`Select ${product.name}`"
                @change="targets.toggleProduct(product.id)"
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
                  <span class="ptargets__meta">
                    <span v-if="product.sku">SKU {{ product.sku }}</span>
                    <span v-if="product.short_description" class="ptargets__desc">{{ product.short_description }}</span>
                  </span>
                </span>
              </div>
            </td>
            <td class="ptargets__hide-sm">{{ product.category?.name ?? '—' }}</td>
            <td class="ptargets__num ptargets__hide-sm">{{ variantCountLabel(product) }}</td>
            <td class="ptargets__num">
              <span class="ptargets__price">
                {{ money(priceOf(product).base) }}
                <s v-if="product.sale_price != null && product.price != null" class="ptargets__was">{{ money(product.price) }}</s>
              </span>
              <span v-if="priceOf(product).preview" class="ptargets__after">
                <span class="ptargets__off">−{{ money(priceOf(product).preview.discount) }}</span>
                → <strong>{{ money(priceOf(product).preview.finalPrice) }}</strong>
              </span>
            </td>
            <td @click.stop>
              <div
                v-if="targets.modeOf(product.id) !== 'none'"
                class="ptargets__mode"
                role="radiogroup"
                :aria-label="`Targeting for ${product.name}`"
              >
                <button
                  type="button"
                  role="radio"
                  :aria-checked="targets.modeOf(product.id) === 'whole'"
                  @click="targets.setWhole(product.id)"
                >
                  Whole product
                </button>
                <button
                  type="button"
                  role="radio"
                  :aria-checked="targets.modeOf(product.id) === 'variants'"
                  :disabled="targets.groupState(product.id).total === 0"
                  :title="targets.groupState(product.id).total === 0 ? 'This product has no active variants' : null"
                  @click="targets.setSpecific(product.id)"
                >
                  Specific variants
                </button>
              </div>
              <span v-else class="ptargets__muted">Not selected</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ptargets__pager">
      <span>Page {{ page }} of {{ pageCount }}</span>
      <span class="ptargets__pager-buttons">
        <button type="button" :disabled="page <= 1 || loading" @click="goTo(page - 1)">Previous</button>
        <button type="button" :disabled="page >= pageCount || loading" @click="goTo(page + 1)">Next</button>
      </span>
    </div>

    <p class="ptargets__summary">
      <strong>{{ plural(selectedCount, 'product', 'products') }} selected</strong>
      <template v-if="selectedCount">
        · {{ summary.wholeProducts }} whole
        · {{ summary.specificProducts }} narrowed to specific variants
      </template>
    </p>
    <p class="ptargets__hint">
      Preview per unit. Final prices are recalculated at checkout, where minimum spend and usage limits also apply.
    </p>
    <span v-if="error" class="field-error" role="alert">{{ error }}</span>
  </div>
</template>

<style scoped lang="scss">
.ptargets {
  display: grid;
  gap: 0.65rem;

  &__filters {
    display: grid;
    grid-template-columns: 1fr minmax(0, 200px) auto;
    gap: 0.5rem;

    @media (max-width: 640px) { grid-template-columns: 1fr; }

    input, select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.5rem 0.7rem;
      font: inherit;
      font-size: 0.85rem;
      color: var(--text-strong);
      background: var(--surface);

      &:focus-visible {
        outline: none;
        border-color: rgb(var(--accent-rgb));
        box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.25);
      }
    }
  }

  &__views, &__mode {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;

    button {
      padding: 0.4rem 0.7rem;
      border: 0;
      background: var(--surface);
      color: var(--text-body);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;

      & + button { border-left: 1px solid var(--border); }
      &:hover:not(:disabled) { background: var(--surface-hover); }
      &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: -2px; }
      &:disabled { opacity: 0.45; cursor: not-allowed; }

      &[aria-pressed='true'], &[aria-checked='true'] {
        background: rgb(var(--accent-rgb));
        color: var(--ink-on-accent);
      }
    }
  }

  &__mode button { padding: 0.3rem 0.55rem; font-size: 0.72rem; }

  &__count {
    display: inline-block;
    min-width: 1.2rem;
    margin-left: 0.2rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-strong);
    font-size: 0.7rem;
    text-align: center;
  }

  &__bulk {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
    color: var(--text-subtle);
  }

  &__bulk-actions, &__confirm { display: inline-flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  &__confirm { color: var(--text-body); }

  &__action {
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-body);
    font: inherit;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;

    &:hover:not(:disabled) { border-color: rgb(var(--accent-rgb)); }
    &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }

    &--danger { border-color: var(--danger); color: var(--danger); }
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
    font-size: 0.8rem;

    th {
      padding: 0.5rem 0.65rem;
      text-align: left;
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted);
      background: var(--surface-sunken);
      white-space: nowrap;
    }

    td {
      padding: 0.45rem 0.65rem;
      border-top: 1px solid var(--border-subtle);
      color: var(--text-body);
      vertical-align: middle;
    }

    input[type='checkbox'] {
      width: 16px;
      height: 16px;
      accent-color: rgb(var(--accent-rgb));
      cursor: pointer;

      &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
    }
  }

  &__row {
    cursor: pointer;

    &:hover td { background: var(--surface-hover); }

    &--selected td { background: rgb(var(--accent-rgb) / 0.09); }
    &--selected td:first-child { box-shadow: inset 3px 0 0 rgb(var(--accent-rgb)); }
    &--partial td { background: rgb(var(--accent-rgb) / 0.04); }
    &--partial td:first-child { box-shadow: inset 3px 0 0 rgb(var(--accent-rgb) / 0.5); }
  }

  &__check { width: 2.25rem; }
  &__num { text-align: right !important; white-space: nowrap; }
  &__price { display: block; color: var(--text-strong); }
  &__was { margin-left: 0.3rem; font-size: 0.72rem; color: var(--text-subtle); }
  &__after { display: block; font-size: 0.72rem; color: var(--text-subtle); strong { color: var(--text-strong); } }
  &__off { color: var(--danger); }
  &__muted { font-size: 0.74rem; color: var(--text-subtle); }

  &__hide-sm {
    @media (max-width: 640px) { display: none; }
  }

  &__product { display: flex; align-items: center; gap: 0.6rem; min-width: 190px; }

  &__thumb {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 6px;
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
  &__meta { display: flex; gap: 0.5rem; min-width: 0; font-size: 0.72rem; color: var(--text-subtle); }

  &__desc {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
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
      padding: 0.3rem 0.7rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text-body);
      font: inherit;
      cursor: pointer;

      &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
      &:disabled { opacity: 0.45; cursor: default; }
    }
  }

  &__pager-buttons { display: flex; gap: 0.4rem; }
  &__summary { margin: 0; padding: 0.55rem 0.75rem; border-radius: 8px; background: var(--bg); font-size: 0.8rem; color: var(--text-body); strong { color: var(--text-strong); } }
  &__link { padding: 0; border: 0; background: transparent; color: var(--accent-ink); font: inherit; font-size: 0.78rem; cursor: pointer; }
  &__hint { margin: 0; font-size: 0.74rem; color: var(--text-subtle); }
  &__error { margin: 0; font-size: 0.78rem; color: var(--danger); }
}

.field-error { font-size: 0.75rem; color: var(--danger); }
</style>
