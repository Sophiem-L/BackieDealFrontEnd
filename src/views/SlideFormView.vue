<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { createSlide, findSlide, removeSlide } from '@/data/slides'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => Boolean(route.params.id))

const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
]

const gradients = [
  'linear-gradient(135deg, #1b2a4a 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #d9c7a8 0%, #8a6f4d 100%)',
  'linear-gradient(135deg, #7c1f9e 0%, #e0218a 100%)',
  'linear-gradient(135deg, #b08968 0%, #7f5539 100%)',
  'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
  'linear-gradient(135deg, #be123c 0%, #fb7185 100%)',
]

const form = reactive({
  title: '',
  subtitle: '',
  cta: '',
  status: 'draft',
  image: '',
  gradient: gradients[0],
})

// Prefill when editing.
if (isEdit.value) {
  const existing = findSlide(route.params.id)
  if (existing) {
    Object.assign(form, {
      title: existing.title,
      subtitle: existing.subtitle,
      cta: existing.cta,
      status: existing.status,
      image: existing.image,
      gradient: existing.gradient,
    })
  }
}

const pageTitle = computed(() =>
  isEdit.value ? `Edit Slide: ${form.title || 'Slide'}` : 'New Slide',
)

const statusLabels = { active: 'Active', scheduled: 'Scheduled', draft: 'Draft' }

const imageInput = ref(null)
function pickImage() {
  imageInput.value?.click()
}
function onImageChange(event) {
  const file = event.target.files?.[0]
  if (file) form.image = URL.createObjectURL(file)
}
function clearImage(event) {
  event.stopPropagation()
  form.image = ''
  if (imageInput.value) imageInput.value.value = ''
}

function save() {
  const payload = {
    title: form.title.trim() || 'Untitled Slide',
    subtitle: form.subtitle.trim(),
    cta: form.cta.trim() || 'Learn More',
    status: form.status,
    image: form.image,
    gradient: form.gradient,
  }

  if (isEdit.value) {
    const existing = findSlide(route.params.id)
    if (existing) Object.assign(existing, payload)
  } else {
    createSlide(payload)
  }
  router.push('/slides')
}

function remove() {
  if (!window.confirm('Delete this slide? This cannot be undone.')) return
  removeSlide(route.params.id)
  router.push('/slides')
}
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
          <BaseButton variant="primary" @click="save">
            {{ isEdit ? 'Update Slide' : 'Create Slide' }}
          </BaseButton>
        </div>
      </div>

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
          </section>

          <!-- Live preview -->
          <section class="card">
            <h3 class="card__title">Preview</h3>
            <div class="preview" :style="!form.image ? { background: form.gradient } : null">
              <img v-if="form.image" :src="form.image" :alt="form.title" class="preview__img" />
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
          </section>

          <section class="card">
            <h3 class="card__title">Slide Image</h3>
            <button
              type="button"
              class="cover"
              :class="{ 'cover--image': form.image }"
              :style="form.image ? null : { background: form.gradient }"
              @click="pickImage"
            >
              <img v-if="form.image" :src="form.image" alt="Slide preview" class="cover__img" />
              <span class="cover__upload">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
                </svg>
                {{ form.image ? 'Change image' : 'Upload image' }}
              </span>
              <span
                v-if="form.image"
                class="cover__remove"
                role="button"
                aria-label="Remove image"
                @click="clearImage"
              >
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
              </span>
            </button>
            <p class="card__hint">No image? Pick a gradient background below. Recommended: 1600x700px.</p>
          </section>

          <section class="card">
            <h3 class="card__title">Gradient Background</h3>
            <div class="swatches">
              <button
                v-for="(g, i) in gradients"
                :key="i"
                type="button"
                class="swatch"
                :class="{ 'swatch--active': form.gradient === g && !form.image }"
                :style="{ background: g }"
                :aria-label="`Gradient ${i + 1}`"
                @click="form.gradient = g"
              ></button>
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

  &__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

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

/* Image upload */
.cover {
  position: relative;
  width: 100%;
  height: 130px;
  padding: 0;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;

  &:hover .cover__upload { opacity: 1; }

  &__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__upload {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-on-solid);
    background: var(--backdrop);
    opacity: 0;
    transition: opacity 0.15s ease;

    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__remove {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--backdrop);
    color: var(--ink-on-solid);
    cursor: pointer;

    &:hover { background: var(--danger); }

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; }
  }
}

/* Gradient swatches */
.swatches {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.swatch {
  height: 46px;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover { transform: translateY(-1px); }

  &--active {
    border-color: var(--text-strong);
    box-shadow: 0 0 0 2px var(--surface) inset;
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
