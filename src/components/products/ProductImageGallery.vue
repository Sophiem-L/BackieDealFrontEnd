<script setup>
import { computed, ref, watch } from 'vue'
import { ACCEPT_ATTR, uploadImage, validateImageFile } from '@/services/media'
import { useAuthStore } from '@/stores/auth'

/**
 * Editor for a product's image gallery.
 *
 * Each entry is `{ url, isPrimary }`. Exactly one entry is primary — it is the
 * image the product list and storefront lead with, and the form copies its URL
 * into `thumbnail` on save. The API rejects a payload with two primaries, so
 * marking one here always unmarks the others.
 */
const props = defineProps({
  images: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:images'])

const auth = useAuthStore()

const fileInput = ref(null)
const uploading = ref(0)
const error = ref('')

// Which image fills the large preview. In read-only mode this is a viewer, so
// it follows whatever the reader clicked; while editing it tracks the primary.
const activeIndex = ref(0)

const primaryIndex = computed(() => {
  const found = props.images.findIndex((image) => image.isPrimary)
  return found === -1 ? 0 : found
})

const activeImage = computed(() => props.images[activeIndex.value] ?? props.images[primaryIndex.value] ?? null)

// Keep the preview on a real entry after a removal shortens the list, and
// follow the primary while editing.
watch(
  () => [props.images.length, primaryIndex.value, props.readonly],
  () => {
    if (activeIndex.value > props.images.length - 1) {
      activeIndex.value = Math.max(0, props.images.length - 1)
    }
    if (!props.readonly) activeIndex.value = primaryIndex.value
  },
  { immediate: true },
)

const uploadLabel = computed(() => {
  if (uploading.value > 0) {
    return `Uploading ${uploading.value} image${uploading.value === 1 ? '' : 's'}…`
  }
  return props.images.length ? 'Add more images' : 'Upload images'
})

function pickFiles() {
  fileInput.value?.click()
}

/**
 * Upload the picked files and append whatever landed.
 *
 * Uploads run one at a time so the gallery keeps the order they were picked in,
 * and a partial failure keeps the images that did upload rather than throwing
 * the whole batch away. Only hosted URLs are stored — a `blob:` preview would
 * stop resolving the moment this page unmounts.
 */
async function onFiles(event) {
  const files = Array.from(event.target.files ?? [])
  event.target.value = '' // so the same file can be picked twice
  if (!files.length) return

  error.value = ''
  uploading.value += files.length

  const uploaded = []
  const failures = []

  for (const file of files) {
    const problem = validateImageFile(file)
    if (problem) {
      failures.push(`${file.name}: ${problem}`)
      uploading.value -= 1
      continue
    }

    try {
      const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'products' })
      uploaded.push(url)
    } catch (err) {
      failures.push(`${file.name}: ${err.message || 'Upload failed.'}`)
    } finally {
      uploading.value -= 1
    }
  }

  if (uploaded.length) {
    const hadImages = props.images.length > 0
    emit('update:images', [
      ...props.images,
      // The first image a product ever gets becomes its primary, so a new
      // product is never saved with a gallery but no thumbnail.
      ...uploaded.map((url, i) => ({ url, isPrimary: !hadImages && i === 0 })),
    ])
  }
  if (failures.length) error.value = failures.join(' ')
}

function removeImage(index) {
  const next = props.images.filter((_, i) => i !== index)
  // Removing the primary hands the role to whatever is left, so the gallery
  // never ends up with images and no primary among them.
  if (next.length && !next.some((image) => image.isPrimary)) {
    next[0] = { ...next[0], isPrimary: true }
  }
  emit('update:images', next)
}

function setPrimary(index) {
  emit(
    'update:images',
    props.images.map((image, i) => ({ ...image, isPrimary: i === index })),
  )
}

function moveImage(index, offset) {
  const target = index + offset
  if (target < 0 || target > props.images.length - 1) return
  const next = [...props.images]
  ;[next[index], next[target]] = [next[target], next[index]]
  emit('update:images', next)
}
</script>

<template>
  <div class="gallery">
    <!-- Large preview of the active image -->
    <div class="gallery__preview" :class="{ 'gallery__preview--empty': !activeImage }">
      <img v-if="activeImage" :src="activeImage.url" :alt="`Product image ${activeIndex + 1}`" />
      <span v-else class="gallery__placeholder">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>No image</span>
      </span>
      <span v-if="activeImage?.isPrimary" class="gallery__badge">Primary</span>
    </div>

    <p v-if="error" class="gallery__error" role="alert">{{ error }}</p>

    <ul v-if="images.length" class="gallery__strip">
      <li
        v-for="(image, i) in images"
        :key="`${i}-${image.url}`"
        class="gallery__thumb"
        :class="{
          'gallery__thumb--active': i === activeIndex,
          'gallery__thumb--primary': image.isPrimary,
        }"
      >
        <button
          type="button"
          class="gallery__thumb-btn"
          :aria-label="`Show image ${i + 1}`"
          @click="activeIndex = i"
        >
          <img :src="image.url" :alt="`Product image ${i + 1}`" />
        </button>

        <span v-if="image.isPrimary" class="gallery__star" aria-label="Primary image">★</span>

        <template v-if="!readonly">
          <button
            v-if="!image.isPrimary"
            type="button"
            class="gallery__btn gallery__btn--primary"
            :aria-label="`Make image ${i + 1} the primary image`"
            @click="setPrimary(i)"
          >
            ★
          </button>

          <button
            type="button"
            class="gallery__btn gallery__btn--remove"
            :aria-label="`Remove image ${i + 1}`"
            @click="removeImage(i)"
          >
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
          </button>

          <span class="gallery__move">
            <button
              v-if="i > 0"
              type="button"
              class="gallery__btn"
              :aria-label="`Move image ${i + 1} earlier`"
              @click="moveImage(i, -1)"
            >
              <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <button
              v-if="i < images.length - 1"
              type="button"
              class="gallery__btn"
              :aria-label="`Move image ${i + 1} later`"
              @click="moveImage(i, 1)"
            >
              <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </span>
        </template>
      </li>
    </ul>

    <template v-if="!readonly">
      <button type="button" class="gallery__upload" :disabled="uploading > 0" @click="pickFiles">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
        </svg>
        {{ uploadLabel }}
      </button>

      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPT_ATTR"
        multiple
        class="gallery__input"
        @change="onFiles"
      />

      <p class="gallery__hint">
        Recommended: 1000x1000px, up to 5MB each. The ★ image leads the product listing.
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.gallery {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__input { display: none; }

  &__preview {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--switch-track);
    border-radius: 12px;
    background: var(--surface-sunken);
    overflow: hidden;

    &--empty { border-style: dashed; }

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  &__badge {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    font-size: 0.68rem;
    font-weight: 600;
    color: #fff;
    background: rgb(var(--accent-rgb) / 0.9);
  }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-subtle);
    font-size: 0.8rem;

    svg { width: 34px; height: 34px; stroke: currentColor; stroke-width: 1.5; }
  }

  &__strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__thumb {
    position: relative;
    width: 58px;
    height: 58px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    background: var(--surface-sunken);

    &--active { border-color: rgb(var(--accent-rgb) / 0.5); }
    &--primary { border-color: rgb(var(--accent-rgb)); }

    &:hover .gallery__btn { opacity: 1; }
  }

  &__thumb-btn {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  &__star {
    position: absolute;
    left: 2px;
    bottom: 0;
    font-size: 0.7rem;
    color: rgb(var(--accent-rgb));
    text-shadow: 0 0 2px rgb(0 0 0 / 0.6);
    pointer-events: none;
  }

  &__btn {
    position: absolute;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: #fff;
    background: rgb(0 0 0 / 0.6);
    font-size: 0.6rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;

    &:focus-visible { opacity: 1; }

    svg { width: 11px; height: 11px; stroke: currentColor; stroke-width: 2.5; }

    &--remove { top: 2px; right: 2px; }
    &--primary { top: 2px; left: 2px; }
  }

  &__move {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2px;
    display: flex;
    justify-content: center;
    gap: 2px;

    .gallery__btn { position: static; }
  }

  &__upload {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.55rem;
    border: 1px dashed var(--switch-track);
    border-radius: 10px;
    background: none;
    color: var(--text-subtle);
    font-size: 0.78rem;
    cursor: pointer;

    &:hover:not(:disabled) { border-color: rgb(var(--accent-rgb)); color: rgb(var(--accent-rgb)); }
    &:disabled { cursor: progress; }

    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__hint {
    margin: 0;
    font-size: 0.72rem;
    color: var(--text-subtle);
    text-align: center;
  }

  &__error {
    margin: 0;
    font-size: 0.75rem;
    color: var(--danger);
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gallery__btn { transition: none; }
}
</style>
