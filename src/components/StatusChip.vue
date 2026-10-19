<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'draft' },
  label: { type: String, default: '' },
})

const labels = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
}

const normalized = computed(() => String(props.status || 'draft').toLowerCase())
const displayLabel = computed(() => props.label || labels[normalized.value] || 'Draft')
</script>

<template>
  <span class="status-chip" :class="[`status-chip--${normalized}`]">{{ displayLabel }}</span>
</template>

<style scoped lang="scss">
// Same badge as the News list: pages and articles are one content table, so a
// status should read the same on both screens.
.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 6px;
  white-space: nowrap;

  &--published {
    color: var(--success);
    background: var(--success-bg);
  }

  &--draft {
    color: var(--text-muted);
    background: var(--surface-track);
  }

  &--archived {
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.18);
  }
}
</style>
