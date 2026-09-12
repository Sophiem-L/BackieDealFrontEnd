<script setup>
import { computed, ref } from 'vue'
import { ACCEPT_ATTR, uploadImage, validateImageFile } from '@/services/media'
import { useAuthStore } from '@/stores/auth'

// Editor for a slide's ordered image list. Frame 1 is the cover, so order
// matters; playback settings only appear once there is something to play.
const props = defineProps({
  images: { type: Array, default: () => [] },
  durationMs: { type: Number, default: 3000 },
  transition: { type: String, default: 'fade' },
})

const emit = defineEmits(['update:images', 'update:durationMs', 'update:transition'])

const durations = [2000, 3000, 5000]
const transitions = [
  { value: 'fade', label: 'Fade' },
  { value: 'cut', label: 'Cut' },
]

const auth = useAuthStore()

const fileInput = ref(null)
const uploading = ref(0)
const error = ref('')

const summary = computed(() => {
  const count = props.images.length
  const noun = count === 1 ? 'image' : 'images'
  if (count < 2) return `${count} ${noun}`
  return `${count} ${noun} · plays for ${(count * props.durationMs) / 1000}s`
})

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
 * Frames are stored as hosted URLs, not blob:/data: — the src outlives this
 * component the moment the slide is saved, so it has to be something the
 * browser can still fetch afterwards.
 *
 * Uploads run one at a time so the frames keep the order they were picked in,
 * and a failure part-way keeps the frames that did land rather than discarding
 * the whole batch.
 */
async function onFiles(event) {
  const files = Array.from(event.target.files ?? [])
  event.target.value = '' // so the same file can be picked again
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
      const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'banners' })
      uploaded.push(url)
    } catch (err) {
      failures.push(`${file.name}: ${err.message || 'Upload failed.'}`)
    } finally {
      uploading.value -= 1
    }
  }

  if (uploaded.length) emit('update:images', [...props.images, ...uploaded])
  if (failures.length) error.value = failures.join(' ')
}

function removeImage(index) {
  const next = [...props.images]
  next.splice(index, 1)
  emit('update:images', next)
}

function moveImage(index, offset) {
  const target = index + offset
  const next = [...props.images]
  ;[next[index], next[target]] = [next[target], next[index]]
  emit('update:images', next)
}
</script>

<template>
  <div class="images">
    <button type="button" class="uploader" :disabled="uploading > 0" @click="pickFiles">
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
      class="images__input"
      @change="onFiles"
    />

    <p v-if="error" class="images__error" role="alert">{{ error }}</p>

    <ul v-if="images.length" class="images__strip">
      <li v-for="(src, i) in images" :key="`${i}-${src}`" class="images__thumb">
        <img :src="src" :alt="`Frame ${i + 1}`" class="images__thumb-img" />
        <span class="images__frame-no">{{ i + 1 }}</span>

        <button
          type="button"
          class="images__btn images__btn--remove"
          :aria-label="`Remove image ${i + 1}`"
          @click="removeImage(i)"
        >
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
        </button>

        <span class="images__move">
          <button
            v-if="i > 0"
            type="button"
            class="images__btn"
            :aria-label="`Move image ${i + 1} earlier`"
            @click="moveImage(i, -1)"
          >
            <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <button
            v-if="i < images.length - 1"
            type="button"
            class="images__btn"
            :aria-label="`Move image ${i + 1} later`"
            @click="moveImage(i, 1)"
          >
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </span>
      </li>
    </ul>

    <p v-if="images.length" class="images__summary">{{ summary }}</p>

    <div v-if="images.length > 1" class="settings">
      <div class="settings__row">
        <span class="settings__label">Seconds per image</span>
        <div class="settings__options">
          <button
            v-for="ms in durations"
            :key="ms"
            type="button"
            class="settings__option"
            :class="{ 'settings__option--active': durationMs === ms }"
            @click="emit('update:durationMs', ms)"
          >
            {{ ms / 1000 }}s
          </button>
        </div>
      </div>

      <div class="settings__row">
        <span class="settings__label">Transition</span>
        <div class="settings__options">
          <button
            v-for="t in transitions"
            :key="t.value"
            type="button"
            class="settings__option"
            :class="{ 'settings__option--active': transition === t.value }"
            @click="emit('update:transition', t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.images {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__input {
    display: none;
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
    width: 74px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface-track);

    &:hover .images__move,
    &:focus-within .images__move {
      opacity: 1;
    }
  }

  &__thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__frame-no {
    position: absolute;
    left: 0.25rem;
    bottom: 0.25rem;
    padding: 0 0.3rem;
    font-size: 0.6rem;
    font-weight: 700;
    line-height: 1.4;
    border-radius: 4px;
    color: var(--ink-on-solid);
    background: var(--backdrop);
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    color: var(--ink-on-solid);
    background: var(--backdrop);
    cursor: pointer;

    &:hover {
      background: rgb(var(--accent-rgb));
    }

    svg {
      width: 11px;
      height: 11px;
      stroke: currentColor;
      stroke-width: 2.2;
    }

    &--remove {
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;

      &:hover {
        background: var(--danger);
      }
    }
  }

  &__move {
    position: absolute;
    left: 0.25rem;
    top: 0.25rem;
    display: flex;
    gap: 0.2rem;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &__summary {
    margin: 0;
    font-size: 0.72rem;
    color: var(--text-subtle);
  }

  &__error {
    margin: 0;
    font-size: 0.72rem;
    color: var(--danger);
  }
}

.uploader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.9rem;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-body);
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgb(var(--accent-rgb));
    color: var(--text-strong);
  }

  &:disabled {
    cursor: progress;
    opacity: 0.65;
  }

  svg {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    stroke-width: 1.8;
  }
}

.settings {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);

  &__row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  &__label {
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__options {
    display: flex;
    gap: 0.35rem;
  }

  &__option {
    flex: 1;
    padding: 0.4rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;

    &:hover {
      border-color: rgb(var(--accent-rgb));
    }

    &--active {
      color: var(--ink-on-accent);
      background: rgb(var(--accent-rgb));
      border-color: rgb(var(--accent-rgb));
    }
  }
}
</style>
