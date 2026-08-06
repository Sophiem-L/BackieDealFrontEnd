<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const search = ref('')
const categories = ref([])
const loading = ref(false)
const error = ref('')
// Delete failures are shown separately so a 409 doesn't wipe the loaded grid.
const actionError = ref('')
const deletingId = ref(null)

// GET /admin/categories hard-codes paginate(20) and ignores per_page, so walk
// the pages (guarded at 10 = 200 categories).
const MAX_PAGES = 10

// Cover gradients, picked by id so a category keeps the same cover on reload.
const TONES = ['slate', 'blue', 'green', 'violet', 'cyan', 'amber', 'neutral', 'teal', 'warm']

// The API returns no icon, so match one off the slug/name. CategoryIcon falls
// back to a generic glyph, so an unmatched category still renders.
const ICON_RULES = [
  [/graphic|gpu|vga/, 'gpu'],
  [/processor|cpu/, 'cpu'],
  [/motherboard|mainboard|mobo/, 'mobo'],
  [/memory|ram/, 'ram'],
  [/storage|ssd|hdd|disk/, 'storage'],
  [/power|psu|supply/, 'psu'],
  [/case|chassis/, 'case'],
  [/cool|fan|thermal/, 'cooling'],
]

function iconFor(slug, name) {
  const haystack = `${slug ?? ''} ${name ?? ''}`.toLowerCase()
  const hit = ICON_RULES.find(([pattern]) => pattern.test(haystack))
  return hit ? hit[1] : 'other'
}

function relativeTime(value) {
  if (!value) return 'never'
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return 'never'

  const minutes = Math.round((Date.now() - then.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days <= 30) return `${days} day${days === 1 ? '' : 's'} ago`

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name ?? `Category ${row.id}`,
    slug: row.slug ?? '',
    icon: iconFor(row.slug, row.name),
    tone: TONES[Math.abs(Number(row.id) || 0) % TONES.length],
    updated: relativeTime(row.updated_at),
  }
}

async function loadCategories() {
  loading.value = true
  error.value = ''
  actionError.value = ''
  try {
    const collected = []
    let current = 1
    let last = 1
    do {
      const response = await apiFetch(`/admin/categories?page=${current}`, {
        token: auth.accessToken,
      })
      // The endpoint wraps a paginator, so `data` may be the array itself or {data: [...]}.
      const payload = response?.data
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? [])
      collected.push(...rows)
      last = payload?.meta?.last_page ?? 1
      current += 1
    } while (current <= last && current <= MAX_PAGES)

    categories.value = collected.filter((row) => row?.id != null).map(mapCategory)
  } catch (err) {
    error.value = err.message || 'Unable to load categories. Please try again.'
    categories.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)

function openCategory(cat) {
  router.push({ name: 'category-detail', params: { id: cat.id }, query: { name: cat.name } })
}

function editCategory(cat) {
  router.push({
    name: 'category-detail',
    params: { id: cat.id },
    query: { name: cat.name, edit: '1' },
  })
}

async function deleteCategory(cat) {
  if (!window.confirm(`Delete category "${cat.name}"? This action cannot be undone.`)) return
  actionError.value = ''
  deletingId.value = cat.id
  try {
    await apiFetch(`/admin/categories/${cat.id}`, { method: 'DELETE', token: auth.accessToken })
    categories.value = categories.value.filter((c) => c.id !== cat.id)
  } catch (err) {
    // 409 means the category still has products; the API message says as much.
    actionError.value = err.message || `Unable to delete "${cat.name}".`
  } finally {
    deletingId.value = null
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter((c) => c.name.toLowerCase().includes(q))
})
</script>

<template>
  <div class="page">
    <AppHeader title="Manage Categories" />

    <div class="page__body">
      <!-- Toolbar -->
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input v-model="search" type="search" placeholder="Search categories..." />
        </label>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="primary" :to="{ name: 'category-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          New Category
        </BaseButton>
      </section>

      <p v-if="actionError" class="notice notice--error">{{ actionError }}</p>

      <!-- Category grid -->
      <p v-if="loading" class="state">Loading categories…</p>
      <p v-else-if="error" class="state state--error">
        {{ error }}
        <button type="button" class="state__retry" @click="loadCategories">Retry</button>
      </p>
      <section v-else class="grid">
        <article
          v-for="cat in filtered"
          :key="cat.id"
          class="cat"
          tabindex="0"
          @click="openCategory(cat)"
          @keyup.enter="openCategory(cat)"
        >
          <div
            class="cat__media"
            :class="`cat__media--${cat.tone}`"
            :style="cat.image ? { backgroundImage: `url(${cat.image})` } : null"
          >
            <!-- Faded watermark glyph stands in for a product photo -->
            <span class="cat__glyph" aria-hidden="true">
              <CategoryIcon :name="cat.icon" />
            </span>

            <div class="cat__label">
              <span class="cat__icon" aria-hidden="true">
                <CategoryIcon :name="cat.icon" />
              </span>
              <h3 class="cat__name">{{ cat.name }}</h3>
            </div>
          </div>

          <div class="cat__body">
            <div class="cat__info">
              <p class="cat__updated">Updated {{ cat.updated }}</p>
            </div>
            <div class="cat__actions">
              <button
                type="button"
                class="icon-btn"
                title="Edit category"
                aria-label="Edit category"
                @click.stop="editCategory(cat)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                  <path d="M13.5 6.5l3 3" stroke-linecap="round" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn--danger"
                title="Delete category"
                aria-label="Delete category"
                :disabled="deletingId === cat.id"
                @click.stop="deleteCategory(cat)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </article>

        <p v-if="filtered.length === 0" class="empty">
          {{ search ? `No categories match "${search}".` : 'No categories yet.' }}
        </p>
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

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within { background: var(--surface); border-color: var(--border); }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__spacer { flex: 1; }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    &:focus { outline: none; }
  }
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;

  @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

/* Category card */
.cat {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;

  &:hover, &:focus-visible {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px rgba(20, 23, 28, 0.1);
    border-color: var(--border);
    outline: none;
  }

  &__media {
    position: relative;
    height: 150px;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: flex-end;
    overflow: hidden;

    // Dark scrim so the white label stays readable over any cover.
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, var(--backdrop) 0%, rgba(15, 17, 21, 0.15) 55%, rgba(15, 17, 21, 0.05) 100%);
    }

    // Tone gradients (used when no cover image is set).
    &--slate { background-image: linear-gradient(135deg, #2b2f3a, #15171d); }
    &--blue { background-image: linear-gradient(135deg, #28333f, #141a21); }
    &--green { background-image: linear-gradient(135deg, #2c382a, #161d15); }
    &--violet { background-image: linear-gradient(135deg, #352b3a, #1d1722); }
    &--cyan { background-image: linear-gradient(135deg, #273841, #131e24); }
    &--amber { background-image: linear-gradient(135deg, #3a3325, #211c12); }
    &--neutral { background-image: linear-gradient(135deg, #2e2e33, #18181c); }
    &--teal { background-image: linear-gradient(135deg, #27393a, #132122); }
    &--warm { background-image: linear-gradient(135deg, #382f29, #201913); }
  }

  &__glyph {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    color: var(--ink-on-solid);
    opacity: 0.12;

    svg { width: 76px; height: 76px; stroke: currentColor; stroke-width: 1.4; }
  }

  &__label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 1rem;
  }

  &__icon {
    display: inline-flex;
    color: rgb(var(--accent-rgb));
    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--ink-on-solid);
    text-shadow: 0 1px 4px var(--backdrop);
  }

  &__body {
    padding: 1rem 1.1rem 1.1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__info { min-width: 0; }

  &__actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  &__updated {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }
}

/* Inline banner for delete failures (the API 409s on a category with products) */
.notice {
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  font-size: 0.85rem;

  &--error {
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger);
  }
}

/* Grid-level load states */
.state {
  margin: 0;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-subtle);
  font-size: 0.9rem;

  &--error { color: var(--danger); }

  &__retry {
    margin-left: 0.6rem;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: var(--surface-alt); }
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover { background: var(--surface-alt); color: var(--text-strong); border-color: var(--border); }

  &--danger:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

.empty {
  grid-column: 1 / -1;
  margin: 0;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-subtle);
  font-size: 0.9rem;
}
</style>
