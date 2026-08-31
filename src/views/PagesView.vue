<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// The website's standing pages are `content_items` rows of type `page`; News
// is the same table with type `news`. Every request here carries the filter,
// so the two screens never show each other's rows.
const TYPE = 'page'

// GET /admin/content returns { items, pagination } and honours ?page and
// ?per_page. The list pages server-side rather than pulling every row.
const PER_PAGE = 15

const statusLabels = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
}

const statusFilter = ref('all')
const statusFilters = [
  { value: 'all', label: 'All Pages' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

const pages = ref([])
const loading = ref(false)
const error = ref('')
// Row actions report separately from the load: a failed delete must not blank
// out the list the user is looking at.
const actionError = ref('')
const busyId = ref(null)

// Server-side paging state, fed by the `pagination` block of each response.
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// The list shows the opening of the body as a stand-in for a summary; the API
// has no excerpt column. Collapsing whitespace keeps a formatted body on one line.
function excerpt(body) {
  const text = String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 'No content yet.'
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

// A row can be `published` with no published_at: saving the form with that
// status stores the status only — the publish endpoint is what stamps the date.
// Falling back to the created date keeps the footer from reading "Published —".
function dateline(row) {
  if (row.status === 'published' && row.published_at) {
    return `Published ${formatDate(row.published_at)}`
  }
  return `Created ${formatDate(row.created_at)}`
}

function mapPage(row) {
  return {
    id: row.id,
    title: row.title ?? `Page ${row.id}`,
    excerpt: excerpt(row.body),
    // A legacy row could hold a status outside the three; show it raw rather
    // than an empty badge.
    status: row.status ?? 'draft',
    author: row.author?.name ?? 'Unknown',
    dateline: dateline(row),
  }
}

function buildQuery() {
  const params = new URLSearchParams({
    type: TYPE,
    page: String(page.value),
    per_page: String(PER_PAGE),
  })
  if (statusFilter.value !== 'all') params.set('status', statusFilter.value)
  return params.toString()
}

async function loadPages() {
  loading.value = true
  error.value = ''
  actionError.value = ''
  try {
    const response = await apiFetch(`/admin/content?${buildQuery()}`, {
      token: auth.accessToken,
    })
    // The envelope wraps { items, pagination }; tolerate a bare array too in
    // case an older backend passes the resource collection straight through.
    const payload = response?.data
    const rows = Array.isArray(payload) ? payload : (payload?.items ?? [])
    const pagination = Array.isArray(payload) ? {} : (payload?.pagination ?? {})

    pages.value = rows.filter((row) => row?.id != null).map(mapPage)
    total.value = pagination.total ?? pages.value.length
    lastPage.value = Math.max(1, pagination.last_page ?? 1)

    // A stale page number (last row on the page just deleted, or a filter that
    // shrank the set) can land past the end — pull back and refetch.
    if (page.value > lastPage.value) {
      page.value = lastPage.value
    }
  } catch (err) {
    error.value = err.message || 'Unable to load pages. Please try again.'
    pages.value = []
    total.value = 0
    lastPage.value = 1
  } finally {
    loading.value = false
  }
}

onMounted(loadPages)
watch(page, loadPages)

// Changing the filter restarts from page 1. Reload directly only when already
// on page 1, otherwise the page watcher does it (avoids a double fetch).
watch(statusFilter, () => {
  if (page.value !== 1) {
    page.value = 1
  } else {
    loadPages()
  }
})

// The list is already the filtered set — the server applied `status`.
const filtered = computed(() => pages.value)

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PER_PAGE + 1))
const rangeEnd = computed(() => (page.value - 1) * PER_PAGE + pages.value.length)

function prevPage() {
  if (page.value > 1) page.value -= 1
}

function nextPage() {
  if (page.value < lastPage.value) page.value += 1
}

function statusLabel(value) {
  return statusLabels[value] ?? value
}

function addPage() {
  router.push({ name: 'page-create' })
}

function editPage(row) {
  router.push({ name: 'page-edit', params: { id: row.id } })
}

// publish and archive are dedicated endpoints rather than a status PATCH:
// publish also stamps published_at server-side.
async function setStatus(row, action) {
  actionError.value = ''
  busyId.value = row.id
  try {
    const response = await apiFetch(`/admin/content/${row.id}/${action}`, {
      method: 'POST',
      token: auth.accessToken,
    })
    const updated = response?.data
    // A status change can move the row out of the active filter, so when one is
    // set the list is refetched rather than patched in place.
    if (statusFilter.value === 'all' && updated?.id != null) {
      pages.value = pages.value.map((item) => (item.id === updated.id ? mapPage(updated) : item))
    } else {
      await loadPages()
    }
  } catch (err) {
    actionError.value = err.message || `Unable to ${action} "${row.title}".`
  } finally {
    busyId.value = null
  }
}

async function deletePage(row) {
  if (!window.confirm(`Delete page "${row.title}"? This action cannot be undone.`)) return
  actionError.value = ''
  busyId.value = row.id
  try {
    await apiFetch(`/admin/content/${row.id}`, { method: 'DELETE', token: auth.accessToken })
    // Refetch so the row that slides up from the next page fills the gap and the
    // total / `last_page` stay honest.
    await loadPages()
  } catch (err) {
    actionError.value = err.message || `Unable to delete "${row.title}".`
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="page">
    <AppHeader title="Content: Pages" />

    <div class="page__body">
      <!-- Section heading + primary action -->
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">Website Pages</h2>
          <p class="head__subtitle">
            The standing pages of your website — About, Terms, Privacy and the like.
          </p>
        </div>

        <BaseButton v-if="auth.hasPermission('content.create')" variant="primary" @click="addPage">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </template>
          Add New Page
        </BaseButton>
      </section>

      <!-- Status filter -->
      <section class="filters">
        <button
          v-for="opt in statusFilters"
          :key="opt.value"
          type="button"
          class="filter"
          :class="{ 'filter--active': statusFilter === opt.value }"
          @click="statusFilter = opt.value"
        >
          {{ opt.label }}
        </button>
      </section>

      <p v-if="actionError" class="alert" role="alert">{{ actionError }}</p>

      <!-- Pages list -->
      <section class="pages">
        <p v-if="loading" class="pages__empty">Loading pages…</p>
        <p v-else-if="error" class="alert" role="alert">{{ error }}</p>

        <template v-else>
          <article v-for="item in filtered" :key="item.id" class="entry">
            <div class="entry__body">
              <div class="entry__meta">
                <span class="badge" :class="`badge--${item.status}`">
                  {{ statusLabel(item.status) }}
                </span>
              </div>
              <h3 class="entry__title">{{ item.title }}</h3>
              <p class="entry__excerpt">{{ item.excerpt }}</p>
              <div class="entry__footer">
                <span class="entry__byline">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round" />
                  </svg>
                  {{ item.author }}
                </span>
                <span class="entry__dot" aria-hidden="true">·</span>
                <span>{{ item.dateline }}</span>
              </div>
            </div>

            <div class="entry__actions">
              <button
                v-if="auth.hasPermission('content.update') && item.status !== 'published'"
                type="button"
                class="icon-btn icon-btn--ok"
                :disabled="busyId === item.id"
                :aria-label="`Publish ${item.title}`"
                title="Publish"
                @click="setStatus(item, 'publish')"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>

              <button
                v-if="auth.hasPermission('content.update') && item.status !== 'archived'"
                type="button"
                class="icon-btn"
                :disabled="busyId === item.id"
                :aria-label="`Archive ${item.title}`"
                title="Archive"
                @click="setStatus(item, 'archive')"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" stroke-linejoin="round" />
                  <path d="M10 12h4" stroke-linecap="round" />
                </svg>
              </button>

              <button
                v-if="auth.hasPermission('content.update')"
                type="button"
                class="icon-btn"
                :aria-label="`Edit ${item.title}`"
                title="Edit"
                @click="editPage(item)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke-linejoin="round" />
                  <path d="m13.5 6.5 4 4" stroke-linecap="round" />
                </svg>
              </button>

              <button
                v-if="auth.hasPermission('content.delete')"
                type="button"
                class="icon-btn icon-btn--danger"
                :disabled="busyId === item.id"
                :aria-label="`Delete ${item.title}`"
                title="Delete"
                @click="deletePage(item)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M10 11v6M14 11v6" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </article>

          <p v-if="filtered.length === 0" class="pages__empty">
            {{
              statusFilter === 'all'
                ? 'No pages yet. Add one to get started.'
                : 'No pages match this filter.'
            }}
          </p>

          <!-- Pagination -->
          <footer v-if="total > 0" class="pagination">
            <p class="pagination__info">
              Showing {{ rangeStart }}–{{ rangeEnd }} of {{ total.toLocaleString() }} pages
            </p>
            <div class="pagination__controls">
              <button
                type="button"
                class="page-btn"
                :disabled="page <= 1 || loading"
                @click="prevPage"
              >
                Previous
              </button>
              <button type="button" class="page-btn page-btn--active">{{ page }}</button>
              <button
                type="button"
                class="page-btn"
                :disabled="page >= lastPage || loading"
                @click="nextPage"
              >
                Next
              </button>
            </div>
          </footer>
        </template>
      </section>
    </div>
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

/* Status filter pills */
.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter {
  padding: 0.45rem 0.9rem;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { background: var(--surface-alt); }

  &--active {
    background: rgb(var(--accent-rgb) / 0.16);
    border-color: transparent;
    color: var(--nav-active-ink);
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

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.25rem;
  flex-wrap: wrap;

  &__info { margin: 0; font-size: 0.82rem; color: var(--text-subtle); }
  &__controls { display: flex; gap: 0.4rem; }
}

.page-btn {
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

  &:hover:not(:disabled) { background: var(--surface-alt); }

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &--active {
    background: rgb(var(--accent-rgb));
    border-color: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
  }
}

/* Pages list */
.pages {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__empty {
    margin: 0;
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
  }
}

.entry {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--border);
    box-shadow: 0 2px 10px rgba(20, 23, 28, 0.05);
  }

  &__body {
    flex: 1;
    min-width: 0;
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
    color: var(--text-body);
    line-height: 1.45;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.7rem;
    font-size: 0.78rem;
    color: var(--text-subtle);
    flex-wrap: wrap;
  }

  &__byline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
    color: var(--text-body);

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__dot { color: var(--text-faint); }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

/* Status badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 6px;
  white-space: nowrap;

  &--published { color: var(--success); background: var(--success-bg); }
  &--draft { color: var(--text-muted); background: var(--surface-track); }
  // No warning token exists; the accent tint is what the other views use for
  // a third, non-success non-danger state (compare OrdersView's `pending`).
  &--archived { color: var(--accent-ink); background: rgb(var(--accent-rgb) / 0.18); }
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
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { background: var(--surface-alt); }

  &:disabled { opacity: 0.55; cursor: not-allowed; }

  svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.7; }

  &--ok {
    color: var(--success);
    &:hover:not(:disabled) { background: var(--success-bg); }
  }

  &--danger {
    color: var(--danger);
    &:hover:not(:disabled) { background: var(--danger-bg); border-color: var(--danger-border); }
  }
}
</style>
