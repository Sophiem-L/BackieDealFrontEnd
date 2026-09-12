<script setup>
/**
 * One variant inside the grouped table - the child row under a group header, or
 * a top-level row when there is a single option. Columns line up with the
 * table head: Variant | Price | Available. "Edit" opens the full detail screen.
 */
import VariantImagePicker from './VariantImagePicker.vue'

defineProps({
  row: { type: Object, required: true },
  // Position in the flat variants array; echoed back so the parent can patch.
  index: { type: Number, required: true },
  // What to show as this row's title - the group strips the shared value.
  label: { type: String, default: '' },
  pool: { type: Array, default: () => [] },
  uploading: { type: Boolean, default: false },
  basePrice: { type: String, default: '' },
  error: { type: String, default: '' },
  selected: { type: Boolean, default: false },
  removable: { type: Boolean, default: true },
})

const emit = defineEmits(['patch', 'remove', 'upload', 'open', 'toggle-select'])

const patch = (index, changes) => emit('patch', index, changes)
</script>

<template>
  <div class="vrow" :class="{ 'vrow--invalid': error }">
    <label class="vrow__check">
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="`Select ${row.name}`"
        @change="emit('toggle-select', index)"
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

    <button type="button" class="vrow__title" @click="emit('open', index)">
      <span class="vrow__name">{{ label || row.name }}</span>
      <span class="vrow__sku">{{ row.sku }}</span>
      <span v-if="error" class="vrow__error">{{ error }}</span>
    </button>

    <label class="vrow__price">
      <span class="vrow__money">
        <span>$</span>
        <input
          :value="row.price"
          type="text"
          inputmode="decimal"
          :placeholder="basePrice || '0.00'"
          :aria-label="`Price for ${row.name}`"
          @input="patch(index, { price: $event.target.value })"
        />
      </span>
    </label>

    <label class="vrow__avail">
      <input
        :value="row.stock"
        type="number"
        min="0"
        :aria-label="`Available quantity for ${row.name}`"
        @input="patch(index, { stock: $event.target.value })"
      />
    </label>

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
  grid-template-columns: 18px 44px 1fr 160px 90px auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.55rem 0.9rem 0.55rem 3rem;
  border-top: 1px solid var(--border-subtle);

  &--invalid { background: var(--danger-bg); }

  @media (max-width: 720px) {
    grid-template-columns: auto auto 1fr auto;
    padding-left: 1rem;

    &__price,
    &__avail { grid-column: 3 / -1; }
  }

  &__check input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: rgb(var(--accent-rgb));
    cursor: pointer;
  }

  &__title {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    padding: 0;
    background: transparent;
    border: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;

    &:hover .vrow__name { color: rgb(var(--accent-rgb)); }
  }

  &__name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__sku {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    color: var(--text-subtle);
  }

  &__error {
    font-size: 0.72rem;
    color: var(--danger);
  }

  &__money {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding-left: 0.55rem;
    background: var(--surface);

    &:focus-within {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    span { font-size: 0.8rem; color: var(--text-subtle); }

    input {
      width: 100%;
      border: none;
      background: transparent;
      padding: 0.42rem 0.55rem;
      font-size: 0.82rem;
      font-family: inherit;
      color: var(--text-strong);

      &::placeholder { color: var(--text-faint); }
      &:focus { outline: none; }
    }
  }

  &__avail input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.42rem 0.5rem;
    font-size: 0.82rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); }

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__spacer { display: block; width: 28px; }
}
</style>
