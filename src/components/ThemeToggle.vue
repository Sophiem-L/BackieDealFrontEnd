<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

// Light/dark switch. Standalone rather than inlined in AppHeader so the login
// page (meta.layout === 'blank', no header) can adopt it without extraction.
const ui = useUiStore()

const isDark = computed(() => ui.theme === 'dark')
// Name the destination, not the current state — an icon-only control gives a
// screen reader nothing else to go on.
const label = computed(() =>
  isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
)
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="label"
    :title="label"
    :aria-pressed="isDark"
    @click="ui.toggleTheme()"
  >
    <!-- Sun: shown in dark mode, since it's what clicking will give you -->
    <svg v-if="isDark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path
        d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"
        stroke-linecap="round"
      />
    </svg>
    <!-- Moon -->
    <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped lang="scss">
// Matches .bell in AppHeader so the two read as siblings in the actions row.
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  flex-shrink: 0;
  background: var(--bg);
  border: none;
  border-radius: 50%;
  color: var(--text-body);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--surface-hover);
    border-color: transparent;
    color: var(--text-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 1.7;
  }
}
</style>
