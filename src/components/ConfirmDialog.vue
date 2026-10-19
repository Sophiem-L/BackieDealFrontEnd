<script setup>
import { computed } from 'vue'
import BaseButton from '@/components/BaseButton.vue'

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
        <BaseButton variant="ghost" @click="close()">{{ cancelLabel }}</BaseButton>
        <button
          v-if="destructive"
          type="button"
          class="dialog-card__danger"
          :disabled="confirmDisabled"
          @click="confirm()"
        >
          {{ confirmLabel }}
        </button>
        <BaseButton v-else variant="primary" :disabled="confirmDisabled" @click="confirm()">
          {{ confirmLabel }}
        </BaseButton>
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
  background: var(--backdrop);
  z-index: 50;
  padding: 1rem;
}

.dialog-card {
  width: min(32rem, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
}

.dialog-card__header {
  padding: 1.1rem 1.25rem 0.4rem;

  h3 {
    margin: 0;
    color: var(--text-strong);
    font-size: 1.02rem;
    font-weight: 700;
  }
}

.dialog-card__body {
  padding: 0.25rem 1.25rem 1.1rem;
  color: var(--text-body);
  font-size: 0.88rem;

  p {
    margin: 0;
    line-height: 1.55;
  }
}

.dialog-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0 1.25rem 1.1rem;
}

// BaseButton has no solid-danger variant, so this matches its geometry and uses
// the same solid-fill tokens as the Orders bulk delete (white ink, saturated
// fill in both themes).
.dialog-card__danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.1rem;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--ink-on-solid);
  background: var(--danger-solid);
  border: 1px solid var(--danger-solid);
  border-radius: 10px;
  cursor: pointer;
  transition: filter 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.94);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}
</style>
