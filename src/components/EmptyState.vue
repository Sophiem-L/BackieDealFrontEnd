<script setup>
const props = defineProps({
  title: { type: String, default: 'Nothing here yet' },
  description: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  variant: { type: String, default: 'default' },
})

const emit = defineEmits(['action'])
</script>

<template>
  <div class="empty-state" :class="[`empty-state--${variant}`]">
    <div class="empty-state__icon" aria-hidden="true">●</div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <button v-if="actionLabel" type="button" class="empty-state__button" @click="emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 2.5rem 1.25rem;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  h3 {
    margin: 0;
    color: var(--text-strong);
    font-size: 1.05rem;
  }

  p {
    margin: 0;
    max-width: 34rem;
    color: var(--text-subtle);
    line-height: 1.5;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: rgb(var(--accent-rgb) / 0.12);
    color: rgb(var(--accent-rgb));
    font-size: 1.2rem;
    font-weight: 700;
  }

  &__button {
    appearance: none;
    border: none;
    border-radius: 10px;
    padding: 0.7rem 1rem;
    background: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
    font-weight: 700;
    cursor: pointer;
  }
}
</style>
