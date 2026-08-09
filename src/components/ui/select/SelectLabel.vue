<script setup>
// Vendored from shadcn-vue, ported to plain JS — see Select.vue for why.
import { SelectLabel } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, default: undefined },
})
</script>

<template>
  <SelectLabel
    data-slot="select-label"
    :class="cn('px-2 py-1.5 text-sm font-semibold', props.class)"
  >
    <slot />
  </SelectLabel>
</template>
