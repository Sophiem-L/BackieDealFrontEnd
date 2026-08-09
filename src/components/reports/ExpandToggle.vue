<script setup>
// The chevron that opens a row's detail. Owns the aria wiring so the two
// expandable reports can't describe the same control differently.
defineProps({
  expanded: { type: Boolean, required: true },
  // id of the detail row this controls, for aria-controls.
  controls: { type: String, required: true },
  // Names the thing being expanded, e.g. 'hits for 182.44.22.10'.
  label: { type: String, required: true },
})

defineEmits(['toggle'])
</script>

<template>
  <button
    type="button"
    class="disclose"
    :class="{ 'disclose--on': expanded }"
    :aria-expanded="expanded"
    :aria-controls="controls"
    :aria-label="`${expanded ? 'Hide' : 'Show'} ${label}`"
    @click="$emit('toggle')"
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<style scoped lang="scss">

.disclose {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 2;
    transition: transform 0.15s ease;
  }

  &:hover {
    background: var(--surface-alt);
    color: var(--text-strong);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb));
    outline-offset: 1px;
  }

  &--on {
    background: rgb(var(--accent-rgb) / 0.18);
    border-color: transparent;
    color: var(--accent-ink);

    svg {
      transform: rotate(90deg);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .disclose,
  .disclose svg {
    transition: none;
  }
}
</style>
