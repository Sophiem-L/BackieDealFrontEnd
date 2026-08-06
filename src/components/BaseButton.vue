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
    background: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
    &:hover:not(:disabled) { filter: brightness(0.96); }
  }

  &--ghost {
    background: var(--surface);
    border-color: var(--border);
    color: var(--text-body);
    &:hover:not(:disabled) { background: var(--surface-alt); }
  }

  &--subtle {
    background: var(--bg);
    color: var(--text-body);
    &:hover:not(:disabled) { background: var(--surface-hover); }
  }

  &--danger {
    background: var(--surface);
    border-color: var(--border);
    color: var(--danger);
    &:hover:not(:disabled) {
      background: var(--danger-bg);
      border-color: var(--danger-border);
    }
  }

  &--outline {
    background: var(--surface);
    border-color: rgb(var(--accent-rgb));
    color: var(--accent-ink);
    &:hover:not(:disabled) { background: rgb(var(--accent-rgb) / 0.12); }
  }
}
</style>
