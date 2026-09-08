<script setup>
/**
 * Collects the options that define a product's variants - "Size: 7.5, 8, 8.5" -
 * and emits them upward. VariantEditor turns the combinations into rows.
 *
 * A finished option (name + at least one value) collapses to a compact display
 * row with a drag handle, the way Shopify shows it; clicking the row re-opens it
 * for editing.
 */
import { computed, ref } from 'vue'
import { validateAxes, cartesian } from '@/services/variants'

const props = defineProps({
  axes: { type: Array, required: true },
})

const emit = defineEmits(['update:axes'])

// One in-progress chip entry per option, keyed by index.
const drafts = ref({})
// Which option is open for editing (-1 = none). A nameless or valueless option
// is always treated as open.
const editingIndex = ref(-1)

const problems = computed(() => validateAxes(props.axes))
const comboCount = computed(() => cartesian(props.axes).length)

function isComplete(axis) {
  return (
    Boolean(String(axis?.name ?? '').trim()) &&
    (axis?.values ?? []).some((v) => String(v).trim())
  )
}

function isEditing(index) {
  return editingIndex.value === index || !isComplete(props.axes[index])
}

function update(next) {
  emit('update:axes', next)
}

function addAxis() {
  update([...props.axes, { name: '', values: [] }])
  editingIndex.value = props.axes.length
}

function removeAxis(index) {
  update(props.axes.filter((_, i) => i !== index))
  const shifted = {}
  for (const key of Object.keys(drafts.value)) {
    const i = Number(key)
    if (i < index) shifted[i] = drafts.value[i]
    else if (i > index) shifted[i - 1] = drafts.value[i]
  }
  drafts.value = shifted
  if (editingIndex.value === index) editingIndex.value = -1
}

function renameAxis(index, name) {
  update(props.axes.map((axis, i) => (i === index ? { ...axis, name } : axis)))
}

/** Commit the draft text as chips, splitting on commas so "S, M, L" adds three. */
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

function onDraftKeydown(event, index) {
  if (event.key === 'Backspace' && !(drafts.value[index] ?? '')) {
    const axis = props.axes[index]
    if (axis.values.length) removeValue(index, axis.values.length - 1)
  }
}

function doneEditing(index) {
  commitDraft(index)
  if (isComplete(props.axes[index])) editingIndex.value = -1
}

function openEditing(index) {
  editingIndex.value = index
}

/* ------------------------------------------------------------- drag reorder */

const dragFrom = ref(-1)

function onDragStart(index) {
  dragFrom.value = index
}

function onDrop(to) {
  const from = dragFrom.value
  dragFrom.value = -1
  if (from === -1 || from === to) return
  const next = [...props.axes]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  update(next)
}
</script>

<template>
  <div class="axes">
    <div v-if="axes.length" class="axes__box">
      <div
        v-for="(axis, i) in axes"
        :key="i"
        class="axis"
        :class="{ 'axis--editing': isEditing(i), 'axis--drag': dragFrom === i }"
        @dragover.prevent
        @drop="onDrop(i)"
      >
        <span
          class="axis__handle"
          draggable="true"
          aria-label="Drag to reorder"
          @dragstart="onDragStart(i)"
          @dragend="dragFrom = -1"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
            <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
          </svg>
        </span>

        <!-- Display mode: a finished option, collapsed. -->
        <div v-if="!isEditing(i)" class="axis__done" @click="openEditing(i)">
          <p class="axis__done-name">{{ axis.name }}</p>
          <div class="axis__done-values">
            <span v-for="(value, v) in axis.values" :key="v" class="chip chip--static">{{ value }}</span>
          </div>
        </div>

        <!-- Edit mode. -->
        <div v-else class="axis__edit">
          <div class="axis__field">
            <label class="axis__label" :for="`axis-name-${i}`">Option name</label>
            <input
              :id="`axis-name-${i}`"
              :value="axis.name"
              type="text"
              class="axis__name"
              placeholder="Size"
              :aria-label="`Option ${i + 1} name`"
              @input="renameAxis(i, $event.target.value)"
            />
          </div>

          <div class="axis__field">
            <label class="axis__label" :for="`axis-values-${i}`">Option values</label>
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
              :id="`axis-values-${i}`"
              v-model="drafts[i]"
              type="text"
              class="axis__draft"
              :placeholder="axis.values.length ? 'Add another value' : 'Medium'"
              :aria-label="`Add a value to ${axis.name || `option ${i + 1}`}`"
              @keydown.enter.prevent="commitDraft(i)"
              @keydown="onDraftKeydown($event, i)"
              @blur="commitDraft(i)"
            />
            </div>
          </div>

          <div class="axis__edit-actions">
            <button type="button" class="axis__delete" @click="removeAxis(i)">Delete</button>
            <button type="button" class="axis__donebtn" @click="doneEditing(i)">Done</button>
          </div>
        </div>
      </div>
    </div>

    <button v-if="!axes.length" type="button" class="axes__link" @click="addAxis">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" stroke-linecap="round" />
      </svg>
      Add options like size or color
    </button>
    <button v-else type="button" class="axes__link" @click="addAxis">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" stroke-linecap="round" />
      </svg>
      Add another option
    </button>

    <ul v-if="problems.length" class="axes__problems">
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>

    <p v-if="comboCount" class="axes__count">
      {{ comboCount }} variant{{ comboCount === 1 ? '' : 's' }} from these options.
    </p>
  </div>
</template>

<style scoped lang="scss">
.axes {
  &__box {
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 0.85rem;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-strong);
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover { color: rgb(var(--accent-rgb)); }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; flex: none; }
  }

  &__problems {
    margin: 0.75rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.78rem;
    color: var(--danger);

    li + li { margin-top: 0.2rem; }
  }

  &__count {
    margin: 0.75rem 0 0;
    font-size: 0.74rem;
    font-weight: 500;
    color: var(--text-subtle);
  }
}

.axis {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.85rem 1rem;

  & + & { border-top: 1px solid var(--border-subtle); }

  &--drag { opacity: 0.4; }

  &__handle {
    display: inline-flex;
    align-items: center;
    padding-top: 0.15rem;
    color: var(--text-faint);
    cursor: grab;

    &:active { cursor: grabbing; }

    svg { width: 18px; height: 18px; fill: currentColor; }
  }

  &__done {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    border-radius: 8px;
    margin: -0.3rem -0.4rem;
    padding: 0.3rem 0.4rem;

    &:hover { background: var(--surface-sunken); }

    &-name {
      margin: 0 0 0.4rem;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-strong);
    }

    &-values {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
  }

  &__edit {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  &__label {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-subtle);
  }

  &__name {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);

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

  &__edit-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__delete,
  &__donebtn {
    padding: 0.4rem 0.8rem;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: inherit;
    border-radius: 8px;
    cursor: pointer;
  }

  &__delete {
    color: var(--danger);
    background: transparent;
    border: 1px solid var(--danger-border);

    &:hover { background: var(--danger-bg); }
  }

  &__donebtn {
    color: #fff;
    background: rgb(var(--accent-rgb));
    border: none;

    &:hover { filter: brightness(0.95); }
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

  &--static { padding: 0.22rem 0.6rem; }

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
