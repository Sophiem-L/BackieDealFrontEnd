import { ref } from 'vue'
import { defineStore } from 'pinia'

// Shared UI state. The sidebar collapse is toggled from the header's
// hamburger and consumed by AppSidebar / the layout backdrop.
export const useUiStore = defineStore('ui', () => {
  // Start collapsed on small screens (off-canvas), expanded on desktop.
  const sidebarCollapsed = ref(
    typeof window !== 'undefined' && window.innerWidth <= 768,
  )

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function collapseSidebar() {
    sidebarCollapsed.value = true
  }

  return { sidebarCollapsed, toggleSidebar, collapseSidebar }
})
