<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
const statusFilter = ref(
  ['all', 'published', 'draft', 'archived'].includes(route.query.status)
    ? route.query.status
    : 'all',
)
const sortBy = ref(
  ['updated', 'newest', 'oldest', 'title'].includes(route.query.sort)
    ? route.query.sort
    : 'updated',
)
const viewMode = ref(route.query.view === 'table' ? 'table' : 'list')
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

const totalPages = computed(() =>
  Math.max(1, Math.ceil(visiblePages.value.length / itemsPerPage.value)),
)
const currentPageItems = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return visiblePages.value.slice(start, start + itemsPerPage.value)
})
const rangeStart = computed(() =>
  visiblePages.value.length === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1,
)
const rangeEnd = computed(() => (page.value - 1) * itemsPerPage.value + currentPageItems.value.length)
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

  if (viewMode.value !== 'list') query.view = viewMode.value
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
  const nextStatus = ['all', 'published', 'draft', 'archived'].includes(route.query.status)
    ? route.query.status
    : 'all'
  const nextSort = ['updated', 'newest', 'oldest', 'title'].includes(route.query.sort)
    ? route.query.sort
    : 'updated'
  const nextView = route.query.view === 'table' ? 'table' : 'list'
  const nextDensity = route.query.density === 'compact' ? 'compact' : 'comfortable'

  statusFilter.value = nextStatus
  sortBy.value = nextSort
  viewMode.value = nextView
  density.value = nextDensity
  queryText.value = route.query.q || ''
  debouncedQuery.value = queryText.value.trim()
  page.value = Number(route.query.page || 1)
}

function buildListQuery() {
  const params = new URLSearchParams({ type: TYPE, per_page: '200' })
  return params.toString()
}

async function loadPages() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/content?${buildListQuery()}`, {
      token: auth.accessToken,
    })
    const payload = response?.data
    const rows = Array.isArray(payload) ? payload : (payload?.items ?? [])
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
  if (
    (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) &&
    !event.altKey
  ) {
    event.preventDefault()
    focusSearch()
  }
}

function handleOpenTemplate(template = 'blank') {
  showTemplateModal.value = false
  router.push({ name: 'page-create', query: template === 'blank' ? {} : { template } })
}

function openEditor(item) {
  router.push({ name: 'page-edit', params: { id: item.id } })
}

function openPage(item) {
  router.push({ name: 'page-view', params: { id: item.id } })
}

function copySlug(item) {
  const text = item.slug || ''
  if (!text) return
  navigator.clipboard
    ?.writeText(text)
    .then(() => {
      pushToast('Slug copied', text)
    })
    .catch(() => {
      pushToast('Copy not available', 'Use the URL in the page details instead.')
    })
}

async function persistStatus(item, nextStatus) {
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
    pages.value = pages.value.map((pageItem) =>
      pageItem.id === item.id ? { ...pageItem, ...previousPage } : pageItem,
    )
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
      await apiFetch(`/admin/content/${item.id}/publish`, {
        method: 'POST',
        token: auth.accessToken,
      })
    } else if (nextStatus === 'archived') {
      await apiFetch(`/admin/content/${item.id}/archive`, {
        method: 'POST',
        token: auth.accessToken,
      })
    } else {
      await apiFetch(`/admin/content/${item.id}`, {
        method: 'PATCH',
        token: auth.accessToken,
        body: { status: nextStatus },
      })
    }
  } catch (err) {
    pages.value = pages.value.map((pageItem) =>
      pageItem.id === item.id ? { ...pageItem, ...previousPage } : pageItem,
    )
    pushToast('Action failed', err?.message || 'Please try again.', { type: 'error' })
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

  pushToast(
    `${actionLabels[action]} ${selectedItems.length} page${selectedItems.length > 1 ? 's' : ''}`,
    'Bulk action in progress.',
    { persist: true },
  )

  for (const item of selectedItems) {
    const targetStatus =
      action === 'publish'
        ? 'published'
        : action === 'unpublish'
          ? 'draft'
          : action === 'archive'
            ? 'archived'
            : null

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

  if (
    event &&
    event.shiftKey &&
    lastSelectedId.value &&
    visibleIds.includes(lastSelectedId.value)
  ) {
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

function clearFilters() {
  queryText.value = ''
  statusFilter.value = 'all'
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
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">Pages</h2>
          <p class="head__subtitle">Create, organize, and publish website content.</p>
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
      </section>

      <p v-if="error" class="alert" role="alert">{{ error }}</p>

      <section class="pages" aria-label="Pages list">
        <div class="toolbar" aria-label="Page list controls">
          <div class="toolbar__row">
            <div class="toolbar__search">
              <span class="toolbar__search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.4-3.4" stroke-linecap="round" />
                </svg>
              </span>
              <input
                ref="searchRef"
                v-model="queryText"
                type="search"
                placeholder="Search pages by title, slug or excerpt"
                aria-label="Search pages"
              />
              <button
                v-if="queryText"
                type="button"
                class="toolbar__clear"
                aria-label="Clear search"
                @click="queryText = ''"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <label class="select">
              <span class="select__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <select v-model="sortBy" aria-label="Sort pages">
                <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <div class="toggle" role="group" aria-label="Layout view">
              <button
                type="button"
                :class="{ 'is-active': viewMode === 'list' }"
                :aria-pressed="viewMode === 'list'"
                @click="viewMode = 'list'"
              >
                List
              </button>
              <button
                type="button"
                :class="{ 'is-active': viewMode === 'table' }"
                :aria-pressed="viewMode === 'table'"
                @click="viewMode = 'table'"
              >
                Table
              </button>
            </div>

            <!-- Density only changes the list layout; in the table it would do nothing. -->
            <div v-if="viewMode === 'list'" class="toggle" role="group" aria-label="Density">
              <button
                type="button"
                :class="{ 'is-active': density === 'comfortable' }"
                :aria-pressed="density === 'comfortable'"
                @click="density = 'comfortable'"
              >
                Comfortable
              </button>
              <button
                type="button"
                :class="{ 'is-active': density === 'compact' }"
                :aria-pressed="density === 'compact'"
                @click="density = 'compact'"
              >
                Compact
              </button>
            </div>
          </div>

          <div class="filters" role="group" aria-label="Filter by status">
            <button
              v-for="filter in statusFilters"
              :key="filter.value"
              type="button"
              class="filter"
              :class="{ 'filter--active': statusFilter === filter.value }"
              :aria-pressed="statusFilter === filter.value"
              @click="statusFilter = filter.value"
            >
              {{ filter.label }}
              <span class="filter__count">{{ statusCounts[filter.value] ?? 0 }}</span>
            </button>
          </div>
        </div>

        <div v-if="loading" class="skeletons" aria-live="polite" aria-busy="true">
          <div v-for="n in 4" :key="n" class="skeleton" />
        </div>

        <template v-else>
          <EmptyState
            v-if="!error && visiblePages.length === 0 && !debouncedQuery && statusFilter === 'all'"
            title="No pages yet"
            description="Create your first website page to start publishing policy content and storefront details."
            action-label="Create your first page"
            @action="showTemplateModal = true"
          />

          <EmptyState
            v-else-if="!error && visiblePages.length === 0"
            :title="`No pages match “${debouncedQuery || statusFilter}”`"
            description="Try a different search, or switch to another filter to broaden the list."
            action-label="Clear filters"
            @action="clearFilters()"
          />

          <div v-else-if="viewMode === 'table'" class="table-card">
            <table class="table">
              <thead>
                <tr>
                  <th class="table__check">
                    <input
                      type="checkbox"
                      aria-label="Select all pages on this screen"
                      :checked="
                        currentPageItems.length > 0 &&
                        currentPageItems.every((item) => selectedIds.includes(item.id))
                      "
                      @change="toggleSelectAllVisible"
                    />
                  </th>
                  <th>Title</th>
                  <th>Status</th>
                  <th class="table__author">Author</th>
                  <th>Updated</th>
                  <th class="table__slug">Slug</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in currentPageItems"
                  :key="item.id"
                  :class="{ 'is-selected': selectedIds.includes(item.id) }"
                >
                  <td class="table__check">
                    <input
                      type="checkbox"
                      :aria-label="`Select ${item.title}`"
                      :checked="selectedIds.includes(item.id)"
                      @change="toggleSelection(item.id, $event)"
                    />
                  </td>
                  <td>
                    <button type="button" class="title-link" @click="openPage(item)">
                      <span v-html="highlightMatch(item.title, debouncedQuery)" />
                    </button>
                  </td>
                  <td><StatusChip :status="item.status" /></td>
                  <td class="table__author">{{ item.author }}</td>
                  <td>
                    <span class="muted" :title="`Updated ${formatShortDate(getUpdatedAtValue(item))}`">
                      {{ formatRelativeTime(getUpdatedAtValue(item)) }}
                    </span>
                  </td>
                  <td class="table__slug">
                    <button
                      v-if="item.slug"
                      type="button"
                      class="slug-copy"
                      title="Copy slug"
                      @click="copySlug(item)"
                    >
                      {{ item.slug }}
                    </button>
                    <span v-else class="faint">—</span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button
                        type="button"
                        class="icon-btn icon-btn--sm"
                        :aria-label="`Edit ${item.title}`"
                        title="Edit"
                        @click="openEditor(item)"
                      >
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke-linejoin="round" />
                          <path d="m13.5 6.5 4 4" stroke-linecap="round" />
                        </svg>
                      </button>
                      <PageActionsMenu
                        compact
                        :item="item"
                        :busy="actionBusyId === item.id"
                        @publish="persistStatus(item, 'published')"
                        @unpublish="persistStatus(item, 'draft')"
                        @archive="persistStatus(item, 'archived')"
                        @restore="persistStatus(item, 'draft')"
                        @duplicate="
                          router.push({ name: 'page-create', query: { duplicate: item.id } })
                        "
                        @delete="confirmDelete(item)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="page-list"
            :class="{ 'page-list--compact': density === 'compact' }"
            aria-live="polite"
          >
            <article
              v-for="item in currentPageItems"
              :key="item.id"
              class="page-row"
              :class="{ 'page-row--selected': selectedIds.includes(item.id) }"
            >
              <div
                class="page-row__body"
                role="button"
                tabindex="0"
                @click="openPage(item)"
                @keydown.enter.self.prevent="openPage(item)"
                @keydown.space.self.prevent="openPage(item)"
              >
                <div class="page-row__meta">
                  <StatusChip :status="item.status" />
                  <span v-if="isPageStale(item)" class="needs-review">Needs review</span>
                </div>
                <h3 class="page-row__title" v-html="highlightMatch(item.title, debouncedQuery)" />
                <p
                  class="page-row__excerpt"
                  v-html="highlightMatch(item.excerpt, debouncedQuery)"
                />
                <div class="page-row__footer">
                  <span class="byline">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round" />
                    </svg>
                    {{ item.author }}
                  </span>
                  <span class="dot" aria-hidden="true">·</span>
                  <span :title="`Updated ${formatShortDate(getUpdatedAtValue(item))}`">
                    Updated {{ formatRelativeTime(getUpdatedAtValue(item)) }}
                  </span>
                  <template v-if="item.slug">
                    <span class="dot" aria-hidden="true">·</span>
                    <span>{{ item.slug }}</span>
                  </template>
                </div>
              </div>

              <div class="page-row__actions">
                <button
                  type="button"
                  class="icon-btn"
                  :aria-label="`Edit ${item.title}`"
                  title="Edit"
                  @click="openEditor(item)"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke-linejoin="round" />
                    <path d="m13.5 6.5 4 4" stroke-linecap="round" />
                  </svg>
                </button>
                <PageActionsMenu
                  :item="item"
                  :busy="actionBusyId === item.id"
                  @publish="persistStatus(item, 'published')"
                  @unpublish="persistStatus(item, 'draft')"
                  @archive="persistStatus(item, 'archived')"
                  @restore="persistStatus(item, 'draft')"
                  @duplicate="router.push({ name: 'page-create', query: { duplicate: item.id } })"
                  @delete="confirmDelete(item)"
                />
              </div>
            </article>
          </div>

          <footer v-if="visiblePages.length" class="pagination">
            <p class="pagination__info">
              Showing {{ rangeStart }}–{{ rangeEnd }} of {{ visiblePages.length }} pages
            </p>
            <div class="pagination__controls">
              <button type="button" class="page-btn" :disabled="page <= 1" @click="page -= 1">
                Previous
              </button>
              <span class="page-btn page-btn--active" aria-current="page">{{ page }}</span>
              <button
                type="button"
                class="page-btn"
                :disabled="page >= totalPages"
                @click="page += 1"
              >
                Next
              </button>
            </div>
          </footer>
        </template>
      </section>

      <BulkActionBar
        :selected-count="selectedIds.length"
        @publish="performBulkAction('publish')"
        @unpublish="performBulkAction('unpublish')"
        @archive="performBulkAction('archive')"
        @delete="performBulkAction('delete')"
        @clear="clearSelection()"
      />
    </div>

    <div v-if="showTemplateModal" class="modal" @click="showTemplateModal = false">
      <div
        class="modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        @click.stop
      >
        <div class="modal__header">
          <h3 id="template-modal-title">Start a new page</h3>
          <button
            type="button"
            class="icon-btn icon-btn--sm"
            aria-label="Close"
            @click="showTemplateModal = false"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="modal__grid">
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
        <div class="confirm-delete">
          <label for="delete-confirm"
            >Type <strong>{{ deleteTarget?.id ?? '' }}</strong> or DELETE to confirm.</label
          >
          <input
            id="delete-confirm"
            v-model="deleteConfirmationText"
            type="text"
            placeholder="Type here"
          />
        </div>
      </template>
    </ConfirmDialog>

    <ToastStack :toasts="toasts" @dismiss="removeToast" @action="handleToastAction" />
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

/* Section heading */
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }
}

.alert {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
}

.pages {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  /* Search matches are injected through v-html, so scoped styles need :deep. */
  :deep(mark) {
    padding: 0 1px;
    color: inherit;
    background: rgb(var(--accent-rgb) / 0.3);
    border-radius: 3px;
  }
}

/* Toolbar: the same card the Customers and Orders lists use */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* The only growing item in the row, so it pushes the controls to the right. */
  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within {
      background: var(--surface);
      border-color: var(--border);
    }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      padding: 0.6rem;
      font-size: 0.85rem;
      font-family: inherit;
      color: var(--text-strong);

      &:focus {
        outline: none;
      }

      &::-webkit-search-cancel-button {
        display: none;
      }
    }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);

    svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
  }

  &__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      color: var(--text-strong);
      background: var(--surface-hover);
      border-color: transparent;
    }

    svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 2;
    }
  }
}

/* Sort select: same control as System Logs */
.select {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 0.7rem;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;

  &:hover {
    background: var(--surface-hover);
  }

  &:focus-within {
    border-color: var(--border-strong);
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.1);
  }

  &__icon {
    display: inline-flex;
    color: var(--text-strong);

    svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
  }

  select {
    min-width: 0;
    border: none;
    background-color: transparent;
    padding: 0.55rem 1.5rem 0.55rem 0;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-strong);
    cursor: pointer;
    appearance: none;
    color-scheme: inherit;
    background-image:
      linear-gradient(45deg, transparent 50%, var(--text-strong) 50%),
      linear-gradient(135deg, var(--text-strong) 50%, transparent 50%);
    background-position:
      calc(100% - 10px) 50%,
      calc(100% - 6px) 50%;
    background-size:
      4px 4px,
      4px 4px;
    background-repeat: no-repeat;

    &:focus {
      outline: none;
    }
  }

  option {
    background-color: var(--surface-alt);
    color: var(--text-strong);
  }
}

/* Two-option switches (layout, density), styled like the Stock detail toggle */
.toggle {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--surface-hover);
  border-radius: 10px;

  button {
    padding: 0.4rem 0.75rem;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    &:hover {
      color: var(--text-strong);
      border-color: transparent;
    }

    &.is-active {
      color: var(--text-strong);
      background: var(--surface);
      border-color: var(--border);
    }
  }
}

/* Status filter pills: News list, plus a count */
.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.9rem;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--surface-alt);
    border-color: var(--border);
  }

  &--active,
  &--active:hover {
    background: rgb(var(--accent-rgb) / 0.16);
    border-color: transparent;
    color: var(--nav-active-ink);
  }

  &__count {
    min-width: 1.35rem;
    padding: 0.05rem 0.4rem;
    font-size: 0.72rem;
    font-weight: 700;
    text-align: center;
    color: var(--text-muted);
    background: var(--surface-track);
    border-radius: 999px;
  }

  &--active &__count {
    color: var(--nav-active-ink);
    background: rgb(var(--accent-rgb) / 0.28);
  }
}

/* Page rows: the News card */
.page-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;

  &--compact {
    gap: 0.6rem;
  }
}

.page-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--border);
    box-shadow: 0 2px 10px rgba(20, 23, 28, 0.05);
  }

  &--selected,
  &--selected:hover {
    background: var(--surface);
    border-color: rgb(var(--accent-rgb) / 0.5);
    box-shadow: inset 0 0 0 9999px rgb(var(--accent-rgb) / 0.06);
  }

  &__body {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    border-radius: 8px;

    &:focus-visible {
      outline: 2px solid rgb(var(--accent-rgb) / 0.5);
      outline-offset: 4px;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0.5rem 0 0.3rem;
    font-size: 1.02rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__excerpt {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--text-body);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.7rem;
    font-size: 0.78rem;
    color: var(--text-subtle);
  }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

.page-list--compact .page-row {
  padding: 0.7rem 1.25rem;

  .page-row__excerpt {
    display: none;
  }

  .page-row__title {
    margin-bottom: 0;
  }

  .page-row__footer {
    margin-top: 0.4rem;
  }
}

.byline {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  color: var(--text-body);

  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 1.8;
  }
}

.dot {
  color: var(--text-faint);
}

/* Stale pages: outlined, so it doesn't compete with the status badge */
.needs-review {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  white-space: nowrap;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-body);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--border);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb) / 0.5);
    outline-offset: 2px;
  }

  svg {
    width: 17px;
    height: 17px;
    stroke: currentColor;
    stroke-width: 1.7;
  }

  /* Table rows use the denser 32px button, as Customers does. */
  &--sm {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: var(--text-muted);

    &:hover:not(:disabled) {
      color: var(--text-strong);
    }

    svg {
      width: 16px;
      height: 16px;
      stroke-width: 1.8;
    }
  }
}

/* Table view: the Customers / Orders table */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    text-align: left;
    padding: 0.9rem 1rem;
    vertical-align: middle;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  thead th:first-child {
    border-top-left-radius: 14px;
  }

  thead th:last-child {
    border-top-right-radius: 14px;
  }

  tbody tr + tr td {
    border-top: 1px solid var(--border-subtle);
  }

  tbody tr:hover {
    background: var(--surface-sunken);
  }

  /* Selected rows win over the hover tint so the selection stays visible. */
  tbody tr.is-selected td {
    background: rgb(var(--accent-rgb) / 0.08);
  }

  td {
    font-size: 0.84rem;
    color: var(--text-body);
  }

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: rgb(var(--accent-rgb));
    cursor: pointer;
  }

  &__check {
    width: 44px;
  }
}

.title-link {
  display: inline;
  padding: 0;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  text-align: left;
  color: var(--text-strong);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    border-color: transparent;
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb) / 0.5);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.slug-copy {
  padding: 0;
  font-family: inherit;
  font-size: 0.84rem;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    color: var(--text-strong);
    border-color: transparent;
  }
}

.muted {
  color: var(--text-muted);
}

.faint {
  color: var(--text-faint);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* Pagination: the News list */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.25rem;
  flex-wrap: wrap;

  &__info {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-subtle);
  }

  &__controls {
    display: flex;
    gap: 0.4rem;
  }
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--border);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--active {
    background: rgb(var(--accent-rgb));
    border-color: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
    cursor: default;
  }
}

/* Loading: row-shaped placeholders in the surface tokens */
.skeletons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.skeleton {
  height: 118px;
  background: linear-gradient(
    90deg,
    var(--surface) 25%,
    var(--surface-alt) 50%,
    var(--surface) 75%
  );
  background-size: 200% 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  animation: shine 1.3s linear infinite;
}

@keyframes shine {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}

/* New-page template picker */
.modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--backdrop);
  z-index: 45;
  padding: 1rem;

  &__card {
    width: min(38rem, 100%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow-md);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-subtle);

    h3 {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--text-strong);
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 0.75rem;
    padding: 1.1rem 1.25rem 1.25rem;
  }
}

.template-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  min-height: 96px;
  padding: 1rem;
  text-align: left;
  font-family: inherit;
  color: var(--text-body);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--surface);
    border-color: rgb(var(--accent-rgb) / 0.6);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb) / 0.5);
    outline-offset: 2px;
  }

  small {
    font-size: 0.78rem;
    color: var(--text-subtle);
  }

  &__label {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }
}

/* Delete confirmation field, inside ConfirmDialog */
.confirm-delete {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.85rem;

  label {
    font-size: 0.84rem;
    color: var(--text-subtle);
  }

  input {
    width: 100%;
    padding: 0.65rem 0.75rem;
    font: inherit;
    font-size: 0.85rem;
    color: var(--text-strong);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 10px;

    &:focus {
      outline: none;
      border-color: var(--border-strong);
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.1);
    }
  }
}

@media (max-width: 900px) {
  .table__author,
  .table__slug {
    display: none;
  }
}

@media (max-width: 720px) {
  .page-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .page-row {
    flex-wrap: wrap;

    &__actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
}

@media (max-width: 640px) {
  .page__body {
    padding: 1rem;
  }

  .pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
