<script setup>
// Reusable on/off switch. Use with v-model: <ToggleSwitch v-model="flag" />
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="toggle" :class="{ 'toggle--on': modelValue }">
    <span v-if="label" class="toggle__label">{{ label }}</span>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      class="toggle__track"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="toggle__thumb"></span>
    </button>
  </label>
</template>

<style scoped lang="scss">
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--success-ink);
  }

  &__track {
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--switch-track);
    cursor: pointer;
    transition: background-color 0.18s ease;
  }

  &__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    // Stays white in both themes: the thumb reads against the grey off-track
    // and the yellow on-track, neither of which inverts.
    background: #fff;
    box-shadow: var(--shadow-sm);
    transition: transform 0.18s ease;
  }

  &--on {
    .toggle__track { background: rgb(var(--accent-rgb)); }
    .toggle__thumb { transform: translateX(18px); }
  }
}
</style>
