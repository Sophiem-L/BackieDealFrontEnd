<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

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

// Object URLs this component handed out. Only these get revoked — the list may
// also hold plain URLs that came from elsewhere and are not ours to release.
const created = new Set()

const fileInput = ref(null)

const summary = computed(() => {
  const count = props.images.length
  const noun = count === 1 ? 'image' : 'images'
  if (count < 2) return `${count} ${noun}`
  return `${count} ${noun} · plays for ${(count * props.durationMs) / 1000}s`
})

function pickFiles() {
  fileInput.value?.click()
}

function onFiles(event) {
  const files = Array.from(event.target.files ?? [])
  if (!files.length) return

  const urls = files.map((file) => {
    const url = URL.createObjectURL(file)
    created.add(url)
    return url
  })

  emit('update:images', [...props.images, ...urls])
  event.target.value = '' // so the same file can be picked again
}

function release(url) {
  if (!created.has(url)) return
  URL.revokeObjectURL(url)
  created.delete(url)
}

function removeImage(index) {
  const next = [...props.images]
  const [removed] = next.splice(index, 1)
  release(removed)
  emit('update:images', next)
}

function moveImage(index, offset) {
  const target = index + offset
  const next = [...props.images]
  ;[next[index], next[target]] = [next[target], next[index]]
  emit('update:images', next)
}

onBeforeUnmount(() => {
  created.forEach((url) => URL.revokeObjectURL(url))
  created.clear()
})
</script>

<template>
  <div class="images">
    <button type="button" class="uploader" @click="pickFiles">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
      </svg>
      {{ images.length ? 'Add more images' : 'Upload images' }}
    </button>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="images__input"
      @change="onFiles"
    />

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

  &:hover {
    border-color: rgb(var(--accent-rgb));
    color: var(--text-strong);
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
