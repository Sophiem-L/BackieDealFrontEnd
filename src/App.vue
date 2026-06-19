<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()
// Routes with meta.layout === 'blank' (e.g. login) render full-bleed, no sidebar.
const isBlank = computed(() => route.meta.layout === 'blank')
</script>

<template>
  <RouterView v-if="isBlank" />

  <div v-else class="layout">
    <AppSidebar />

    <!-- Mobile-only backdrop: tapping it closes the off-canvas sidebar -->
    <div
      v-if="!ui.sidebarCollapsed"
      class="layout__backdrop"
      @click="ui.collapseSidebar()"
    ></div>

    <main class="layout__main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
.layout {
  display: flex;
  min-height: 100vh;
  background: #f4f5f7;

  &__main {
    flex: 1;
    min-width: 0;
    // No padding here — pages render their own <AppHeader> flush to the top
    // and manage their own body padding.
  }

  // Backdrop only appears on mobile, where the sidebar is an overlay.
  &__backdrop {
    display: none;
  }

  @media (max-width: 768px) {
    &__backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgba(20, 23, 28, 0.4);
    }
  }
}
</style>
