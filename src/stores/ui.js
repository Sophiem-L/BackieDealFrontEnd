import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const THEME_KEY = 'backiedeal.theme'

// localStorage throws (rather than returning null) in some privacy modes, so
// every access is guarded. A failure degrades to "no stored preference".
function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function writeStoredTheme(value) {
  try {
    window.localStorage.setItem(THEME_KEY, value)
  } catch {
    // Read-only or full storage: the theme still applies for this session.
  }
}

function prefersDark() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

// The inline script in index.html resolves the theme before Vue mounts, to avoid
// a flash of the wrong palette. Trust its result first so the store and the DOM
// can never disagree; the remaining branches cover SSR and unit tests.
function resolveInitialTheme() {
  if (typeof document !== 'undefined') {
    const booted = document.documentElement.dataset.theme
    if (booted === 'light' || booted === 'dark') return booted
  }
  return readStoredTheme() ?? (prefersDark() ? 'dark' : 'light')
}

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

  const theme = ref(resolveInitialTheme())

  // Mirror the theme onto <html data-theme>, which is what _tokens.scss keys on.
  //
  // flush: 'sync' because the default (pre-flush) defers the write by a
  // microtask, which would let a click paint one frame with the old palette.
  // Watching rather than writing inside setTheme keeps a direct
  // `store.theme = 'dark'` assignment working too.
  //
  // Deliberately does not persist here: writing on init would freeze the OS
  // preference as an explicit choice, so the app would stop following the OS
  // for users who never touched the toggle.
  watch(
    theme,
    (value) => {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = value
      }
    },
    { immediate: true, flush: 'sync' },
  )

  function setTheme(value) {
    if (value !== 'light' && value !== 'dark') return
    theme.value = value
    writeStoredTheme(value)
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
    collapseSidebar,
    theme,
    setTheme,
    toggleTheme,
  }
})
