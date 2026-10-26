<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Plays a slide's images as a looping sequence. Zero or one image renders
// statically and runs no timer; two or more change on an interval.
//
// Every image has its own transition: the one that plays when *it* comes in,
// so image 2 can slide in while image 3 arrives as blinds. Image 1's plays when
// the loop wraps back to it (never on first load).
const props = defineProps({
  images: { type: Array, default: () => [] },
  durationMs: { type: Number, default: 3000 },
  // One entry per image, same order. A missing entry uses `transition`.
  // Each is one of the values in SLIDE_TRANSITIONS (services/slides.js).
  transitions: { type: Array, default: () => [] },
  transition: { type: String, default: 'fade' },
  alt: { type: String, default: '' },
})

const index = ref(0)
// The frame that just left, -1 before the first change. It stays in place under
// the incoming frame (or slides out) until the next change replaces it.
const previous = ref(-1)
let timer = null

// Everything except blinds is a CSS animation on the incoming frame, chosen by
// a class on the root; blinds needs its own strip elements (below).
const EFFECTS = [
  'fade',
  'cut',
  'zoom',
  'grow',
  'blur',
  'slide',
  'slide-left',
  'slide-up',
  'slide-down',
  'wipe-left',
  'wipe-right',
  'circle',
  'flip',
]
const EFFECT_MS = {
  cut: 0,
  zoom: 900,
  grow: 700,
  blur: 800,
  'wipe-left': 700,
  'wipe-right': 700,
  circle: 800,
  flip: 900,
}

// Blinds: the incoming frame is drawn as strips that fade in one after
// another, starting from one edge. Each strip is a full copy of the image
// clipped to its own column or row, so object-fit: cover crops exactly as it
// does for the other transitions. Columns run 16 x 40 ms, rows 8 x 80 ms, each
// with a 300 ms fade: ~0.9 s either way.
function buildStrips(axis, fromFarEdge) {
  const count = axis === 'x' ? 16 : 8
  const stagger = axis === 'x' ? 40 : 80

  return Array.from({ length: count }, (_, n) => {
    const start = (n * 100) / count
    const end = 100 - ((n + 1) * 100) / count
    // The extra pixel overlaps the next strip so no hairline shows between them.
    const clipPath =
      axis === 'x' ? `inset(0 calc(${end}% - 1px) 0 ${start}%)` : `inset(${start}% 0 calc(${end}% - 1px) 0)`

    return {
      clipPath,
      animationDelay: `${(fromFarEdge ? count - 1 - n : n) * stagger}ms`,
    }
  })
}

const BLINDS = {
  'blinds-left': buildStrips('x', false),
  'blinds-right': buildStrips('x', true),
  'blinds-top': buildStrips('y', false),
  'blinds-bottom': buildStrips('y', true),
}

// The transition that brings the current frame in. Anything unrecognised plays
// as a fade rather than leaving the frame without an animation.
const playing = computed(() => {
  const name = props.transitions[index.value] ?? props.transition
  if (Object.hasOwn(BLINDS, name) || EFFECTS.includes(name)) return name
  return 'fade'
})
const isBlinds = computed(() => Object.hasOwn(BLINDS, playing.value))
const effect = computed(() => (isBlinds.value ? 'blinds' : playing.value))
const durationOfChange = computed(() => EFFECT_MS[effect.value] ?? 600)

// 'slide-left' also carries 'slide', so the shared rules apply to every
// direction and the specific class only has to set the direction.
const rootClass = computed(() => {
  const name = effect.value
  const family = name.split('-')[0]
  return family === name ? [`sequence--${name}`] : [`sequence--${family}`, `sequence--${name}`]
})

const strips = computed(() => BLINDS[playing.value] ?? [])

// The strips replace the incoming frame's plain image only while a change is
// playing; the first frame on load, and a lone image, have nothing to blend.
const showStrips = computed(
  () => isBlinds.value && previous.value !== -1 && props.images.length > 1,
)

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
  previous.value = -1
  if (props.images.length < 2 || prefersReducedMotion()) return
  timer = setInterval(() => {
    previous.value = index.value
    index.value = (index.value + 1) % props.images.length
  }, props.durationMs)
}

start()

watch(() => [props.images, props.durationMs], start)

/** Which state a frame is in; the stylesheet turns these into movement. */
function frameClass(i) {
  return {
    'sequence__frame--active': i === index.value,
    // Skipped on the very first frame so a slide doesn't animate in on load.
    'sequence__frame--enter': i === index.value && previous.value !== -1,
    'sequence__frame--leave': i === previous.value && i !== index.value,
  }
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="sequence" :class="rootClass">
    <img
      v-for="(src, i) in images"
      :key="`${i}-${src}`"
      :src="src"
      :alt="i === 0 ? alt : ''"
      :aria-hidden="i === index ? undefined : 'true'"
      class="sequence__frame"
      :class="frameClass(i)"
      :style="{ animationDuration: `${durationOfChange}ms` }"
    />

    <!-- Re-keyed on every change so the strips restart their fade each time. -->
    <div
      v-if="showStrips"
      :key="`${index}-${images[index]}`"
      class="sequence__blinds"
      aria-hidden="true"
    >
      <img
        v-for="(stripStyle, n) in strips"
        :key="n"
        :src="images[index]"
        alt=""
        class="sequence__strip"
        :style="stripStyle"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.sequence {
  position: absolute;
  inset: 0;
  // Keeps zoomed and slid frames inside the slide while they animate.
  overflow: hidden;

  // Every change is the incoming frame animating in on top of the frame it
  // replaces, which stays put (or slides out) until the next change. Frames
  // that are neither coming in nor going out stay hidden.
  &__frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    visibility: hidden;

    &--leave {
      visibility: visible;
    }

    &--active {
      visibility: visible;
      // Above the old frame even when it comes later in the DOM (the loop
      // wrapping from the last image back to the first).
      z-index: 1;
    }
  }

  &--fade &__frame--enter {
    animation: fade-in both ease;
  }

  &--zoom &__frame--enter {
    animation: zoom-out both ease;
  }

  &--grow &__frame--enter {
    animation: zoom-in both ease;
  }

  &--blur &__frame--enter {
    animation: blur-in both ease;
  }

  &--flip &__frame--enter {
    animation: flip-in both ease;
  }

  &--circle &__frame--enter {
    animation: circle-in both ease;
  }

  // Slide: the incoming frame moves in from an edge and pushes the old one out
  // the opposite side. The class for each direction only sets where from.
  &--slide {
    --slide-from: translateX(100%);
    --slide-to: translateX(-100%);
  }

  &--slide-left {
    --slide-from: translateX(-100%);
    --slide-to: translateX(100%);
  }

  &--slide-up {
    --slide-from: translateY(100%);
    --slide-to: translateY(-100%);
  }

  &--slide-down {
    --slide-from: translateY(-100%);
    --slide-to: translateY(100%);
  }

  &--slide &__frame--enter {
    animation: slide-in both ease;
  }

  &--slide &__frame--leave {
    animation: slide-out both ease;
  }

  // Wipe: the incoming frame is uncovered by an edge moving across it.
  &--wipe-left {
    --wipe-from: inset(0 100% 0 0);
  }

  &--wipe-right {
    --wipe-from: inset(0 0 0 100%);
  }

  &--wipe &__frame--enter {
    animation: wipe-in both ease;
  }

  // Cut: the new frame simply replaces the old one.
  &--cut &__frame--leave {
    visibility: hidden;
  }

  // Blinds: the strips below stand in for the incoming frame's plain image.
  &--blinds &__frame--enter {
    visibility: hidden;
  }

  &__blinds {
    position: absolute;
    inset: 0;
    z-index: 2;
  }

  &__strip {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: fade-in 300ms both ease;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes zoom-out {
  from {
    opacity: 0;
    transform: scale(1.12);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes zoom-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes blur-in {
  from {
    opacity: 0;
    filter: blur(18px);
  }

  to {
    opacity: 1;
    filter: none;
  }
}

@keyframes flip-in {
  from {
    opacity: 0;
    transform: perspective(1200px) rotateY(-90deg);
  }

  to {
    opacity: 1;
    transform: perspective(1200px) rotateY(0);
  }
}

@keyframes circle-in {
  from {
    clip-path: circle(0% at 50% 50%);
  }

  // 75% of the reference box is past the corners, so the circle always ends
  // up covering the whole frame.
  to {
    clip-path: circle(75% at 50% 50%);
  }
}

@keyframes wipe-in {
  from {
    clip-path: var(--wipe-from);
  }

  to {
    clip-path: inset(0);
  }
}

@keyframes slide-in {
  from {
    transform: var(--slide-from);
  }

  to {
    transform: translate(0);
  }
}

@keyframes slide-out {
  from {
    transform: translate(0);
  }

  to {
    transform: var(--slide-to);
  }
}
</style>
