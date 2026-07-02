<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { slides, removeSlide } from '@/data/slides'

const router = useRouter()

const statusLabels = {
  active: 'Active',
  scheduled: 'Scheduled',
  draft: 'Draft',
}

function addSlide() {
  router.push('/slides/new')
}

function viewSlide(slide) {
  router.push(`/slides/${slide.id}`)
}

function editSlide(slide) {
  router.push(`/slides/${slide.id}/edit`)
}

function deleteSlide(slide) {
  if (!window.confirm(`Delete slide "${slide.title}"? This cannot be undone.`)) return
  removeSlide(slide.id)
}
</script>

<template>
  <div class="page">
    <AppHeader title="Content: Homepage Slides" />

    <div class="page__body">
      <!-- Section heading + primary action -->
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">Homepage Carousel</h2>
          <p class="head__subtitle">Manage the main sliders on your computer shop homepage.</p>
        </div>

        <BaseButton variant="primary" @click="addSlide">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </template>
          Add New Slide
        </BaseButton>
      </section>

      <!-- Slides list -->
      <section class="slides">
        <article v-for="slide in slides" :key="slide.id" class="slide">
          <span class="slide__handle" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>

          <span
            class="slide__thumb"
            :style="!slide.image ? { background: slide.gradient } : null"
            role="button"
            :aria-label="`View ${slide.title}`"
            @click="viewSlide(slide)"
          >
            <img v-if="slide.image" :src="slide.image" :alt="slide.title" />
          </span>

          <div class="slide__body" role="button" @click="viewSlide(slide)">
            <span class="badge" :class="`badge--${slide.status}`">
              {{ statusLabels[slide.status] }}
            </span>
            <h3 class="slide__title">{{ slide.title }}</h3>
            <p class="slide__subtitle">{{ slide.subtitle }}</p>
          </div>

          <div class="slide__cta">
            <span class="slide__cta-label">CTA Button</span>
            <span class="slide__cta-pill">{{ slide.cta }}</span>
          </div>

          <div class="slide__actions">
            <button
              type="button"
              class="icon-btn"
              :aria-label="`Edit ${slide.title}`"
              @click="editSlide(slide)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke-linejoin="round" />
                <path d="m13.5 6.5 4 4" stroke-linecap="round" />
              </svg>
            </button>

            <button
              type="button"
              class="icon-btn icon-btn--danger"
              :aria-label="`Delete ${slide.title}`"
              @click="deleteSlide(slide)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M10 11v6M14 11v6" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </article>

        <p v-if="slides.length === 0" class="slides__empty">No slides yet.</p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
$accent: #f4c10f;
$muted: #8a909c;
$divider: #eef0f3;

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
    color: $color-text;
  }

  &__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: $muted;
  }
}

/* Slides list */
.slides {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__empty {
    margin: 0;
    text-align: center;
    color: $muted;
    font-size: 0.88rem;
    padding: 2.5rem 1rem;
    background: #fff;
    border: 1px solid $divider;
    border-radius: 14px;
  }
}

.slide {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 0.85rem 1rem 0.85rem 0.5rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: #e1e4e9;
    box-shadow: 0 2px 10px rgba(20, 23, 28, 0.05);
  }

  &__handle {
    flex-shrink: 0;
    display: inline-flex;
    color: #c4c9d1;
    cursor: grab;
    svg { width: 22px; height: 22px; }
  }

  &__thumb {
    flex-shrink: 0;
    width: 132px;
    height: 74px;
    border-radius: 10px;
    overflow: hidden;
    background: #eef0f3;
    cursor: pointer;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  &__body {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  &__title {
    margin: 0.4rem 0 0.2rem;
    font-size: 1rem;
    font-weight: 700;
    color: $color-text;
  }

  &__subtitle {
    margin: 0;
    font-size: 0.82rem;
    color: $muted;
  }

  &__cta {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
  }

  &__cta-label {
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #9099a6;
  }

  &__cta-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #1f242d;
    background: #f1f3f5;
    border: 1px solid #e6e8ec;
    border-radius: 8px;
  }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

@media (max-width: 760px) {
  .slide {
    flex-wrap: wrap;
    &__body { flex-basis: 100%; order: 3; }
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

  &--active { color: #1c8c4a; background: #e7f6ed; }
  &--scheduled { color: #2563c9; background: #eaf1fd; }
  &--draft { color: #6b7280; background: #f1f3f5; }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  color: #4a5160;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { background: #f6f7f9; }

  svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.7; }

  &--danger {
    color: #d14343;
    &:hover { background: #fff5f5; border-color: #f0c9c9; }
  }
}
</style>
