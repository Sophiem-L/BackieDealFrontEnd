<script setup>
const props = defineProps({
  selectedCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['publish', 'unpublish', 'archive', 'delete', 'clear'])
</script>

<template>
  <div v-if="selectedCount > 0" class="bulk-bar" role="toolbar" aria-label="Bulk actions">
    <span class="bulk-bar__count">{{ selectedCount }} selected</span>
    <div class="bulk-bar__actions">
      <button type="button" class="bulk-bar__button" @click="emit('publish')">Publish</button>
      <button type="button" class="bulk-bar__button" @click="emit('unpublish')">Unpublish</button>
      <button type="button" class="bulk-bar__button" @click="emit('archive')">Archive</button>
      <button type="button" class="bulk-bar__button bulk-bar__button--danger" @click="emit('delete')">Delete</button>
      <button type="button" class="bulk-bar__button bulk-bar__button--ghost" @click="emit('clear')">Clear</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bulk-bar {
  position: sticky;
  bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(17, 18, 22, 0.9);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(12px);
  z-index: 25;
}

.bulk-bar__count {
  font-weight: 700;
  color: var(--text-strong);
}

.bulk-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bulk-bar__button {
  appearance: none;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-body);
  cursor: pointer;
  font: inherit;
  font-weight: 600;

  &--danger {
    color: var(--danger);
    border-color: var(--danger-border);
  }

  &--ghost {
    background: transparent;
  }
}
</style>
