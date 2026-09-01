<script setup>
// Vendored from shadcn-vue, ported to plain JS — see ../select/Select.vue for why.
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from './index.js'

const props = defineProps({
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'default' },
  as: { type: null, default: 'button' },
  asChild: { type: Boolean, default: false },
  class: { type: null, default: undefined },
})
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
