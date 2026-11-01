<script setup>
defineProps({
  toasts: { type: Array, default: () => [] },
})

const emit = defineEmits(['dismiss', 'action'])
</script>

<template>
  <div v-if="toasts.length" class="toast-stack" aria-live="polite" aria-atomic="false">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="[`toast--${toast.type || 'info'}`]"
      :role="toast.type === 'error' ? 'alert' : 'status'"
    >
      <!-- A shape per kind, because delete and error are both red. -->
      <span v-if="['success', 'update', 'delete', 'error'].includes(toast.type)" class="toast__icon" aria-hidden="true">
        <svg v-if="toast.type === 'success'" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.8 2.8L16 9.5" />
        </svg>
        <svg v-else-if="toast.type === 'update'" viewBox="0 0 24 24">
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
          <path d="M13.5 6.5l3 3" />
        </svg>
        <svg v-else-if="toast.type === 'delete'" viewBox="0 0 24 24">
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" />
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path d="M12 4 3 20h18L12 4Z" />
          <path d="M12 10v4M12 17.2v.1" />
        </svg>
      </span>
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
  // Top-centre: the header keeps its title on the left and the bell/avatar on
  // the right, so the middle is the one spot a toast does not cover. left/right
  // 0 with auto margins centres a fixed box without a transform.
  top: 1rem;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: min(24rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  // Above the modals (some sit at 1000): a failed save inside a dialog has to
  // be readable while the dialog is still open.
  z-index: 1100;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);
  --toast-accent: var(--text-subtle);
  --toast-title: var(--text-strong);

  // created = green, edited = blue, removed = red. A failure is also red, so it
  // additionally gets a tinted background (and a warning icon above).
  &--success,
  &--update,
  &--delete,
  &--error {
    border-left: 4px solid var(--toast-accent);
  }

  &--success {
    --toast-accent: var(--success);
    --toast-title: var(--success-ink);
  }

  &--update {
    --toast-accent: var(--info);
    --toast-title: var(--info);
  }

  &--delete {
    --toast-accent: var(--danger);
    --toast-title: var(--danger);
  }

  &--error {
    --toast-accent: var(--danger);
    --toast-title: var(--danger);
    background: var(--danger-bg);
    border-color: var(--danger-border);
    border-left-color: var(--danger);

    .toast__content span {
      color: var(--text-body);
    }
  }

  &__icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--toast-accent);

    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }

  &__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.15rem;
    color: var(--text-body);
    min-width: 0;

    strong {
      font-size: 0.86rem;
      color: var(--toast-title);
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
