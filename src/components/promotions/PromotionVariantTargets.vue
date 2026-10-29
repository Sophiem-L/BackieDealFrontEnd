<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { currency } from '@/lib/format'
import { isTargetableVariant, variantAttributes } from '@/composables/usePromotionTargets'

// Optional variant targeting for the selected products, grouped by product.
// A whole product already discounts every variant; switching a product to
// "Specific variants" discounts only the variants ticked here.
const props = defineProps({
  targets: { type: Object, required: true },
  error: { type: String, default: '' },
})

const search = ref('')
const term = ref('')
// 'all' | 'selected' | 'unselected'
const filter = ref('all')
const expanded = reactive(new Set())
const confirmingClear = ref(false)

let searchTimer = null

const productIds = computed(() => props.targets.selectedProductIds.value)
const summary = computed(() => props.targets.summary.value)

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    term.value = search.value.trim().toLowerCase()
  }, 250)
}

// Variant search needs every group's variants, loaded a few at a time.
watch(term, (value) => {
  if (value) props.targets.ensureVariantsFor(productIds.value)
})

// A product switched to specific variants opens so its variants can be picked.
watch(
  () => [...props.targets.selectedProductIds.value].filter((id) => props.targets.modeOf(id) === 'variants'),
  (narrowed, before = []) => {
    for (const id of narrowed) if (!before.includes(id)) expanded.add(id)
  },
  { immediate: true },
)

const variantText = (variant) =>
  `${variant.name ?? ''} ${variant.sku ?? ''} ${variantAttributes(variant).map((attr) => attr.value).join(' ')}`.toLowerCase()

const groups = computed(() =>
  productIds.value
    .map((id) => {
      const product = props.targets.productOf(id)
      const list = props.targets.variantLists.get(id)
      const state = props.targets.groupState(id)
      const productMatch = !term.value || `${product.name ?? ''} ${product.sku ?? ''}`.toLowerCase().includes(term.value)
      const loaded = list?.status === 'loaded'

      let variants = (list?.items ?? []).filter((variant) => productMatch || variantText(variant).includes(term.value))
      if (filter.value === 'selected') variants = variants.filter((variant) => props.targets.isVariantIncluded(variant))
      if (filter.value === 'unselected') variants = variants.filter((variant) => !props.targets.isVariantIncluded(variant))

      const narrowedView = Boolean(term.value) || filter.value !== 'all'
      const hidden = loaded ? narrowedView && !variants.length : Boolean(term.value) && !productMatch && list?.status !== 'loading'

      return {
        id,
        product,
        list,
        state,
        variants,
        hidden,
        open: expanded.has(id) || (Boolean(term.value) && !productMatch && variants.length > 0),
      }
    })
    .filter((group) => !group.hidden),
)

const shownNarrowedVariants = computed(() =>
  groups.value.filter((group) => group.open && group.state.mode === 'variants').flatMap((group) => group.variants),
)

function toggleOpen(id) {
  if (expanded.has(id)) {
    expanded.delete(id)
  } else {
    expanded.add(id)
    props.targets.ensureVariants(id)
  }
}

function expandAll(open) {
  for (const id of productIds.value) {
    if (open) expanded.add(id)
    else expanded.delete(id)
  }
  if (open) props.targets.ensureVariantsFor(productIds.value)
}

// The group checkbox picks every variant of a narrowed product, or none.
async function toggleGroup(group) {
  if (group.state.mode !== 'variants') return
  await props.targets.ensureVariants(group.id)
  const items = props.targets.variantLists.get(group.id)?.items ?? []
  props.targets.setVariants(items, !group.state.checked)
}

function clearPicks() {
  props.targets.clearVariantPicks()
  confirmingClear.value = false
}

function countLabel(state) {
  if (state.total === 0) return 'No variants'
  if (state.mode === 'whole') return state.total == null ? 'All variants' : `All ${state.total} variants`
  return state.total == null ? `${state.selected} selected` : `${state.selected} of ${state.total} variants`
}

function priceLabel(variant) {
  const price = variant.sale_price ?? variant.price
  return price == null ? '—' : currency.format(price)
}

onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<template>
  <div class="vtargets">
    <p class="vtargets__explainer">
      <strong>Whole product</strong> discounts every variant, including ones added later.
      <strong>Specific variants</strong> discounts only the variants you tick below.
    </p>

    <div class="vtargets__summary" aria-live="polite">
      <span><strong>{{ summary.wholeProducts }}</strong> whole {{ summary.wholeProducts === 1 ? 'product' : 'products' }}</span>
      <span>
        <strong>{{ summary.specificProducts }}</strong> narrowed to
        <strong>{{ summary.specificVariants }}</strong> {{ summary.specificVariants === 1 ? 'variant' : 'variants' }}
      </span>
      <span v-if="summary.emptySpecific.length" class="vtargets__warn">
        {{ summary.emptySpecific.length }} without a variant picked
      </span>
    </div>

    <div class="vtargets__toolbar">
      <input
        id="variantSearch"
        v-model="search"
        type="search"
        placeholder="Search product, variant or SKU"
        aria-label="Search variants by product, variant name or SKU"
        @input="onSearch"
      />
      <div class="vtargets__filters" role="group" aria-label="Show variants">
        <button v-for="option in ['all', 'selected', 'unselected']" :key="option" type="button" :aria-pressed="filter === option" @click="filter = option">
          {{ option.charAt(0).toUpperCase() + option.slice(1) }}
        </button>
      </div>
    </div>

    <div class="vtargets__actions">
      <button type="button" class="vtargets__action" @click="expandAll(true)">Expand all</button>
      <button type="button" class="vtargets__action" @click="expandAll(false)">Collapse all</button>
      <button
        type="button"
        class="vtargets__action"
        :disabled="!shownNarrowedVariants.length"
        title="Ticks every variant shown in open groups narrowed to specific variants"
        @click="targets.setVariants(shownNarrowedVariants, true)"
      >
        Select all shown
      </button>
      <span v-if="confirmingClear" class="vtargets__confirm" role="alert">
        Untick every specific variant?
        <button type="button" class="vtargets__action vtargets__action--danger" @click="clearPicks">Untick all</button>
        <button type="button" class="vtargets__action" @click="confirmingClear = false">Keep</button>
      </span>
      <button v-else type="button" class="vtargets__action" :disabled="!summary.specificVariants" @click="confirmingClear = true">
        Clear variant picks
      </button>
    </div>

    <p v-if="!groups.length" class="vtargets__empty">
      {{ term || filter !== 'all' ? 'No variants match these filters.' : 'Select products above to target their variants.' }}
    </p>

    <ul v-else class="vtargets__groups">
      <li
        v-for="group in groups"
        :key="group.id"
        class="vtargets__group"
        :class="{
          'vtargets__group--whole': group.state.mode === 'whole',
          'vtargets__group--narrowed': group.state.mode === 'variants',
          'vtargets__group--invalid': group.state.mode === 'variants' && !group.state.selected,
        }"
      >
        <div class="vtargets__head">
          <button
            type="button"
            class="vtargets__toggle"
            :aria-expanded="group.open"
            :aria-controls="`variants-${group.id}`"
            :aria-label="`${group.open ? 'Collapse' : 'Expand'} ${group.product.name}`"
            @click="toggleOpen(group.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <input
            type="checkbox"
            :checked="group.state.checked"
            :indeterminate="group.state.indeterminate"
            :disabled="group.state.mode !== 'variants' || group.state.total === 0"
            :title="group.state.mode === 'whole' ? 'Whole product: every variant is included' : null"
            :aria-label="`All variants of ${group.product.name}`"
            @change="toggleGroup(group)"
          />
          <span class="vtargets__product">
            <span class="vtargets__name">{{ group.product.name }}</span>
            <small v-if="group.product.sku">SKU {{ group.product.sku }}</small>
          </span>
          <span class="vtargets__badge" :class="`vtargets__badge--${group.state.mode}`">
            {{ group.state.mode === 'whole' ? 'Whole product' : 'Specific variants' }}
          </span>
          <span class="vtargets__tally">{{ countLabel(group.state) }}</span>
          <button
            v-if="group.state.mode === 'whole'"
            type="button"
            class="vtargets__action"
            :disabled="group.state.total === 0"
            @click="targets.setSpecific(group.id)"
          >
            Choose variants
          </button>
          <button v-else type="button" class="vtargets__action" @click="targets.setWhole(group.id)">Use whole product</button>
        </div>

        <p v-if="group.state.mode === 'variants' && !group.state.selected" class="vtargets__warn vtargets__inline">
          Tick at least one variant, or use the whole product.
        </p>

        <div v-if="group.open" :id="`variants-${group.id}`" class="vtargets__body">
          <p v-if="!group.list || group.list.status === 'loading'" class="vtargets__empty">Loading variants…</p>
          <p v-else-if="group.list.status === 'error'" class="vtargets__error" role="alert">
            {{ group.list.error }}
            <button type="button" class="vtargets__link" @click="targets.ensureVariants(group.id, { force: true })">Retry</button>
          </p>
          <p v-else-if="!group.list.items.length" class="vtargets__empty">This product has no variants; it can only be targeted whole.</p>
          <p v-else-if="!group.variants.length" class="vtargets__empty">No variants match these filters.</p>
          <ul v-else class="vtargets__variants">
            <li v-for="variant in group.variants" :key="variant.id">
              <label
                class="vtargets__variant"
                :class="{
                  'vtargets__variant--on': targets.isVariantIncluded(variant),
                  'vtargets__variant--locked': group.state.mode === 'whole',
                }"
              >
                <input
                  type="checkbox"
                  :checked="targets.isVariantIncluded(variant)"
                  :disabled="group.state.mode === 'whole' || (!isTargetableVariant(variant) && !targets.isVariantIncluded(variant))"
                  @change="targets.toggleVariant(variant)"
                />
                <span class="vtargets__vname">
                  {{ variant.name }}
                  <span v-if="variantAttributes(variant).length" class="vtargets__attrs">
                    <span v-for="attr in variantAttributes(variant)" :key="attr.name" class="vtargets__attr">{{ attr.name }}: {{ attr.value }}</span>
                  </span>
                </span>
                <span class="vtargets__sku">{{ variant.sku || '—' }}</span>
                <span class="vtargets__vprice">{{ priceLabel(variant) }}</span>
                <span class="vtargets__stock" :class="{ 'vtargets__stock--out': !variant.in_stock }">
                  <template v-if="!isTargetableVariant(variant)">Inactive</template>
                  <template v-else>{{ variant.in_stock ? `In stock${variant.stock_quantity != null ? ` (${variant.stock_quantity})` : ''}` : 'Out of stock' }}</template>
                </span>
              </label>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <span v-if="error" class="field-error" role="alert">{{ error }}</span>
  </div>
</template>

<style scoped lang="scss">
.vtargets {
  display: grid;
  gap: 0.65rem;

  &__explainer { margin: 0; font-size: 0.78rem; line-height: 1.5; color: var(--text-subtle); strong { color: var(--text-body); } }

  &__summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    background: var(--bg);
    font-size: 0.8rem;
    color: var(--text-body);
    strong { color: var(--text-strong); }
  }

  &__toolbar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;

    @media (max-width: 560px) { grid-template-columns: 1fr; }

    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.5rem 0.7rem;
      font: inherit;
      font-size: 0.85rem;
      color: var(--text-strong);
      background: var(--surface);

      &:focus-visible { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.25); }
    }
  }

  &__filters {
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
      cursor: pointer;

      & + button { border-left: 1px solid var(--border); }
      &:hover { background: var(--surface-hover); }
      &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: -2px; }
      &[aria-pressed='true'] { background: rgb(var(--accent-rgb)); color: var(--ink-on-accent); }
    }
  }

  &__actions, &__confirm { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  &__confirm { font-size: 0.78rem; color: var(--text-body); }

  &__action {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-body);
    font: inherit;
    font-size: 0.74rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;

    &:hover:not(:disabled) { border-color: rgb(var(--accent-rgb)); }
    &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
    &--danger { border-color: var(--danger); color: var(--danger); }
  }

  &__groups { display: grid; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }

  &__group {
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    background: var(--surface);

    &--narrowed { border-color: rgb(var(--accent-rgb) / 0.55); }
    &--invalid { border-color: var(--danger); }
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
    padding: 0.45rem 0.65rem;

    input[type='checkbox'] { width: 16px; height: 16px; accent-color: rgb(var(--accent-rgb)); }
  }

  &__toggle {
    display: inline-flex;
    padding: 0.2rem;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;

    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2; transition: transform 0.15s ease; }
    &[aria-expanded='true'] svg { transform: rotate(90deg); }
    &:hover { background: var(--surface-hover); }
    &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); }
  }

  &__product { display: flex; flex-direction: column; flex: 1 1 180px; min-width: 0; small { font-size: 0.7rem; color: var(--text-subtle); } }
  &__name { overflow: hidden; font-size: 0.83rem; font-weight: 600; color: var(--text-strong); text-overflow: ellipsis; white-space: nowrap; }

  &__badge {
    padding: 0.12rem 0.5rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
    white-space: nowrap;

    &--whole { background: rgb(var(--accent-rgb)); color: var(--ink-on-accent); }
    &--variants { border: 1px solid rgb(var(--accent-rgb)); color: var(--accent-ink); }
  }

  &__tally { font-size: 0.74rem; color: var(--text-subtle); white-space: nowrap; }

  &__body { padding: 0 0.65rem 0.55rem 2.6rem; }

  &__variants { display: grid; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--border-subtle); }

  &__variant {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 9rem) 5.5rem 7.5rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.3rem;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.79rem;
    color: var(--text-body);
    cursor: pointer;

    @media (max-width: 640px) {
      grid-template-columns: auto 1fr auto;
      .vtargets__sku, .vtargets__stock { display: none; }
    }

    input { width: 16px; height: 16px; accent-color: rgb(var(--accent-rgb)); }
    input:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
    &:hover { background: var(--surface-hover); }

    &--on { color: var(--text-strong); }
    &--locked { cursor: default; opacity: 0.75; }
  }

  &__vname { min-width: 0; }
  &__attrs { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.15rem; }
  &__attr { padding: 0 0.35rem; border-radius: 4px; background: var(--bg); font-size: 0.68rem; color: var(--text-muted); }
  &__sku { overflow: hidden; font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--text-subtle); text-overflow: ellipsis; white-space: nowrap; }
  &__vprice { text-align: right; white-space: nowrap; }
  &__stock { font-size: 0.72rem; color: var(--success-ink); text-align: right; &--out { color: var(--text-subtle); } }

  &__empty { margin: 0; padding: 0.5rem 0; font-size: 0.78rem; color: var(--text-subtle); }
  &__warn { color: var(--danger); }
  &__inline { margin: 0; padding: 0 0.65rem 0.45rem 2.6rem; font-size: 0.74rem; }
  &__error { margin: 0; padding: 0.5rem 0; font-size: 0.78rem; color: var(--danger); }
  &__link { padding: 0; border: 0; background: transparent; color: var(--accent-ink); font: inherit; cursor: pointer; }
}

.field-error { font-size: 0.75rem; color: var(--danger); }
</style>
