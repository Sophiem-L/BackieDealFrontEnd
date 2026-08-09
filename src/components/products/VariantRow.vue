<script setup>
/**
 * One editable variant: image, SKU, price, stock and the default-variant radio.
 *
 * Rendered both as a top-level row (a single option) and nested under a group
 * header (two or more options), which is why it owns no list logic — the parent
 * decides where it sits and what it is called.
 */
import VariantImagePicker from './VariantImagePicker.vue'

defineProps({
  row: { type: Object, required: true },
  // Position in the flat variants array; echoed back so the parent can patch.
  index: { type: Number, required: true },
  // What to show as this row's title — the group strips the shared value.
  label: { type: String, default: '' },
  pool: { type: Array, default: () => [] },
  uploading: { type: Boolean, default: false },
  basePrice: { type: String, default: '' },
  error: { type: String, default: '' },
  nested: { type: Boolean, default: false },
  // Editing an existing variant's SKU would create a duplicate rather than
  // rename it, because the API syncs variants by SKU.
  lockSku: { type: Boolean, default: false },
  removable: { type: Boolean, default: true },
})

const emit = defineEmits(['patch', 'remove', 'make-default', 'upload'])

const patch = (index, changes) => emit('patch', index, changes)
</script>

<template>
  <div class="vrow" :class="{ 'vrow--invalid': error, 'vrow--nested': nested }">
    <label class="vrow__default" :title="row.isDefault ? 'Default variant' : 'Make default'">
      <input
        type="radio"
        name="variant-default"
        :checked="row.isDefault"
        :aria-label="`Make ${row.name} the default variant`"
        @change="emit('make-default', index)"
      />
    </label>

    <VariantImagePicker
      :model-value="row.image"
      :pool="pool"
      :uploading="uploading"
      :label="row.name"
      @update:model-value="patch(index, { image: $event })"
      @upload="emit('upload', index, $event)"
    />

    <div class="vrow__body">
      <div class="vrow__title">
        <span class="vrow__name">{{ label || row.name }}</span>
        <span v-if="row.isDefault" class="badge badge--default">Default</span>
      </div>

      <div class="vrow__fields">
        <label class="vfield vfield--sku">
          <span>SKU</span>
          <input
            :value="row.sku"
            type="text"
            placeholder="Required"
            :readonly="lockSku"
            :title="lockSku ? 'A variant SKU cannot be changed after the product is created.' : null"
            @input="patch(index, { sku: $event.target.value, skuTouched: true })"
          />
        </label>
        <label class="vfield">
          <span>Price</span>
          <input
            :value="row.price"
            type="text"
            inputmode="decimal"
            :placeholder="basePrice || '0.00'"
            @input="patch(index, { price: $event.target.value })"
          />
        </label>
        <label class="vfield">
          <span>Stock</span>
          <input
            :value="row.stock"
            type="number"
            min="0"
            @input="patch(index, { stock: $event.target.value })"
          />
        </label>
        <label class="vfield">
          <span>Alert at</span>
          <input
            :value="row.minStockAlert"
            type="number"
            min="0"
            @input="patch(index, { minStockAlert: $event.target.value })"
          />
        </label>
      </div>

      <p v-if="error" class="vrow__error">{{ error }}</p>
    </div>

    <button
      v-if="removable"
      type="button"
      class="vrow__remove"
      :aria-label="`Remove variant ${row.name}`"
      @click="emit('remove', index)"
    >
      <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
    </button>
    <span v-else class="vrow__spacer"></span>
  </div>
</template>

<style scoped lang="scss">
.vrow {
  display: grid;
  // radio | image | fields | remove
  grid-template-columns: auto auto 1fr auto;
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

  // Nested under a group header: indented, lighter, connected to the row above.
  &--nested {
    margin-left: 1.6rem;
    background: var(--surface);
    border-style: dashed;
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

    // Locked SKU: readable, clearly not an input you can change.
    &[readonly] {
      color: var(--text-subtle);
      background: var(--surface-sunken);
      cursor: not-allowed;

      &:focus { border-color: var(--border); box-shadow: none; }
    }
  }
}

// Keeps the grid columns aligned where the remove button is withheld.
.vrow__spacer {
  display: block;
  width: 30px;
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
}
</style>
