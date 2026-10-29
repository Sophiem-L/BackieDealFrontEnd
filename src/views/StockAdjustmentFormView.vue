<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToastStack from '@/components/ToastStack.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORM_SELECT } from '@/lib/selectPresets'
import { fetchStockCatalog, createBulkStockMovement } from '@/services/stock'
import { fetchSerials, lookupSerial } from '@/services/serials'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// `tone` picks the dot colour from the theme tokens (see .type-dot in the
// styles); the same value-to-tone mapping drives the badges on the detail page.
const adjustmentTypes = [
  { value: 'Inventory Recount', label: 'Inventory Recount', description: 'Regular count and verification', tone: 'info' },
  { value: 'Damaged Goods', label: 'Damaged Goods', description: 'Items too damaged to sell', tone: 'danger' },
  { value: 'Customer Return', label: 'Customer Return', description: 'Items returned by customers', tone: 'warning' },
  { value: 'Supplier Delivery', label: 'Supplier Delivery', description: 'Stock received from suppliers', tone: 'success' },
  { value: 'Theft / Loss', label: 'Theft / Loss', description: 'Missing or stolen items', tone: 'danger' },
  { value: 'Correction', label: 'Correction', description: 'System error correction', tone: 'violet' },
]

const product = ref(null)
const submitting = ref(false)
const submitError = ref('')
const toasts = ref([])
const drawer = reactive({
  open: false,
  variantId: null,
  mode: 'increase',
  input: '',
  search: '',
  selectedSerials: [],
  // What the variant already holds, as { serial, status }. `existingLoaded` flips
  // once the list has come back, until then the catalog's count stands in.
  existingSerials: [],
  existingLoaded: false,
  errors: {},
  pendingExtras: 0,
  originalSerials: [],
  lastFocusedEl: null,
  showExistingSerials: false,
  lastAddedSerial: '',
})

const form = reactive({
  adjustmentType: 'Inventory Recount',
  reason: '',
})

const selectedAdjustmentType = computed(
  () => adjustmentTypes.find((type) => type.value === form.adjustmentType) || adjustmentTypes[0],
)

const isProductLocked = computed(() => Boolean(route.query.product_id || route.query.id))

function normalizeSerial(value = '') {
  return String(value ?? '').trim().toUpperCase()
}

function isIncreaseAdjustment(type = form.adjustmentType) {
  return !['Damaged Goods', 'Theft / Loss'].includes(type)
}

function activeRows() {
  return product.value?.adjustments?.filter((item) => Number(item.quantityChange) !== 0) ?? []
}

function getRowQty(item) {
  return Number(item.quantityChange) || 0
}

// A product with variants adjusts stock per variant; one without adjusts itself.
function isVariantRow() {
  return Boolean(product.value?.variants?.length)
}

function getSerialTarget(item) {
  if (!item) return 0

  const currentQty = Number(item.currentStock) || 0
  const adjQty = Number(item.quantityChange) || 0
  const existingSerialCount = getRowSerials(item).length

  if (isIncreaseAdjustment(form.adjustmentType)) {
    // A variant takes one serial number for every unit that comes in, on top of
    // any it already holds (those are listed under Existing serials).
    if (isVariantRow()) return Math.max(0, adjQty)
    return Math.max(0, (currentQty + adjQty) - existingSerialCount)
  }

  return Math.max(0, Math.min(Math.abs(adjQty), existingSerialCount))
}

function getRequiredSerials(item) {
  return getSerialTarget(item)
}

function getFilledSerialCount(item) {
  return Array.isArray(item.serialNumbers)
    ? item.serialNumbers.filter((serial) => normalizeSerial(serial).length > 0).length
    : 0
}

// What the variant's stock would be once this adjustment is saved.
function getAfterQty(item) {
  return (Number(item.currentStock) || 0) + (Number(item.quantityChange) || 0)
}

function getSerialTriggerTitle(item) {
  const qty = getRowQty(item)
  if (!Number.isFinite(qty) || qty === 0) {
    return 'Enter quantity first'
  }

  const required = getRequiredSerials(item)
  if (required === 0) {
    return 'Serials complete'
  }

  return getFilledSerialCount(item) >= required
    ? 'Serials complete'
    : `${getFilledSerialCount(item)} of ${required} serials entered`
}

function getRowSerials(item) {
  return Array.isArray(item.serialNumbers)
    ? item.serialNumbers.map(normalizeSerial).filter((serial) => serial.length > 0)
    : []
}

function getExistingSerialCount(item) {
  return drawer.existingLoaded ? drawer.existingSerials.length : (Number(item?.serialsCount) || 0)
}

function getSerialModalTitle(item) {
  const required = getRequiredSerials(item)
  return required === 1 ? 'Add 1 serial number' : `Add ${required} serial numbers`
}

const summaryText = computed(() => {
  const rows = activeRows()
  const variantCount = rows.length
  const signedTotal = rows.reduce((sum, item) => sum + getRowQty(item), 0)
  const serialRequired = rows.reduce((sum, item) => sum + getRequiredSerials(item), 0)

  return `${variantCount} variants · ${signedTotal >= 0 ? '+' : ''}${signedTotal} units · ${serialRequired} serials required`
})

const incompleteRows = computed(() => {
  return activeRows().filter((item) => getFilledSerialCount(item) !== getRequiredSerials(item))
})

const incompleteTooltip = computed(() => {
  return incompleteRows.value
    .map((item) => `${item.name}: ${getFilledSerialCount(item)} of ${getRequiredSerials(item)} serials`)
    .join('; ')
})

const quantityIsValid = computed(() => {
  const rows = activeRows()
  if (!rows.length) return false
  return rows.every((item) => {
    const qty = getRowQty(item)
    if (!Number.isFinite(qty) || qty === 0) return false
    return getFilledSerialCount(item) === getRequiredSerials(item)
  })
})

function pushToast(title, message = '', type = 'success') {
  const toast = { id: Date.now() + Math.random(), title, message, type }
  toasts.value.push(toast)
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== toast.id)
  }, 5000)
}

function selectAdjustmentType(type) {
  const nextIsIncrease = isIncreaseAdjustment(type.value)
  const currentMode = product.value?.adjustments?.some((item) => getRowQty(item) < 0)
  const hasValues = product.value?.adjustments?.some((item) => Number(item.quantityChange) !== 0)

  if (hasValues && currentMode !== nextIsIncrease) {
    const shouldContinue = window.confirm('Changing the adjustment type will clear the row quantities and serial selections. Continue?')
    if (!shouldContinue) return

    product.value.adjustments.forEach((item) => {
      const nextQty = nextIsIncrease ? Math.abs(getRowQty(item) || 1) : -Math.abs(getRowQty(item) || 1)
      item.quantityChange = nextQty
      item.serialNumbers = Array.from({ length: Math.max(0, getRequiredSerials(item)) }, (_, index) => item.serialNumbers?.[index] ?? '')
    })
  }

  form.adjustmentType = type.value
}

// The Select is controlled by form.adjustmentType, so declining the confirm in
// selectAdjustmentType leaves the old value showing.
function onAdjustmentTypeChange(value) {
  const type = adjustmentTypes.find((candidate) => candidate.value === value)
  if (type) selectAdjustmentType(type)
}

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

const catalog = ref([])
const pickerLoading = ref(false)

async function loadCatalog() {
  pickerLoading.value = true
  try {
    catalog.value = await fetchStockCatalog(100, auth.accessToken)

    const queryProductId = route.query.product_id || route.query.id
    if (queryProductId && !product.value) {
      const match = catalog.value.find((p) => String(p.id) === String(queryProductId))
      if (match) selectProduct(match)
    }
  } catch (err) {
    console.error('Failed to load products catalog:', err)
  } finally {
    pickerLoading.value = false
  }
}

function selectProduct(picked) {
  product.value = {
    id: picked.id,
    name: picked.name,
    sku: picked.sku,
    category: picked.category,
    location: picked.location || 'Main Warehouse',
    currentStock: Number(picked.currentStock ?? 0),
    unitPrice: picked.unitPrice,
    threshold: Number(picked.threshold ?? 0),
    thumbnail: picked.thumbnail,
    variants: picked.variants ?? [],
    adjustments: (picked.variants?.length ? picked.variants : [{
      id: picked.id,
      name: picked.name,
      sku: picked.sku,
      currentStock: picked.currentStock,
      isSerialized: picked.isSerialized,
    }]).map((variant) => ({
      ...variant,
      quantityChange: isIncreaseAdjustment(form.adjustmentType) ? 1 : -1,
      serialNumbers: Array.from({ length: isIncreaseAdjustment(form.adjustmentType) ? 1 : 1 }, () => ''),
    })),
  }

  product.value.adjustments = product.value.adjustments.map((item) => ({
    ...item,
    serialNumbers: Array.from({ length: Math.max(0, Math.abs(Number(item.quantityChange) || 0)) }, () => ''),
  }))
}

function updateVariantQuantity(item, rawValue) {
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) {
    item.quantityChange = 0
    return
  }

  const nextQty = isIncreaseAdjustment(form.adjustmentType) ? Math.abs(parsed) : -Math.abs(parsed)
  const previousQty = getRowQty(item)

  if (previousQty !== 0 && Math.abs(nextQty) < Math.abs(previousQty)) {
    const nextCount = Math.abs(nextQty)
    const removed = getRequiredSerials(item) - nextCount
    if (removed > 0) {
      const confirmed = window.confirm(`Lowering the qty for ${item.name} will remove the last ${removed} serial numbers. Continue?`)
      if (!confirmed) {
        item.quantityChange = previousQty
        return
      }
    }
  }

  item.quantityChange = nextQty

  const limit = getRequiredSerials(item)
  const current = Array.isArray(item.serialNumbers) ? item.serialNumbers.slice(0, limit) : []
  const nextSerials = Array.from({ length: limit }, (_, index) => current[index] ?? '')
  item.serialNumbers = nextSerials
}

function selectProductById(id) {
  const picked = catalog.value.find((item) => String(item.id) === String(id))
  if (!picked) return
  selectProduct(picked)
}

function cancel() {
  router.push('/stock')
}

function getCurrentItem() {
  return product.value?.adjustments?.find((item) => Number(item.id) === Number(drawer.variantId)) ?? null
}

function hasUnsavedChanges() {
  if (!product.value) return false
  return product.value.adjustments.some((item) => {
    const qty = Number(item.quantityChange) || 0
    if (qty !== 0) return true
    return getRowSerials(item).length > 0
  }) || Boolean(form.reason.trim())
}

function scrollToFirstInvalidRow() {
  const invalidRow = document.querySelector('[data-row-invalid="true"]')
  if (invalidRow) {
    invalidRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const field = invalidRow.querySelector('input, button, [contenteditable="true"]')
    field?.focus?.()
  }
}

function parseSerialInput(rawValue) {
  return String(rawValue ?? '')
    .split(/[\n,\t\s]+/)
    .map((serial) => normalizeSerial(serial))
    .filter((serial) => serial.length > 0)
}

async function checkSerialExists(serialNumber) {
  if (!serialNumber) return false
  try {
    const result = await lookupSerial(serialNumber, auth.accessToken)
    return Boolean(result)
  } catch {
    return false
  }
}

async function openSerialDrawer(item) {
  if (!item) return

  drawer.lastFocusedEl = document.activeElement
  drawer.open = true
  drawer.variantId = item.id
  drawer.mode = isIncreaseAdjustment(form.adjustmentType) ? 'increase' : 'decrease'
  drawer.input = ''
  drawer.search = ''
  drawer.errors = {}
  drawer.pendingExtras = 0
  drawer.selectedSerials = getRowSerials(item)
  drawer.originalSerials = getRowSerials(item)
  drawer.existingSerials = []
  drawer.existingLoaded = false
  drawer.showExistingSerials = false
  drawer.lastAddedSerial = ''

  requestAnimationFrame(() => {
    const input = document.getElementById('serial-modal-input')
    input?.focus()
  })

  // Taking stock out can only remove an available unit; bringing it in lists
  // everything the variant holds, so its one serial shows up here.
  const variantId = item.id
  const params = {
    ...(isVariantRow() ? { product_variant_id: variantId } : { product_id: variantId }),
    ...(drawer.mode === 'decrease' ? { status: 'available' } : {}),
    per_page: 200,
  }
  try {
    const response = await fetchSerials(params, auth.accessToken)
    // Closed, or reopened on another variant, while the list was loading.
    if (!drawer.open || drawer.variantId !== variantId) return

    const seen = new Set()
    drawer.existingSerials = (response?.items ?? []).flatMap((serial) => {
      const status = serial.status || 'available'
      const number = normalizeSerial(serial.serial_number || serial.serialNumber)
      if (!number || status === 'cancelled' || seen.has(number)) return []
      seen.add(number)
      return [{ serial: number, status }]
    })
    drawer.existingLoaded = true
    drawer.showExistingSerials = drawer.mode === 'increase' && drawer.existingSerials.length > 0
  } catch (err) {
    console.error('Failed to load serial inventory', err)
  }
}

function closeSerialDrawer(confirmBeforeClose = false) {
  const item = getCurrentItem()
  if (confirmBeforeClose && item) {
    const current = getRowSerials(item)
    const baseline = drawer.originalSerials ?? []
    const hasChanges = JSON.stringify(current) !== JSON.stringify(baseline)
    if (hasChanges && !window.confirm('Discard the unsaved serial changes?')) {
      return
    }
  }

  drawer.open = false
  drawer.variantId = null
  drawer.input = ''
  drawer.search = ''
  drawer.selectedSerials = []
  drawer.existingSerials = []
  drawer.existingLoaded = false
  drawer.errors = {}
  drawer.pendingExtras = 0
  drawer.originalSerials = []
  drawer.showExistingSerials = false
  drawer.lastAddedSerial = ''

  if (drawer.lastFocusedEl instanceof HTMLElement) {
    drawer.lastFocusedEl.focus()
  }
}

function addSerialsFromInput() {
  const item = getCurrentItem()
  if (!item) return

  const limit = getRequiredSerials(item)
  const current = getRowSerials(item)
  const incoming = parseSerialInput(drawer.input)
  const accepted = []
  let ignored = 0

  incoming.forEach((serial) => {
    if (current.includes(serial) || accepted.includes(serial)) {
      drawer.errors[serial] = 'Duplicate serial in the list.'
      return
    }
    if (current.length + accepted.length >= limit) {
      ignored += 1
      return
    }
    accepted.push(serial)
  })

  drawer.pendingExtras = ignored
  drawer.input = ''

  if (accepted.length === 0) return

  const nextSerials = [...current, ...accepted].slice(0, limit)
  item.serialNumbers = nextSerials
  while (item.serialNumbers.length < limit) item.serialNumbers.push('')
  drawer.lastAddedSerial = nextSerials[nextSerials.length - 1] || ''
  if (drawer.lastAddedSerial) {
    setTimeout(() => {
      if (drawer.lastAddedSerial === nextSerials[nextSerials.length - 1]) drawer.lastAddedSerial = ''
    }, 850)
  }
}

async function addSingleSerial(value) {
  const item = getCurrentItem()
  if (!item) return

  const serial = normalizeSerial(value)
  if (!serial) return

  const current = getRowSerials(item)
  if (current.includes(serial)) {
    drawer.errors[serial] = 'Duplicate serial in the list.'
    return
  }

  const exists = await checkSerialExists(serial)
  if (exists) {
    drawer.errors[serial] = 'Already exists in the system.'
    return
  }

  if (current.length >= getRequiredSerials(item)) {
    drawer.pendingExtras = current.length - getRequiredSerials(item)
    return
  }

  delete drawer.errors[serial]
  const nextSerials = [...current, serial].slice(0, getRequiredSerials(item))
  item.serialNumbers = nextSerials
  while (item.serialNumbers.length < getRequiredSerials(item)) item.serialNumbers.push('')
  drawer.input = ''
  drawer.lastAddedSerial = serial
  setTimeout(() => {
    if (drawer.lastAddedSerial === serial) drawer.lastAddedSerial = ''
  }, 850)
}

function removeSerial(item, serial) {
  if (!item) return
  item.serialNumbers = item.serialNumbers.filter((candidate) => normalizeSerial(candidate) !== normalizeSerial(serial))
  while (item.serialNumbers.length < getRequiredSerials(item)) item.serialNumbers.push('')
}

function saveDrawerSelection() {
  const item = getCurrentItem()
  if (!item) return

  const serials = getRowSerials(item)
  item.serialNumbers = [...serials, ...Array.from({ length: Math.max(0, getRequiredSerials(item) - serials.length) }, () => '')]
  closeSerialDrawer()
}

function handleModalKeydown(event) {
  if (!drawer.open) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeSerialDrawer(true)
    return
  }

  if (event.key !== 'Tab') return

  const modal = document.querySelector('.serial-modal__panel')
  if (!modal) return

  const focusable = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
}

async function complete() {
  if (!product.value) return
  if (submitting.value) return

  const rows = activeRows()
  if (!rows.length) {
    submitError.value = 'Select at least one row to adjust.'
    return
  }

  const invalid = rows.filter((item) => getFilledSerialCount(item) !== getRequiredSerials(item))

  if (invalid.length) {
    submitError.value = `Please complete the serial entries before submitting.`
    setTimeout(scrollToFirstInvalidRow, 0)
    return
  }

  submitting.value = true
  submitError.value = ''

  try {
    const reference = form.reason?.trim() || form.adjustmentType
    const payload = rows.map((item) => {
      const qty = Number(item.quantityChange) || 0
      const serials = getRowSerials(item)
      return {
        stockable_type: product.value.variants.length ? 'variant' : 'product',
        stockable_id: String(item.id),
        movement_type: qty >= 0 ? 'stock_in' : 'stock_out',
        quantity: Math.abs(qty),
        reason: form.adjustmentType,
        reference,
        serial_numbers: serials,
        metadata: { adjustment_type: form.adjustmentType },
      }
    })

    await createBulkStockMovement({ items: payload }, auth.accessToken)
    pushToast('Stock adjustment saved', 'Inventory updated successfully.', 'success')
    router.push({ name: 'stock-detail', params: { id: product.value.id }, query: { refresh: Date.now() } })
  } catch (err) {
    // Laravel keys row errors as `items.0.serial_numbers`, so take the first
    // message under any key; `err.message` alone is just "The given data was invalid."
    const fieldError = Object.values(err?.errors ?? {}).flat()[0]
    const message = fieldError || err?.message || 'Unable to save stock adjustment. Please try again.'
    submitError.value = message
    pushToast('Stock adjustment failed', message, 'error')
  } finally {
    submitting.value = false
  }
}

let leaveGuard = null

onMounted(() => {
  loadCatalog()
  document.addEventListener('keydown', handleModalKeydown)
  window.addEventListener('beforeunload', (event) => {
    if (hasUnsavedChanges()) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
  leaveGuard = router.beforeEach((to, from, next) => {
    if (!hasUnsavedChanges() || window.confirm('You have unsaved changes. Leave this page?')) {
      next()
      return
    }
    next(false)
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleModalKeydown)
  document.body.style.overflow = ''
  if (leaveGuard) leaveGuard()
})

watch(
  () => drawer.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  },
  { immediate: true },
)

watch(
  () => form.adjustmentType,
  () => {
    if (!product.value?.adjustments?.length) return
    const nextSeries = isIncreaseAdjustment(form.adjustmentType)
    product.value.adjustments.forEach((item) => {
      const qty = Number(item.quantityChange) || 0
      item.quantityChange = nextSeries ? Math.abs(qty || 1) : -Math.abs(qty || 1)
      const serials = Array.isArray(item.serialNumbers) ? item.serialNumbers.slice(0, Math.abs(Number(item.quantityChange) || 0)) : []
      item.serialNumbers = Array.from({ length: Math.max(0, Math.abs(Number(item.quantityChange) || 0)) }, (_, index) => serials[index] ?? '')
    })
  },
)
</script>

<template>
  <div class="page">
    <AppHeader title="Stock Adjustment" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink :to="{ name: 'stock' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Back to Stock</span>
            <span class="subhead__title">New Stock Adjustment</span>
          </span>
        </RouterLink>
      </div>

      <p v-if="submitError" class="alert alert--error" role="alert">{{ submitError }}</p>

      <!-- Details -->
      <section class="card">
        <h3 class="card__title">Adjustment Details</h3>
        <p class="card__lead">Manually adjust inventory levels for damages, returns, or corrections.</p>

        <div class="row">
          <div v-if="!isProductLocked" class="field">
            <label for="productSelect">Product</label>
            <Select
              :model-value="product ? String(product.id) : ''"
              :disabled="pickerLoading"
              @update:model-value="selectProductById"
            >
              <SelectTrigger id="productSelect" :class="FORM_SELECT.trigger">
                <SelectValue placeholder="Select a product to adjust…" />
              </SelectTrigger>
              <SelectContent :class="FORM_SELECT.content">
                <SelectItem
                  v-for="entry in catalog"
                  :key="entry.id"
                  :value="String(entry.id)"
                  :class="FORM_SELECT.item"
                >
                  {{ entry.name }} (SKU: {{ entry.sku }}) — {{ entry.currentStock }} in stock
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="field">
            <label for="adjustmentType">Adjustment Type</label>
            <Select :model-value="form.adjustmentType" @update:model-value="onAdjustmentTypeChange">
              <SelectTrigger id="adjustmentType" :class="FORM_SELECT.trigger">
                <!-- Overrides the default label: an option's text includes its
                     description, which belongs in the list but not the trigger. -->
                <SelectValue>
                  <span class="type-value">
                    <span class="type-dot" :class="`type-dot--${selectedAdjustmentType.tone}`" aria-hidden="true"></span>
                    {{ selectedAdjustmentType.label }}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent :class="FORM_SELECT.content">
                <SelectItem
                  v-for="type in adjustmentTypes"
                  :key="type.value"
                  :value="type.value"
                  :class="FORM_SELECT.item"
                >
                  <span class="type-option">
                    <span class="type-dot" :class="`type-dot--${type.tone}`" aria-hidden="true"></span>
                    <span class="type-option__copy">
                      <span class="type-option__label">{{ type.label }}</span>
                      <span class="type-option__desc">{{ type.description }}</span>
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="product" class="product-header">
          <img
            v-if="product.thumbnail"
            :src="product.thumbnail"
            :alt="product.name"
            class="product-header__thumb"
          />
          <span v-else class="product-header__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
          <div class="product-header__meta">
            <p class="product-header__name">{{ product.name }}</p>
            <p class="product-header__sub">SKU: {{ product.sku }} · Location: {{ product.location }}</p>
          </div>
          <div class="product-header__stock">
            <span>Current stock</span>
            <strong>{{ product.currentStock.toLocaleString() }}</strong>
          </div>
        </div>
      </section>

      <!-- Quantities -->
      <section v-if="product?.adjustments?.length" class="card card--flush">
        <header class="card__head">
          <h3 class="card__title">Quantities</h3>
          <span class="card__summary">{{ summaryText }}</span>
        </header>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th class="col-no">No</th>
                <th class="col-sku">SKU</th>
                <th class="col-variant">Variant Info</th>
                <th class="col-current">Current Qty</th>
                <th class="col-qty">Stock In Qty</th>
                <th class="col-serial">Serial</th>
                <th class="col-after">After Update</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in product.adjustments"
                :key="item.id"
                :data-row-invalid="getFilledSerialCount(item) !== getRequiredSerials(item) && Number(item.quantityChange) !== 0"
              >
                <td class="col-no">{{ index + 1 }}</td>
                <td class="col-sku">{{ item.sku || 'N/A' }}</td>
                <td class="col-variant">
                  <div class="variant-cell">
                    <img
                      v-if="product.thumbnail"
                      :src="product.thumbnail"
                      :alt="item.name"
                      class="variant-cell__thumb"
                    />
                    <span v-else class="variant-cell__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
                    <span class="variant-cell__name">{{ item.name }}</span>
                  </div>
                </td>
                <td class="col-current">{{ item.currentStock }}</td>
                <td class="col-qty">
                  <input
                    :id="`quantity-${item.id}`"
                    class="qty-input"
                    :value="item.quantityChange"
                    type="number"
                    :min="isIncreaseAdjustment(form.adjustmentType) ? 1 : -9999"
                    step="1"
                    inputmode="numeric"
                    required
                    :aria-label="`Quantity change for ${item.name}`"
                    @input="updateVariantQuantity(item, $event.target.valueAsNumber)"
                  />
                </td>
                <td class="col-serial">
                  <button
                    type="button"
                    class="serial-trigger"
                    :class="{
                      'serial-trigger--disabled': !Number.isFinite(getRowQty(item)) || getRowQty(item) <= 0,
                      'serial-trigger--incomplete': getRowQty(item) > 0 && getFilledSerialCount(item) !== getRequiredSerials(item),
                      'serial-trigger--complete': getRowQty(item) > 0 && getFilledSerialCount(item) === getRequiredSerials(item),
                    }"
                    :disabled="!Number.isFinite(getRowQty(item)) || getRowQty(item) <= 0"
                    :aria-label="`Add serial numbers for ${item.name}`"
                    :title="getSerialTriggerTitle(item)"
                    @click="openSerialDrawer(item)"
                  >
                    <span class="serial-trigger__label">Add serial</span>
                    <span class="serial-trigger__count" aria-live="polite">{{ getFilledSerialCount(item) }} / {{ getRequiredSerials(item) }}</span>
                    <svg
                      v-if="getRowQty(item) > 0 && getFilledSerialCount(item) === getRequiredSerials(item)"
                      class="serial-trigger__check"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </td>
                <td class="col-after" :class="{ 'col-after--negative': getAfterQty(item) < 0 }">{{ getAfterQty(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Reason -->
      <section class="card">
        <div class="field">
          <label for="reason">Reason for Adjustment</label>
          <textarea
            id="reason"
            v-model="form.reason"
            rows="3"
            placeholder="Monthly inventory recount. Found 2 additional units in warehouse back-shelf."
          ></textarea>
          <p class="field__hint">Saved as the reference on each stock movement. Defaults to the adjustment type when left blank.</p>
        </div>
      </section>

      <!-- Form actions -->
      <div class="actions">
        <BaseButton variant="ghost" :disabled="submitting" @click="cancel">Cancel</BaseButton>
        <BaseButton
          variant="primary"
          :disabled="!product || !quantityIsValid || submitting"
          :title="incompleteRows.length ? incompleteTooltip : ''"
          @click="complete"
        >
          {{ submitting ? 'Saving…' : 'Create Adjustment' }}
        </BaseButton>
      </div>

      <!-- Serial entry -->
      <aside
        v-if="drawer.open"
        class="serial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="serial-modal-title"
        @click.self="closeSerialDrawer(true)"
      >
        <div class="serial-modal__panel" aria-live="polite">
          <header class="serial-modal__header">
            <div class="serial-modal__variant">
              <img
                v-if="product?.thumbnail"
                :src="product.thumbnail"
                :alt="getCurrentItem()?.name || 'Variant image'"
                class="serial-modal__thumb"
              />
              <span v-else class="serial-modal__thumb" aria-hidden="true">{{ thumbInitials(getCurrentItem()?.name || product?.name || 'V') }}</span>
              <div class="serial-modal__variant-copy">
                <strong>{{ getCurrentItem()?.name || 'Variant' }}</strong>
                <span>{{ getCurrentItem()?.sku || product?.sku || 'SKU' }}</span>
              </div>
            </div>
            <button type="button" class="serial-modal__close" aria-label="Close" title="Close" @click="closeSerialDrawer(true)">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" /></svg>
            </button>
          </header>

          <div class="serial-modal__body">
            <div>
              <p class="serial-modal__eyebrow">Variant serials</p>
              <h3 id="serial-modal-title" class="serial-modal__title">
                {{ getSerialModalTitle(getCurrentItem()) }}
              </h3>
            </div>

            <div class="serial-modal__stats" aria-label="Serial stats">
              <div class="serial-modal__stat">
                <span>Existing</span>
                <strong>{{ getExistingSerialCount(getCurrentItem()) }}</strong>
              </div>
              <div class="serial-modal__stat">
                <span>Needed</span>
                <strong>{{ Math.max(0, getRequiredSerials(getCurrentItem())) }}</strong>
              </div>
              <div class="serial-modal__stat">
                <span>Entered</span>
                <strong>{{ getFilledSerialCount(getCurrentItem()) }}</strong>
              </div>
            </div>

            <div class="serial-modal__progress" aria-live="polite">
              <div class="serial-modal__progress-meta">
                <span>{{ getFilledSerialCount(getCurrentItem()) }} / {{ getRequiredSerials(getCurrentItem()) }}</span>
                <span :class="{ 'serial-modal__progress-state--complete': getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem()) }">
                  {{ getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem()) ? 'Complete' : 'In progress' }}
                </span>
              </div>
              <div class="serial-modal__progress-track">
                <span
                  class="serial-modal__progress-bar"
                  :style="{ width: `${Math.min(100, (getFilledSerialCount(getCurrentItem()) / Math.max(1, getRequiredSerials(getCurrentItem()))) * 100)}%` }"
                />
              </div>
            </div>

            <div class="serial-modal__field">
              <label for="serial-modal-input">Scan or type a serial</label>
              <div class="serial-modal__input-row">
                <input
                  id="serial-modal-input"
                  v-model="drawer.input"
                  type="text"
                  autocomplete="off"
                  :disabled="getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem())"
                  @keydown.enter.prevent="addSingleSerial(drawer.input)"
                  @keydown.backspace.prevent="if (!drawer.input.trim()) { const item = getCurrentItem(); if (item && item.serialNumbers && item.serialNumbers.length) { const last = item.serialNumbers.slice().reverse().find((serial) => normalizeSerial(serial)); if (last) removeSerial(item, last) } }"
                  @paste="event => { event.preventDefault(); addSerialsFromInput(); }"
                  placeholder="Scan or type a serial, then press Enter"
                />
                <BaseButton
                  variant="primary"
                  :disabled="!drawer.input.trim() || getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem())"
                  @click="addSingleSerial(drawer.input)"
                >
                  Add
                </BaseButton>
              </div>
              <p class="serial-modal__helper">Tip: paste many serials separated by new lines, commas or spaces</p>
              <p v-if="getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem())" class="serial-modal__limit">All serials entered</p>
            </div>

            <p v-if="drawer.pendingExtras" class="serial-modal__banner">
              {{ drawer.pendingExtras }} extra ignored.
            </p>
            <div v-if="Object.keys(drawer.errors).length" class="serial-modal__error-list" aria-live="polite">
              <div v-for="(message, serial) in drawer.errors" :key="serial" class="serial-modal__error-item">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3 2 20h20L12 3Z" stroke-linejoin="round" />
                  <path d="M12 10v4M12 17h.01" stroke-linecap="round" />
                </svg>
                <span>{{ serial }}: {{ message }}</span>
              </div>
            </div>

            <div class="serial-modal__chips-wrap">
              <div v-if="!getRowSerials(getCurrentItem()).length" class="serial-modal__empty-state">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <p>No serials yet. Scan or paste to begin.</p>
              </div>
              <div v-else class="serial-modal__chips">
                <button
                  v-for="(serial, serialIndex) in getRowSerials(getCurrentItem())"
                  :key="serial"
                  type="button"
                  class="serial-modal__chip"
                  :class="{ 'serial-modal__chip--new': drawer.lastAddedSerial && serial === drawer.lastAddedSerial }"
                  :title="`Remove ${serial}`"
                  @click="removeSerial(getCurrentItem(), serial)"
                >
                  <span class="serial-modal__chip-index">#{{ serialIndex + 1 }}</span>
                  <span class="serial-modal__chip-value">{{ serial }}</span>
                  <svg class="serial-modal__chip-remove" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="serial-modal__existing">
              <button type="button" class="serial-modal__existing-toggle" :aria-expanded="drawer.showExistingSerials" @click="drawer.showExistingSerials = !drawer.showExistingSerials">
                <span>Existing serials ({{ getExistingSerialCount(getCurrentItem()) }})</span>
                <span>{{ drawer.showExistingSerials ? 'Hide' : 'Show' }}</span>
              </button>
              <div v-if="drawer.showExistingSerials" class="serial-modal__existing-panel">
                <div class="serial-modal__existing-search">
                  <input v-model="drawer.search" type="search" placeholder="Search serials" aria-label="Search existing serials" />
                </div>
                <div class="serial-modal__existing-list">
                  <div v-for="entry in drawer.existingSerials.filter(candidate => candidate.serial.toLowerCase().includes(drawer.search.toLowerCase()))" :key="entry.serial" class="serial-modal__existing-item">
                    <span>{{ entry.serial }}</span>
                    <span v-if="entry.status !== 'available'" class="serial-modal__existing-status">{{ entry.status.replace('_', ' ') }}</span>
                  </div>
                  <p v-if="!drawer.existingSerials.length" class="serial-modal__existing-empty">
                    {{ drawer.existingLoaded ? 'No serial numbers yet.' : 'Loading…' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer class="serial-modal__footer">
            <BaseButton variant="danger" @click="() => { const item = getCurrentItem(); if (item) { item.serialNumbers = []; drawer.selectedSerials = []; drawer.errors = {}; drawer.pendingExtras = 0 } }">Clear all</BaseButton>
            <div class="serial-modal__footer-actions">
              <BaseButton variant="ghost" @click="closeSerialDrawer(true)">Cancel</BaseButton>
              <BaseButton
                variant="primary"
                :disabled="getFilledSerialCount(getCurrentItem()) !== getRequiredSerials(getCurrentItem()) || !getCurrentItem()"
                @click="saveDrawerSelection"
              >
                Save serials
              </BaseButton>
            </div>
          </footer>
        </div>
      </aside>

      <ToastStack :toasts="toasts" @dismiss="toasts = toasts.filter((toast) => toast.id !== $event)" />
    </div>
  </div>
</template>

<style scoped lang="scss">

.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

/* Sub header */
.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__back {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;
    &:hover { text-decoration: none; }
    svg { width: 22px; height: 22px; stroke: var(--text-muted); stroke-width: 1.8; }
    span { display: flex; flex-direction: column; line-height: 1.2; }
  }

  &__crumb {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__title { font-size: 1.1rem; font-weight: 700; color: var(--text-strong); }
}

.alert {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.86rem;
  font-weight: 500;
  border-radius: 10px;

  &--error {
    background: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger-border);
  }
}

/* Cards */
.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  /* The quantities card runs its table edge to edge, so the padding moves to the head. */
  &--flush { padding: 0; overflow: hidden; }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__head &__title { margin: 0; }

  &__lead { margin: -0.5rem 0 1rem; font-size: 0.82rem; color: var(--text-subtle); }

  &__summary { font-size: 0.82rem; font-weight: 600; color: var(--text-body); }
}

/* Fields */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &__hint { margin: 0; font-size: 0.74rem; color: var(--text-subtle); }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }
    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 620px) { grid-template-columns: 1fr; }
}

/* Adjustment type — a dot in the theme's semantic colours stands in for the
   per-type icons, so it follows light and dark mode with the rest of the app. */
.type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--text-subtle);

  &--info { background: var(--info); }
  &--danger { background: var(--danger); }
  &--warning { background: rgb(var(--accent-rgb)); }
  &--success { background: var(--success); }
  &--violet { background: var(--violet); }
}

.type-value {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.1rem 0;

  &__copy { display: flex; flex-direction: column; gap: 0.1rem; }
  &__label { font-weight: 600; }
  &__desc { font-size: 0.76rem; font-weight: 400; color: var(--text-subtle); }
}

/* Selected product */
.product-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.25rem;
  padding: 1rem;
  background: var(--surface-sunken);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    object-fit: cover;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__meta { flex: 1; min-width: 0; }
  &__name { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-strong); }
  &__sub { margin: 0.2rem 0 0; font-size: 0.76rem; color: var(--text-subtle); }

  &__stock {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1rem;

    span {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-subtle);
    }
    strong { font-size: 1.2rem; font-weight: 800; color: var(--text-strong); }
  }
}

/* Quantities table */
.table-wrap { overflow-x: auto; }

.table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.85rem 1rem; vertical-align: middle; }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  td { font-size: 0.86rem; color: var(--text-body); }

  .col-no { width: 56px; color: var(--text-subtle); }
  .col-sku { width: 110px; white-space: nowrap; }
  .col-variant { min-width: 200px; }
  .col-current,
  .col-after { width: 110px; text-align: center; font-variant-numeric: tabular-nums; }
  .col-qty { width: 140px; }
  .col-serial { width: 150px; text-align: center; }

  td.col-after { font-weight: 700; color: var(--text-strong); }
  td.col-after--negative { color: var(--danger); }
}

.variant-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__name { font-weight: 600; color: var(--text-strong); }
}

.qty-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  font-size: 0.9rem;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
  background: var(--surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  appearance: textfield;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button { appearance: none; margin: 0; }

  &:focus {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }
}

/* Serial entry button. Amber while serials are optional-looking, red while the
   count is short, green once it matches. */
.serial-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  min-height: 36px;
  padding: 0.4rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgb(var(--accent-rgb) / 0.4);
  background: rgb(var(--accent-rgb) / 0.12);
  color: var(--accent-ink);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgb(var(--accent-rgb) / 0.7);
    background: rgb(var(--accent-rgb) / 0.2);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  &--incomplete {
    border-color: var(--danger-border);
    background: var(--danger-bg);
    color: var(--danger);

    &:hover:not(:disabled) { border-color: var(--danger); background: var(--danger-bg); }
  }

  &--complete {
    border-color: var(--success-border);
    background: var(--success-bg);
    color: var(--success);

    &:hover:not(:disabled) { border-color: var(--success); background: var(--success-bg); }
  }

  &--disabled,
  &--disabled:hover:not(:disabled) {
    border-color: var(--border-subtle);
    background: var(--surface-track);
    color: var(--text-muted);
  }

  &:disabled { opacity: 0.6; cursor: not-allowed; }

  &__label { white-space: nowrap; }
  &__count { white-space: nowrap; font-variant-numeric: tabular-nums; }
  &__check { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2.4; }
}

/* Bottom action bar */
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
}

/* Serial modal */
.serial-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: var(--backdrop);
  animation: serialModalFade 0.2s ease;

  &__panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(100%, 640px);
    max-height: 85vh;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    box-shadow: var(--shadow-md);
    overflow: hidden;
    animation: serialModalScale 0.2s ease;
  }

  &__header,
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    background: var(--surface);
  }

  &__header { border-bottom: 1px solid var(--border-subtle); }

  &__footer {
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
    flex-wrap: wrap;
  }

  &__footer-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-left: auto;
  }

  &__variant { display: flex; align-items: center; gap: 0.8rem; min-width: 0; }

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__variant-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;

    strong { font-size: 0.92rem; font-weight: 700; color: var(--text-strong); }
    span { font-size: 0.76rem; color: var(--text-subtle); }
  }

  &__close {
    display: inline-flex;
    padding: 0.35rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--bg); color: var(--text-strong); border-color: transparent; }
    &:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    overflow-y: auto;
  }

  &__eyebrow {
    margin: 0 0 0.3rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__title { margin: 0; font-size: 1.15rem; font-weight: 700; line-height: 1.3; color: var(--text-strong); }

  &__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    background: var(--surface-sunken);

    span {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-subtle);
    }
    strong { font-size: 1.05rem; font-weight: 700; color: var(--text-strong); }
  }

  &__progress { display: flex; flex-direction: column; gap: 0.5rem; }

  &__progress-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  &__progress-state--complete { color: var(--success-ink); font-weight: 600; }

  &__progress-track {
    height: 8px;
    border-radius: 999px;
    background: var(--surface-track);
    overflow: hidden;
  }

  &__progress-bar {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: rgb(var(--accent-rgb));
    transition: width 0.2s ease;
  }

  &__field { display: flex; flex-direction: column; gap: 0.5rem; }

  &__field label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  &__input-row { display: flex; align-items: center; gap: 0.6rem; }

  &__input-row input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-strong);
    padding: 0.65rem 0.8rem;
    font: inherit;
    font-size: 0.9rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }
    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }

  &__helper,
  &__limit { margin: 0; font-size: 0.76rem; color: var(--text-subtle); }

  &__limit { color: var(--success-ink); font-weight: 600; }

  &__banner {
    margin: 0;
    padding: 0.7rem 0.9rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--danger);
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: 10px;
  }

  &__error-list { display: flex; flex-direction: column; gap: 0.5rem; }

  &__error-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 0.9rem;
    font-size: 0.78rem;
    color: var(--danger);
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    border-radius: 10px;

    svg { width: 16px; height: 16px; flex-shrink: 0; stroke: currentColor; stroke-width: 1.8; }
  }

  &__chips-wrap {
    min-height: 120px;
    max-height: 240px;
    overflow-y: auto;
    padding: 0.75rem;
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
  }

  &__empty-state {
    min-height: 96px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.5rem;
    text-align: center;
    color: var(--text-subtle);

    svg { width: 28px; height: 28px; stroke: currentColor; stroke-width: 1.5; }
    p { margin: 0; font-size: 0.86rem; }
  }

  &__chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 34px;
    padding: 0.3rem 0.6rem 0.3rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text-strong);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.78rem;
    cursor: pointer;

    &:hover { border-color: var(--danger); background: var(--danger-bg); }

    &--new,
    &--new:hover {
      border-color: rgb(var(--accent-rgb) / 0.7);
      background: rgb(var(--accent-rgb) / 0.12);
    }
  }

  &__chip-index { color: var(--text-subtle); }
  &__chip-value { font-weight: 600; }
  &__chip-remove { width: 12px; height: 12px; stroke: currentColor; stroke-width: 2; opacity: 0.6; }

  &__existing {
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    overflow: hidden;
  }

  &__existing-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0.9rem;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--text-strong);
    font: inherit;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;

    &:hover { background: var(--surface-sunken); border-color: transparent; }

    span:last-child { color: var(--accent-ink); font-size: 0.8rem; }
  }

  &__existing-panel { border-top: 1px solid var(--border-subtle); padding: 0.8rem; }

  &__existing-search input {
    width: 100%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-strong);
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
    font: inherit;
    font-size: 0.86rem;

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  &__existing-list {
    display: grid;
    gap: 0.4rem;
    max-height: 160px;
    overflow-y: auto;
    margin-top: 0.8rem;
  }

  &__existing-status {
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
    color: var(--text-subtle);
  }

  &__existing-empty { margin: 0; font-size: 0.78rem; color: var(--text-subtle); }

  &__existing-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.78rem;
    color: var(--text-body);
  }
}

@keyframes serialModalFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes serialModalScale {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 900px) {
  .product-header { flex-wrap: wrap; }
}

@media (max-width: 640px) {
  .page__body { padding: 1rem; }

  .serial-modal {
    padding: 0;
    align-items: end;

    &__panel {
      width: 100%;
      max-width: 100%;
      max-height: 92vh;
      border-radius: 14px 14px 0 0;
    }

    &__header,
    &__footer { padding: 0.9rem 1rem; }

    &__body { padding: 1rem; }

    &__input-row { flex-direction: column; align-items: stretch; }

    &__footer-actions {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-left: 0;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .serial-modal,
  .serial-modal__panel {
    animation: none;
  }
}
</style>
