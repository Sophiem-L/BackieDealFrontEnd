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
  <span class="status-chip" :class="[`status-chip--${normalized}`]" aria-label="Page status">
    <span class="status-chip__dot" aria-hidden="true" />
    {{ displayLabel }}
  </span>
</template>

<style scoped lang="scss">
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid transparent;
  white-space: nowrap;

  &__dot {
    width: 0.52rem;
    height: 0.52rem;
    border-radius: 50%;
    background: currentColor;
    display: inline-block;
  }

  &--published {
    background: rgba(34, 197, 94, 0.12);
    color: #8ae6b1;
    border-color: rgba(34, 197, 94, 0.35);
  }

  &--draft {
    background: rgba(251, 191, 36, 0.12);
    color: #f7d66b;
    border-color: rgba(251, 191, 36, 0.35);
  }

  &--archived {
    background: rgba(148, 163, 184, 0.12);
    color: #dfe3ec;
    border-color: rgba(148, 163, 184, 0.25);
  }
}
</style>
