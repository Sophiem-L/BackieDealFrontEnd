<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  canDelete: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
  // 32px trigger for table rows, matching the other tables' icon buttons.
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['publish', 'unpublish', 'archive', 'restore', 'duplicate', 'delete'])

const isOpen = ref(false)
const rootRef = ref(null)
const buttonRef = ref(null)
const itemRefs = ref([])

const actionItems = computed(() => {
  const actions = [
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

// Every row has its own menu; without this, opening one leaves the previous
// one hanging open until Escape.
function handlePointerDown(event) {
  if (isOpen.value && rootRef.value && !rootRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

function onAction(action) {
  isOpen.value = false
  switch (action) {
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
  document.addEventListener('pointerdown', handlePointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('pointerdown', handlePointerDown)
})
</script>

<template>
  <div ref="rootRef" class="menu" @keydown.stop="handleKeydown">
    <button
      ref="buttonRef"
      type="button"
      class="menu__trigger"
      :class="{ 'menu__trigger--compact': compact }"
      :aria-label="`Open actions for ${item.title}`"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :disabled="busy"
      @click="isOpen = !isOpen"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>

    <div v-if="isOpen" class="menu__panel" role="menu" aria-label="Page actions">
      <button
        v-for="action in actionItems"
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

// Same box as the row icon buttons next to it (38px; 32px in tables).
.menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-body);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  svg {
    width: 17px;
    height: 17px;
  }

  &--compact {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--text-muted);

    svg {
      width: 16px;
      height: 16px;
    }
  }

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    color: var(--text-strong);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb) / 0.5);
    outline-offset: 2px;
  }
}

// Popup matches the Orders export menu.
.menu__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 176px;
  display: flex;
  flex-direction: column;
  padding: 0.35rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(20, 23, 28, 0.12);
  z-index: 20;
}

.menu__item {
  appearance: none;
  width: 100%;
  padding: 0.55rem 0.6rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-body);
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--surface-alt);
    outline: none;
  }

  &--danger {
    color: var(--danger);

    &:hover,
    &:focus-visible {
      background: var(--danger-bg);
    }
  }
}
</style>
