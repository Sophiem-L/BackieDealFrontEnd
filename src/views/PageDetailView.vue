<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const page = ref(null)
const loading = ref(true)
const error = ref('')

const statusLabels = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const statusLabel = computed(() => statusLabels[page.value?.status] ?? page.value?.status)

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/content/${route.params.id}`, {
      token: auth.accessToken,
    })
    page.value = response?.data ?? null
  } catch (err) {
    error.value =
      err.status === 404
        ? 'That page no longer exists.'
        : err.message || 'Unable to load this page. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <div class="page">
    <AppHeader title="Content: Pages" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink :to="{ name: 'pages' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="subhead__crumb">Back to Pages</span>
        </RouterLink>
      </div>

      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="loading" class="loading">Loading page…</p>

      <div v-else-if="page" class="grid">
        <!-- Main column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">Page Content</h3>

            <div class="field">
              <span class="field__label">Title</span>
              <p class="field__value field__value--title">{{ page.title }}</p>
            </div>

            <div class="field">
              <span class="field__label">Body</span>
              <p class="field__value field__value--body">{{ page.body || 'No content yet.' }}</p>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Publishing</h3>

            <div class="field">
              <span class="field__label">Status</span>
              <p class="field__value">
                <span class="badge" :class="`badge--${page.status}`">{{ statusLabel }}</span>
              </p>
            </div>

            <div class="field">
              <span class="field__label">Publish date</span>
              <p class="field__value">{{ formatDate(page.published_at) }}</p>
            </div>

            <div class="field">
              <span class="field__label">Created</span>
              <p class="field__value">{{ formatDate(page.created_at) }}</p>
            </div>

            <div class="field">
              <span class="field__label">Author</span>
              <p class="field__value">{{ page.author?.name ?? 'Unknown' }}</p>
            </div>
          </section>
        </div>
      </div>
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

/* Sub header */
.subhead {
  display: flex;
  align-items: center;

  &__back {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-subtle);
    text-decoration: none;

    &:hover {
      color: var(--text-strong);
    }

    svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
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

.loading {
  margin: 0;
  text-align: center;
  color: var(--text-subtle);
  font-size: 0.88rem;
  padding: 2.5rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
}

/* Two-column layout, collapsing on narrow screens */
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  & + & {
    margin-top: 1rem;
  }

  &__label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-body);
  }

  &__value {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-strong);
    line-height: 1.55;
    white-space: pre-wrap;

    &--title {
      font-weight: 700;
    }

    &--body {
      font-weight: 400;
      color: var(--text-body);
    }
  }
}

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
  &--archived { color: var(--accent-ink); background: rgb(var(--accent-rgb) / 0.18); }
}
</style>
