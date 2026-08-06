import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui'

const THEME_KEY = 'backiedeal.theme'

// jsdom does not implement matchMedia at all, so it must be provided.
// `prefersDark` drives the OS-preference branch.
function stubMatchMedia(prefersDark) {
  window.matchMedia = vi.fn((query) => ({
    matches: prefersDark && query.includes('dark'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

// jsdom's localStorage is a Proxy-backed Storage: vi.spyOn on its methods does
// not intercept. The real implementation works, so tests use it directly and
// only swap the whole object when they need it to throw.
const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')

function breakStorage(impl) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: impl,
  })
}

describe('ui store — theme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.removeAttribute('data-theme')
    stubMatchMedia(false)
    window.localStorage.clear()
  })

  afterEach(() => {
    if (realStorage) Object.defineProperty(window, 'localStorage', realStorage)
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  it('follows the OS preference when nothing is stored', () => {
    stubMatchMedia(true)
    expect(useUiStore().theme).toBe('dark')
  })

  it('defaults to light when the OS prefers light and nothing is stored', () => {
    stubMatchMedia(false)
    expect(useUiStore().theme).toBe('light')
  })

  it('prefers a stored choice over a conflicting OS preference', () => {
    stubMatchMedia(true)
    window.localStorage.setItem(THEME_KEY, 'light')
    expect(useUiStore().theme).toBe('light')
  })

  it('ignores a corrupt stored value and falls back to the OS preference', () => {
    stubMatchMedia(true)
    window.localStorage.setItem(THEME_KEY, 'banana')
    expect(useUiStore().theme).toBe('dark')
  })

  it('adopts the theme the boot script already put on <html>', () => {
    // The inline script in index.html resolves the theme before Vue mounts.
    // The store must not contradict it, or the page would visibly flip.
    document.documentElement.dataset.theme = 'dark'
    stubMatchMedia(false)
    expect(useUiStore().theme).toBe('dark')
  })

  it('toggleTheme flips light to dark and back', () => {
    const store = useUiStore()
    expect(store.theme).toBe('light')
    store.toggleTheme()
    expect(store.theme).toBe('dark')
    store.toggleTheme()
    expect(store.theme).toBe('light')
  })

  it('writes the active theme to <html data-theme>', () => {
    const store = useUiStore()
    expect(document.documentElement.dataset.theme).toBe('light')
    store.toggleTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists the chosen theme to localStorage', () => {
    useUiStore().toggleTheme()
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark')
  })

  it('does not persist on init, so the OS preference stays live', () => {
    // Writing at startup would turn a first-visit OS default into an explicit
    // choice, and the app would stop following the OS from then on.
    stubMatchMedia(true)
    useUiStore()
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('setTheme rejects a value that is not a theme', () => {
    const store = useUiStore()
    store.setTheme('banana')
    expect(store.theme).toBe('light')
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('falls back to light when reading localStorage throws', () => {
    // Private browsing modes throw on access rather than returning null.
    stubMatchMedia(false)
    breakStorage({
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {},
    })
    expect(() => useUiStore()).not.toThrow()
    expect(useUiStore().theme).toBe('light')
  })

  it('still applies the theme when writing to localStorage throws', () => {
    const store = useUiStore()
    breakStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    expect(() => store.toggleTheme()).not.toThrow()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('leaves sidebar behaviour untouched', () => {
    const store = useUiStore()
    const before = store.sidebarCollapsed
    store.toggleTheme()
    expect(store.sidebarCollapsed).toBe(before)
  })
})
