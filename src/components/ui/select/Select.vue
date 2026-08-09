<script setup>
// Vendored from shadcn-vue (style: new-york), ported to plain JS.
//
// Upstream forwards props with `defineProps<SelectRootProps>()`, which needs
// @vue/compiler-sfc to read reka-ui's .d.ts at build time. That resolution
// fails under this project's Vite 8 / rolldown pipeline, so the wrappers rely
// on Vue's attribute fallthrough instead: undeclared attrs and listeners land
// on the single root element, where reka-ui claims them as its own props and
// emits. v-model therefore still works. Rendered output is unchanged.
import { SelectRoot } from 'reka-ui'
</script>

<template>
  <SelectRoot>
    <slot />
  </SelectRoot>
</template>
