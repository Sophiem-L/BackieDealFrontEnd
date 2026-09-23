<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
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

const pageTypes = [
  { value: 'about-us', label: 'About Us' },
  { value: 'contact-us', label: 'Contact Us' },
  { value: 'terms-and-conditions', label: 'Terms & Conditions' },
  { value: 'privacy-policy', label: 'Privacy Policy' },
  { value: 'shipping-policy', label: 'Shipping Policy' },
  { value: 'returns-policy', label: 'Returns Policy' },
  { value: 'warranty-policy', label: 'Warranty Policy' },
  { value: 'faq', label: 'FAQ' },
  { value: 'support', label: 'Support' },
  { value: 'delivery-information', label: 'Delivery Information' },
  { value: 'size-guide', label: 'Size Guide' },
  { value: 'careers', label: 'Careers' },
]

function slugToLabel(slug = '') {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const existingPageSlugs = ref(new Set())
const pageOptions = ref([...pageTypes])
const availablePageTypes = computed(() => {
  const currentSlug = form.slug?.trim()
  const uniqueOptions = new Map()

  for (const option of pageOptions.value) {
    if (!option?.value) continue
    if (!uniqueOptions.has(option.value)) {
      uniqueOptions.set(option.value, option)
    }
  }

  return [...uniqueOptions.values()].filter((pageType) => {
    if (currentSlug && pageType.value === currentSlug) return true
    return !existingPageSlugs.value.has(pageType.value)
  })
})

// The scoped `.is-invalid` rule below only reaches native controls; the Select
// trigger is a Tailwind-styled button, so its error state is expressed the same
// way FORM_SELECT expresses its focus ring.
const INVALID_TRIGGER = 'border-[var(--danger)] shadow-[0_0_0_3px_rgb(var(--danger-rgb)/0.14)]'

const form = reactive({
  slug: isEdit.value ? '' : 'about-us',
  title: '',
  body: '',
  status: 'draft',
  // datetime-local wants `YYYY-MM-DDTHH:mm`; empty means "leave it to the API".
  publishedAt: '',
})

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const editorRef = ref(null)
// Keyed by field name, straight from the API's 422 body.
const fieldErrors = ref({})

function syncEditorContent() {
  if (!editorRef.value) return
  const html = form.body || ''
  if (editorRef.value.innerHTML !== html) {
    editorRef.value.innerHTML = html
  }
}

function applyEditorCommand(command, value = null) {
  if (!editorRef.value) return
  editorRef.value.focus()
  document.execCommand(command, false, value)
  form.body = editorRef.value.innerHTML
}

function onEditorInput() {
  form.body = editorRef.value?.innerHTML ?? ''
}

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

async function loadExistingPageSlugs() {
  try {
    const response = await apiFetch('/admin/content?type=page&per_page=200', { token: auth.accessToken })
    const rows = Array.isArray(response?.data) ? response.data : response?.data?.items ?? []
    const used = new Set(
      rows
        .map((item) => item?.slug)
        .filter((slug) => typeof slug === 'string' && slug.trim().length > 0)
        .map((slug) => slug.trim()),
    )

    if (isEdit.value) {
      const currentPage = rows.find((item) => String(item?.id) === String(pageId.value))
      if (currentPage?.slug) {
        used.delete(currentPage.slug.trim())
      }
    }

    existingPageSlugs.value = used

    const dynamicOptions = rows
      .map((item) => item?.slug)
      .filter((slug) => typeof slug === 'string' && slug.trim().length > 0)
      .map((slug) => ({ value: slug.trim(), label: slugToLabel(slug.trim()) }))

    const merged = [...pageTypes, ...dynamicOptions]
    const unique = new Map()
    for (const option of merged) {
      if (!option?.value) continue
      if (!unique.has(option.value)) unique.set(option.value, option)
    }

    pageOptions.value = [...unique.values()]
  } catch (err) {
    existingPageSlugs.value = new Set()
    pageOptions.value = [...pageTypes]
  }
}

async function loadPage() {
  if (!isEdit.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/content/${pageId.value}`, { token: auth.accessToken })
    const data = response?.data
    Object.assign(form, {
      slug: data?.slug ?? '',
      title: data?.title ?? '',
      body: data?.body ?? '',
      status: data?.status ?? 'draft',
      publishedAt: toLocalInput(data?.published_at),
    })
    await nextTick()
    syncEditorContent()
  } catch (err) {
    error.value =
      err.status === 404
        ? 'That page no longer exists.'
        : err.message || 'Unable to load this page. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadExistingPageSlugs(), loadPage()])
})

watch(
  availablePageTypes,
  (options) => {
    if (isEdit.value) return
    if (!options.length) {
      form.slug = ''
      return
    }

    const currentSlug = form.slug?.trim()
    if (!currentSlug || !options.some((option) => option.value === currentSlug)) {
      form.slug = options[0].value
    }
  },
  { immediate: true },
)

watch(
  () => form.body,
  () => {
    nextTick(() => syncEditorContent())
  },
)

const pageTitle = computed(() => (isEdit.value ? `Edit Page: ${form.title || 'Page'}` : 'New Page'))
const pageTypeLabel = computed(
  () => pageTypes.find((pageType) => pageType.value === form.slug)?.label ?? 'Policy page',
)
const bodyLength = computed(() => form.body.length)

const canSave = computed(() => form.title.trim().length > 0 && !saving.value && !loading.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  fieldErrors.value = {}

  // `type` is sent on create only — an edit must not be able to turn a page
  // into a news article by accident.
  const body = {
    ...(form.slug ? { slug: form.slug } : {}),
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
      <div class="subhead">
        <RouterLink :to="{ name: 'pages' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="subhead__crumb">Back to Pages</span>
        </RouterLink>
      </div>

      <section class="page-intro" aria-labelledby="policy-heading">
        <div>
          <p class="page-intro__eyebrow">Storefront content / policy</p>
          <h2 id="policy-heading">{{ pageTitle }}</h2>
          <p class="page-intro__description">
            Keep the policy clear, current, and ready for customers across every storefront touchpoint.
          </p>
        </div>
        <span class="page-intro__type">{{ pageTypeLabel }}</span>
      </section>

      <p v-if="error" class="alert" role="alert" aria-live="assertive">{{ error }}</p>
      <p v-if="loading" class="loading" role="status">Loading policy…</p>

      <form v-else class="policy-form" @submit.prevent="save">
        <div class="grid">
          <!-- Main column -->
          <div class="col col--main">
            <section class="card">
              <div class="card__heading">
                <div>
                  <p class="card__eyebrow">Customer-facing copy</p>
                  <h3 class="card__title">Policy content</h3>
                </div>
                <span class="card__status">{{ bodyLength.toLocaleString() }} characters</span>
              </div>

              <div class="field">
                <label for="page-type">Page selector</label>
                <Select v-model="form.slug">
                  <SelectTrigger id="page-type" :class="FORM_SELECT.trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent :class="FORM_SELECT.content">
                    <SelectItem
                      v-for="pageType in availablePageTypes"
                      :key="pageType.value"
                      :value="pageType.value"
                      :class="FORM_SELECT.item"
                    >
                      {{ pageType.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p v-if="firstError('slug')" class="field__error">{{ firstError('slug') }}</p>
              </div>

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
                <div class="field__label-row">
                  <label for="body">Policy content</label>
                  <span class="field__format">Rich text</span>
                </div>
                <div class="editor-shell" :class="{ 'editor-shell--invalid': firstError('body') }">
                  <div class="editor-shell__toolbar" role="toolbar" aria-label="Text formatting tools">
                    <button type="button" class="editor-tool" @click="applyEditorCommand('bold')">Bold</button>
                    <button type="button" class="editor-tool" @click="applyEditorCommand('italic')">Italic</button>
                    <button type="button" class="editor-tool" @click="applyEditorCommand('underline')">Underline</button>
                    <button type="button" class="editor-tool" @click="applyEditorCommand('insertUnorderedList')">Bullets</button>
                    <button type="button" class="editor-tool" @click="applyEditorCommand('formatBlock', 'p')">Paragraph</button>
                    <span class="editor-shell__toolbar-note">Rich text editor</span>
                  </div>
                  <div
                    id="body"
                    ref="editorRef"
                    class="editor-content"
                    contenteditable="true"
                    role="textbox"
                    aria-label="Policy content"
                    aria-multiline="true"
                    :aria-invalid="Boolean(firstError('body'))"
                    @input="onEditorInput"
                  ></div>
                </div>
                <p v-if="firstError('body')" class="field__error">{{ firstError('body') }}</p>
                <p class="field__hint">
                  Add headings, lists, and emphasis to keep the policy easier to scan and easier to trust.
                </p>
              </div>
            </section>

            <aside class="editor-note" aria-label="Publishing guidance">
              <span class="editor-note__icon">i</span>
              <p><strong>Keep it easy to scan.</strong> Put the most important customer guidance first and review dates whenever policy terms change.</p>
            </aside>
          </div>

          <!-- Side column -->
          <div class="col col--side">
            <section class="card">
              <div class="card__heading">
                <div>
                  <p class="card__eyebrow">Visibility</p>
                  <h3 class="card__title">Publishing</h3>
                </div>
                <span class="status-dot" :class="`status-dot--${form.status}`"></span>
              </div>

              <div class="field">
                <label for="status">Publishing status</label>
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
                <label for="published-at">Publish date and time</label>
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
                  Optional. Publishing from the list stamps the current date and time when left empty.
                </p>
              </div>
            </section>

            <section class="card card--checklist">
              <p class="card__eyebrow">Before publishing</p>
              <ul class="checklist">
                <li><span class="checklist__mark">✓</span> Page type is selected</li>
                <li><span class="checklist__mark">✓</span> Customer language is clear</li>
                <li><span class="checklist__mark">✓</span> Content is ready to share</li>
              </ul>
            </section>
          </div>
        </div>

        <div class="form-footer">
          <span class="form-footer__hint">Changes are saved to the selected page.</span>
          <BaseButton type="button" variant="ghost" @click="router.push({ name: 'pages' })">
            Cancel
          </BaseButton>
          <BaseButton type="submit" variant="primary" :disabled="!canSave" :aria-busy="saving">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5 9.5 17 19 7.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
            {{ saving ? 'Saving…' : isEdit ? 'Update Page' : 'Create Page' }}
          </BaseButton>
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
  gap: 0.4rem;

  & + & {
    margin-top: 1rem;
  }

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
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

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

  .editor-content {
    min-height: 300px;
    padding: 1rem;
    background: transparent;
    color: var(--text-strong);
    line-height: 1.6;
    outline: none;

    &:empty::before {
      content: 'Write the policy customers will read…';
      color: var(--text-subtle);
      pointer-events: none;
    }

    p {
      margin: 0 0 0.8rem;
    }

    ul,
    ol {
      margin: 0.6rem 0 0.8rem 1.25rem;
      padding: 0;
    }

    strong,
    b {
      font-weight: 700;
    }

    em,
    i {
      font-style: italic;
    }

    u {
      text-decoration: underline;
    }
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

.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 1rem 1.15rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  &__hint {
    margin-right: auto;
    color: var(--text-subtle);
    font-size: 0.76rem;
  }
}

.page-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.35rem 0 0.25rem;

  h2 {
    margin: 0.2rem 0 0;
    color: var(--text-strong);
    font-size: clamp(1.35rem, 2vw, 1.75rem);
    letter-spacing: 0;
    line-height: 1.2;
  }

  &__eyebrow,
  &__description {
    margin: 0;
  }

  &__eyebrow,
  .card__eyebrow {
    color: var(--accent-ink);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__description {
    max-width: 620px;
    margin-top: 0.55rem;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  &__type {
    flex-shrink: 0;
    padding: 0.45rem 0.7rem;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.12);
    border: 1px solid rgb(var(--accent-rgb) / 0.28);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
  }
}

.card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;

  .card__title {
    margin: 0.2rem 0 0;
  }
}

.card__eyebrow {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.card__status {
  padding-top: 0.25rem;
  color: var(--text-subtle);
  font-size: 0.72rem;
  white-space: nowrap;
}

.field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.field__format {
  color: var(--text-subtle);
  font-size: 0.7rem;
}

.editor-shell {
  overflow: hidden;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 11px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus-within {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.16);
  }

  &--invalid {
    border-color: var(--danger);
    box-shadow: 0 0 0 3px rgb(var(--danger-rgb) / 0.14);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 38px;
    padding: 0.35rem 0.55rem;
    color: var(--text-subtle);
    background: var(--surface-sunken);
    border-bottom: 1px solid var(--border-subtle);
    font-size: 0.72rem;
  }

  .editor-content {
    display: block;
    min-height: 300px;
    padding: 1rem;
    background: transparent;
    border: 0;
    border-radius: 0;
    outline: none;
    line-height: 1.6;
    color: var(--text-strong);

    &:empty::before {
      content: 'Write the policy customers will read…';
      color: var(--text-subtle);
      pointer-events: none;
    }

    p {
      margin: 0 0 0.8rem;
    }

    ul,
    ol {
      margin: 0.6rem 0 0.8rem 1.25rem;
      padding: 0;
    }

    strong,
    b {
      font-weight: 700;
    }

    em,
    i {
      font-style: italic;
    }

    u {
      text-decoration: underline;
    }
  }
}

.editor-tool {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  color: var(--text-body);
  border-radius: 6px;
  padding: 0.3rem 0.45rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;

  &:hover {
    background: var(--surface-hover);
  }
}

.editor-shell__toolbar-note {
  margin-left: auto;
  color: var(--text-subtle);
  font-size: 0.68rem;
}

.editor-note {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 0.95rem;
  color: var(--text-muted);
  background: rgb(var(--accent-rgb) / 0.07);
  border: 1px solid rgb(var(--accent-rgb) / 0.18);
  border-radius: 10px;
  font-size: 0.78rem;
  line-height: 1.5;

  p { margin: 0; }
  strong { color: var(--text-body); }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--accent-ink);
    border: 1px solid currentColor;
    border-radius: 50%;
    font-size: 0.68rem;
    font-weight: 700;
  }
}

.status-dot {
  width: 9px;
  height: 9px;
  margin-top: 0.3rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--text-subtle);

  &--published { background: var(--success); box-shadow: 0 0 0 4px rgb(var(--success-rgb) / 0.12); }
  &--draft { background: var(--accent-ink); box-shadow: 0 0 0 4px rgb(var(--accent-rgb) / 0.12); }
  &--archived { background: var(--text-subtle); }
}

.card--checklist {
  padding-bottom: 1rem;
}

.checklist {
  display: grid;
  gap: 0.65rem;
  margin: 0.85rem 0 0;
  padding: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  &__mark {
    color: var(--success);
    font-weight: 800;
  }
}

@media (max-width: 620px) {
  .page__body { padding: 1rem; gap: 1rem; }
  .page-intro { align-items: flex-start; flex-direction: column; gap: 0.75rem; }
  .page-intro__type { align-self: flex-start; }
  .card { padding: 1rem; border-radius: 12px; }
  .form-footer { align-items: stretch; flex-wrap: wrap; }
  .form-footer__hint { width: 100%; margin-bottom: 0.15rem; }
  .form-footer .btn { flex: 1; }
}
</style>
