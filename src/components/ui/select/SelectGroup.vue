<script setup>
// Vendored from shadcn-vue, ported to plain JS — see Select.vue for why.
import { SelectGroup } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: null, default: undefined },
})
</script>

<template>
  <SelectGroup data-slot="select-group" :class="cn('p-1 w-full', props.class)">
    <slot />
  </SelectGroup>
</template>
