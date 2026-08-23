<script setup>
import { granularities } from '@/data/reports'

defineProps({
  modelValue: { type: String, required: true },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="seg" role="group" aria-label="Report period">
    <button
      v-for="option in granularities"
      :key="option.key"
      type="button"
      class="seg__btn"
      :class="{ 'seg__btn--on': modelValue === option.key }"
      :aria-pressed="modelValue === option.key"
      @click="$emit('update:modelValue', option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">

.seg {
  display: inline-flex;
  padding: 3px;
  background: var(--bg);
  border-radius: 10px;

  &__btn {
    appearance: none;
    border: none;
    background: transparent;
    padding: 0.45rem 0.85rem;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
      color: var(--text-strong);
    }

    &:focus-visible {
      outline: 2px solid rgb(var(--accent-rgb));
      outline-offset: 1px;
    }

    &--on {
      background: var(--surface);
      color: var(--accent-ink);
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .seg__btn {
    transition: none;
  }
}
</style>
