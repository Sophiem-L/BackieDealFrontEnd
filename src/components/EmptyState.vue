<script setup>
import BaseButton from '@/components/BaseButton.vue'

defineProps({
  title: { type: String, default: 'Nothing here yet' },
  description: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  variant: { type: String, default: 'default' },
})

const emit = defineEmits(['action'])
</script>

<template>
  <div class="empty-state" :class="[`empty-state--${variant}`]">
    <div class="empty-state__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke-linejoin="round"
        />
        <path d="M14 3v5h5M9 13h6M9 17h4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <BaseButton v-if="actionLabel" variant="primary" @click="emit('action')">
      {{ actionLabel }}
    </BaseButton>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 2.5rem 1.25rem;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  h3 {
    margin: 0;
    color: var(--text-strong);
    font-size: 1rem;
    font-weight: 700;
  }

  p {
    margin: 0 0 0.3rem;
    max-width: 34rem;
    color: var(--text-subtle);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: rgb(var(--accent-rgb) / 0.14);
    color: var(--accent-ink);

    svg {
      width: 22px;
      height: 22px;
      stroke: currentColor;
      stroke-width: 1.7;
    }
  }
}
</style>
