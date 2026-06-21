<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { findArticle } from '@/data/news'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => Boolean(route.params.id))

const categories = ['Product News', 'Guides', 'Company', 'Announcements', 'Reviews']
const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
]

const form = reactive({
  title: '',
  excerpt: '',
  content: '',
  category: 'Product News',
  author: 'Admin User',
  status: 'draft',
  publishDate: '',
  coverImage: '',
  coverGradient: 'linear-gradient(135deg, #1b2a4a 0%, #6d28d9 100%)',
})

// Prefill when editing (stands in for an API fetch).
if (isEdit.value) {
  const existing = findArticle(route.params.id)
  if (existing) {
    Object.assign(form, {
      title: existing.title,
      excerpt: existing.excerpt,
      category: existing.category,
      author: existing.author,
      status: existing.status,
    })
  }
}

const pageTitle = computed(() =>
  isEdit.value ? `Edit Article: ${form.title || 'Article'}` : 'New Article',
)

const coverInput = ref(null)
function pickCover() {
  coverInput.value?.click()
}
function onCoverChange(event) {
  const file = event.target.files?.[0]
  if (file) form.coverImage = URL.createObjectURL(file)
}
function clearCover(event) {
  event.stopPropagation()
  form.coverImage = ''
  if (coverInput.value) coverInput.value.value = ''
}

function save() {
  // TODO: POST/PUT to the news API.
  router.push('/news')
}
function remove() {
  // TODO: DELETE via the news API.
  router.push('/news')
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/news" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Content &middot; News</span>
            <span class="subhead__title">{{ form.title || 'New Article' }}</span>
          </span>
        </RouterLink>

        <div class="subhead__actions">
          <BaseButton v-if="isEdit" variant="danger" @click="remove">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
            Delete Article
          </BaseButton>
          <BaseButton variant="primary" @click="save">
            {{ isEdit ? 'Update Article' : 'Publish Article' }}
          </BaseButton>
        </div>
      </div>

      <div class="grid">
        <!-- Main column -->
        <div class="col">
          <section class="card">
            <h3 class="card__title">Article Content</h3>
            <div class="field">
              <label for="title">Title</label>
              <input id="title" v-model="form.title" type="text" placeholder="e.g. RTX 50-Series Pre-Orders Are Now Open" />
            </div>
            <div class="field">
              <label for="excerpt">Excerpt</label>
              <textarea id="excerpt" v-model="form.excerpt" rows="2" placeholder="A short summary shown in article listings..."></textarea>
            </div>
            <div class="field">
              <label for="content">Body</label>
              <textarea id="content" v-model="form.content" rows="12" placeholder="Write your article here..."></textarea>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Publish</h3>
            <div class="field">
              <label for="status">Status</label>
              <div class="select-wrap">
                <select id="status" v-model="form.status">
                  <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </div>
            </div>
            <div v-if="form.status === 'scheduled'" class="field">
              <label for="publishDate">Publish Date</label>
              <input id="publishDate" v-model="form.publishDate" type="date" />
            </div>
            <div class="field">
              <label for="author">Author</label>
              <input id="author" v-model="form.author" type="text" placeholder="Author name" />
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Category</h3>
            <div class="field">
              <label for="category">Article Category</label>
              <div class="select-wrap">
                <select id="category" v-model="form.category">
                  <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </div>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Cover Image</h3>
            <button
              type="button"
              class="cover"
              :class="{ 'cover--image': form.coverImage }"
              :style="form.coverImage ? null : { background: form.coverGradient }"
              @click="pickCover"
            >
              <img v-if="form.coverImage" :src="form.coverImage" alt="Cover preview" class="cover__img" />

              <span class="cover__upload">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
                </svg>
                {{ form.coverImage ? 'Change image' : 'Upload cover' }}
              </span>

              <span
                v-if="form.coverImage"
                class="cover__remove"
                role="button"
                aria-label="Remove cover image"
                @click="clearCover"
              >
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
              </span>
            </button>
            <input
              ref="coverInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              @change="onCoverChange"
            />
            <p class="card__hint">
              Shown at the top of the article and in featured listings. Recommended: 1200x630px.
            </p>
          </section>
        </div>
      </div>
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
    font-size: 0.66rem;
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

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.72rem;
    line-height: 1.5;
    color: $muted;
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
    stroke: $muted;
    stroke-width: 1.8;
    pointer-events: none;
  }
}

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
    color: #fff;
    background: rgba(20, 23, 28, 0.45);
    opacity: 0;
    transition: opacity 0.15s ease;

    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &--image .cover__upload { opacity: 0; }

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
    background: rgba(20, 23, 28, 0.55);
    color: #fff;
    cursor: pointer;

    &:hover { background: #d14343; }

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; }
  }
}
</style>
