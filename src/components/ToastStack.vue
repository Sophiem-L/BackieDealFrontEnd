<script setup>
const props = defineProps({
  toasts: { type: Array, default: () => [] },
})

const emit = defineEmits(['dismiss', 'action'])
</script>

<template>
  <div v-if="toasts.length" class="toast-stack" aria-live="polite" aria-atomic="false">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="[`toast--${toast.type || 'info'}`]" role="status">
      <div class="toast__content">
        <strong>{{ toast.title }}</strong>
        <span v-if="toast.message">{{ toast.message }}</span>
      </div>
      <div class="toast__actions">
        <button v-if="toast.actionLabel" type="button" class="toast__action" @click="emit('action', toast)">
          {{ toast.actionLabel }}
        </button>
        <button type="button" class="toast__dismiss" aria-label="Dismiss notification" @click="emit('dismiss', toast.id)">
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toast-stack {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  z-index: 40;
  max-width: min(24rem, calc(100vw - 2rem));
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);

  &__content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    color: var(--text-body);
    min-width: 0;

    strong {
      font-size: 0.86rem;
      color: var(--text-strong);
    }

    span {
      font-size: 0.8rem;
      color: var(--text-subtle);
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__action,
  &__dismiss {
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
  }

  &__action {
    background: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
    padding: 0.45rem 0.7rem;
    font-weight: 700;
  }

  &__dismiss {
    background: transparent;
    color: var(--text-subtle);
    width: 2rem;
    height: 2rem;
  }
}
</style>
