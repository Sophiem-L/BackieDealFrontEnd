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

// One component serves both routes: /news/new has no :id, /news/:id/edit does.
const articleId = computed(() => route.params.id ?? null)
const isEdit = computed(() => Boolean(articleId.value))

// Every row this screen writes is a `news` article; Pages owns type `page`.
const TYPE = 'news'

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

const categories = [
  'Product News',
  'Guides',
  'Reviews',
  'Promotions',
  'Company',
  'Announcements',
]

// The scoped `.is-invalid` rule below only reaches native controls; the Select
// trigger is a Tailwind-styled button, so its error state is expressed the same
// way FORM_SELECT expresses its focus ring.
const INVALID_TRIGGER =
  'border-[var(--danger)] shadow-[0_0_0_3px_rgb(var(--danger-rgb)/0.14)]'

const form = reactive({
  title: '',
  body: '',
  category: 'Product News',
  imageUrl: '',
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

async function loadArticle() {
  if (!isEdit.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/content/${articleId.value}`, { token: auth.accessToken })
    const data = response?.data
    Object.assign(form, {
      title: data?.title ?? '',
      body: data?.body ?? '',
      category: data?.category ?? 'Product News',
      imageUrl: data?.image_url ?? '',
      status: data?.status ?? 'draft',
      publishedAt: toLocalInput(data?.published_at),
    })
  } catch (err) {
    error.value =
      err.status === 404
        ? 'That article no longer exists.'
        : err.message || 'Unable to load this article. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(loadArticle)

const pageTitle = computed(() =>
  isEdit.value ? `Edit Article: ${form.title || 'Article'}` : 'New Article',
)

const canSave = computed(() => form.title.trim().length > 0 && !saving.value && !loading.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  fieldErrors.value = {}

  // `type` is sent on create only — an edit must not be able to turn a news
  // article into a page by accident.
  const body = {
    title: form.title.trim(),
    body: form.body,
    category: form.category,
    image_url: form.imageUrl.trim() || null,
    status: form.status,
    ...(isEdit.value ? {} : { type: TYPE }),
    // Omitted rather than sent empty: the API validates `date` when present,
    // and publish() stamps published_at itself.
    ...(form.publishedAt ? { published_at: form.publishedAt } : {}),
  }

  try {
    await apiFetch(isEdit.value ? `/admin/content/${articleId.value}` : '/admin/content', {
      method: isEdit.value ? 'PATCH' : 'POST',
      token: auth.accessToken,
      body,
    })
    router.push({ name: 'news' })
  } catch (err) {
    fieldErrors.value = err.errors || {}
    error.value = err.message || 'Unable to save this article. Please try again.'
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
        <RouterLink :to="{ name: 'news' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="subhead__crumb">Back to News</span>
        </RouterLink>
      </div>

      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="loading" class="loading">Loading article…</p>

      <form v-else class="grid" @submit.prevent="save">
        <!-- Main column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">Article Content</h3>

            <div class="field">
              <label for="title">Title</label>
              <input
                id="title"
                v-model="form.title"
                type="text"
                maxlength="255"
                placeholder="e.g. RTX 50-Series Graphics Cards Now In Stock"
                :class="{ 'is-invalid': firstError('title') }"
              />
              <p v-if="firstError('title')" class="field__error">{{ firstError('title') }}</p>
            </div>

            <div class="field">
              <label for="body">Body</label>
              <textarea
                id="body"
                v-model="form.body"
                rows="16"
                placeholder="Write your article here…"
                :class="{ 'is-invalid': firstError('body') }"
              ></textarea>
              <p v-if="firstError('body')" class="field__error">{{ firstError('body') }}</p>
              <p class="field__hint">
                Plain text. Whatever your website renders for this article is stored here as-is.
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

          <section class="card">
            <h3 class="card__title">Category</h3>
            <div class="field">
              <label for="category">Article category</label>
              <Select v-model="form.category">
                <SelectTrigger
                  id="category"
                  :class="[FORM_SELECT.trigger, firstError('category') && INVALID_TRIGGER]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent :class="FORM_SELECT.content">
                  <SelectItem
                    v-for="opt in categories"
                    :key="opt"
                    :value="opt"
                    :class="FORM_SELECT.item"
                  >
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="firstError('category')" class="field__error">{{ firstError('category') }}</p>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Cover Image</h3>

            <div
              v-if="form.imageUrl"
              class="cover-preview"
              :style="{ backgroundImage: `url(${form.imageUrl})` }"
            ></div>

            <div class="field">
              <label for="image-url">Image URL</label>
              <input
                id="image-url"
                v-model="form.imageUrl"
                type="url"
                maxlength="2048"
                placeholder="https://…"
                :class="{ 'is-invalid': firstError('image_url') }"
              />
              <p v-if="firstError('image_url')" class="field__error">
                {{ firstError('image_url') }}
              </p>
              <p class="field__hint">
                Optional. Shown at the top of the article and in listings. Recommended: 1200x630px.
              </p>
            </div>
          </section>

          <div class="actions">
            <BaseButton type="submit" variant="primary" block :disabled="!canSave">
              {{ saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Article' }}
            </BaseButton>
            <BaseButton type="button" variant="ghost" block @click="router.push({ name: 'news' })">
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

.cover-preview {
  width: 100%;
  height: 130px;
  margin-bottom: 1rem;
  border-radius: 10px;
  background-color: var(--surface-alt);
  background-size: cover;
  background-position: center;
  border: 1px solid var(--border-subtle);
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
