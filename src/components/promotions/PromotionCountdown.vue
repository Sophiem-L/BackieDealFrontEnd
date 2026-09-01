<script setup>
import { computed } from 'vue'
import { formatCountdown, useNow } from '@/lib/countdown'

const props = defineProps({
  expiresAt: { type: String, default: null },
})

const now = useNow()

// null means "nothing to count down to" — no expiry, or one the API sent in a
// shape we cannot parse. Either way the component renders nothing rather than
// claiming the promotion has expired.
const remaining = computed(() => {
  if (!props.expiresAt) return null

  const end = new Date(props.expiresAt).getTime()
  return Number.isNaN(end) ? null : end - now.value
})

const timeLeft = computed(() => (remaining.value === null ? '' : formatCountdown(remaining.value)))
const expired = computed(() => remaining.value !== null && timeLeft.value === '')
</script>

<template>
  <span
    v-if="remaining !== null"
    class="countdown"
    :class="{ 'countdown--expired': expired }"
  >{{ expired ? 'Expired' : `${timeLeft} left` }}</span>
</template>

<style scoped lang="scss">
.countdown {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  // Tabular figures keep the digits from shuffling sideways each second.
  font-variant-numeric: tabular-nums;
  color: var(--ink-on-solid);
  background: var(--danger-solid);

  &--expired {
    background: var(--neutral-solid);
  }
}
</style>
