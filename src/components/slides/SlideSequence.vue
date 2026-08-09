<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Plays a slide's images as a looping sequence. Zero or one image renders
// statically and runs no timer; two or more cross-fade on an interval.
const props = defineProps({
  images: { type: Array, default: () => [] },
  durationMs: { type: Number, default: 3000 },
  transition: { type: String, default: 'fade' }, // 'fade' | 'cut'
  alt: { type: String, default: '' },
})

const index = ref(0)
let timer = null

const fadeMs = computed(() => (props.transition === 'cut' ? 0 : 600))

// Optional call: jsdom omits matchMedia unless a test provides it.
function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

function stop() {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

// Always restarts from the first frame, so editing the list mid-playback can
// never leave the index pointing past the end of the array.
function start() {
  stop()
  index.value = 0
  if (props.images.length < 2 || prefersReducedMotion()) return
  timer = setInterval(() => {
    index.value = (index.value + 1) % props.images.length
  }, props.durationMs)
}

start()

watch(() => [props.images, props.durationMs], start)

onBeforeUnmount(stop)
</script>

<template>
  <div class="sequence">
    <img
      v-for="(src, i) in images"
      :key="`${i}-${src}`"
      :src="src"
      :alt="i === 0 ? alt : ''"
      :aria-hidden="i === index ? undefined : 'true'"
      class="sequence__frame"
      :class="{ 'sequence__frame--active': i === index }"
      :style="{ transitionDuration: `${fadeMs}ms` }"
    />
  </div>
</template>

<style scoped lang="scss">
.sequence {
  position: absolute;
  inset: 0;

  &__frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition-property: opacity;
    transition-timing-function: ease;

    &--active {
      opacity: 1;
    }
  }
}
</style>
