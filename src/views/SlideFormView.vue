<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import SlideImagesField from '@/components/slides/SlideImagesField.vue'
import SlideSequence from '@/components/slides/SlideSequence.vue'
import { DEFAULT_GRADIENT, deleteSlide, fetchSlide, saveSlide } from '@/services/slides'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isEdit = computed(() => Boolean(route.params.id))

// 'Scheduled' only differs from 'Active' by having a future start date, so the
// date fields below are what make the choice mean anything.
const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
]

const form = reactive({
  title: '',
  subtitle: '',
  cta: '',
  ctaUrl: '',
  status: 'draft',
  images: [],
  durationMs: 3000,
  transition: 'fade',
  gradient: DEFAULT_GRADIENT,
  startDate: '',
  endDate: '',
})

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const pageTitle = computed(() =>
  isEdit.value ? `Edit Slide: ${form.title || 'Slide'}` : 'New Slide',
)

const statusLabels = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', draft: 'Draft' }

// The API rejects an end date before the start date, so catch it here rather
// than on a round trip.
const dateProblem = computed(() => {
  if (!form.startDate || !form.endDate) return ''
  return form.endDate < form.startDate ? 'The end date cannot fall before the start date.' : ''
})

// Prefill when editing. The fetched slide is copied field by field so the
// reactive form owns its own `images` array.
async function loadSlide() {
  loading.value = true
  error.value = ''
  try {
    const existing = await fetchSlide(route.params.id, auth.accessToken)
    Object.assign(form, { ...existing, images: [...existing.images] })
  } catch (err) {
    error.value = err.message || 'Could not load this slide.'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (dateProblem.value) {
    error.value = dateProblem.value
    return
  }

  saving.value = true
  error.value = ''
  try {
    await saveSlide(isEdit.value ? route.params.id : null, form, auth.accessToken)
    router.push('/slides')
  } catch (err) {
    error.value = err.message || 'Could not save the slide.'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!window.confirm('Delete this slide? This cannot be undone.')) return

  error.value = ''
  try {
    await deleteSlide(route.params.id, auth.accessToken)
    router.push('/slides')
  } catch (err) {
    error.value = err.message || 'Could not delete the slide.'
  }
}

onMounted(() => {
  if (isEdit.value) loadSlide()
})
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/slides" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Content &middot; Homepage Slides</span>
            <span class="subhead__title">{{ form.title || 'New Slide' }}</span>
          </span>
        </RouterLink>

        <div class="subhead__actions">
          <BaseButton v-if="isEdit" variant="danger" @click="remove">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
            Delete Slide
          </BaseButton>
          <BaseButton variant="primary" :disabled="saving || loading" @click="save">
            {{ saving ? 'Saving…' : isEdit ? 'Update Slide' : 'Create Slide' }}
          </BaseButton>
        </div>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="grid">
        <!-- Main column -->
        <div class="col">
          <section class="card">
            <h3 class="card__title">Slide Content</h3>
            <div class="field">
              <label for="title">Title</label>
              <input id="title" v-model="form.title" type="text" placeholder="e.g. Ultimate Gaming Setup 2024" />
            </div>
            <div class="field">
              <label for="subtitle">Subtitle</label>
              <textarea id="subtitle" v-model="form.subtitle" rows="2" placeholder="A short supporting line shown under the title..."></textarea>
            </div>
            <div class="field">
              <label for="cta">CTA Button Label</label>
              <input id="cta" v-model="form.cta" type="text" placeholder="e.g. Shop Now" />
            </div>
            <div class="field">
              <label for="cta-url">CTA Link</label>
              <input id="cta-url" v-model="form.ctaUrl" type="text" placeholder="e.g. /products or https://..." />
            </div>
          </section>

          <!-- Live preview -->
          <section class="card">
            <h3 class="card__title">Preview</h3>
            <div class="preview" :style="!form.images.length ? { background: form.gradient } : null">
              <SlideSequence
                :images="form.images"
                :duration-ms="form.durationMs"
                :transition="form.transition"
                :alt="form.title"
              />
              <div class="preview__overlay">
                <span class="badge" :class="`badge--${form.status}`">{{ statusLabels[form.status] }}</span>
                <h4 class="preview__title">{{ form.title || 'Slide title' }}</h4>
                <p class="preview__subtitle">{{ form.subtitle || 'Slide subtitle goes here' }}</p>
                <span class="preview__cta">{{ form.cta || 'Call to action' }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Status</h3>
            <div class="field">
              <label for="status">Slide Status</label>
              <div class="select-wrap">
                <select id="status" v-model="form.status">
                  <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </div>
            </div>

            <div class="field">
              <label for="start-date">Start Date</label>
              <input id="start-date" v-model="form.startDate" type="date" />
            </div>
            <div class="field">
              <label for="end-date">End Date</label>
              <input id="end-date" v-model="form.endDate" type="date" />
            </div>

            <p v-if="dateProblem" class="card__error" role="alert">{{ dateProblem }}</p>
            <p v-else class="card__hint">
              Leave both dates empty to run the slide indefinitely. A start date in the future is
              what makes a slide &ldquo;Scheduled&rdquo;.
            </p>
          </section>

          <section class="card">
            <h3 class="card__title">Slide Images</h3>
            <SlideImagesField
              v-model:images="form.images"
              v-model:duration-ms="form.durationMs"
              v-model:transition="form.transition"
            />
            <p class="card__hint">
              Add two or more images and the slide plays them as a looping sequence. Recommended:
              1600x700px.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.form-error {
  margin: 0;
  font-size: 0.82rem;
  color: var(--danger);
}


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

.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__back {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;

    &:hover { text-decoration: none; }

    svg { width: 22px; height: 22px; stroke: var(--text-muted); stroke-width: 1.8; }
    span { display: flex; flex-direction: column; line-height: 1.2; }
  }

  &__crumb {
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__title { font-size: 1.1rem; font-weight: 700; color: var(--text-strong); }
  &__actions { display: flex; gap: 0.6rem; }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 920px) { grid-template-columns: 1fr; }
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
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--text-subtle);
  }

  &__error {
    margin: 0.75rem 0 0;
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--danger);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & + .field { margin-top: 1rem; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  input,
  textarea,
  select {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  textarea { resize: vertical; line-height: 1.5; }
}

.select-wrap {
  position: relative;

  select { appearance: none; padding-right: 2.2rem; cursor: pointer; }

  svg {
    position: absolute;
    top: 50%;
    right: 0.8rem;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    stroke: var(--text-subtle);
    stroke-width: 1.8;
    pointer-events: none;
  }
}

/* Preview */
.preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 7;
  border-radius: 12px;
  overflow: hidden;
  background: var(--border-subtle);

  &__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0.55rem;
    padding: 1.75rem;
    background: linear-gradient(90deg, var(--backdrop) 0%, rgba(10, 12, 18, 0.1) 100%);
    color: var(--ink-on-solid);
  }

  &__title { margin: 0; font-size: 1.5rem; font-weight: 800; }
  &__subtitle { margin: 0; font-size: 0.92rem; opacity: 0.92; max-width: 70%; }

  &__cta {
    margin-top: 0.3rem;
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--ink-on-accent);
    background: rgb(var(--accent-rgb));
    border-radius: 8px;
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

  &--active { color: var(--success); background: var(--success-bg); }
  &--scheduled { color: var(--info); background: var(--info-bg); }
  &--draft { color: var(--text-muted); background: var(--surface-track); }
}
</style>
