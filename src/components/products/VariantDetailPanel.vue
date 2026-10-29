<script setup>
/**
 * Full-screen editor for one variant, modelled on Shopify's "Add variant"
 * screen: a searchable list of every variant on the left, and on the right the
 * media, the option values (Size / Color / ...), pricing and the SKU / barcode.
 *
 * No inventory section - stock is edited in the grouped table on the product
 * form. Edits are applied live to the row via `patch`; a brand-new variant is
 * held locally until Done, then emitted with `append`.
 *
 * Serial numbers are the exception to "no inventory": when the product tracks
 * them, each variant lists the units typed here. They only wait on the row; the
 * product form receives them once the product has been saved.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ACCEPT_ATTR, uploadImage } from '@/services/media'
import { MAX_SERIALS_PER_VARIANT, addSerials, blankRow, parseSerialInput } from '@/services/variants'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  // Index of the row being edited; ignored while `isNew`.
  index: { type: Number, default: -1 },
  isNew: { type: Boolean, default: false },
  // Option names to show a value field for (Size, Color, Type…).
  axisNames: { type: Array, default: () => [] },
  pool: { type: Array, default: () => [] },
  lockSku: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: true },
  promotions: { type: Array, default: () => [] },
  promotionIds: { type: Array, default: () => [] },
  productName: { type: String, default: 'Product' },
  productImage: { type: String, default: '' },
  productActive: { type: Boolean, default: true },
  // The product's "Track individual serial numbers" switch. The API refuses
  // serials for a product that doesn't have it on, so the entry box stays hidden
  // until it is; the card's own switch turns it on via `update:serialized`.
  serialized: { type: Boolean, default: false },
})

const emit = defineEmits(['patch', 'append', 'delete', 'select', 'close', 'toggle-promotion', 'update:serialized', 'set-default'])

const auth = useAuthStore()

// Which option names to render fields for: the product's, or a sane default.
const optionNames = computed(() =>
  props.axisNames.length ? props.axisNames : ['Size', 'Color'],
)

// A blank row for the "add variant" flow, pre-keyed with the option names.
const newRow = reactive({
  ...blankRow(),
  attributes: Object.fromEntries(optionNames.value.map((name) => [name, ''])),
})

const current = computed(() => (props.isNew ? newRow : (props.rows[props.index] ?? blankRow())))

function variantName(attributes) {
  return Object.values(attributes)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' / ')
}

function apply(patch) {
  if (props.isNew) Object.assign(newRow, patch)
  else emit('patch', props.index, patch)
}

function setAttr(name, value) {
  const attributes = { ...(current.value.attributes ?? {}), [name]: value }
  apply({ attributes, name: variantName(attributes) })
}

function setField(field, value) {
  apply({ [field]: value })
}

// There is always exactly one default, so it can be handed to this variant but
// not taken away - picking another variant moves it.
function makeDefault(checked) {
  if (props.isNew) newRow.isDefault = checked
  else if (checked) emit('set-default', props.index)
}

/* ------------------------------------------------------------------ pricing */

const moreOpen = ref(false)

/* ----------------------------------------------------------------- serials */

const serialInput = ref('')
const serialNote = ref('')

const serials = computed(() => current.value.serials ?? [])

// A serial is one physical unit, so it can't also sit on another variant.
const takenElsewhere = computed(() =>
  props.rows.flatMap((row, i) => (!props.isNew && i === props.index ? [] : (row.serials ?? []))),
)

// A variant takes one serial number. What is already saved on it counts, so the
// entry stays locked after the product is saved, not only while one is waiting.
const serialRoom = computed(() =>
  Math.max(0, MAX_SERIALS_PER_VARIANT - (current.value.receivedSerials ?? 0) - serials.value.length),
)
const serialLocked = computed(() => serialRoom.value === 0)

function receiveSerials(text) {
  if (serialLocked.value) return
  const { serials: added, duplicates } = addSerials(serials.value, text, takenElsewhere.value)
  const next = added.slice(0, serials.value.length + serialRoom.value)
  const surplus = added.slice(next.length)
  setField('serials', next)

  const notes = []
  if (duplicates.length) notes.push(`Skipped, already in use: ${duplicates.join(', ')}`)
  if (surplus.length) {
    notes.push(`Each variant can have only ${MAX_SERIALS_PER_VARIANT} serial number. Skipped: ${surplus.join(', ')}`)
  }
  serialNote.value = notes.join('. ')
}

function commitSerial() {
  if (!serialInput.value.trim()) return
  receiveSerials(serialInput.value)
  serialInput.value = ''
}

// A single-line input drops the line breaks from a pasted list, gluing the
// serials together, so a multi-serial paste is taken over and split here.
function onSerialPaste(event) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (parseSerialInput(text).length < 2) return
  event.preventDefault()
  receiveSerials(text)
}

function removeSerial(serial) {
  setField('serials', serials.value.filter((candidate) => candidate !== serial))
  serialNote.value = ''
}

// What was half-typed or reported for one variant means nothing on the next.
watch(
  () => [props.index, props.isNew],
  () => {
    serialInput.value = ''
    serialNote.value = ''
  },
)

/* ------------------------------------------------------------------- media */

const fileInput = ref(null)
const uploading = ref(false)
const uploadError = ref('')

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'variants' })
    setField('image', url)
  } catch (err) {
    uploadError.value = err.message || 'Unable to upload that image.'
  } finally {
    uploading.value = false
  }
}

/* ---------------------------------------------------------------- the list */

const search = ref('')
const filters = reactive(Object.fromEntries(optionNames.value.map((name) => [name, ''])))

const listRows = computed(() =>
  props.rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => {
      const q = search.value.trim().toLowerCase()
      if (q && !String(row.name ?? '').toLowerCase().includes(q) && !String(row.sku ?? '').toLowerCase().includes(q)) {
        return false
      }
      return optionNames.value.every((name) => {
        const want = filters[name]
        return !want || (row.attributes?.[name] ?? '') === want
      })
    }),
)

function axisValues(name) {
  const seen = new Set()
  for (const row of props.rows) {
    const v = row.attributes?.[name]
    if (v) seen.add(v)
  }
  return [...seen]
}

function pickVariant(i) {
  emit('select', i)
}

/* --------------------------------------------------------------- done / del */

function done() {
  if (props.isNew && variantName(newRow.attributes)) emit('append', { ...newRow })
  emit('close')
}

function isPromotionSelected(id) {
  return props.promotionIds.includes(id)
}

function onKeydown(event) {
  if (event.key === 'Escape') done()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="vp" @click.self="done">
  <div class="vp__dialog" role="dialog" aria-modal="true" aria-label="Variant details">
    <header class="vp__bar">
      <nav class="vp__crumbs">
        <button type="button" class="vp__crumb" @click="done">{{ productName }}</button>
        <span aria-hidden="true">›</span>
        <span class="vp__crumb vp__crumb--current">{{ isNew ? 'Add variant' : current.name || 'Variant' }}</span>
      </nav>
      <div class="vp__actions">
        <button v-if="!isNew && canDelete" type="button" class="vp__delete" @click="emit('delete', index)">
          Delete
        </button>
        <button type="button" class="vp__done" @click="done">Done</button>
      </div>
    </header>

    <div class="vp__cols">
      <!-- Left: variant list -->
      <aside class="vp__side">
        <div class="pcard">
          <div class="pcard__thumb" :class="{ 'pcard__thumb--empty': !productImage }">
            <img v-if="productImage" :src="productImage" alt="" />
            <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="pcard__body">
            <p class="pcard__name">{{ productName }}</p>
            <span class="pcard__status" :class="{ 'pcard__status--on': productActive }">
              {{ productActive ? 'Active' : 'Draft' }}
            </span>
            <p class="pcard__count">{{ rows.length }} variant{{ rows.length === 1 ? '' : 's' }}</p>
          </div>
        </div>

        <div class="vp__searchbar">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" stroke-linecap="round" />
          </svg>
          <input v-model="search" type="search" placeholder="Search variants" />
        </div>

        <div v-if="optionNames.length && rows.length" class="vp__filters">
          <label v-for="name in optionNames" :key="name" class="vp__filter">
            <select v-model="filters[name]">
              <option value="">{{ name }}</option>
              <option v-for="value in axisValues(name)" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
        </div>

        <p class="vp__listcount">{{ listRows.length }} variant{{ listRows.length === 1 ? '' : 's' }}</p>

        <ul class="vp__list">
          <li v-for="entry in listRows" :key="entry.i">
            <button
              type="button"
              class="vp__listitem"
              :class="{ 'is-active': !isNew && entry.i === index }"
              @click="pickVariant(entry.i)"
            >
              <span class="vp__listthumb" :class="{ 'vp__listthumb--empty': !entry.row.image }">
                <img v-if="entry.row.image" :src="entry.row.image" alt="" />
                <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="vp__listname">{{ entry.row.name || 'Untitled' }}</span>
              <span v-if="entry.row.isDefault" class="vp__listdefault">Default</span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- Right: the variant -->
      <div class="vp__main">
        <section class="card">
          <div class="media">
            <button
              type="button"
              class="media__tile"
              :class="{ 'media__tile--empty': !current.image }"
              :aria-label="current.image ? 'Change variant image' : 'Add variant image'"
              @click="pickFile"
            >
              <span v-if="uploading" class="media__spinner" aria-hidden="true"></span>
              <img v-else-if="current.image" :src="current.image" alt="" />
              <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke-linecap="round" />
              </svg>
            </button>
            <div class="media__text">
              <p class="media__label">Variant image</p>
              <p class="media__hint">JPG, PNG, GIF, WebP or SVG. Up to 5MB.</p>
              <div v-if="pool.length" class="media__pool">
                <button
                  v-for="url in pool"
                  :key="url"
                  type="button"
                  class="media__poolitem"
                  :class="{ 'is-active': url === current.image }"
                  @click="setField('image', url)"
                >
                  <img :src="url" alt="" />
                </button>
              </div>
            </div>
          </div>
          <p v-if="uploadError" class="media__error">{{ uploadError }}</p>

          <div class="fields">
            <label v-for="name in optionNames" :key="name" class="field">
              <span>{{ name }}</span>
              <input
                :value="current.attributes?.[name] ?? ''"
                type="text"
                :placeholder="`Enter ${name.toLowerCase()}`"
                @input="setAttr(name, $event.target.value)"
              />
            </label>
          </div>
        </section>

        <section class="card">
          <h3 class="card__title">Price</h3>
          <label class="field field--money">
            <span class="sr-only">Price</span>
            <span class="money">
              <span>$</span>
              <input
                :value="current.price"
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                @input="setField('price', $event.target.value)"
              />
            </span>
          </label>

          <button type="button" class="card__more" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen">
            <span class="pill">Compare-at</span>
            <span class="pill">Cost per item</span>
            <svg viewBox="0 0 24 24" fill="none" :class="{ 'is-open': moreOpen }" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div v-if="moreOpen" class="grid2">
            <label class="field">
              <span>Compare-at price</span>
              <span class="money">
                <span>$</span>
                <input
                  :value="current.compareAt"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  @input="setField('compareAt', $event.target.value)"
                />
              </span>
            </label>
            <label class="field">
              <span>Cost per item</span>
              <span class="money">
                <span>$</span>
                <input
                  :value="current.costPrice"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  @input="setField('costPrice', $event.target.value)"
                />
              </span>
            </label>
          </div>
        </section>

        <section class="card">
          <h3 class="card__title">More details</h3>
          <div class="grid2">
            <label class="field">
              <span>SKU (Stock Keeping Unit)</span>
              <input
                :value="current.sku"
                type="text"
                :readonly="lockSku"
                :title="lockSku ? 'A variant SKU cannot be changed after the product is created.' : null"
                @input="apply({ sku: $event.target.value, skuTouched: true })"
              />
            </label>
            <label class="field">
              <span>Barcode (ISBN, UPC, GTIN, etc.)</span>
              <input
                :value="current.barcode"
                type="text"
                @input="setField('barcode', $event.target.value)"
              />
            </label>
          </div>
          <label class="default-toggle">
            <input
              type="checkbox"
              :checked="current.isDefault"
              :disabled="!isNew && current.isDefault"
              @change="makeDefault($event.target.checked)"
            />
            <span>
              <strong>Default variant</strong>
              <small>
                {{
                  !isNew && current.isDefault
                    ? 'This is the default. To change it, mark another variant as the default.'
                    : 'The variant the store opens on before a customer chooses one.'
                }}
              </small>
            </span>
          </label>
        </section>

        <section class="card">
          <h3 class="card__title">Serial numbers</h3>
          <label class="serial-track">
            <input
              type="checkbox"
              aria-label="Track serial numbers"
              :checked="serialized"
              @change="emit('update:serialized', $event.target.checked)"
            />
            <span>
              <strong>Track serial numbers</strong>
              <small>Applies to the whole product, so every variant is received and sold by serial.</small>
            </span>
          </label>
          <template v-if="serialized">
            <p class="card__hint">
              Each variant has one serial number. Type it and press Enter. It is received when you
              save the product; stock is still set in the variants table.
            </p>
            <div class="serial-add">
              <input
                v-model="serialInput"
                type="text"
                autocomplete="off"
                :placeholder="serialLocked ? 'This variant already has a serial number' : 'Enter serial number'"
                aria-label="Serial number"
                :disabled="serialLocked"
                @keydown.enter.prevent="commitSerial"
                @paste="onSerialPaste"
              />
              <button
                type="button"
                class="serial-add__btn"
                :disabled="serialLocked || !serialInput.trim()"
                @click="commitSerial"
              >
                Add
              </button>
            </div>
            <p v-if="current.receivedSerials" class="serial-count">
              This variant already has a serial number, so no more can be added.
            </p>
            <p v-if="serialNote" class="serial-note">{{ serialNote }}</p>
            <ul v-if="serials.length" class="serial-list">
              <li v-for="serial in serials" :key="serial" class="serial-chip">
                <span>{{ serial }}</span>
                <button type="button" :aria-label="`Remove serial number ${serial}`" @click="removeSerial(serial)">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
                  </svg>
                </button>
              </li>
            </ul>
            <p class="serial-count">
              {{ serials.length }} serial number{{ serials.length === 1 ? '' : 's' }} waiting to be received
            </p>
          </template>
        </section>

        <section v-if="promotions.length" class="card">
          <h3 class="card__title">Promotions</h3>
          <p class="card__hint">Promotions apply to the whole product, across every variant.</p>
          <ul class="promo-list">
            <li v-for="promo in promotions" :key="promo.id">
              <label class="promo" :class="{ 'is-selected': isPromotionSelected(promo.id) }">
                <input
                  type="checkbox"
                  :checked="isPromotionSelected(promo.id)"
                  @change="emit('toggle-promotion', promo.id)"
                />
                <span class="promo__meta">
                  <span class="promo__name">{{ promo.name }}</span>
                  <span class="promo__period">{{ promo.period }}</span>
                </span>
                <span class="promo__benefit">{{ promo.benefit }}</span>
              </label>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <input ref="fileInput" type="file" :accept="ACCEPT_ATTR" hidden @change="onFileChange" />
  </div>
  </div>
</template>

<style scoped lang="scss">
.vp {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--backdrop);

  &__dialog {
    display: flex;
    flex-direction: column;
    width: min(1100px, 100%);
    max-height: min(88vh, 800px);
    background: var(--bg);
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(20, 23, 28, 0.25);
    overflow: hidden;
  }

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border-subtle);
  }

  &__crumbs {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }

  &__crumb {
    padding: 0;
    background: transparent;
    border: none;
    font: inherit;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover:not(&--current) { color: var(--text-body); }

    &--current { color: var(--text-strong); font-weight: 700; cursor: default; }
  }

  &__actions { display: flex; align-items: center; gap: 0.6rem; }

  &__delete {
    padding: 0.5rem 0.9rem;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--danger);
    background: transparent;
    border: 1px solid var(--danger-border);
    border-radius: 9px;
    cursor: pointer;

    &:hover { background: var(--danger-bg); }
  }

  &__done {
    padding: 0.5rem 1.1rem;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    color: #fff;
    background: rgb(var(--accent-rgb));
    border: none;
    border-radius: 9px;
    cursor: pointer;

    &:hover { filter: brightness(0.95); }
  }

  &__cols {
    flex: 1;
    display: grid;
    grid-template-columns: 320px 1fr;
    min-height: 0;

    @media (max-width: 860px) { grid-template-columns: 1fr; }
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-right: 1px solid var(--border-subtle);
    overflow-y: auto;

    @media (max-width: 860px) { display: none; }
  }

  &__searchbar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);

    &:focus-within { border-color: rgb(var(--accent-rgb)); }

    svg { width: 15px; height: 15px; stroke: var(--text-subtle); stroke-width: 1.8; flex: none; }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      font: inherit;
      font-size: 0.82rem;
      color: var(--text-strong);
      &:focus { outline: none; }
    }
  }

  &__filters { display: flex; flex-wrap: wrap; gap: 0.4rem; }

  &__filter select {
    padding: 0.3rem 0.5rem;
    font: inherit;
    font-size: 0.76rem;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    &:focus { outline: none; border-color: rgb(var(--accent-rgb)); }
  }

  &__listcount { margin: 0.25rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }

  &__list { list-style: none; margin: 0; padding: 0; }

  &__listitem {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.6rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover { background: var(--surface-sunken); }
    &.is-active { background: rgb(var(--accent-rgb) / 0.12); }
  }

  &__listthumb {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 26px;
    height: 26px;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--surface-sunken);

    &--empty { border-style: dashed; }

    img { width: 100%; height: 100%; object-fit: cover; }
    svg { width: 13px; height: 13px; stroke: var(--text-faint); stroke-width: 1.6; }
  }

  &__listname { font-size: 0.83rem; color: var(--text-strong); }
  &__listdefault {
    margin-left: auto;
    padding: 0.05rem 0.4rem;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    color: rgb(var(--accent-rgb));
    background: rgb(var(--accent-rgb) / 0.12);
    border-radius: 999px;
  }

  &__main {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    overflow-y: auto;
  }
}

.pcard {
  display: flex;
  gap: 0.7rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;

  &__thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 48px;
    height: 48px;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    background: var(--surface-sunken);
    &--empty { border-style: dashed; }
    img { width: 100%; height: 100%; object-fit: cover; }
    svg { width: 18px; height: 18px; stroke: var(--text-faint); stroke-width: 1.6; }
  }

  &__body { min-width: 0; }
  &__name { margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--text-strong); }

  &__status {
    display: inline-flex;
    margin-top: 0.25rem;
    padding: 0.05rem 0.4rem;
    font-size: 0.66rem;
    font-weight: 700;
    border-radius: 999px;
    color: var(--text-subtle);
    background: var(--surface-sunken);
    &--on { color: var(--success-ink); background: var(--success-bg); }
  }

  &__count { margin: 0.35rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;
  max-width: 640px;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__hint { margin: 0 0 0.75rem; font-size: 0.74rem; color: var(--text-subtle); }

  &__more {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    margin-top: 0.85rem;
    padding: 0.6rem;
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    font: inherit;
    cursor: pointer;

    svg {
      width: 16px;
      height: 16px;
      margin-left: auto;
      stroke: var(--text-subtle);
      stroke-width: 2;
      transition: transform 0.15s ease;
      &.is-open { transform: rotate(180deg); }
    }
  }
}

.pill {
  padding: 0.2rem 0.55rem;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.media {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  margin-bottom: 1.1rem;

  &__tile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 84px;
    height: 84px;
    flex: none;
    overflow: hidden;
    background: var(--surface-sunken);
    border: 1px solid var(--border);
    border-radius: 12px;
    cursor: pointer;

    &--empty { border-style: dashed; }
    &:hover { border-color: rgb(var(--accent-rgb)); }

    img { width: 100%; height: 100%; object-fit: cover; }
    svg { width: 22px; height: 22px; stroke: var(--text-subtle); stroke-width: 1.8; }
  }

  &__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgb(var(--accent-rgb) / 0.3);
    border-top-color: rgb(var(--accent-rgb));
    border-radius: 50%;
    animation: vp-spin 0.7s linear infinite;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  &__label {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-body);
  }

  &__hint {
    margin: 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }

  &__pool {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.4rem;
  }

  &__error {
    flex-basis: 100%;
    margin: 0.5rem 0 0;
    font-size: 0.76rem;
    color: var(--danger);
  }

  &__poolitem {
    width: 40px;
    height: 40px;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    cursor: pointer;

    &:hover { border-color: rgb(var(--accent-rgb)); }
    &.is-active { border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 0.28); }

    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }
}

@keyframes vp-spin { to { transform: rotate(360deg); } }

.fields { display: flex; flex-direction: column; gap: 0.85rem; }

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 0.85rem;

  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  > span {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-body);
  }

  input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 0.6rem 0.75rem;
    font: inherit;
    font-size: 0.88rem;
    color: var(--text-strong);
    background: var(--surface);

    &::placeholder { color: var(--text-faint); }
    &:focus { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }
    &:read-only { background: var(--surface-sunken); color: var(--text-muted); }
  }

  &--money { max-width: 220px; }
}

.money {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 9px;
  padding-left: 0.7rem;
  background: var(--surface);

  &:focus-within { border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }

  > span { font-size: 0.88rem; color: var(--text-subtle); }

  input { border: none; box-shadow: none; &:focus { box-shadow: none; } }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.serial-track {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  cursor: pointer;

  input[type='checkbox'] { width: 18px; height: 18px; margin: 0.1rem 0 0; flex: none; accent-color: rgb(var(--accent-rgb)); cursor: pointer; }

  span { display: flex; flex-direction: column; gap: 0.15rem; }
  strong { font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  small { font-size: 0.74rem; color: var(--text-subtle); }
}

.default-toggle {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-top: 1rem;
  cursor: pointer;

  input[type='checkbox'] { width: 18px; height: 18px; margin: 0.1rem 0 0; flex: none; accent-color: rgb(var(--accent-rgb)); cursor: pointer; }
  input:disabled { cursor: default; }

  span { display: flex; flex-direction: column; gap: 0.15rem; }
  strong { font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  small { font-size: 0.74rem; color: var(--text-subtle); }
}

.serial-add {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;

  input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 0.6rem 0.75rem;
    font: inherit;
    font-size: 0.88rem;
    color: var(--text-strong);
    background: var(--surface);

    &::placeholder { color: var(--text-faint); }
    &:focus { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }
  }

  &__btn {
    padding: 0.5rem 1.1rem;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    color: #fff;
    background: rgb(var(--accent-rgb));
    border: none;
    border-radius: 9px;
    cursor: pointer;

    &:hover:not(:disabled) { filter: brightness(0.95); }
    &:disabled { opacity: 0.45; cursor: default; }
  }
}

.serial-note { margin: 0.5rem 0 0; font-size: 0.76rem; color: var(--danger); }

.serial-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.serial-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.3rem 0.25rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  border-radius: 999px;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;

    &:hover { background: var(--border-subtle); }
    svg { width: 11px; height: 11px; stroke: var(--text-subtle); stroke-width: 2.4; }
  }
}

.serial-count { margin: 0.75rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }

.promo-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }

.promo {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.7rem;
  background: var(--surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;

  &:hover { border-color: var(--border); background: var(--surface-sunken); }
  &.is-selected { border-color: rgb(var(--accent-rgb)); background: rgb(var(--accent-rgb) / 0.1); }

  input[type='checkbox'] { width: 18px; height: 18px; margin: 0; flex: none; accent-color: rgb(var(--accent-rgb)); cursor: pointer; }

  &__meta { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  &__name { font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  &__period { font-size: 0.74rem; color: var(--text-subtle); }
  &__benefit {
    padding: 0.28rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.28);
    border-radius: 999px;
    white-space: nowrap;
  }
}
</style>
