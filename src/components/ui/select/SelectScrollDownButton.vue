<script setup>
// Vendored from shadcn-vue, ported to plain JS — see Select.vue for why.
import { ChevronDown } from '@lucide/vue'
import { SelectScrollDownButton } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, default: undefined },
})
</script>

<template>
  <SelectScrollDownButton
    data-slot="select-scroll-down-button"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <ChevronDown />
    </slot>
  </SelectScrollDownButton>
</template>
