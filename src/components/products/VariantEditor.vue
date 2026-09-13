<script setup>
/**
 * The product form's variant section.
 *
 * - `create`: the option builder (VariantAxisBuilder) generates one row per
 *   combination; the grouped table below edits them and a row opens the
 *   full-screen detail screen.
 * - `edit`: rows load from the API and stay editable, but SKUs are locked and
 *   rows cannot be removed - the API syncs variants by SKU and offers no delete.
 * - `view`: a plain read-only list.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import VariantAxisBuilder from './VariantAxisBuilder.vue'
import VariantDetailPanel from './VariantDetailPanel.vue'
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
  skuPart,
  slugifyPart,
  sumStock,
  validateVariants,
} from '@/services/variants'
import { uploadImage } from '@/services/media'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Array, required: true },
  baseSku: { type: String, default: '' },
  basePrice: { type: String, default: '' },
  seedImages: { type: Array, default: () => [] },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit', 'view'].includes(value),
  },
  promotions: { type: Array, default: () => [] },
  promotionIds: { type: Array, default: () => [] },
  productName: { type: String, default: 'Product' },
  productImage: { type: String, default: '' },
  productActive: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'update:valid', 'toggle-promotion'])

const auth = useAuthStore()

const isCreate = computed(() => props.mode === 'create')
const isView = computed(() => props.mode === 'view')

const rows = computed(() => props.modelValue)

const validation = computed(() => validateVariants(props.modelValue))
watch(
  () => validation.value.valid,
  (valid) => emit('update:valid', valid),
  { immediate: true },
)

function setRows(next) {
  emit('update:modelValue', next)
}

/* ------------------------------------------------------------- option axes */

const axes = ref([])

watch(
  [axes, () => props.baseSku],
  () => {
    if (!isCreate.value) return
    setRows(buildVariants(axes.value, props.baseSku, props.modelValue))
  },
  { deep: true },
)

/* ----------------------------------------------------------------- editing */

function patchRow(index, patch) {
  setRows(props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}

function removeRow(index) {
  setRows(normalizeDefault(props.modelValue.filter((_, i) => i !== index)))
  selected.value.delete(index)
}

/* ------------------------------------------------------------------ images */

const imagePool = computed(() => collectImagePool(props.modelValue, props.seedImages))
const uploadingIndex = ref(-1)
const uploadingGroup = ref('')
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

/* ---------------------------------------------------------------- grouping */

const axisNames = computed(() => deriveAxisNames(rows.value))
const isGrouped = computed(() => axisNames.value.length >= 2)

const groupBy = ref('')
watch(
  axisNames,
  (names) => {
    if (!names.includes(groupBy.value)) groupBy.value = names[0] ?? ''
  },
  { immediate: true },
)

const search = ref('')

function matchesSearch(row) {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  return (
    String(row.name ?? '').toLowerCase().includes(q) ||
    String(row.sku ?? '').toLowerCase().includes(q)
  )
}

/* ------------------------------------------------------------------ filters */

// One selected value per option (Size, Color, ...); '' means "any".
const filters = reactive({})
watch(
  axisNames,
  (names) => {
    for (const name of names) if (!(name in filters)) filters[name] = ''
    for (const key of Object.keys(filters)) if (!names.includes(key)) delete filters[key]
  },
  { immediate: true },
)

const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)

function axisValues(name) {
  const seen = new Set()
  for (const row of rows.value) {
    const v = row.attributes?.[name]
    if (v) seen.add(v)
  }
  return [...seen]
}

function matchesFilters(row) {
  return axisNames.value.every((name) => !filters[name] || (row.attributes?.[name] ?? '') === filters[name])
}

function clearFilters() {
  for (const name of axisNames.value) filters[name] = ''
}

function matches(row) {
  return matchesSearch(row) && matchesFilters(row)
}

// The panel is teleported to <body> so it can't be clipped by the table's
// `overflow: hidden`, so its position is computed from the button's rect
// instead of relying on CSS anchoring.
const filterOpen = ref(false)
const toolsRef = ref(null)
const filterBtnRef = ref(null)
const filterPanelRef = ref(null)
const filterPanelStyle = reactive({ top: '0px', left: '0px' })

function positionFilterPanel() {
  const btn = filterBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const panelWidth = 220
  filterPanelStyle.top = `${rect.bottom + 6}px`
  filterPanelStyle.left = `${Math.min(rect.left, window.innerWidth - panelWidth - 8)}px`
}

function toggleFilterPanel() {
  filterOpen.value = !filterOpen.value
  if (filterOpen.value) positionFilterPanel()
}

function onDocClick(event) {
  if (!filterOpen.value) return
  const inTools = toolsRef.value && toolsRef.value.contains(event.target)
  const inPanel = filterPanelRef.value && filterPanelRef.value.contains(event.target)
  if (!inTools && !inPanel) filterOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  window.addEventListener('resize', positionFilterPanel)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  window.removeEventListener('resize', positionFilterPanel)
})

// Flat rows (single option or ungrouped), carrying their real index.
const flatRows = computed(() =>
  rows.value
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => matches(row)),
)

const groups = computed(() => {
  if (!isGrouped.value) return []
  return groupVariants(rows.value, groupBy.value)
    .map((group) => ({
      ...group,
      items: group.items.filter(({ row }) => matches(row)),
    }))
    .filter((group) => group.items.length)
})

const collapsed = ref(new Set())
function toggleCollapse(value) {
  const next = new Set(collapsed.value)
  next.has(value) ? next.delete(value) : next.add(value)
  collapsed.value = next
}

const groupStock = (group) => sumStock(group.items)
const groupPrice = (group) => sharedFieldValue(group.items, 'price') ?? ''
const groupPriceMixed = (group) => sharedFieldValue(group.items, 'price') === null
const groupImage = (group) => sharedFieldValue(group.items, 'image') ?? ''
const groupHasError = (group) => group.items.some(({ index }) => validation.value.errors[index])

function patchGroup(group, patch) {
  const indexes = new Set(group.items.map((item) => item.index))
  setRows(props.modelValue.map((row, i) => (indexes.has(i) ? { ...row, ...patch } : row)))
}

function removeGroup(group) {
  const indexes = new Set(group.items.map((item) => item.index))
  setRows(normalizeDefault(props.modelValue.filter((_, i) => !indexes.has(i))))
  collapsed.value.delete(group.value)
}

/* ---------------------------------------------------------------- selection */

const selected = ref(new Set())

const visibleIndexes = computed(() =>
  isGrouped.value
    ? groups.value.flatMap((g) => g.items.map((i) => i.index))
    : flatRows.value.map((r) => r.index),
)

const allSelected = computed(
  () => visibleIndexes.value.length > 0 && visibleIndexes.value.every((i) => selected.value.has(i)),
)

function toggleSelect(index) {
  const next = new Set(selected.value)
  next.has(index) ? next.delete(index) : next.add(index)
  selected.value = next
}

function toggleAll() {
  const next = new Set(selected.value)
  const all = allSelected.value
  for (const i of visibleIndexes.value) all ? next.delete(i) : next.add(i)
  selected.value = next
}

function groupSelected(group) {
  return group.items.length > 0 && group.items.every(({ index }) => selected.value.has(index))
}

function toggleGroupSelect(group) {
  const next = new Set(selected.value)
  const all = groupSelected(group)
  for (const { index } of group.items) all ? next.delete(index) : next.add(index)
  selected.value = next
}

function removeSelected() {
  const drop = selected.value
  setRows(normalizeDefault(props.modelValue.filter((_, i) => !drop.has(i))))
  selected.value = new Set()
}

/* -------------------------------------------------------------- detail panel */

const panelOpen = ref(false)
const panelIndex = ref(-1)
const panelIsNew = ref(false)

function openDetail(index) {
  panelIndex.value = index
  panelIsNew.value = false
  panelOpen.value = true
}

function openNewVariant() {
  panelIsNew.value = true
  panelOpen.value = true
}

function selectVariant(index) {
  panelIndex.value = index
  panelIsNew.value = false
}

function deleteDetail(index) {
  removeRow(index)
  panelOpen.value = false
}

/**
 * Append a variant added by hand on the detail screen. Its name comes from the
 * option values typed there; a blank SKU gets a generated one, and the slug is
 * seeded from the SKU to stay clear of the global unique index.
 */
function appendVariant(row) {
  const attributes = row.attributes ?? {}
  const name = Object.values(attributes)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' / ')
  const sku =
    String(row.sku ?? '').trim() ||
    `${skuPart(name) || 'VAR'}-${Date.now().toString(36).toUpperCase()}`.slice(0, 64)

  const next = [
    ...props.modelValue,
    {
      ...row,
      attributes,
      name,
      sku,
      slug: row.slug || slugifyPart(sku),
      isDefault: props.modelValue.length === 0,
    },
  ]
  setRows(normalizeDefault(next))
  panelOpen.value = false
}

/* ---------------------------------------------------------------- read-only */

function formatPrice(value) {
  if (value === '' || value == null) return '—'
  const n = Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const attributePairs = (row) => Object.entries(row.attributes ?? {})
const selectedPromotions = computed(() =>
  props.promotions.filter((p) => props.promotionIds.includes(p.id)),
)
</script>

<template>
  <!-- Read-only. -->
  <div v-if="isView" class="ro">
    <p v-if="!rows.length" class="ro__empty">This product has no variants.</p>
    <ul v-else class="ro__list">
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
            <span v-if="row.barcode" class="ro__sku">{{ row.barcode }}</span>
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
    <div v-if="selectedPromotions.length" class="ro__promos">
      <p class="ro__promos-title">Applied promotions</p>
      <div v-for="promo in selectedPromotions" :key="promo.id" class="ro__promo">
        <span class="ro__promo-badge">{{ promo.benefit }}</span>
        <div>
          <p class="ro__promo-name">{{ promo.name }}</p>
          <p class="ro__promo-period">{{ promo.period }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Create / edit. -->
  <div v-else class="editor">
    <div v-if="!isCreate" class="editor__head">
      <h4>Variants{{ rows.length ? ` (${rows.length})` : '' }}</h4>
      <button type="button" class="editor__add" @click="openNewVariant">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        Add variant
      </button>
    </div>

    <VariantAxisBuilder v-if="isCreate" v-model:axes="axes" />
    <button v-if="isCreate" type="button" class="editor__addmanual" @click="openNewVariant">
      Add a variant manually
    </button>

    <p v-if="!isCreate && !rows.length" class="editor__note">
      This product has no variants. They can only be added when creating a product.
    </p>
    <p v-else-if="!isCreate && rows.length" class="editor__note">
      Prices, stock and images can be changed here. SKUs are locked and variants cannot be removed -
      the API syncs variants by SKU.
    </p>

    <div v-if="rows.length" class="vtable">
      <div ref="toolsRef" class="vtable__tools">
        <div class="vtable__search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" stroke-linecap="round" />
          </svg>
          <input v-model="search" type="search" placeholder="Search variants" />
        </div>

        <div v-if="axisNames.length" class="vtable__filterwrap">
          <button
            ref="filterBtnRef"
            type="button"
            class="vtable__icon"
            :class="{ 'is-active': filterOpen || activeFilterCount }"
            aria-label="Filter variants"
            title="Filter by option"
            @click="toggleFilterPanel"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
            </svg>
            <span v-if="activeFilterCount" class="vtable__filterbadge">{{ activeFilterCount }}</span>
          </button>

          <Teleport to="body">
            <div
              v-if="filterOpen"
              ref="filterPanelRef"
              class="vtable__filterpanel"
              :style="filterPanelStyle"
            >
              <label v-for="name in axisNames" :key="name" class="vtable__filterrow">
                <span>{{ name }}</span>
                <select v-model="filters[name]">
                  <option value="">Any {{ name }}</option>
                  <option v-for="value in axisValues(name)" :key="value" :value="value">{{ value }}</option>
                </select>
              </label>
              <button
                type="button"
                class="vtable__filterclear"
                :disabled="!activeFilterCount"
                @click="clearFilters"
              >
                Clear filters
              </button>
            </div>
          </Teleport>
        </div>
      </div>

      <div v-if="selected.size" class="vtable__bulk">
        <span>{{ selected.size }} selected</span>
        <button v-if="isCreate" type="button" @click="removeSelected">Delete</button>
      </div>

      <div class="vhead">
        <span class="vhead__check">
          <input type="checkbox" :checked="allSelected" aria-label="Select all variants" @change="toggleAll" />
        </span>
        <span>Variant</span>
        <span>Price</span>
        <span class="vhead__avail">Available</span>
        <span></span>
      </div>

      <!-- Grouped: two or more options. -->
      <template v-if="isGrouped">
        <div v-for="group in groups" :key="group.value" class="vgroup">
          <div class="ghead" :class="{ 'ghead--invalid': groupHasError(group) }">
            <span class="ghead__check">
              <input
                type="checkbox"
                :checked="groupSelected(group)"
                :aria-label="`Select all ${group.value} variants`"
                @change="toggleGroupSelect(group)"
              />
            </span>
            <button
              type="button"
              class="ghead__toggle"
              :aria-expanded="!collapsed.has(group.value)"
              :aria-label="`${collapsed.has(group.value) ? 'Expand' : 'Collapse'} ${group.value}`"
              @click="toggleCollapse(group.value)"
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

            <div class="ghead__body">
              <p class="ghead__name">{{ group.value }}</p>
              <p class="ghead__count">
                {{ group.items.length }} variant{{ group.items.length === 1 ? '' : 's' }}
              </p>
            </div>

            <span class="ghead__money">
              <span>$</span>
              <input
                :value="groupPrice(group)"
                type="text"
                inputmode="decimal"
                :placeholder="groupPriceMixed(group) ? 'Mixed' : basePrice || '0.00'"
                :title="`Applies to ${group.items.length} variant${group.items.length === 1 ? '' : 's'}`"
                @input="patchGroup(group, { price: $event.target.value })"
              />
            </span>

            <span class="ghead__avail" :title="`Total across ${group.items.length} variants`">
              {{ groupStock(group) }}
            </span>

            <button
              v-if="isCreate"
              type="button"
              class="ghead__remove"
              :aria-label="`Remove all ${group.value} variants`"
              @click="removeGroup(group)"
            >
              <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
            </button>
            <span v-else class="ghead__spacer"></span>
          </div>

          <template v-if="!collapsed.has(group.value)">
            <VariantRow
              v-for="item in group.items"
              :key="item.index"
              :row="item.row"
              :index="item.index"
              :label="childLabel(item.row, groupBy)"
              :pool="imagePool"
              :uploading="uploadingIndex === item.index"
              :base-price="basePrice"
              :selected="selected.has(item.index)"
              :removable="isCreate"
              :error="validation.errors[item.index] ?? ''"
              @patch="patchRow"
              @remove="removeRow"
              @upload="onUpload"
              @open="openDetail"
              @toggle-select="toggleSelect"
            />
          </template>
        </div>
      </template>

      <!-- A single option: one row per value. -->
      <template v-else>
        <VariantRow
          v-for="item in flatRows"
          :key="item.index"
          :row="item.row"
          :index="item.index"
          :pool="imagePool"
          :uploading="uploadingIndex === item.index"
          :base-price="basePrice"
          :selected="selected.has(item.index)"
          :removable="isCreate"
          :error="validation.errors[item.index] ?? ''"
          @patch="patchRow"
          @remove="removeRow"
          @upload="onUpload"
          @open="openDetail"
          @toggle-select="toggleSelect"
        />
      </template>

      <p v-if="uploadError" class="vtable__error">{{ uploadError }}</p>
    </div>

    <Teleport to="body">
      <VariantDetailPanel
        v-if="panelOpen"
        :rows="rows"
        :index="panelIndex"
        :is-new="panelIsNew"
        :axis-names="axisNames"
        :pool="imagePool"
        :can-delete="isCreate"
        :lock-sku="!isCreate"
        :promotions="promotions"
        :promotion-ids="promotionIds"
        :product-name="productName"
        :product-image="productImage"
        :product-active="productActive"
        @patch="patchRow"
        @append="appendVariant"
        @select="selectVariant"
        @delete="deleteDetail"
        @close="panelOpen = false"
        @toggle-promotion="emit('toggle-promotion', $event)"
      />
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.editor__head {
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

.editor__add {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-strong);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;

  &:hover { background: var(--surface-sunken); }

  svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; }
}

.editor__note {
  margin: 1rem 0 0;
  padding: 0.7rem 0.85rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-subtle);
  background: var(--surface-sunken);
  border-radius: 10px;
}

.editor__addmanual {
  display: inline-flex;
  align-items: center;
  margin-top: 0.6rem;
  padding: 0;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-subtle);
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover { color: rgb(var(--accent-rgb)); }
}

.vtable {
  margin-top: 1.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;

  &__tools {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    flex: none;
    color: var(--text-subtle);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;

    &:hover, &.is-active { color: var(--text-strong); background: var(--surface-sunken); }

    svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);

    &:focus-within { border-color: rgb(var(--accent-rgb)); }

    svg { width: 15px; height: 15px; stroke: var(--text-subtle); stroke-width: 1.8; flex: none; }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      font-size: 0.82rem;
      font-family: inherit;
      color: var(--text-strong);

      &:focus { outline: none; }
    }
  }

  &__filterwrap { position: relative; }

  &__filterbadge {
    position: absolute;
    top: -3px;
    right: -3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1;
    color: var(--ink-on-accent);
    background: rgb(var(--accent-rgb));
    border-radius: 999px;
  }

  &__filterpanel {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 220px;
    padding: 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-md);
  }

  &__filterrow {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-subtle);
    text-transform: capitalize;

    select {
      padding: 0.4rem 0.5rem;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 400;
      text-transform: none;
      color: var(--text-strong);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;

      &:focus { outline: none; border-color: rgb(var(--accent-rgb)); }
    }
  }

  &__filterclear {
    padding: 0.4rem 0;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    color: rgb(var(--accent-rgb));
    background: transparent;
    border: none;
    border-top: 1px solid var(--border-subtle);
    cursor: pointer;

    &:disabled { color: var(--text-faint); cursor: default; }
    &:not(:disabled):hover { filter: brightness(0.92); }
  }

  &__bulk {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.9rem;
    font-size: 0.8rem;
    color: var(--text-body);
    background: rgb(var(--accent-rgb) / 0.08);
    border-bottom: 1px solid var(--border-subtle);

    button {
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--danger);
      background: transparent;
      border: none;
      cursor: pointer;
    }
  }

  &__error {
    margin: 0;
    padding: 0.6rem 0.9rem;
    font-size: 0.78rem;
    color: var(--danger);
    background: var(--danger-bg);
  }
}

.vhead {
  display: grid;
  grid-template-columns: 34px 1fr 200px 90px 30px;
  gap: 0.6rem;
  align-items: center;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-sunken);

  span {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--text-subtle);
  }

  &__check { display: flex; }
  &__check input { width: 16px; height: 16px; margin: 0; accent-color: rgb(var(--accent-rgb)); }
  &__avail { text-align: left; }

  @media (max-width: 720px) {
    grid-template-columns: 34px 1fr auto;
    span:nth-child(3), span:nth-child(4) { display: none; }
  }
}

.vgroup {
  border-top: 1px solid var(--border-subtle);
  &:first-of-type { border-top: none; }
}

.ghead {
  display: grid;
  grid-template-columns: 34px 28px 48px 1fr 200px 90px 30px;
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0.9rem;
  background: var(--surface);

  &--invalid { background: var(--danger-bg); }

  @media (max-width: 720px) {
    grid-template-columns: 34px 28px 48px 1fr auto;
    .ghead__money, .ghead__avail { grid-column: 4 / -1; }
  }

  &__check { display: flex; }
  &__check input { width: 16px; height: 16px; margin: 0; accent-color: rgb(var(--accent-rgb)); }

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
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__count {
    margin: 0.1rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
  }

  &__money {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding-left: 0.55rem;
    background: var(--surface);

    &:focus-within {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    > span { font-size: 0.8rem; color: var(--text-subtle); }

    input {
      width: 100%;
      border: none;
      background: transparent;
      padding: 0.45rem 0.55rem;
      font-size: 0.82rem;
      font-family: inherit;
      color: var(--text-strong);

      &::placeholder { color: var(--text-faint); font-style: italic; }
      &:focus { outline: none; }
    }
  }

  &__avail {
    font-size: 0.85rem;
    color: var(--text-body);
  }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); }

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__spacer { display: block; width: 28px; }
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

  &--default { color: var(--accent-ink); background: rgb(var(--accent-rgb) / 0.16); }
  &--off { color: var(--text-subtle); background: var(--surface-sunken); }
}

.ro {
  &__empty { margin: 0; font-size: 0.8rem; color: var(--text-subtle); }
  &__list { margin: 0; padding: 0; list-style: none; }
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
  &__main { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  &__name { font-size: 0.88rem; font-weight: 600; color: var(--text-strong); }
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
  &__attrs { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem; }
  &__promos { margin-top: 1rem; }
  &__promos-title {
    margin: 0 0 0.5rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  &__promo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid rgb(var(--accent-rgb) / 0.4);
    background: rgb(var(--accent-rgb) / 0.1);
    border-radius: 10px;
  }
  &__promo-badge {
    padding: 0.28rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.28);
    border-radius: 999px;
    white-space: nowrap;
  }
  &__promo-name { margin: 0; font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  &__promo-period { margin: 0.15rem 0 0; font-size: 0.76rem; color: var(--text-subtle); }
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
