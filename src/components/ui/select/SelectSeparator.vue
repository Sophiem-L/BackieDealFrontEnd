<script setup>
// Vendored from shadcn-vue, ported to plain JS — see Select.vue for why.
import { SelectSeparator } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, default: undefined },
})
</script>

<template>
  <SelectSeparator
    data-slot="select-separator"
    :class="cn('-mx-1 my-1 h-px bg-muted', props.class)"
  />
</template>
