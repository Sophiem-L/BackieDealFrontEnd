<script setup>
import BaseButton from '@/components/BaseButton.vue'

defineProps({
  selectedCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['publish', 'unpublish', 'archive', 'delete', 'clear'])
</script>

<template>
  <div v-if="selectedCount > 0" class="bulk-bar" role="toolbar" aria-label="Bulk actions">
    <span class="bulk-bar__count">{{ selectedCount }} selected</span>
    <div class="bulk-bar__actions">
      <BaseButton variant="ghost" size="sm" :disabled="loading" @click="emit('publish')">
        Publish
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="loading" @click="emit('unpublish')">
        Unpublish
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="loading" @click="emit('archive')">
        Archive
      </BaseButton>
      <BaseButton variant="danger" size="sm" :disabled="loading" @click="emit('delete')">
        Delete
      </BaseButton>
      <BaseButton variant="subtle" size="sm" @click="emit('clear')">Clear</BaseButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Follows the Orders bulk bar: an accent-tinted strip with accent-ink text, so
// "something is selected" looks the same on every list. It floats at the bottom
// because the page list scrolls.
.bulk-bar {
  position: sticky;
  bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.7rem 1rem;
  background: var(--surface);
  border: 1px solid rgb(var(--accent-rgb) / 0.45);
  border-radius: 14px;
  box-shadow:
    inset 0 0 0 9999px rgb(var(--accent-rgb) / 0.08),
    var(--shadow-md);
  z-index: 25;
}

.bulk-bar__count {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--accent-ink);
}

.bulk-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
