<script setup>
// A from/to date pair drawn as one bordered control, so the two dates read as a
// single filter. Sized to sit level with the 36px toolbar Select triggers.
const from = defineModel('from', { type: String, default: '' })
const to = defineModel('to', { type: String, default: '' })

defineProps({
  label: { type: String, default: 'Date range' },
  fromLabel: { type: String, default: 'From date' },
  toLabel: { type: String, default: 'To date' },
})
</script>

<template>
  <div class="date-range" role="group" :aria-label="label">
    <input v-model="from" type="date" :max="to || undefined" :aria-label="fromLabel" :title="fromLabel" />
    <span aria-hidden="true">–</span>
    <input v-model="to" type="date" :min="from || undefined" :aria-label="toLabel" :title="toLabel" />
  </div>
</template>

<style scoped lang="scss">
.date-range {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 36px;
  padding: 0 0.7rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-subtle);

  &:focus-within {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  /* The native inputs already carry their own calendar picker icon. */
  input {
    width: 7.8rem;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 0.82rem;
    font-family: inherit;
    color: var(--text-body);

    &:focus { outline: none; }
  }
}
</style>
