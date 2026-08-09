<script setup>
/**
 * A variant row's image: a thumbnail that opens a small picker.
 *
 * The picker offers every image this form already knows about plus an upload
 * tile. Reuse matters more than it looks — the API has no product media
 * collection, so "the Red photo on all three Red sizes" is achieved by handing
 * the same URL to each row.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ACCEPT_ATTR } from '@/services/media'

defineProps({
  modelValue: { type: String, default: '' },
  // Reusable image URLs gathered from the rest of the form.
  pool: { type: Array, default: () => [] },
  uploading: { type: Boolean, default: false },
  label: { type: String, default: 'variant' },
})

const emit = defineEmits(['update:modelValue', 'upload'])

const open = ref(false)
const root = ref(null)
const fileInput = ref(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function choose(url) {
  emit('update:modelValue', url)
  close()
}

function clear() {
  emit('update:modelValue', '')
  close()
}

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  // Reset so picking the same file twice still fires a change event.
  event.target.value = ''
  if (file) {
    emit('upload', file)
    close()
  }
}

function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="root" class="pick">
    <button
      type="button"
      class="pick__thumb"
      :class="{ 'pick__thumb--empty': !modelValue }"
      :aria-label="modelValue ? `Change image for ${label}` : `Add image for ${label}`"
      :aria-expanded="open"
      :disabled="uploading"
      @click.stop="toggle"
    >
      <span v-if="uploading" class="pick__spinner" aria-hidden="true"></span>
      <img v-else-if="modelValue" :src="modelValue" :alt="`Image for ${label}`" />
      <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div v-if="open" class="panel" @click.stop>
      <p class="panel__title">{{ pool.length ? 'Choose an image' : 'Add an image' }}</p>

      <div class="panel__grid">
        <button
          v-for="url in pool"
          :key="url"
          type="button"
          class="panel__option"
          :class="{ 'panel__option--active': url === modelValue }"
          :aria-label="`Use this image for ${label}`"
          :aria-pressed="url === modelValue"
          @click="choose(url)"
        >
          <img :src="url" alt="" />
        </button>

        <button type="button" class="panel__upload" @click="pickFile">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          <span>Upload</span>
        </button>
      </div>

      <p class="panel__hint">JPG, PNG, GIF, WebP or SVG. Up to 5MB.</p>

      <button v-if="modelValue" type="button" class="panel__clear" @click="clear">
        Remove image
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      :accept="ACCEPT_ATTR"
      hidden
      @change="onFileChange"
    />
  </div>
</template>

<style scoped lang="scss">
.pick {
  position: relative;
  flex: none;
}

.pick__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover:not(:disabled) { border-color: rgb(var(--accent-rgb)); }
  &:disabled { cursor: progress; }

  &--empty {
    border-style: dashed;
    background: var(--surface-sunken);
  }

  img { width: 100%; height: 100%; object-fit: cover; }

  svg { width: 20px; height: 20px; stroke: var(--text-faint); stroke-width: 1.6; }
}

.pick__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgb(var(--accent-rgb) / 0.3);
  border-top-color: rgb(var(--accent-rgb));
  border-radius: 50%;
  animation: pick-spin 0.7s linear infinite;
}

@keyframes pick-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .pick__spinner { animation-duration: 2s; }
}

.panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  width: 232px;
  padding: 0.7rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 11px;
  box-shadow: 0 10px 26px rgb(0 0 0 / 0.16);

  &__title {
    margin: 0 0 0.5rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.35rem;
  }

  &__option,
  &__upload {
    aspect-ratio: 1 / 1;
    padding: 0;
    overflow: hidden;
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: 7px;
    cursor: pointer;

    &:hover { border-color: rgb(var(--accent-rgb)); }
  }

  &__option {
    img { width: 100%; height: 100%; object-fit: cover; display: block; }

    &--active {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 0.28);
    }
  }

  &__upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    border-style: dashed;
    color: var(--text-subtle);
    font-family: inherit;

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; }
    span { font-size: 0.58rem; font-weight: 600; }
  }

  &__hint {
    margin: 0.5rem 0 0;
    font-size: 0.68rem;
    color: var(--text-subtle);
  }

  &__clear {
    margin-top: 0.5rem;
    padding: 0.3rem 0;
    width: 100%;
    font-size: 0.74rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-subtle);
    background: transparent;
    border: none;
    border-top: 1px solid var(--border-subtle);
    border-radius: 0;
    cursor: pointer;

    &:hover { color: var(--danger); }
  }
}
</style>
