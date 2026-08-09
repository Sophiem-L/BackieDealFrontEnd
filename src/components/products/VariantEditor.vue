<script setup>
/**
 * The product form's variant section, in three modes.
 *
 * - `create`: the axis builder generates a row per combination; everything is
 *   editable and rows can be removed.
 * - `edit`: existing variants load from the API and stay editable, but SKUs are
 *   locked and rows cannot be removed. Both limits come from the API, not
 *   taste: `PUT` syncs variants by SKU, so renaming one silently creates a
 *   second variant, and nothing in the admin API deletes a variant at all.
 *   There is also no axis builder here — regenerating combinations would
 *   fabricate variants the product never had.
 * - `view`: a plain read-only list.
 *
 * See docs/superpowers/specs/2026-08-06-product-variant-editor-design.md.
 */
import { computed, ref, watch } from 'vue'
import VariantAxisBuilder from './VariantAxisBuilder.vue'
import VariantImagePicker from './VariantImagePicker.vue'
import VariantRow from './VariantRow.vue'
import {
  buildVariants,
  childLabel,
  collectImagePool,
  deriveAxisNames,
  groupVariants,
  normalizeDefault,
  sharedFieldValue,
  sumStock,
  validateVariants,
} from '@/services/variants'
import { uploadImage } from '@/services/media'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Array, required: true },
  // Seeds generated SKUs and slugs. Blank is tolerated; rows stay editable.
  baseSku: { type: String, default: '' },
  // Placeholder shown on a blank variant price, to signal inheritance.
  basePrice: { type: String, default: '' },
  // Images offered for reuse on top of whatever the rows already carry —
  // in practice the product thumbnail.
  seedImages: { type: Array, default: () => [] },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit', 'view'].includes(value),
  },
})

const isCreate = computed(() => props.mode === 'create')
const isView = computed(() => props.mode === 'view')

const emit = defineEmits(['update:modelValue', 'update:valid'])

const auth = useAuthStore()

const axes = ref([])

const rows = computed(() => props.modelValue)

const validation = computed(() => validateVariants(props.modelValue))

// The parent gates its submit button on this.
watch(
  () => validation.value.valid,
  (valid) => emit('update:valid', valid),
  { immediate: true },
)

function setRows(next) {
  emit('update:modelValue', next)
}

function generate() {
  setRows(buildVariants(axes.value, props.baseSku, props.modelValue))
}

/**
 * Rows follow the options live — there is no "generate" step. Watching the axes
 * deeply is safe because buildVariants carries prior rows over by their axis
 * values, so a keystroke mid-rename doesn't discard entered prices.
 */
watch(
  [axes, () => props.baseSku],
  () => {
    // Only the create flow derives rows from options. On edit they come from
    // the API, and regenerating would invent combinations the product lacks.
    if (!isCreate.value) return
    generate()
  },
  { deep: true },
)

function patchRow(index, patch) {
  setRows(props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}

function removeRow(index) {
  setRows(normalizeDefault(props.modelValue.filter((_, i) => i !== index)))
}

function makeDefault(index) {
  setRows(props.modelValue.map((row, i) => ({ ...row, isDefault: i === index })))
}

function clearAll() {
  axes.value = []
  setRows([])
}

// Images uploaded for one row stay offered to the others.
const imagePool = computed(() => collectImagePool(props.modelValue, props.seedImages))

// Row index currently uploading, so only that thumbnail shows a spinner.
const uploadingIndex = ref(-1)
const uploadError = ref('')

async function onUpload(index, file) {
  uploadingIndex.value = index
  uploadError.value = ''
  try {
    const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'variants' })
    patchRow(index, { image: url })
  } catch (err) {
    uploadError.value = err.message || 'Unable to upload that image.'
  } finally {
    uploadingIndex.value = -1
  }
}

/* ---------------------------------------------------------------- grouping */

// Taken from the rows themselves, so grouping works identically whether the
// rows came from the axis builder or from the API.
const axisNames = computed(() => deriveAxisNames(rows.value))

// Nesting only earns its keep from two options up; one option is already a
// one-row-per-value list.
const isGrouped = computed(() => axisNames.value.length >= 2)

const groupBy = ref('')

// Keep the choice pointing at an option that still exists.
watch(
  axisNames,
  (names) => {
    if (!names.includes(groupBy.value)) groupBy.value = names[0] ?? ''
  },
  { immediate: true },
)

const groups = computed(() => (isGrouped.value ? groupVariants(rows.value, groupBy.value) : []))

const collapsed = ref(new Set())

function toggleGroup(value) {
  const next = new Set(collapsed.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  collapsed.value = next
}

const groupStock = (group) => sumStock(group.items)
const groupPrice = (group) => sharedFieldValue(group.items, 'price') ?? ''
// Only rows that genuinely disagree count as mixed; all-blank is not mixed.
const groupPriceMixed = (group) => sharedFieldValue(group.items, 'price') === null
// The group thumbnail shows an image only when the whole group shares one.
const groupImage = (group) => sharedFieldValue(group.items, 'image') ?? ''
const groupHasError = (group) => group.items.some(({ index }) => validation.value.errors[index])

/** Apply one patch to every row in a group — Shopify's "applies to N variants". */
function patchGroup(group, patch) {
  const indexes = new Set(group.items.map((item) => item.index))
  setRows(props.modelValue.map((row, i) => (indexes.has(i) ? { ...row, ...patch } : row)))
}

function removeGroup(group) {
  const indexes = new Set(group.items.map((item) => item.index))
  setRows(normalizeDefault(props.modelValue.filter((_, i) => !indexes.has(i))))
}

// Uploading from a group header assigns the result to every row beneath it.
const uploadingGroup = ref('')

async function onGroupUpload(group, file) {
  uploadingGroup.value = group.value
  uploadError.value = ''
  try {
    const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'variants' })
    patchGroup(group, { image: url })
  } catch (err) {
    uploadError.value = err.message || 'Unable to upload that image.'
  } finally {
    uploadingGroup.value = ''
  }
}

const attributePairs = (row) => Object.entries(row.attributes ?? {})

function formatPrice(value) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <!-- Read-only: an existing product's variants, listed but not editable. -->
  <div v-if="isView" class="ro">
    <p v-if="!rows.length" class="ro__empty">This product has no variants.</p>

    <template v-else>
      <ul class="ro__list">
        <li v-for="(row, i) in rows" :key="i" class="ro__item">
          <div class="ro__thumb" :class="{ 'ro__thumb--empty': !row.image }">
            <img v-if="row.image" :src="row.image" :alt="`Image for ${row.name}`" />
            <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>

          <div class="ro__detail">
            <div class="ro__main">
              <span class="ro__name">{{ row.name }}</span>
              <span v-if="row.isDefault" class="badge badge--default">Default</span>
              <span v-if="!row.isActive" class="badge badge--off">Inactive</span>
            </div>
            <div class="ro__meta">
              <span class="ro__sku">{{ row.sku }}</span>
              <span>{{ formatPrice(row.price) }}</span>
              <span>{{ row.stock }} in stock</span>
            </div>
            <div v-if="attributePairs(row).length" class="ro__attrs">
              <span v-for="([key, value]) in attributePairs(row)" :key="key" class="chip chip--static">
                {{ key }}: {{ value }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>

  <!-- Create: axis builder plus the generated rows. Edit: the loaded rows. -->
  <div v-else class="editor">
    <VariantAxisBuilder v-if="isCreate" v-model:axes="axes" />

    <p v-if="!isCreate && !rows.length" class="editor__empty">
      This product has no variants. They can only be added when creating a product.
    </p>

    <p v-else-if="!isCreate" class="editor__note">
      Prices, stock and images can be changed here. SKUs are locked and variants cannot be
      removed — the API syncs variants by SKU, so a rename would create a duplicate, and it
      offers no way to delete one.
    </p>

    <div v-if="rows.length" class="rows">
      <div class="rows__head">
        <h4>Variants ({{ rows.length }})</h4>

        <div class="rows__tools">
          <label v-if="isGrouped" class="rows__groupby">
            <span>Group by</span>
            <select v-model="groupBy">
              <option v-for="name in axisNames" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <button v-if="isCreate" type="button" class="rows__clear" @click="clearAll">
            Clear all
          </button>
        </div>
      </div>

      <!-- Two or more options: a header per value of the grouping option, with
           its variants nested underneath. -->
      <template v-if="isGrouped">
        <div v-for="group in groups" :key="group.value" class="group">
          <div class="grouphead" :class="{ 'grouphead--invalid': groupHasError(group) }">
            <button
              type="button"
              class="grouphead__toggle"
              :aria-expanded="!collapsed.has(group.value)"
              :aria-label="`${collapsed.has(group.value) ? 'Expand' : 'Collapse'} ${group.value}`"
              @click="toggleGroup(group.value)"
            >
              <svg viewBox="0 0 24 24" fill="none" :class="{ 'is-collapsed': collapsed.has(group.value) }">
                <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <VariantImagePicker
              :model-value="groupImage(group)"
              :pool="imagePool"
              :uploading="uploadingGroup === group.value"
              :label="group.value"
              @update:model-value="patchGroup(group, { image: $event })"
              @upload="onGroupUpload(group, $event)"
            />

            <div class="grouphead__body">
              <p class="grouphead__name">{{ group.value }}</p>
              <p class="grouphead__count">
                {{ group.items.length }} variant{{ group.items.length === 1 ? '' : 's' }}
              </p>
            </div>

            <label class="grouphead__price">
              <span>Price</span>
              <input
                :value="groupPrice(group)"
                type="text"
                inputmode="decimal"
                :placeholder="groupPriceMixed(group) ? 'Mixed' : basePrice || '0.00'"
                :title="`Applies to ${group.items.length} variant${group.items.length === 1 ? '' : 's'}`"
                @input="patchGroup(group, { price: $event.target.value })"
              />
            </label>

            <!--
              With one variant the group IS that variant, so its stock is
              editable here. With several it is a roll-up and there is no
              sensible way to split a typed number, so it reads as a total.
            -->
            <label v-if="group.items.length === 1" class="grouphead__price">
              <span>Available</span>
              <input
                :value="group.items[0].row.stock"
                type="number"
                min="0"
                @input="patchRow(group.items[0].index, { stock: $event.target.value })"
              />
            </label>
            <div v-else class="grouphead__stock">
              <span>Available</span>
              <p :title="`Total across ${group.items.length} variants — edit each below`">
                {{ groupStock(group) }}
              </p>
            </div>

            <button
              v-if="isCreate"
              type="button"
              class="grouphead__remove"
              :aria-label="`Remove all ${group.value} variants`"
              @click="removeGroup(group)"
            >
              <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
            </button>
            <span v-else class="grouphead__spacer"></span>
          </div>

          <template v-if="!collapsed.has(group.value)">
            <VariantRow
              v-for="item in group.items"
              :key="item.index"
              nested
              :row="item.row"
              :index="item.index"
              :label="childLabel(item.row, groupBy)"
              :pool="imagePool"
              :uploading="uploadingIndex === item.index"
              :base-price="basePrice"
              :lock-sku="!isCreate"
              :removable="isCreate"
              :error="validation.errors[item.index] ?? ''"
              @patch="patchRow"
              @remove="removeRow"
              @make-default="makeDefault"
              @upload="onUpload"
            />
          </template>
        </div>
      </template>

      <!-- A single option is already one row per value; nesting adds nothing. -->
      <template v-else>
        <VariantRow
          v-for="(row, i) in rows"
          :key="i"
          :row="row"
          :index="i"
          :pool="imagePool"
          :uploading="uploadingIndex === i"
          :base-price="basePrice"
          :lock-sku="!isCreate"
          :removable="isCreate"
          :error="validation.errors[i] ?? ''"
          @patch="patchRow"
          @remove="removeRow"
          @make-default="makeDefault"
          @upload="onUpload"
        />
      </template>

      <p v-if="uploadError" class="rows__error">{{ uploadError }}</p>

      <p class="rows__hint">
        A blank price inherits the product's base price. The selected row is the default variant.
        An image set on a {{ isGrouped ? groupBy.toLowerCase() : 'variant' }} row applies to
        {{ isGrouped ? 'every variant under it' : 'that variant' }}, and can be reused elsewhere.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rows {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-subtle);

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

  &__tools {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  &__groupby {
    display: flex;
    align-items: center;
    gap: 0.35rem;

    span {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-subtle);
    }

    select {
      padding: 0.25rem 0.4rem;
      font-size: 0.78rem;
      font-family: inherit;
      color: var(--text-strong);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 7px;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: rgb(var(--accent-rgb));
      }
    }
  }

  &__clear {
    padding: 0.25rem 0.45rem;
    font-size: 0.76rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-subtle);
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover { color: var(--danger); }
  }

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }

  &__error {
    margin: 0.75rem 0 0;
    padding: 0.5rem 0.7rem;
    font-size: 0.78rem;
    color: var(--danger);
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: 8px;
  }
}

.group {
  & + & { margin-top: 0.6rem; }
}

.grouphead {
  display: grid;
  // chevron | image | name | price | available | remove
  grid-template-columns: auto auto 1fr 120px 90px auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-sunken);

  &--invalid { border-color: var(--danger-border); }

  @media (max-width: 720px) {
    grid-template-columns: auto auto 1fr auto;

    &__price,
    &__stock { grid-column: 3 / -1; }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-subtle);
    cursor: pointer;

    svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      transition: transform 0.15s ease;

      &.is-collapsed { transform: rotate(-90deg); }
    }
  }

  &__body { min-width: 0; }

  &__name {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__count {
    margin: 0.1rem 0 0;
    font-size: 0.72rem;
    color: var(--text-subtle);
  }

  &__price {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;

    span {
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-subtle);
    }

    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 0.42rem 0.55rem;
      font-size: 0.82rem;
      font-family: inherit;
      color: var(--text-strong);
      background: var(--surface);

      &::placeholder { color: var(--text-faint); font-style: italic; }

      &:focus {
        outline: none;
        border-color: rgb(var(--accent-rgb));
        box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
      }
    }
  }

  &__stock {
    min-width: 0;

    span {
      display: block;
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-subtle);
    }

    p {
      margin: 0.3rem 0 0;
      font-size: 0.86rem;
      font-weight: 600;
      color: var(--text-strong);
    }
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); }

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__spacer {
    display: block;
    width: 30px;
  }
}

.editor {
  &__empty,
  &__note {
    margin: 0 0 1rem;
    padding: 0.7rem 0.85rem;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--text-subtle);
    background: var(--surface-sunken);
    border-radius: 10px;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.4rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;
  white-space: nowrap;

  &--default {
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.16);
  }

  &--off {
    color: var(--text-subtle);
    background: var(--surface-sunken);
  }
}

.ro {
  &__empty,
  &__note {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--text-subtle);
  }

  &__note {
    padding: 0.7rem 0.85rem;
    background: var(--surface-sunken);
    border-radius: 10px;
  }

  &__list {
    margin: 0.85rem 0 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;

    & + & { margin-top: 0.5rem; }
  }

  &__detail { min-width: 0; }

  &__thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 44px;
    height: 44px;
    overflow: hidden;
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;

    &--empty { border-style: dashed; }

    img { width: 100%; height: 100%; object-fit: cover; }

    svg { width: 18px; height: 18px; stroke: var(--text-faint); stroke-width: 1.6; }
  }

  &__main {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  &__name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex-wrap: wrap;
    margin-top: 0.3rem;
    font-size: 0.78rem;
    color: var(--text-subtle);
  }

  &__sku {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.74rem;
    color: var(--text-body);
  }

  &__attrs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.5rem;
  }
}

.chip--static {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  font-size: 0.74rem;
  color: var(--text-body);
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  white-space: nowrap;
}
</style>
