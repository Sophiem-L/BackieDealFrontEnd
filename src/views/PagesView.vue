<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import BulkActionBar from '@/components/BulkActionBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageActionsMenu from '@/components/PageActionsMenu.vue'
import StatusChip from '@/components/StatusChip.vue'
import ToastStack from '@/components/ToastStack.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import {
  filterPages,
  formatRelativeTime,
  formatShortDate,
  getStatusCounts,
  getUpdatedAtValue,
  highlightMatch,
  isPageStale,
  makePageRow,
  normalizeStatus,
  PAGE_SORT_OPTIONS,
  sortPages,
} from '@/lib/pages'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const TYPE = 'page'
const searchRef = ref(null)
const showTemplateModal = ref(false)
const showDeleteDialog = ref(false)
const deleteTarget = ref(null)
const deleteConfirmationText = ref('')
const selectedIds = ref([])
const lastSelectedId = ref(null)
const statusFilter = ref(['all', 'published', 'draft', 'archived'].includes(route.query.status) ? route.query.status : 'all')
const sortBy = ref(['updated', 'newest', 'oldest', 'title'].includes(route.query.sort) ? route.query.sort : 'updated')
const viewMode = ref(route.query.view === 'table' ? 'table' : 'card')
const density = ref(route.query.density === 'compact' ? 'compact' : 'comfortable')
const queryText = ref(route.query.q || '')
const debouncedQuery = ref(route.query.q || '')
const pages = ref([])
const loading = ref(true)
const page = ref(Number(route.query.page || 1))
const actionBusyId = ref(null)
const toasts = ref([])
const error = ref('')

let searchTimer = null

const statusFilters = [
  { value: 'all', label: 'All Pages' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

const sortOptions = Object.entries(PAGE_SORT_OPTIONS).map(([value, label]) => ({ value, label }))
const statusCounts = computed(() => getStatusCounts(pages.value))
const itemsPerPage = computed(() => (viewMode.value === 'table' ? 12 : 8))

const visiblePages = computed(() => {
  const filtered = filterPages(pages.value, debouncedQuery.value, statusFilter.value)
  return sortPages(filtered, sortBy.value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(visiblePages.value.length / itemsPerPage.value)))
const currentPageItems = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return visiblePages.value.slice(start, start + itemsPerPage.value)
})
const selectedPages = computed(() => pages.value.filter((pageItem) => selectedIds.value.includes(pageItem.id)))
const deleteConfirmReady = computed(() => {
  if (!deleteTarget.value) return false
  const expected = String(deleteTarget.value.id)
  const typed = deleteConfirmationText.value.trim()
  return typed === expected || typed === 'DELETE'
})

function pushToast(title, message = '', options = {}) {
  const toast = {
    id: Date.now() + Math.random(),
    type: options.type || 'info',
    title,
    message,
    actionLabel: options.actionLabel || '',
    onAction: options.onAction || null,
  }
  toasts.value.push(toast)
  if (!options.persist) {
    setTimeout(() => removeToast(toast.id), 6000)
  }
}

function removeToast(id) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function handleToastAction(toast) {
  if (toast.onAction) toast.onAction()
  removeToast(toast.id)
}

function updateRouteState() {
  const query = { ...route.query }

  if (statusFilter.value !== 'all') query.status = statusFilter.value
  else delete query.status

  if (sortBy.value !== 'updated') query.sort = sortBy.value
  else delete query.sort

  if (queryText.value) query.q = queryText.value
  else delete query.q

  if (viewMode.value !== 'card') query.view = viewMode.value
  else delete query.view

  if (density.value !== 'comfortable') query.density = density.value
  else delete query.density

  if (page.value > 1) query.page = String(page.value)
  else delete query.page

  router.replace({ name: 'pages', query }).catch(() => {})
}

watch(queryText, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedQuery.value = value.trim()
    page.value = 1
    updateRouteState()
  }, 180)
})

watch([statusFilter, sortBy, viewMode, density], () => {
  page.value = 1
  updateRouteState()
})

watch(page, () => updateRouteState())

watch(
  () => visiblePages.value.length,
  () => {
    if (page.value > totalPages.value) {
      page.value = totalPages.value
    }
  },
)

function syncFromRoute() {
  const nextStatus = ['all', 'published', 'draft', 'archived'].includes(route.query.status) ? route.query.status : 'all'
  const nextSort = ['updated', 'newest', 'oldest', 'title'].includes(route.query.sort) ? route.query.sort : 'updated'
  const nextView = route.query.view === 'table' ? 'table' : 'card'
  const nextDensity = route.query.density === 'compact' ? 'compact' : 'comfortable'

  statusFilter.value = nextStatus
  sortBy.value = nextSort
  viewMode.value = nextView
  density.value = nextDensity
  queryText.value = route.query.q || ''
  debouncedQuery.value = queryText.value.trim()
  page.value = Number(route.query.page || 1)
}

function formatPageMeta(item) {
  if (item.status === 'published' && item.published_at) {
    return `Published ${formatShortDate(item.published_at)}`
  }
  if (item.updated_at) {
    return `Updated ${formatShortDate(item.updated_at)}`
  }
  return `Created ${formatShortDate(item.created_at)}`
}

function buildListQuery() {
  const params = new URLSearchParams({ type: TYPE, per_page: '200' })
  return params.toString()
}

async function loadPages() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/content?${buildListQuery()}`, { token: auth.accessToken })
    const payload = response?.data
    const rows = Array.isArray(payload) ? payload : payload?.items ?? []
    pages.value = rows.filter((row) => row?.id != null).map((row) => makePageRow(row))
  } catch (err) {
    pages.value = []
    error.value = err?.message || 'Unable to load pages. Please try again.'
  } finally {
    loading.value = false
  }
}

function focusSearch() {
  nextTick(() => searchRef.value?.focus())
}

function handleGlobalShortcuts(event) {
  if ((event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) && !event.altKey) {
    event.preventDefault()
    focusSearch()
  }
}

function handleOpenTemplate(template = 'blank') {
  showTemplateModal.value = false
  router.push({ name: 'page-create', query: template === 'blank' ? {} : { template } })
}

function openLivePage(item) {
  const url = item.slug.startsWith('http') ? item.slug : `${window.location.origin}${item.slug}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function openEditor(item) {
  router.push({ name: 'page-edit', params: { id: item.id } })
}

function openPage(item) {
  router.push({ name: 'page-view', params: { id: item.id } })
}

function copySlug(item) {
  const text = item.slug || ''
  navigator.clipboard?.writeText(text).then(() => {
    pushToast('Slug copied', text)
  }).catch(() => {
    pushToast('Copy not available', 'Use the URL in the page details instead.')
  })
}

function getPrimaryActionLabel(item) {
  if (item.status === 'draft') return 'Publish'
  if (item.status === 'published') return 'Unpublish'
  return 'Restore'
}

function currentStatus(item) {
  return normalizeStatus(item.status)
}

async function persistStatus(item, nextStatus) {
  const previousStatus = currentStatus(item)
  const previousPage = { ...item }

  pages.value = pages.value.map((pageItem) => {
    if (pageItem.id !== item.id) return pageItem

    const nextUpdated = new Date().toISOString()
    return {
      ...pageItem,
      status: nextStatus,
      updated_at: nextUpdated,
      published_at: nextStatus === 'published' ? nextUpdated : pageItem.published_at,
    }
  })

  const undoAction = () => {
    pages.value = pages.value.map((pageItem) => (pageItem.id === item.id ? { ...pageItem, ...previousPage } : pageItem))
  }

  pushToast(
    nextStatus === 'published'
      ? `Published "${item.title}"`
      : nextStatus === 'archived'
        ? `Archived "${item.title}"`
        : `Moved "${item.title}" back to draft`,
    'Your change is in progress.',
    {
      actionLabel: 'Undo',
      onAction: undoAction,
    },
  )

  try {
    if (nextStatus === 'published') {
      await apiFetch(`/admin/content/${item.id}/publish`, { method: 'POST', token: auth.accessToken })
    } else if (nextStatus === 'archived') {
      await apiFetch(`/admin/content/${item.id}/archive`, { method: 'POST', token: auth.accessToken })
    } else {
      await apiFetch(`/admin/content/${item.id}`, {
        method: 'PATCH',
        token: auth.accessToken,
        body: { status: nextStatus },
      })
    }
  } catch (err) {
    pages.value = pages.value.map((pageItem) => (pageItem.id === item.id ? { ...pageItem, ...previousPage } : pageItem))
    pushToast('Action failed', err?.message || 'Please try again.', { type: 'error' })
  }
}

async function performMainAction(item) {
  actionBusyId.value = item.id
  try {
    const targetStatus = currentStatus(item) === 'draft' ? 'published' : currentStatus(item) === 'published' ? 'draft' : 'draft'
    await persistStatus(item, targetStatus)
  } finally {
    actionBusyId.value = null
  }
}

async function performBulkAction(action) {
  const ids = [...selectedIds.value]
  if (!ids.length) return

  const selectedItems = pages.value.filter((item) => ids.includes(item.id))
  const actionLabels = {
    publish: 'Publish',
    unpublish: 'Unpublish',
    archive: 'Archive',
    delete: 'Delete',
  }

  pushToast(`${actionLabels[action]} ${selectedItems.length} page${selectedItems.length > 1 ? 's' : ''}`, 'Bulk action in progress.', { persist: true })

  for (const item of selectedItems) {
    const targetStatus = action === 'publish' ? 'published' : action === 'unpublish' ? 'draft' : action === 'archive' ? 'archived' : null

    if (action === 'delete') {
      await apiFetch(`/admin/content/${item.id}`, { method: 'DELETE', token: auth.accessToken })
      continue
    }

    await persistStatus(item, targetStatus)
  }

  selectedIds.value = []
  lastSelectedId.value = null
  await loadPages()
  removeToast(toasts.value[toasts.value.length - 1]?.id)
}

function toggleSelection(id, event) {
  const visibleIds = currentPageItems.value.map((item) => item.id)
  const isSelected = selectedIds.value.includes(id)

  if (event && event.shiftKey && lastSelectedId.value && visibleIds.includes(lastSelectedId.value)) {
    const anchorIndex = visibleIds.indexOf(lastSelectedId.value)
    const targetIndex = visibleIds.indexOf(id)
    const start = Math.min(anchorIndex, targetIndex)
    const end = Math.max(anchorIndex, targetIndex)
    const range = visibleIds.slice(start, end + 1)
    const nextSelected = new Set(selectedIds.value)
    range.forEach((rangeId) => {
      if (isSelected) nextSelected.delete(rangeId)
      else nextSelected.add(rangeId)
    })
    selectedIds.value = [...nextSelected]
    return
  }

  if (isSelected) {
    selectedIds.value = selectedIds.value.filter((itemId) => itemId !== id)
  } else {
    selectedIds.value = [...selectedIds.value, id]
  }

  lastSelectedId.value = id
}

function confirmDelete(item) {
  deleteTarget.value = item
  deleteConfirmationText.value = ''
  showDeleteDialog.value = true
}

async function destroyPage() {
  if (!deleteTarget.value) return
  const target = deleteTarget.value
  const targetId = target.id
  const targetTitle = target.title
  actionBusyId.value = targetId
  try {
    await apiFetch(`/admin/content/${targetId}`, {
      method: 'DELETE',
      token: auth.accessToken,
    })
    showDeleteDialog.value = false
    deleteTarget.value = null
    deleteConfirmationText.value = ''
    selectedIds.value = selectedIds.value.filter((id) => id !== targetId)
    pushToast(`Deleted "${targetTitle || 'page'}"`, 'The page was removed from the list.')
    await loadPages()
  } catch (err) {
    pushToast('Delete failed', err?.message || 'Please try again.', { type: 'error' })
  } finally {
    actionBusyId.value = null
  }
}

function clearSelection() {
  selectedIds.value = []
  lastSelectedId.value = null
}

function toggleSelectAllVisible() {
  const visibleIds = currentPageItems.value.map((item) => item.id)
  const allVisibleSelected = visibleIds.every((id) => selectedIds.value.includes(id))

  if (allVisibleSelected) {
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.includes(id))
    return
  }

  selectedIds.value = [...new Set([...selectedIds.value, ...visibleIds])]
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

onMounted(() => {
  syncFromRoute()
  loadPages()
  document.addEventListener('keydown', handleGlobalShortcuts)
})

watch(
  () => route.query,
  () => syncFromRoute(),
  { deep: true },
)
</script>

<template>
  <div class="page">
    <AppHeader title="Content: Pages" />

    <div class="page__body">
      <header class="page__header">
        <div>
          <p class="eyebrow">Website content</p>
          <h2 class="title">Pages</h2>
        </div>

        <BaseButton
          v-if="auth.hasPermission('content.create')"
          variant="primary"
          @click="showTemplateModal = true"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </template>
          Add New Page
        </BaseButton>
      </header>

      <section class="toolbar" aria-label="Page list controls">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" />
            <path d="m20 20-3.4-3.4" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
          <input
            ref="searchRef"
            v-model="queryText"
            type="search"
            placeholder="Search pages by title, slug or excerpt"
            aria-label="Search pages"
          />
          <button v-if="queryText" type="button" class="search-box__clear" aria-label="Clear search" @click="queryText = ''">×</button>
        </div>

        <div class="toolbar__right">
          <div class="view-toggle" role="tablist" aria-label="Layout view">
            <button type="button" :class="{ 'is-active': viewMode === 'card' }" @click="viewMode = 'card'">Cards</button>
            <button type="button" :class="{ 'is-active': viewMode === 'table' }" @click="viewMode = 'table'">Table</button>
          </div>

          <div class="density-toggle" aria-label="Density">
            <button type="button" :class="{ 'is-active': density === 'comfortable' }" @click="density = 'comfortable'">Comfortable</button>
            <button type="button" :class="{ 'is-active': density === 'compact' }" @click="density = 'compact'">Compact</button>
          </div>
        </div>
      </section>

      <nav class="filters" aria-label="Page status filters" role="tablist">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          type="button"
          class="filter-pill"
          :class="{ 'filter-pill--active': statusFilter === filter.value }"
          :aria-pressed="statusFilter === filter.value"
          :aria-live="filter.value === statusFilter ? 'polite' : 'off'"
          @click="statusFilter = filter.value"
        >
          <span>{{ filter.label }}</span>
          <span class="filter-pill__count">{{ statusCounts[filter.value] ?? 0 }}</span>
        </button>
      </nav>

      <section class="sort-row" aria-label="Sort pages">
        <label class="sort-row__label" for="page-sort">Sort by</label>
        <select id="page-sort" v-model="sortBy" class="sort-row__select">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </section>

      <div v-if="loading" class="list-skeleton" aria-live="polite" aria-busy="true">
        <div v-for="n in 4" :key="n" class="skeleton-card" />
      </div>

      <div v-else-if="error" class="alert-card" role="alert" aria-live="assertive">
        <strong>We couldn’t load your pages.</strong>
        <p>{{ error }}</p>
        <button type="button" class="alert-card__retry" @click="loadPages">Try again</button>
      </div>

      <template v-else>
        <EmptyState
          v-if="visiblePages.length === 0 && !debouncedQuery && statusFilter === 'all'"
          title="No pages yet"
          description="Create your first website page to start publishing policy content and storefront details."
          action-label="Create your first page"
          @action="showTemplateModal = true"
        />

        <EmptyState
          v-else-if="visiblePages.length === 0"
          :title="`No pages match “${debouncedQuery || statusFilter}”`"
          description="Try a different search, or switch to another filter to broaden the list."
          action-label="Clear search"
          @action="queryText = ''"
        />

        <div v-else-if="viewMode === 'table'" class="table-shell">
          <table class="page-table" role="table">
            <thead>
              <tr>
                <th class="table-check"><input type="checkbox" :checked="currentPageItems.length > 0 && currentPageItems.every((item) => selectedIds.includes(item.id))" @change="toggleSelectAllVisible" /></th>
                <th>Title</th>
                <th>Status</th>
                <th>Author</th>
                <th>Updated</th>
                <th>Slug</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in currentPageItems" :key="item.id" :class="{ 'is-selected': selectedIds.includes(item.id) }">
                <td><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelection(item.id, $event)" /></td>
                <td>
                  <button type="button" class="title-link" @click="openPage(item)">
                    <span v-html="escapeHtml(item.title).replace(new RegExp(`(${debouncedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>')" />
                  </button>
                </td>
                <td><StatusChip :status="item.status" /></td>
                <td>{{ item.author }}</td>
                <td>
                  <div class="updated-cell">
                    <span>{{ formatRelativeTime(getUpdatedAtValue(item)) }}</span>
                    <button type="button" class="meta-tooltip" :title="`Updated ${formatShortDate(getUpdatedAtValue(item))}`">i</button>
                  </div>
                </td>
                <td>
                  <button type="button" class="slug-copy" @click="copySlug(item)">{{ item.slug }}</button>
                </td>
                <td>
                  <div class="table-actions">
                    <button type="button" class="mini-action" @click="openPage(item)">Edit</button>
                    <button type="button" class="mini-action mini-action--ghost" @click="openLivePage(item)">View live</button>
                    <PageActionsMenu :item="item" :busy="actionBusyId === item.id" @view="openLivePage(item)" @edit="openEditor(item)" @publish="persistStatus(item, 'published')" @unpublish="persistStatus(item, 'draft')" @archive="persistStatus(item, 'archived')" @restore="persistStatus(item, 'draft')" @duplicate="router.push({ name: 'page-create', query: { duplicate: item.id } })" @delete="confirmDelete(item)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="card-list" aria-live="polite">
          <article
            v-for="item in currentPageItems"
            :key="item.id"
            class="page-card"
            :class="{ 'page-card--selected': selectedIds.includes(item.id) }"
          >
            <div class="page-card__head">
              <div class="page-card__check">
                <input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelection(item.id, $event)" />
              </div>
              <div class="page-card__status">
                <StatusChip :status="item.status" />
                <span v-if="isPageStale(item)" class="needs-review">Needs review</span>
              </div>
            </div>

            <button type="button" class="page-card__title" @click="openPage(item)">
              <span v-html="highlightMatch(item.title, debouncedQuery)" />
            </button>

            <p class="page-card__excerpt" v-html="highlightMatch(item.excerpt, debouncedQuery)" />

            <div class="page-card__meta">
              <span class="page-card__meta-label">Author</span>
              <span>{{ item.author }}</span>
            </div>
            <div class="page-card__meta">
              <span class="page-card__meta-label">Updated</span>
              <span>{{ formatRelativeTime(getUpdatedAtValue(item)) }}</span>
            </div>

            <div class="page-card__slug-row">
              <span class="slug-label">Slug</span>
              <button type="button" class="slug-copy" @click="copySlug(item)">{{ item.slug }}</button>
            </div>

            <div class="page-card__actions">
              <button type="button" class="primary-action" @click="performMainAction(item)">
                {{ actionBusyId === item.id ? 'Working…' : getPrimaryActionLabel(item) }}
              </button>
              <button type="button" class="secondary-action" @click="openEditor(item)">Edit</button>
              <button type="button" class="secondary-action" @click="openLivePage(item)">View live</button>
              <PageActionsMenu :item="item" :busy="actionBusyId === item.id" @view="openLivePage(item)" @edit="openEditor(item)" @publish="persistStatus(item, 'published')" @unpublish="persistStatus(item, 'draft')" @archive="persistStatus(item, 'archived')" @restore="persistStatus(item, 'draft')" @duplicate="router.push({ name: 'page-create', query: { duplicate: item.id } })" @delete="confirmDelete(item)" />
            </div>
          </article>
        </div>

        <footer v-if="visiblePages.length" class="pager">
          <span>Showing {{ currentPageItems.length }} of {{ visiblePages.length }} pages</span>
          <div class="pager__controls">
            <button type="button" :disabled="page <= 1" @click="page -= 1">Previous</button>
            <button type="button" class="pager__page" :aria-label="`Page ${page}`">{{ page }}</button>
            <button type="button" :disabled="page >= totalPages" @click="page += 1">Next</button>
          </div>
        </footer>
      </template>

      <BulkActionBar
        :selected-count="selectedIds.length"
        @publish="performBulkAction('publish')"
        @unpublish="performBulkAction('unpublish')"
        @archive="performBulkAction('archive')"
        @delete="performBulkAction('delete')"
        @clear="clearSelection()"
      />
    </div>

    <div v-if="showTemplateModal" class="template-modal" @click="showTemplateModal = false">
      <div class="template-modal__card" @click.stop>
        <div class="template-modal__header">
          <h3>Start a new page</h3>
          <button type="button" class="template-modal__close" @click="showTemplateModal = false">×</button>
        </div>

        <div class="template-modal__grid">
          <button type="button" class="template-option" @click="handleOpenTemplate('blank')">
            <span class="template-option__label">Blank</span>
            <small>Start from a clean page</small>
          </button>
          <button type="button" class="template-option" @click="handleOpenTemplate('legal')">
            <span class="template-option__label">Legal page</span>
            <small>Terms, policy, or disclosure</small>
          </button>
          <button type="button" class="template-option" @click="handleOpenTemplate('faq')">
            <span class="template-option__label">FAQ</span>
            <small>Common customer questions</small>
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete this page?"
      :description="`This page will disappear from your website immediately. This action is permanent and can’t be undone.`"
      confirm-label="Delete page"
      cancel-label="Keep page"
      destructive
      :confirm-disabled="!deleteConfirmReady"
      @confirm="destroyPage()"
    >
      <template #body>
        <div class="confirm-delete-wrap">
          <label for="delete-confirm">Type <strong>{{ deleteTarget?.id ?? '' }}</strong> or DELETE to confirm.</label>
          <input id="delete-confirm" v-model="deleteConfirmationText" type="text" placeholder="Type here" />
        </div>
      </template>
    </ConfirmDialog>

    <ToastStack :toasts="toasts" @dismiss="removeToast" @action="handleToastAction" />
  </div>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text-body);
}

.page__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

.page__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  background: rgba(11, 12, 15, 0.92);
  backdrop-filter: blur(10px);
}

.eyebrow {
  margin: 0 0 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-subtle);
  text-transform: uppercase;
}

.title {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2rem);
  font-weight: 800;
  color: var(--text-strong);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: min(100%, 20rem);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-subtle);

  svg {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text-strong);
    font: inherit;
    padding: 0;

    &:focus {
      outline: none;
    }
  }

  &__clear {
    appearance: none;
    width: 1.8rem;
    height: 1.8rem;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface-alt);
    color: var(--text-body);
    cursor: pointer;
  }
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.view-toggle,
.density-toggle {
  display: inline-flex;
  padding: 0.2rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);

  button {
    border: none;
    background: transparent;
    color: var(--text-subtle);
    padding: 0.5rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
  }

  .is-active {
    background: rgb(var(--accent-rgb) / 0.12);
    color: var(--text-strong);
  }
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-body);
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &--active {
    background: rgb(var(--accent-rgb) / 0.12);
    border-color: rgb(var(--accent-rgb) / 0.4);
    color: var(--text-strong);
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    font-size: 0.72rem;
  }
}

.sort-row {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  width: fit-content;
  color: var(--text-subtle);
}

.sort-row__label {
  font-size: 0.82rem;
  font-weight: 600;
}

.sort-row__select {
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-body);
  padding: 0.6rem 0.8rem;
  font: inherit;
}

.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.page-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--border);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
  }

  &--selected {
    background: rgb(var(--accent-rgb) / 0.06);
    border-color: rgb(var(--accent-rgb) / 0.5);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__check {
    display: inline-flex;
    align-items: center;
  }

  &__title {
    border: none;
    background: transparent;
    color: var(--text-strong);
    text-align: left;
    padding: 0;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
  }

  &__excerpt {
    margin: 0;
    color: var(--text-subtle);
    font-size: 0.86rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    font-size: 0.77rem;
    color: var(--text-subtle);
  }

  &__meta-label {
    font-weight: 700;
    color: var(--text-body);
  }

  &__slug-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
}

.primary-action,
.secondary-action,
.mini-action,
.pager__controls button,
.alert-card__retry {
  appearance: none;
  border: none;
  border-radius: 10px;
  font: inherit;
  cursor: pointer;
}

.primary-action {
  background: rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
  padding: 0.62rem 0.8rem;
  font-weight: 700;
}

.secondary-action {
  background: var(--surface-alt);
  color: var(--text-body);
  padding: 0.62rem 0.8rem;
  border: 1px solid var(--border);
}

.needs-review {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.33);
  color: #f8d572;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
}

.slug-copy,
.title-link {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-strong);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.slug-label {
  color: var(--text-subtle);
  font-weight: 700;
}

.updated-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-tooltip {
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-subtle);
}

.table-shell {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.page-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;

  th, td {
    padding: 0.85rem 0.9rem;
    border-bottom: 1px solid var(--border-subtle);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: var(--text-subtle);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .is-selected {
    background: rgb(var(--accent-rgb) / 0.06);
  }
}

.table-check {
  width: 44px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.mini-action {
  background: var(--surface-alt);
  color: var(--text-body);
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
}

.mini-action--ghost {
  background: transparent;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-subtle);
  font-size: 0.82rem;
  padding: 0.5rem 0.2rem 0;
}

.pager__controls {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  button {
    background: var(--surface);
    color: var(--text-body);
    border: 1px solid var(--border);
    padding: 0.5rem 0.8rem;
  }
}

.pager__page {
  background: rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
}

.list-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.skeleton-card {
  height: 220px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--surface) 25%, rgba(255,255,255,0.05) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: shine 1.3s linear infinite;
}

@keyframes shine {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

.alert-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.2rem;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--text-body);
}

.alert-card__retry {
  align-self: flex-start;
  padding: 0.55rem 0.8rem;
  background: rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
  font-weight: 700;
}

.template-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.56);
  z-index: 45;
  padding: 1rem;
}

.template-modal__card {
  width: min(38rem, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
}

.template-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid var(--border-subtle);

  h3 {
    margin: 0;
    color: var(--text-strong);
  }
}

.template-modal__close {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  color: var(--text-body);
  cursor: pointer;
}

.template-modal__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  padding: 1rem 1.15rem 1.2rem;
}

.template-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  min-height: 110px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  color: var(--text-body);
  padding: 1rem;
  text-align: left;
  cursor: pointer;

  small {
    color: var(--text-subtle);
  }
}

.template-option__label {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-strong);
}

.confirm-delete-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 0.75rem;
}

.confirm-delete-wrap label {
  font-size: 0.84rem;
  color: var(--text-subtle);
}

.confirm-delete-wrap input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-alt);
  color: var(--text-strong);
  padding: 0.75rem 0.8rem;
  font: inherit;
}

@media (max-width: 640px) {
  .page__body {
    padding: 1rem;
  }

  .page__header,
  .toolbar,
  .sort-row,
  .pager {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar__right {
    width: 100%;
    justify-content: space-between;
  }

  .filter-pill,
  .view-toggle,
  .density-toggle {
    width: auto;
  }
}
</style>
