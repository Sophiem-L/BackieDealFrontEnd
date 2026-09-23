<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  canEdit: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['view', 'edit', 'publish', 'unpublish', 'archive', 'restore', 'duplicate', 'delete'])

const isOpen = ref(false)
const buttonRef = ref(null)
const itemRefs = ref([])

const actionItems = computed(() => {
  const actions = [
    { label: 'View live', action: 'view', visible: true },
    { label: 'Edit', action: 'edit', visible: props.canEdit },
    { label: 'Duplicate', action: 'duplicate', visible: true },
  ]

  if (props.item.status === 'published') {
    actions.push({ label: 'Unpublish', action: 'unpublish', visible: true })
  } else if (props.item.status === 'draft') {
    actions.push({ label: 'Publish', action: 'publish', visible: true })
  } else {
    actions.push({ label: 'Restore', action: 'restore', visible: true })
  }

  if (props.item.status !== 'archived') {
    actions.push({ label: 'Move to archive', action: 'archive', visible: true })
  }

  if (props.canDelete) {
    actions.push({ label: 'Delete', action: 'delete', visible: true, destructive: true })
  }

  return actions.filter((action) => action.visible)
})

function focusItem(index) {
  nextTick(() => {
    const target = itemRefs.value[index]
    if (target) target.focus()
  })
}

function handleKeydown(event) {
  if (!isOpen.value) return
  const list = itemRefs.value.filter(Boolean)
  const currentIndex = list.indexOf(document.activeElement)

  if (event.key === 'Escape') {
    isOpen.value = false
    buttonRef.value?.focus()
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = currentIndex >= 0 ? (currentIndex + 1) % list.length : 0
    focusItem(list.indexOf(list[next]))
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const next = currentIndex > 0 ? currentIndex - 1 : list.length - 1
    focusItem(list.indexOf(list[next]))
  }
}

function onAction(action) {
  isOpen.value = false
  switch (action) {
    case 'view':
      emit('view')
      break
    case 'edit':
      emit('edit')
      break
    case 'publish':
      emit('publish')
      break
    case 'unpublish':
      emit('unpublish')
      break
    case 'archive':
      emit('archive')
      break
    case 'restore':
      emit('restore')
      break
    case 'duplicate':
      emit('duplicate')
      break
    case 'delete':
      emit('delete')
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="menu" @keydown.stop="handleKeydown">
    <button
      ref="buttonRef"
      type="button"
      class="menu__trigger"
      :aria-label="`Open actions for ${item.title}`"
      :disabled="busy"
      @click="isOpen = !isOpen"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <div v-if="isOpen" class="menu__panel" role="menu" aria-label="Page actions">
      <button
        v-for="(action, index) in actionItems"
        :key="action.label"
        ref="itemRefs"
        type="button"
        class="menu__item"
        :class="{ 'menu__item--danger': action.destructive }"
        role="menuitem"
        @click="onAction(action.action)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.menu {
  position: relative;
  display: inline-flex;
}

.menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-body);
  cursor: pointer;
  font-size: 1.35rem;
  line-height: 1;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--border-strong);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb));
    outline-offset: 2px;
  }
}

.menu__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 18px 28px rgba(0, 0, 0, 0.25);
  z-index: 20;
}

.menu__item {
  appearance: none;
  padding: 0.7rem 0.8rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-body);
  text-align: left;
  cursor: pointer;
  font: inherit;

  &:hover,
  &:focus-visible {
    background: var(--surface-alt);
    outline: none;
  }

  &--danger {
    color: var(--danger);
  }
}
</style>
