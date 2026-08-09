<script setup>
// Page-level report switcher. Deliberately NOT styled like GranularityTabs: the
// two sit on screen together, and an inset pill at two sizes reads as one control
// misbehaving rather than two levels of navigation. This one underlines.
defineProps({
  modelValue: { type: String, required: true },
  // [{ key, label }] — same shape as the `granularities` list.
  tabs: { type: Array, required: true },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="tabs" role="group" aria-label="Report">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="tabs__btn"
      :class="{ 'tabs__btn--on': modelValue === tab.key }"
      :aria-pressed="modelValue === tab.key"
      @click="$emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">

.tabs {
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border-subtle);

  /* Six labels don't fit on a phone. Scroll the strip rather than wrapping it
     into two rows, which would push the panel below the fold. */
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  &__btn {
    appearance: none;
    border: none;
    background: transparent;
    padding: 0.7rem 0.9rem;
    font-family: inherit;
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    cursor: pointer;
    /* Sits on top of the container's 1px rule so the active underline covers it
       instead of stacking into a 3px bar. */
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s ease, border-color 0.15s ease;

    &:hover {
      color: var(--text-strong);
    }

    &:focus-visible {
      outline: 2px solid rgb(var(--accent-rgb));
      outline-offset: -2px;
      border-radius: 6px 6px 0 0;
    }

    &--on {
      color: var(--accent-ink);
      border-bottom-color: rgb(var(--accent-rgb));
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .tabs__btn {
    transition: none;
  }
}
</style>
