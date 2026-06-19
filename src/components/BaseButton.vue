<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

// Reusable button used across the admin. Renders a <button> by default,
// or a <RouterLink> when `to` is provided.
const props = defineProps({
  variant: {
    type: String,
    default: 'primary', // primary | ghost | danger | outline | subtle
  },
  size: { type: String, default: 'md' }, // md | sm
  type: { type: String, default: 'button' },
  to: { type: [String, Object], default: null },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
})

const tag = computed(() => (props.to ? RouterLink : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to || undefined"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
  >
    <span v-if="$slots.icon" class="btn__icon"><slot name="icon" /></span>
    <span class="btn__label"><slot /></span>
  </component>
</template>

<style scoped lang="scss">
$accent: #f4c10f;

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.6rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.1;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition: filter 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &--block {
    width: 100%;
  }

  &--sm {
    padding: 0.4rem 0.7rem;
    font-size: 0.78rem;
    border-radius: 8px;

    .btn__icon :deep(svg) {
      width: 14px;
      height: 14px;
    }
  }

  &__icon {
    display: inline-flex;

    :deep(svg) {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
  }

  &--primary {
    background: $accent;
    color: #1f242d;
    &:hover:not(:disabled) { filter: brightness(0.96); }
  }

  &--ghost {
    background: #fff;
    border-color: #e6e8ec;
    color: #4a5160;
    &:hover:not(:disabled) { background: #f6f7f9; }
  }

  &--subtle {
    background: #f4f5f7;
    color: #4a5160;
    &:hover:not(:disabled) { background: #eceef1; }
  }

  &--danger {
    background: #fff;
    border-color: #e6e8ec;
    color: #d14343;
    &:hover:not(:disabled) { background: #fff5f5; border-color: #f0c9c9; }
  }

  &--outline {
    background: #fff;
    border-color: $accent;
    color: #a8850a;
    &:hover:not(:disabled) { background: rgba($accent, 0.12); }
  }
}
</style>
