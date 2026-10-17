<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import { SETTINGS_LINKS } from '@/views/settings/settingsData.js'

const props = defineProps({
  breadcrumb: { type: String, default: 'Settings' },
  title: { type: String, default: 'Settings' },
  description: { type: String, default: 'Manage your store configuration.' },
  dirty: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  pageClass: { type: String, default: '' },
})

const emit = defineEmits(['save', 'discard'])
const route = useRoute()
const navLinks = computed(() => SETTINGS_LINKS)

const saveLabel = computed(() => (props.saving ? 'Saving...' : 'Save changes'))

function handleSave() {
  emit('save')
}

function handleDiscard() {
  emit('discard')
}

function isCurrent(path) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function handleShortcuts(event) {
  if (!props.dirty) return
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 's') {
    event.preventDefault()
    handleSave()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcuts)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcuts)
})
</script>

<template>
  <div class="settings-page" :class="pageClass">
    <main class="settings-page__content">
      <header class="settings-page__header">
        <div class="settings-page__breadcrumbs">
          <RouterLink to="/settings/general">Settings</RouterLink>
          <span aria-hidden="true">›</span>
          <span>{{ breadcrumb }}</span>
        </div>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </header>

      <div class="settings-page__layout">
        <aside class="settings-nav" aria-label="Settings sections">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="settings-nav__link"
            :class="{ 'is-active': isCurrent(link.to) }"
          >
            <span class="settings-nav__dot" aria-hidden="true" />
            <span>{{ link.label }}</span>
          </RouterLink>
        </aside>

        <div class="settings-page__body">
          <slot />
        </div>
      </div>

      <div v-if="dirty" class="settings-savebar">
        <span class="settings-savebar__label">You have unsaved changes</span>
        <div class="settings-savebar__actions">
          <BaseButton variant="ghost" size="sm" @click="handleDiscard">Discard</BaseButton>
          <BaseButton variant="primary" size="sm" :disabled="saving" @click="handleSave">
            <span v-if="saving" class="spinner" aria-hidden="true" />
            {{ saveLabel }}
          </BaseButton>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  min-height: calc(100vh - 64px);
  background: var(--bg);
}

.settings-page__content {
  width: min(100%, 1200px);
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.settings-page__header {
  margin-bottom: 1.15rem;
  padding: 1.2rem 0 0.4rem;
}

.settings-page__breadcrumbs {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;

  a {
    color: var(--text-subtle);
    text-decoration: none;
  }

  span:last-child {
    color: var(--text-strong);
  }
}

.settings-page__header h1 {
  margin: 0.5rem 0 0.2rem;
  font-size: clamp(1.55rem, 2vw, 2.1rem);
  font-weight: 700;
  color: var(--text-strong);
}

.settings-page__header p {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.92rem;
}

.settings-page__layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.settings-nav {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface);
}

.settings-nav__link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  color: var(--text-body);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: var(--surface-hover);
    color: var(--text-strong);
    text-decoration: none;
  }

  &.is-active {
    background: rgb(var(--accent-rgb) / 0.12);
    color: var(--nav-active-ink);
    font-weight: 600;
  }
}

.settings-nav__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.settings-page__body {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.settings-savebar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
  padding: 0.9rem 1rem;
  background: rgba(14, 16, 20, 0.96);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.22);
}

.settings-savebar__label {
  color: var(--text-strong);
  font-size: 0.9rem;
  font-weight: 600;
}

.settings-savebar__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: currentColor;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
  margin-right: 0.45rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 980px) {
  .settings-page__layout {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
}

@media (max-width: 640px) {
  .settings-savebar {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-savebar__actions {
    width: 100%;
  }

  .settings-savebar__actions :deep(.btn) {
    flex: 1;
  }
}
</style>
