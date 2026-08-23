<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  // [{ label: 'Jan', value: 96 }, …]
  points: { type: Array, required: true },
  color: { type: String, default: '#f4c10f' },
  // Appended to each tooltip, e.g. "Jan · 96 orders".
  unit: { type: String, default: '' },
})

// SVG <defs> ids are document-global. The overview chart and the Customer Orders
// chart both render on this page, so a hardcoded id would make one of them pick
// up the other's gradient. useId() gives each instance its own.
const uid = useId()
const fillId = computed(() => `trendFill-${uid}`)

// Normalised 0–100 coordinates so the SVG (preserveAspectRatio="none") and the
// HTML dot/label overlays share one coordinate space and stay aligned.
const PLOT_TOP = 10
const PLOT_BOTTOM = 92

// Guard the divisor: a single point (or an all-zero series) would otherwise
// produce NaN coordinates and render nothing.
const peak = computed(() => Math.max(...props.points.map((p) => p.value), 1))

const plotted = computed(() => {
  const span = props.points.length - 1

  return props.points.map((point, index) => ({
    ...point,
    nx: span === 0 ? 50 : (index / span) * 100,
    ny: PLOT_TOP + (1 - point.value / peak.value) * (PLOT_BOTTOM - PLOT_TOP),
    // Tooltips are centred on their dot, so the first and last would hang half
    // their width outside the plot. The end dot sits at x=100%, which pushed the
    // whole PAGE into a horizontal scroll — the tip is laid out even at
    // opacity 0. These two anchor to their dot's edge instead of its centre.
    edge: span === 0 ? null : index === 0 ? 'start' : index === span ? 'end' : null,
  }))
})

const linePath = computed(() =>
  plotted.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.nx} ${p.ny}`).join(' '),
)
const areaPath = computed(() => `${linePath.value} L 100 100 L 0 100 Z`)
</script>

<template>
  <div class="trend">
    <div class="trend__plot">
      <svg class="trend__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="fillId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.32" />
            <stop offset="100%" :stop-color="color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" :fill="`url(#${fillId})`" />
        <path
          :d="linePath"
          fill="none"
          :stroke="color"
          stroke-width="2.5"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
      <div class="trend__dots">
        <span
          v-for="p in plotted"
          :key="p.label"
          class="trend__dot"
          tabindex="0"
          :style="{ left: p.nx + '%', top: p.ny + '%', borderColor: color }"
        >
          <span class="trend__tip" :class="p.edge ? `trend__tip--${p.edge}` : null">
            {{ p.label }} · {{ p.value.toLocaleString() }}{{ unit ? ` ${unit}` : '' }}
          </span>
        </span>
      </div>
    </div>
    <div class="trend__axis">
      <span v-for="p in plotted" :key="p.label" :style="{ left: p.nx + '%' }">{{ p.label }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">

.trend {
  &__plot {
    position: relative;
    height: 240px;
  }

  &__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  &__dots {
    position: absolute;
    inset: 0;
  }

  &__dot {
    position: absolute;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--surface);
    border: 2.5px solid;
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: transform 0.15s ease;

    &:hover,
    &:focus-visible {
      transform: translate(-50%, -50%) scale(1.25);
      outline: none;
    }

    &:hover .trend__tip,
    &:focus-visible .trend__tip {
      opacity: 1;
      transform: translate(-50%, -8px);
    }

    /* The edge variants drop the -50%, so their lift has to be restated or the
       hover rule above would re-centre them. */
    &:hover .trend__tip--start,
    &:focus-visible .trend__tip--start,
    &:hover .trend__tip--end,
    &:focus-visible .trend__tip--end {
      transform: translate(0, -8px);
    }
  }

  &__tip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%, 0);
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    padding: 0.3rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--tooltip-ink);
    background: var(--tooltip-bg);
    border-radius: 7px;
    transition: opacity 0.15s ease, transform 0.15s ease;

    &--start {
      left: 0;
      transform: translate(0, 0);
    }

    &--end {
      left: auto;
      right: 0;
      transform: translate(0, 0);
    }
  }

  &__axis {
    position: relative;
    height: 20px;
    margin-top: 0.6rem;

    span {
      position: absolute;
      transform: translateX(-50%);
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-subtle);
      white-space: nowrap;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .trend__dot,
  .trend__tip {
    transition: none;
  }
}
</style>
