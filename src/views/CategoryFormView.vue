<script setup>
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'

const router = useRouter()

const icons = ['gpu', 'cpu', 'mobo', 'ram', 'storage', 'psu', 'case', 'cooling', 'peripherals']
const tones = [
  { key: 'slate', g: 'linear-gradient(135deg,#2b2f3a,#15171d)' },
  { key: 'blue', g: 'linear-gradient(135deg,#28333f,#141a21)' },
  { key: 'green', g: 'linear-gradient(135deg,#2c382a,#161d15)' },
  { key: 'violet', g: 'linear-gradient(135deg,#352b3a,#1d1722)' },
  { key: 'cyan', g: 'linear-gradient(135deg,#273841,#131e24)' },
  { key: 'amber', g: 'linear-gradient(135deg,#3a3325,#211c12)' },
  { key: 'neutral', g: 'linear-gradient(135deg,#2e2e33,#18181c)' },
  { key: 'teal', g: 'linear-gradient(135deg,#27393a,#132122)' },
  { key: 'warm', g: 'linear-gradient(135deg,#382f29,#201913)' },
]
const parentOptions = [
  'None (Top level)',
  'Graphics Cards',
  'Processors',
  'Motherboards',
  'Memory & RAM',
  'Storage (SSD/HDD)',
  'Peripherals',
]

const form = reactive({
  name: '',
  slug: '',
  parent: 'None (Top level)',
  description: '',
  icon: 'gpu',
  tone: 'slate',
  coverUrl: '',
  active: true,
  metaTitle: '',
  metaDescription: '',
})

// Auto-fill the slug from the name until the user edits the slug directly.
let slugTouched = false
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
watch(
  () => form.name,
  (name) => {
    if (!slugTouched) form.slug = slugify(name)
  },
)
function onSlugInput() {
  slugTouched = true
}

const selectedTone = () => tones.find((t) => t.key === form.tone)?.g

const fileInput = ref(null)
function pickCover() {
  fileInput.value?.click()
}
function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) form.coverUrl = URL.createObjectURL(file)
}

function save() {
  // TODO: POST to the categories API.
  router.push({ name: 'categories' })
}
</script>

<template>
  <div class="page">
    <AppHeader title="New Category" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink :to="{ name: 'categories' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Back to Categories</span>
            <span class="subhead__title">Create Category</span>
          </span>
        </RouterLink>

        <div class="subhead__actions">
          <BaseButton variant="ghost" :to="{ name: 'categories' }">Cancel</BaseButton>
          <BaseButton variant="primary" @click="save">Create Category</BaseButton>
        </div>
      </div>

      <form class="grid" @submit.prevent="save">
        <!-- Left column -->
        <div class="col col--side">
          <!-- Live preview -->
          <section class="card">
            <h3 class="card__title">Preview</h3>
            <div class="preview">
              <div class="preview__media" :style="{ backgroundImage: form.coverUrl ? `url(${form.coverUrl})` : selectedTone() }">
                <span class="preview__glyph" aria-hidden="true"><CategoryIcon :name="form.icon" /></span>
                <div class="preview__label">
                  <span class="preview__icon" aria-hidden="true"><CategoryIcon :name="form.icon" /></span>
                  <span class="preview__name">{{ form.name || 'Category name' }}</span>
                </div>
              </div>
              <div class="preview__body">
                <span class="preview__count">0 Products</span>
                <span class="preview__status" :class="{ 'preview__status--off': !form.active }">
                  {{ form.active ? 'Active' : 'Hidden' }}
                </span>
              </div>
            </div>
          </section>

          <!-- Cover image -->
          <section class="card">
            <h3 class="card__title">Cover Image</h3>
            <button type="button" class="image" @click="pickCover">
              <img v-if="form.coverUrl" :src="form.coverUrl" alt="Cover preview" />
              <span v-else class="image__placeholder">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>Click to upload</span>
              </span>
            </button>
            <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onFileChange" />
            <p class="card__hint">Recommended: 1200x675px (16:9). Optional — a tone is used otherwise.</p>
          </section>

          <!-- Visibility -->
          <section class="card">
            <h3 class="card__title">Visibility</h3>
            <div class="availability" :class="{ 'availability--on': form.active }">
              <span class="availability__dot"></span>
              <ToggleSwitch v-model="form.active" label="Active (visible in storefront)" />
            </div>
          </section>
        </div>

        <!-- Right column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">General Information</h3>
            <div class="field">
              <label for="name">Category Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. Graphics Cards" />
            </div>
            <div class="row">
              <div class="field">
                <label for="slug">URL Slug</label>
                <div class="slug">
                  <span>/category/</span>
                  <input id="slug" v-model="form.slug" type="text" placeholder="graphics-cards" @input="onSlugInput" />
                </div>
              </div>
              <div class="field">
                <label for="parent">Parent Category</label>
                <div class="select-wrap">
                  <select id="parent" v-model="form.parent">
                    <option v-for="opt in parentOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" v-model="form.description" rows="3" placeholder="Short summary shown on the category page..."></textarea>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Appearance</h3>

            <p class="picker-label">Icon</p>
            <div class="icons">
              <button
                v-for="ic in icons"
                :key="ic"
                type="button"
                class="icons__btn"
                :class="{ 'is-active': form.icon === ic }"
                :aria-pressed="form.icon === ic"
                @click="form.icon = ic"
              >
                <CategoryIcon :name="ic" />
              </button>
            </div>

            <p class="picker-label">Cover Tone</p>
            <div class="tones">
              <button
                v-for="tone in tones"
                :key="tone.key"
                type="button"
                class="tones__swatch"
                :class="{ 'is-active': form.tone === tone.key }"
                :style="{ backgroundImage: tone.g }"
                :aria-label="`Tone ${tone.key}`"
                :aria-pressed="form.tone === tone.key"
                @click="form.tone = tone.key"
              ></button>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">SEO &amp; Meta</h3>
            <div class="field">
              <label for="metaTitle">Meta Title</label>
              <input id="metaTitle" v-model="form.metaTitle" type="text" placeholder="Graphics Cards — Beckie Deal" />
            </div>
            <div class="field">
              <label for="metaDescription">Meta Description</label>
              <textarea id="metaDescription" v-model="form.metaDescription" rows="2" placeholder="Used by search engines for this category page..."></textarea>
            </div>
          </section>
        </div>
      </form>
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
    svg { width: 22px; height: 22px; stroke: #6b7280; stroke-width: 1.8; }
    span { display: flex; flex-direction: column; line-height: 1.2; }
  }

  &__crumb {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: $muted;
  }

  &__title { font-size: 1.1rem; font-weight: 700; color: $color-text; }

  &__actions { display: flex; gap: 0.6rem; }
}

.grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }

  &__hint { margin: 0.75rem 0 0; font-size: 0.72rem; color: $muted; text-align: center; }
}

/* Live preview card */
.preview {
  border: 1px solid $divider;
  border-radius: 12px;
  overflow: hidden;

  &__media {
    position: relative;
    height: 120px;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: flex-end;
    overflow: hidden;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(15, 17, 21, 0.82) 0%, rgba(15, 17, 21, 0.15) 55%, rgba(15, 17, 21, 0.05) 100%);
    }
  }

  &__glyph {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    color: #fff;
    opacity: 0.12;
    :deep(svg) { width: 60px; height: 60px; stroke: currentColor; stroke-width: 1.4; }
  }

  &__label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.8rem;
  }

  &__icon {
    display: inline-flex;
    color: $accent;
    :deep(svg) { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__name {
    font-size: 0.92rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }

  &__body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 0.9rem;
  }

  &__count { font-size: 0.82rem; font-weight: 700; color: $color-text; }

  &__status {
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: #e6f7ee;
    color: #1f9d57;

    &--off { background: #f1f3f5; color: #8a909c; }
  }
}

/* Cover upload (shared pattern with the product form) */
.image {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #d3d7dd;
  border-radius: 12px;
  background: #fafbfc;
  overflow: hidden;
  cursor: pointer;
  padding: 0;

  &:hover { border-color: $accent; }
  img { width: 100%; height: 100%; object-fit: cover; }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: $muted;
    font-size: 0.8rem;
    svg { width: 32px; height: 32px; stroke: currentColor; stroke-width: 1.5; }
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
    color: #4a5160;
  }

  input,
  textarea,
  select {
    width: 100%;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: $color-text;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: #b4b9c2; }
    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }
  }

  textarea { resize: vertical; }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  .field + .field { margin-top: 0; }

  @media (max-width: 620px) { grid-template-columns: 1fr; }
}

.slug {
  display: flex;
  align-items: center;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  padding-left: 0.8rem;
  overflow: hidden;

  &:focus-within { border-color: $accent; box-shadow: 0 0 0 3px rgba($accent, 0.18); }

  span { color: $muted; font-size: 0.85rem; white-space: nowrap; }

  input {
    border: none;
    box-shadow: none;
    padding-left: 0.2rem;
    &:focus { box-shadow: none; }
  }
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
    stroke: $muted;
    stroke-width: 1.8;
    pointer-events: none;
  }
}

.availability {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background: #f4f5f7;
  transition: background-color 0.15s ease;

  &--on { background: #e9f7ef; }

  &__dot { width: 8px; height: 8px; border-radius: 50%; background: #c2c7ce; order: -1; }
  &--on &__dot { background: #2f9d57; }
}

.picker-label {
  margin: 0 0 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #4a5160;

  & + .icons, & + .tones { margin-bottom: 1.25rem; }
}

.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 0.5rem;

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    background: #fafbfc;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    color: #6b7280;
    cursor: pointer;
    transition: border-color 0.12s ease, background-color 0.12s ease, color 0.12s ease;

    :deep(svg) { width: 22px; height: 22px; stroke: currentColor; stroke-width: 1.7; }

    &:hover { border-color: #d3d7dd; }

    &.is-active {
      border-color: $accent;
      background: rgba($accent, 0.14);
      color: #a8850a;
    }
  }
}

.tones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  &__swatch {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 2px solid transparent;
    background-size: cover;
    cursor: pointer;
    transition: transform 0.12s ease;

    &:hover { transform: scale(1.06); }

    &.is-active {
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.22);
    }
  }
}
</style>
