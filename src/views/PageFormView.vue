<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORM_SELECT } from '@/lib/selectPresets'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// One component serves both routes: /pages/new has no :id, /pages/:id/edit does.
const pageId = computed(() => route.params.id ?? null)
const isEdit = computed(() => Boolean(pageId.value))

// Every row this screen writes is a `page`; News owns type `news`.
const TYPE = 'page'

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

// The scoped `.is-invalid` rule below only reaches native controls; the Select
// trigger is a Tailwind-styled button, so its error state is expressed the same
// way FORM_SELECT expresses its focus ring.
const INVALID_TRIGGER =
  'border-[var(--danger)] shadow-[0_0_0_3px_rgb(var(--danger-rgb)/0.14)]'

const form = reactive({
  title: '',
  body: '',
  status: 'draft',
  // datetime-local wants `YYYY-MM-DDTHH:mm`; empty means "leave it to the API".
  publishedAt: '',
})

const loading = ref(false)
const saving = ref(false)
const error = ref('')
// Keyed by field name, straight from the API's 422 body.
const fieldErrors = ref({})

function firstError(field) {
  const messages = fieldErrors.value?.[field]
  return Array.isArray(messages) ? messages[0] : messages
}

// The API returns ISO-8601 with an offset; <input type="datetime-local"> only
// accepts a local wall-clock string, so trim to minutes after converting.
function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function loadPage() {
  if (!isEdit.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/content/${pageId.value}`, { token: auth.accessToken })
    const data = response?.data
    Object.assign(form, {
      title: data?.title ?? '',
      body: data?.body ?? '',
      status: data?.status ?? 'draft',
      publishedAt: toLocalInput(data?.published_at),
    })
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

const pageTitle = computed(() =>
  isEdit.value ? `Edit Page: ${form.title || 'Page'}` : 'New Page',
)

const canSave = computed(() => form.title.trim().length > 0 && !saving.value && !loading.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  fieldErrors.value = {}

  // `type` is sent on create only — an edit must not be able to turn a page
  // into a news article by accident.
  const body = {
    title: form.title.trim(),
    body: form.body,
    status: form.status,
    ...(isEdit.value ? {} : { type: TYPE }),
    // Omitted rather than sent empty: the API validates `date` when present,
    // and publish() stamps published_at itself.
    ...(form.publishedAt ? { published_at: form.publishedAt } : {}),
  }

  try {
    await apiFetch(isEdit.value ? `/admin/content/${pageId.value}` : '/admin/content', {
      method: isEdit.value ? 'PATCH' : 'POST',
      token: auth.accessToken,
      body,
    })
    router.push({ name: 'pages' })
  } catch (err) {
    fieldErrors.value = err.errors || {}
    error.value = err.message || 'Unable to save this page. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

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

      <form v-else class="grid" @submit.prevent="save">
        <!-- Main column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">Page Content</h3>

            <div class="field">
              <label for="title">Title</label>
              <input
                id="title"
                v-model="form.title"
                type="text"
                maxlength="255"
                placeholder="e.g. About Us"
                :class="{ 'is-invalid': firstError('title') }"
              />
              <p v-if="firstError('title')" class="field__error">{{ firstError('title') }}</p>
            </div>

            <div class="field">
              <label for="body">Body</label>
              <textarea
                id="body"
                v-model="form.body"
                rows="18"
                placeholder="The page content shown on your website…"
                :class="{ 'is-invalid': firstError('body') }"
              ></textarea>
              <p v-if="firstError('body')" class="field__error">{{ firstError('body') }}</p>
              <p class="field__hint">
                Plain text. Whatever your website renders for this page is stored here as-is.
              </p>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Publishing</h3>

            <div class="field">
              <label for="status">Status</label>
              <Select v-model="form.status">
                <!-- id keeps the <label for="status"> association: a <button>
                     is a labelable element, so the label still focuses it. -->
                <SelectTrigger
                  id="status"
                  :class="[FORM_SELECT.trigger, firstError('status') && INVALID_TRIGGER]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent :class="FORM_SELECT.content">
                  <SelectItem
                    v-for="opt in statuses"
                    :key="opt.value"
                    :value="opt.value"
                    :class="FORM_SELECT.item"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="firstError('status')" class="field__error">{{ firstError('status') }}</p>
            </div>

            <div class="field">
              <label for="published-at">Publish date</label>
              <input
                id="published-at"
                v-model="form.publishedAt"
                type="datetime-local"
                :class="{ 'is-invalid': firstError('published_at') }"
              />
              <p v-if="firstError('published_at')" class="field__error">
                {{ firstError('published_at') }}
              </p>
              <p class="field__hint">
                Optional. Leave empty and publishing from the list stamps the date for you.
              </p>
            </div>
          </section>

          <div class="actions">
            <BaseButton type="submit" variant="primary" block :disabled="!canSave">
              {{ saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Page' }}
            </BaseButton>
            <BaseButton type="button" variant="ghost" block @click="router.push({ name: 'pages' })">
              Cancel
            </BaseButton>
          </div>
        </div>
      </form>
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

    &:hover { color: var(--text-strong); }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
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
  gap: 0.4rem;

  & + & { margin-top: 1rem; }

  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-body);
  }

  input,
  textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    font-family: inherit;
    font-size: 0.88rem;
    color: var(--text-strong);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 10px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    &.is-invalid {
      border-color: var(--danger);
      box-shadow: 0 0 0 3px rgb(var(--danger-rgb) / 0.14);
    }
  }

  textarea {
    resize: vertical;
    line-height: 1.55;
  }

  &__error {
    margin: 0;
    font-size: 0.76rem;
    color: var(--danger);
  }

  &__hint {
    margin: 0;
    font-size: 0.76rem;
    color: var(--text-subtle);
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
</style>
