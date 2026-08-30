<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { deleteSlide as removeSlide, fetchSlides, saveSlideOrder } from '@/services/slides'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const slides = ref([])
const loading = ref(false)
const error = ref('')
const deletingId = ref(null)

// Reordering is a `banners.update` action, same as the edit pencil.
const canReorder = computed(() => auth.hasPermission('banners.update'))

// Rows are only draggable while the pointer is down on their grip, so the
// buttons and text inside a row still behave normally.
const grabbedId = ref(null)
const dragFrom = ref(null)
const dragOver = ref(null)
const savingOrder = ref(false)

const statusLabels = {
  active: 'Active',
  scheduled: 'Scheduled',
  expired: 'Expired',
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

function grab(slide) {
  if (canReorder.value) grabbedId.value = slide.id
}

function onDragStart(index, event) {
  dragFrom.value = index
  event.dataTransfer.effectAllowed = 'move'
  // Firefox refuses to start a drag unless some data is attached.
  event.dataTransfer.setData('text/plain', String(index))
}

function onDragOver(index, event) {
  if (dragFrom.value === null) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOver.value = index
}

function onDragEnd() {
  grabbedId.value = null
  dragFrom.value = null
  dragOver.value = null
}

async function onDrop(index) {
  const from = dragFrom.value
  onDragEnd()
  if (from === null || from === index) return

  const previous = slides.value
  const next = [...previous]
  const [moved] = next.splice(from, 1)
  next.splice(index, 0, moved)

  // Show the new order straight away, then roll back if the save fails.
  slides.value = next
  savingOrder.value = true
  error.value = ''
  try {
    slides.value = await saveSlideOrder(next, auth.accessToken)
  } catch (err) {
    slides.value = previous
    error.value = err.message || 'Could not save the new order.'
  } finally {
    savingOrder.value = false
  }
}

async function loadSlides() {
  loading.value = true
  error.value = ''
  try {
    slides.value = await fetchSlides(auth.accessToken)
  } catch (err) {
    error.value = err.message || 'Could not load slides.'
  } finally {
    loading.value = false
  }
}

async function deleteSlide(slide) {
  if (!window.confirm(`Delete slide "${slide.title}"? This cannot be undone.`)) return

  deletingId.value = slide.id
  error.value = ''
  try {
    await removeSlide(slide.id, auth.accessToken)
    slides.value = slides.value.filter((item) => item.id !== slide.id)
  } catch (err) {
    error.value = err.message || 'Could not delete the slide.'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadSlides)
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

        <BaseButton v-if="auth.hasPermission('banners.create')" variant="primary" @click="addSlide">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </template>
          Add New Slide
        </BaseButton>
      </section>

      <p v-if="error" class="slides__error" role="alert">{{ error }}</p>

      <!-- Slides list -->
      <section class="slides">
        <p v-if="loading" class="slides__empty">Loading slides…</p>

        <article
          v-for="(slide, index) in slides"
          :key="slide.id"
          class="slide"
          :class="{
            'slide--dragging': dragFrom === index,
            'slide--drop-target': dragOver === index && dragFrom !== index,
          }"
          :draggable="grabbedId === slide.id"
          @dragstart="onDragStart(index, $event)"
          @dragover="onDragOver(index, $event)"
          @drop="onDrop(index)"
          @dragend="onDragEnd"
        >
          <span
            v-if="canReorder"
            class="slide__handle"
            :class="{ 'slide__handle--busy': savingOrder }"
            :title="`Drag to reorder ${slide.title}`"
            :aria-label="`Drag to reorder ${slide.title}`"
            @mousedown="grab(slide)"
            @mouseup="onDragEnd"
          >
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
            :style="!slide.images.length ? { background: slide.gradient } : null"
            role="button"
            :aria-label="`View ${slide.title}`"
            @click="viewSlide(slide)"
          >
            <img v-if="slide.images.length" :src="slide.images[0]" :alt="slide.title" />
            <span v-if="slide.images.length > 1" class="slide__frames">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
              </svg>
              {{ slide.images.length }}
            </span>
          </span>

          <div class="slide__body" role="button" @click="viewSlide(slide)">
            <span class="badge" :class="`badge--${slide.status}`">
              {{ statusLabels[slide.status] }}
            </span>
            <h3 class="slide__title">{{ slide.title }}</h3>
            <p class="slide__subtitle">{{ slide.subtitle }}</p>
          </div>

          <div class="slide__cta">
            <span class="slide__cta-pill">{{ slide.cta }}</span>
          </div>

          <div class="slide__actions">
            <button
              v-if="auth.hasPermission('banners.update')"
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
              v-if="auth.hasPermission('banners.delete')"
              type="button"
              class="icon-btn icon-btn--danger"
              :disabled="deletingId === slide.id"
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

        <p v-if="!loading && slides.length === 0" class="slides__empty">No slides yet.</p>
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

/* Slides list */
.slides {
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

  &__error {
    margin: 0;
    font-size: 0.82rem;
    color: var(--danger);
  }
}

.slide {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem 0.85rem 0.5rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--border);
    box-shadow: 0 2px 10px rgba(20, 23, 28, 0.05);
  }

  &__handle {
    flex-shrink: 0;
    display: inline-flex;
    color: var(--text-faint);
    cursor: grab;
    transition: color 0.15s ease;
    svg { width: 22px; height: 22px; }

    &:hover { color: var(--text-body); }
    &:active { cursor: grabbing; }

    &--busy { cursor: progress; }
  }

  &--dragging {
    opacity: 0.45;
  }

  /* Where the row will land if dropped now. */
  &--drop-target {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 1px rgb(var(--accent-rgb));
  }

  &__thumb {
    position: relative;
    flex-shrink: 0;
    width: 132px;
    height: 74px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--border-subtle);
    cursor: pointer;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  /* Frame count: the list stays static, so this is the only cue that a
     slide plays as a sequence. */
  &__frames {
    position: absolute;
    right: 0.3rem;
    bottom: 0.3rem;
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.1rem 0.35rem;
    font-size: 0.62rem;
    font-weight: 700;
    border-radius: 5px;
    color: var(--ink-on-solid);
    background: var(--backdrop);

    svg { width: 10px; height: 10px; }
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
    color: var(--text-strong);
  }

  &__subtitle {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-subtle);
  }

  &__cta {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  &__cta-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-strong);
    background: var(--surface-track);
    border: 1px solid var(--border);
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

  &--active { color: var(--success); background: var(--success-bg); }
  &--scheduled { color: var(--info); background: var(--info-bg); }
  &--expired { color: var(--danger); background: var(--danger-bg); }
  &--draft { color: var(--text-muted); background: var(--surface-track); }
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

  svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.7; }

  &--danger {
    color: var(--danger);
    &:hover { background: var(--danger-bg); border-color: var(--danger-border); }
  }
}
</style>
