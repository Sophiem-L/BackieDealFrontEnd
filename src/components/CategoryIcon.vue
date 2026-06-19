<script setup>
// Line-icon set for product categories. Stroke + size are controlled by the
// parent via `color` / `stroke-width` on the <svg> (both inherit to the paths).
defineProps({
  name: { type: String, required: true },
})
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <template v-if="name === 'gpu'">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <circle cx="16" cy="12" r="2.5" />
      <path d="M2 18v3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'cpu'">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'mobo'">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="6" y="6" width="6" height="6" rx="1" />
      <path d="M15 6h3M15 9h3M7 16h10" stroke-linecap="round" />
      <circle cx="8" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'ram'">
      <path d="M3 7h18v8H3z" stroke-linejoin="round" />
      <path d="M6 15v3M10 15v3M14 15v3M18 15v3M7 10h2M11 10h2M15 10h2" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'storage'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v3" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'psu'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M13 8l-3 4h3l-1 4 4-5h-3l1-3Z" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'case'">
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 6h6M9 9h6" stroke-linecap="round" />
      <circle cx="12" cy="16" r="2" />
    </template>
    <template v-else-if="name === 'cooling'">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" stroke-linecap="round" />
    </template>
    <template v-else>
      <rect x="2" y="13" width="20" height="7" rx="1.5" />
      <path d="M5 16h.01M8 16h.01M11 16h.01M14 16h.01M17 16h.01" stroke-linecap="round" />
      <path d="M7 6.5c0-1.4 1.1-2.5 2.5-2.5S12 5.1 12 6.5 13.1 9 14.5 9" stroke-linecap="round" />
    </template>
  </svg>
</template>
