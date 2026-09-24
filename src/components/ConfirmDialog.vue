<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Confirm' },
  description: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  destructive: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function close() {
  isOpen.value = false
  emit('cancel')
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <div v-if="isOpen" class="dialog-backdrop" @click="close()">
    <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" @click.stop>
      <div class="dialog-card__header">
        <h3 id="confirm-dialog-title">{{ title }}</h3>
      </div>

      <div class="dialog-card__body">
        <p>{{ description }}</p>
        <slot name="body" />
      </div>

      <div class="dialog-card__actions">
        <button type="button" class="dialog-card__button dialog-card__button--ghost" @click="close()">
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="dialog-card__button"
          :class="{ 'dialog-card__button--danger': destructive }"
          :disabled="confirmDisabled"
          @click="confirm()"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.56);
  z-index: 50;
  padding: 1rem;
}

.dialog-card {
  width: min(32rem, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
}

.dialog-card__header {
  padding: 1rem 1.1rem 0.5rem;

  h3 {
    margin: 0;
    color: var(--text-strong);
    font-size: 1.1rem;
  }
}

.dialog-card__body {
  padding: 0.25rem 1.1rem 1rem;
  color: var(--text-body);

  p {
    margin: 0;
    line-height: 1.6;
  }
}

.dialog-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0 1.1rem 1rem;
}

.dialog-card__button {
  appearance: none;
  border: none;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  background: rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--ghost {
    background: var(--surface-alt);
    color: var(--text-body);
    border: 1px solid var(--border);
  }

  &--danger {
    background: var(--danger);
    color: #fff;
  }
}
</style>
}