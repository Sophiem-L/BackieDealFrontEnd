<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { apiFetch } from '@/services/api'
import { ACCEPT_ATTR, uploadImage, validateImageFile } from '@/services/media'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  name: '',
  description: '',
  coverUrl: '',
  active: true,
})

const fileInput = ref(null)
const coverUploading = ref(false)
const coverError = ref('')
function pickCover() {
  fileInput.value?.click()
}
async function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  coverError.value = ''
  const problem = validateImageFile(file)
  if (problem) {
    coverError.value = problem
    return
  }

  coverUploading.value = true
  try {
    const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'categories' })
    form.coverUrl = url
  } catch (err) {
    coverError.value = err.message || 'Upload failed.'
  } finally {
    coverUploading.value = false
  }
}

const saving = ref(false)
const saveError = ref('')

async function save() {
  saving.value = true
  saveError.value = ''
  try {
    await apiFetch('/admin/categories', {
      method: 'POST',
      body: {
        name: form.name,
        description: form.description || null,
        image: form.coverUrl || null,
        is_active: form.active,
      },
      token: auth.accessToken,
    })
    router.push({ name: 'categories' })
  } catch (err) {
    const fieldError = Object.values(err.errors ?? {})[0]
    saveError.value = (Array.isArray(fieldError) ? fieldError[0] : fieldError) || err.message || 'Unable to create this category.'
  } finally {
    saving.value = false
  }
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
          </span>
        </RouterLink>
      </div>

      <form class="grid" @submit.prevent="save">
        <!-- Main column -->
        <div class="col col--main">
          <p v-if="saveError" class="alert">{{ saveError }}</p>
          <section class="card">
            <h3 class="card__title">General Information</h3>
            <div class="field">
              <label for="name">Category Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. Graphics Cards" />
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" v-model="form.description" rows="3" placeholder="Short summary shown on the category page..."></textarea>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <!-- Cover image -->
          <section class="card">
            <h3 class="card__title">Cover Image</h3>
            <button type="button" class="image" :disabled="coverUploading" @click="pickCover">
              <img v-if="form.coverUrl" :src="form.coverUrl" alt="Cover preview" />
              <span v-else class="image__placeholder">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>{{ coverUploading ? 'Uploading…' : 'Click to upload' }}</span>
              </span>
            </button>
            <input ref="fileInput" type="file" :accept="ACCEPT_ATTR" hidden @change="onFileChange" />
            <p v-if="coverError" class="card__hint card__hint--error">{{ coverError }}</p>
            <p v-else class="card__hint">Recommended: 1200x675px (16:9).</p>
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

        <!-- Form actions -->
        <div class="actions">
          <BaseButton variant="ghost" :disabled="saving" :to="{ name: 'categories' }">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="saving">
            <template v-if="saving">Creating…</template>
            <template v-else>Create</template>
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
    font-size: 0.68rem;
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

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

/* Main info on the left, image/visibility on the right. */
.col--main { order: 1; }
.col--side { order: 2; }

@media (max-width: 900px) {
  .col--side { order: 1; }
  .col--main { order: 2; }
}

/* Full-width action bar below both columns */
.actions {
  grid-column: 1 / -1;
  order: 3;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
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
    color: var(--text-subtle);
    text-align: center;

    &--error { color: var(--danger); }
  }
}

.alert {
  margin: 0 0 1.25rem;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
}

/* Cover upload (shared pattern with the product form) */
.image {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--switch-track);
  border-radius: 12px;
  background: var(--surface-sunken);
  overflow: hidden;
  cursor: pointer;
  padding: 0;

  &:hover { border-color: rgb(var(--accent-rgb)); }
  &:disabled { cursor: not-allowed; opacity: 0.7; }
  img { width: 100%; height: 100%; object-fit: cover; }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-subtle);
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

  textarea { resize: vertical; }
}

.availability {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background: var(--bg);
  transition: background-color 0.15s ease;

  &--on { background: var(--success-bg); }

  &__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-faint); order: -1; }
  &--on &__dot { background: var(--success); }
}

</style>
