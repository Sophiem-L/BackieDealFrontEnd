<script setup>
/**
 * The product form's variant section.
 *
 * Create mode: an axis builder generates one row per combination, each row
 * hand-editable. Read-only mode lists a product's existing variants without
 * offering to change them — the API's update path 500s on any variant re-save
 * until the soft-delete unique index is fixed. See
 * docs/superpowers/specs/2026-08-06-product-variant-editor-design.md.
 */
import { computed, ref, watch } from 'vue'
import VariantAxisBuilder from './VariantAxisBuilder.vue'
import { buildVariants, normalizeDefault, validateVariants } from '@/services/variants'

const props = defineProps({
  modelValue: { type: Array, required: true },
  // Seeds generated SKUs and slugs. Blank is tolerated; rows stay editable.
  baseSku: { type: String, default: '' },
  // Placeholder shown on a blank variant price, to signal inheritance.
  basePrice: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'update:valid'])

const axes = ref([])

const rows = computed(() => props.modelValue)

const validation = computed(() => validateVariants(props.modelValue))

// The parent gates its submit button on this.
watch(
  () => validation.value.valid,
  (valid) => emit('update:valid', valid),
  { immediate: true },
)

function setRows(next) {
  emit('update:modelValue', next)
}

function generate() {
  setRows(buildVariants(axes.value, props.baseSku, props.modelValue))
}

function patchRow(index, patch) {
  setRows(props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}

function removeRow(index) {
  setRows(normalizeDefault(props.modelValue.filter((_, i) => i !== index)))
}

function makeDefault(index) {
  setRows(props.modelValue.map((row, i) => ({ ...row, isDefault: i === index })))
}

function clearAll() {
  axes.value = []
  setRows([])
}

const attributePairs = (row) => Object.entries(row.attributes ?? {})

function formatPrice(value) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <!-- Read-only: an existing product's variants, listed but not editable. -->
  <div v-if="readonly" class="ro">
    <p v-if="!rows.length" class="ro__empty">This product has no variants.</p>

    <template v-else>
      <p class="ro__note">
        Variants can only be set when creating a product. Editing them here is disabled until the
        API's variant update path is fixed.
      </p>
      <ul class="ro__list">
        <li v-for="(row, i) in rows" :key="i" class="ro__item">
          <div class="ro__main">
            <span class="ro__name">{{ row.name }}</span>
            <span v-if="row.isDefault" class="badge badge--default">Default</span>
            <span v-if="!row.isActive" class="badge badge--off">Inactive</span>
          </div>
          <div class="ro__meta">
            <span class="ro__sku">{{ row.sku }}</span>
            <span>{{ formatPrice(row.price) }}</span>
            <span>{{ row.stock }} in stock</span>
          </div>
          <div v-if="attributePairs(row).length" class="ro__attrs">
            <span v-for="([key, value]) in attributePairs(row)" :key="key" class="chip chip--static">
              {{ key }}: {{ value }}
            </span>
          </div>
        </li>
      </ul>
    </template>
  </div>

  <!-- Create: axis builder plus the generated rows. -->
  <div v-else class="editor">
    <VariantAxisBuilder v-model:axes="axes" @generate="generate" />

    <div v-if="rows.length" class="rows">
      <div class="rows__head">
        <h4>Variants ({{ rows.length }})</h4>
        <button type="button" class="rows__clear" @click="clearAll">Clear all</button>
      </div>

      <div
        v-for="(row, i) in rows"
        :key="i"
        class="vrow"
        :class="{ 'vrow--invalid': validation.errors[i] }"
      >
        <label class="vrow__default" :title="row.isDefault ? 'Default variant' : 'Make default'">
          <input
            type="radio"
            name="variant-default"
            :checked="row.isDefault"
            :aria-label="`Make ${row.name} the default variant`"
            @change="makeDefault(i)"
          />
        </label>

        <div class="vrow__body">
          <div class="vrow__title">
            <span class="vrow__name">{{ row.name }}</span>
            <span v-if="row.isDefault" class="badge badge--default">Default</span>
          </div>

          <div class="vrow__fields">
            <label class="vfield vfield--sku">
              <span>SKU</span>
              <input
                :value="row.sku"
                type="text"
                placeholder="Required"
                @input="patchRow(i, { sku: $event.target.value })"
              />
            </label>
            <label class="vfield">
              <span>Price</span>
              <input
                :value="row.price"
                type="text"
                inputmode="decimal"
                :placeholder="basePrice || '0.00'"
                @input="patchRow(i, { price: $event.target.value })"
              />
            </label>
            <label class="vfield">
              <span>Stock</span>
              <input
                :value="row.stock"
                type="number"
                min="0"
                @input="patchRow(i, { stock: $event.target.value })"
              />
            </label>
            <label class="vfield">
              <span>Alert at</span>
              <input
                :value="row.minStockAlert"
                type="number"
                min="0"
                @input="patchRow(i, { minStockAlert: $event.target.value })"
              />
            </label>
          </div>

          <p v-if="validation.errors[i]" class="vrow__error">{{ validation.errors[i] }}</p>
        </div>

        <button
          type="button"
          class="vrow__remove"
          :aria-label="`Remove variant ${row.name}`"
          @click="removeRow(i)"
        >
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
        </button>
      </div>

      <p class="rows__hint">
        A blank price inherits the product's base price. The selected row is the default variant.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rows {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-subtle);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;

    h4 {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-body);
    }
  }

  &__clear {
    padding: 0.25rem 0.45rem;
    font-size: 0.76rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-subtle);
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover { color: var(--danger); }
  }

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }
}

.vrow {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  align-items: start;
  padding: 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-sunken);

  & + & { margin-top: 0.5rem; }

  &--invalid {
    border-color: var(--danger-border);
    background: var(--danger-bg);
  }

  &__default {
    display: flex;
    align-items: center;
    height: 30px;

    input { accent-color: rgb(var(--accent-rgb)); cursor: pointer; }
  }

  &__body { min-width: 0; }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.45rem;
  }

  &__name {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__fields {
    display: grid;
    grid-template-columns: 1.6fr 1fr 0.8fr 0.8fr;
    gap: 0.45rem;

    @media (max-width: 720px) {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__error {
    margin: 0.45rem 0 0;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--danger);
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); }

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.9; }
  }
}

.vfield {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;

  span {
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 0.42rem 0.55rem;
    font-size: 0.82rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);

    &::placeholder { color: var(--text-faint); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.4rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;
  white-space: nowrap;

  &--default {
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.16);
  }

  &--off {
    color: var(--text-subtle);
    background: var(--surface-sunken);
  }
}

.ro {
  &__empty,
  &__note {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-subtle);
  }

  &__note {
    padding: 0.7rem 0.85rem;
    background: var(--surface-sunken);
    border-radius: 10px;
  }

  &__list {
    margin: 0.85rem 0 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;

    & + & { margin-top: 0.5rem; }
  }

  &__main {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  &__name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
    margin-top: 0.3rem;
    font-size: 0.78rem;
    color: var(--text-subtle);
  }

  &__sku {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.74rem;
    color: var(--text-body);
  }

  &__attrs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }
}

.chip--static {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  font-size: 0.74rem;
  color: var(--text-body);
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  white-space: nowrap;
}
</style>
