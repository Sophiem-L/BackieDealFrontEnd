<script setup>
/**
 * Collects the axes that define a product's variants — "Color: Red, Blue" —
 * and asks the parent to generate the combinations.
 *
 * Owns no variant rows: it emits axes upward and lets VariantEditor decide what
 * to do with them.
 */
import { computed, ref } from 'vue'
import { cartesian, validateAxes } from '@/services/variants'

const props = defineProps({
  axes: { type: Array, required: true },
})

const emit = defineEmits(['update:axes', 'generate'])

// One in-progress chip entry per axis, keyed by index.
const drafts = ref({})

const problems = computed(() => validateAxes(props.axes))
const comboCount = computed(() => cartesian(props.axes).length)

function update(next) {
  emit('update:axes', next)
}

function addAxis() {
  update([...props.axes, { name: '', values: [] }])
}

function removeAxis(index) {
  update(props.axes.filter((_, i) => i !== index))
  // Drafts are keyed by index, so removing an axis has to shift every key above
  // it down — otherwise the removed axis's half-typed value reappears on its
  // neighbour.
  const shifted = {}
  for (const key of Object.keys(drafts.value)) {
    const i = Number(key)
    if (i < index) shifted[i] = drafts.value[i]
    else if (i > index) shifted[i - 1] = drafts.value[i]
  }
  drafts.value = shifted
}

function renameAxis(index, name) {
  update(props.axes.map((axis, i) => (i === index ? { ...axis, name } : axis)))
}

/**
 * Commit the draft text as a chip. Splits on commas so pasting "S, M, L" adds
 * three values at once, and skips anything already on the axis.
 */
function commitDraft(index) {
  const raw = drafts.value[index] ?? ''
  const incoming = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  if (incoming.length) {
    const axis = props.axes[index]
    const existing = axis.values.map((v) => v.toLowerCase())
    const fresh = incoming.filter((v) => !existing.includes(v.toLowerCase()))
    if (fresh.length) {
      update(
        props.axes.map((a, i) => (i === index ? { ...a, values: [...a.values, ...fresh] } : a)),
      )
    }
  }

  drafts.value[index] = ''
}

function removeValue(index, valueIndex) {
  update(
    props.axes.map((axis, i) =>
      i === index ? { ...axis, values: axis.values.filter((_, v) => v !== valueIndex) } : axis,
    ),
  )
}

// Backspace on an empty draft removes the last chip — standard tag-input feel.
function onDraftKeydown(event, index) {
  if (event.key === 'Backspace' && !(drafts.value[index] ?? '')) {
    const axis = props.axes[index]
    if (axis.values.length) removeValue(index, axis.values.length - 1)
  }
}
</script>

<template>
  <div class="axes">
    <div class="axes__head">
      <h4>Variant Options</h4>
      <button type="button" class="axes__add" @click="addAxis">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        Add option
      </button>
    </div>

    <p v-if="!axes.length" class="axes__empty">
      Add an option like <strong>Color</strong> or <strong>Size</strong>, then list its values to
      generate one variant per combination.
    </p>

    <div v-for="(axis, i) in axes" :key="i" class="axis">
      <input
        :value="axis.name"
        type="text"
        class="axis__name"
        placeholder="Option name"
        :aria-label="`Option ${i + 1} name`"
        @input="renameAxis(i, $event.target.value)"
      />

      <div class="axis__values">
        <span v-for="(value, v) in axis.values" :key="v" class="chip">
          {{ value }}
          <button
            type="button"
            class="chip__remove"
            :aria-label="`Remove ${value}`"
            @click="removeValue(i, v)"
          >
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
          </button>
        </span>
        <input
          v-model="drafts[i]"
          type="text"
          class="axis__draft"
          :placeholder="axis.values.length ? 'Add value…' : 'e.g. Red, Blue'"
          :aria-label="`Add a value to ${axis.name || `option ${i + 1}`}`"
          @keydown.enter.prevent="commitDraft(i)"
          @keydown="onDraftKeydown($event, i)"
          @blur="commitDraft(i)"
        />
      </div>

      <button
        type="button"
        class="axis__remove"
        :aria-label="`Remove option ${axis.name || i + 1}`"
        @click="removeAxis(i)"
      >
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
      </button>
    </div>

    <ul v-if="problems.length" class="axes__problems">
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>

    <div v-if="comboCount" class="axes__generate">
      <button type="button" class="axes__generate-btn" :disabled="problems.length" @click="emit('generate')">
        Generate {{ comboCount }} variant{{ comboCount === 1 ? '' : 's' }}
      </button>
      <p class="axes__generate-hint">Prices and stock you have already entered are kept.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.axes {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;

    h4 {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-body);
    }
  }

  &__add {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--accent-ink);
    background: transparent;
    border: none;
    cursor: pointer;

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; }
  }

  &__empty {
    margin: 0;
    padding: 0.85rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-subtle);
    background: var(--surface-sunken);
    border-radius: 10px;

    strong { color: var(--text-body); font-weight: 600; }
  }

  &__problems {
    margin: 0.75rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.78rem;
    color: var(--danger);

    li + li { margin-top: 0.2rem; }
  }

  &__generate {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.9rem;
  }

  &__generate-btn {
    padding: 0.5rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.12);
    border: 1px solid rgb(var(--accent-rgb) / 0.4);
    border-radius: 9px;
    cursor: pointer;

    &:hover:not(:disabled) { background: rgb(var(--accent-rgb) / 0.2); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &__generate-hint {
    margin: 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }
}

.axis {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 0.5rem;
  align-items: start;
  margin-top: 0.5rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr auto;

    &__values { grid-column: 1 / -1; }
  }

  &__name {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface-sunken);
    min-width: 0;

    &::placeholder { color: var(--text-faint); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  &__values {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 38px;
    padding: 0.3rem 0.45rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);

    &:focus-within {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  &__draft {
    flex: 1;
    min-width: 90px;
    border: none;
    background: transparent;
    padding: 0.2rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);

    &::placeholder { color: var(--text-faint); }
    &:focus { outline: none; }
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); }

    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.9; }
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.3rem 0.22rem 0.55rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-strong);
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  white-space: nowrap;

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); }

    svg { width: 10px; height: 10px; stroke: currentColor; stroke-width: 2.4; }
  }
}
</style>
