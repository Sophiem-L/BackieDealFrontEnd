<script setup>
// The date filter every report shares: the from/to pair, a way to clear it, and
// the reason a range was not applied. State lives in useReportRange so the report
// decides when to reload; this only draws it.
import DateRangeFilter from '@/components/DateRangeFilter.vue'

const from = defineModel('from', { type: String, default: '' })
const to = defineModel('to', { type: String, default: '' })

defineProps({
  error: { type: String, default: '' },
})

defineEmits(['clear'])
</script>

<template>
  <div class="range">
    <div class="range__row">
      <DateRangeFilter v-model:from="from" v-model:to="to" />
      <button v-if="from || to" type="button" class="range__clear" @click="$emit('clear')">
        Clear dates
      </button>
    </div>
    <p v-if="error" class="range__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped lang="scss">
.range {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  &__row {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__clear {
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;

    &:hover {
      color: var(--text-strong);
      background: var(--surface-alt);
    }
  }

  &__error {
    margin: 0;
    font-size: 0.74rem;
    color: var(--danger);
  }
}
</style>
