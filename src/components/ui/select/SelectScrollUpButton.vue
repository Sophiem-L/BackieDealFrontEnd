<script setup>
// Vendored from shadcn-vue, ported to plain JS — see Select.vue for why.
import { ChevronUp } from '@lucide/vue'
import { SelectScrollUpButton } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, default: undefined },
})
</script>

<template>
  <SelectScrollUpButton
    data-slot="select-scroll-up-button"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <ChevronUp />
    </slot>
  </SelectScrollUpButton>
</template>
