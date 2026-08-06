<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { findSlide, removeSlide } from '@/data/slides'

const route = useRoute()
const router = useRouter()

const slide = computed(() => findSlide(route.params.id))

const statusLabels = {
  active: 'Active',
  scheduled: 'Scheduled',
  draft: 'Draft',
}

function editSlide() {
  router.push(`/slides/${route.params.id}/edit`)
}

function deleteSlide() {
  if (!slide.value) return
  if (!window.confirm(`Delete slide "${slide.value.title}"? This cannot be undone.`)) return
  removeSlide(route.params.id)
  router.push('/slides')
}
</script>

<template>
  <div class="page">
    <AppHeader title="Content: Homepage Slides" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/slides" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Content &middot; Homepage Slides</span>
            <span class="subhead__title">{{ slide ? slide.title : 'Slide not found' }}</span>
          </span>
        </RouterLink>

        <div v-if="slide" class="subhead__actions">
          <BaseButton variant="danger" @click="deleteSlide">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
            Delete
          </BaseButton>
          <BaseButton variant="primary" @click="editSlide">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke-linejoin="round" />
                <path d="m13.5 6.5 4 4" stroke-linecap="round" />
              </svg>
            </template>
            Edit Slide
          </BaseButton>
        </div>
      </div>

      <div v-if="slide" class="grid">
        <!-- Preview -->
        <section class="card card--preview">
          <h3 class="card__title">Preview</h3>
          <div class="preview" :style="!slide.image ? { background: slide.gradient } : null">
            <img v-if="slide.image" :src="slide.image" :alt="slide.title" class="preview__img" />
            <div class="preview__overlay">
              <span class="badge" :class="`badge--${slide.status}`">{{ statusLabels[slide.status] }}</span>
              <h4 class="preview__title">{{ slide.title }}</h4>
              <p class="preview__subtitle">{{ slide.subtitle }}</p>
              <span class="preview__cta">{{ slide.cta }}</span>
            </div>
          </div>
        </section>

        <!-- Details -->
        <section class="card">
          <h3 class="card__title">Slide Details</h3>
          <dl class="info">
            <div class="info__row"><dt>Title</dt><dd>{{ slide.title }}</dd></div>
            <div class="info__row"><dt>Subtitle</dt><dd>{{ slide.subtitle }}</dd></div>
            <div class="info__row">
              <dt>Status</dt>
              <dd><span class="badge" :class="`badge--${slide.status}`">{{ statusLabels[slide.status] }}</span></dd>
            </div>
            <div class="info__row"><dt>CTA Button</dt><dd>{{ slide.cta }}</dd></div>
            <div class="info__row"><dt>Slide ID</dt><dd>#{{ slide.id }}</dd></div>
          </dl>
        </section>
      </div>

      <!-- Not found -->
      <section v-else class="missing">
        <p class="missing__text">This slide doesn’t exist or has been removed.</p>
        <BaseButton variant="ghost" :to="{ name: 'slides' }">Back to Slides</BaseButton>
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
  grid-template-columns: 1fr 340px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 920px) { grid-template-columns: 1fr; }
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
    gap: 0.6rem;
    padding: 2rem;
    background: linear-gradient(90deg, var(--backdrop) 0%, rgba(10, 12, 18, 0.1) 100%);
    color: var(--ink-on-solid);
  }

  &__title { margin: 0; font-size: 1.6rem; font-weight: 800; }
  &__subtitle { margin: 0; font-size: 0.95rem; opacity: 0.92; max-width: 70%; }

  &__cta {
    margin-top: 0.4rem;
    display: inline-flex;
    align-items: center;
    padding: 0.55rem 1.1rem;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--ink-on-accent);
    background: rgb(var(--accent-rgb));
    border-radius: 8px;
  }
}

/* Details list */
.info {
  margin: 0;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem 0;

    & + & { border-top: 1px solid var(--border-subtle); }

    dt { font-size: 0.82rem; color: var(--text-subtle); flex-shrink: 0; }
    dd {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-strong);
      text-align: right;
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

  &--active { color: var(--success); background: var(--success-bg); }
  &--scheduled { color: var(--info); background: var(--info-bg); }
  &--draft { color: var(--text-muted); background: var(--surface-track); }
}

.missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  &__text { margin: 0; font-size: 0.9rem; color: var(--text-subtle); }
}
</style>
