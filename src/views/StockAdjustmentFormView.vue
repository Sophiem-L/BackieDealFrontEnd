<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToastStack from '@/components/ToastStack.vue'
import { fetchStockCatalog, createBulkStockMovement } from '@/services/stock'
import { fetchSerials, lookupSerial } from '@/services/serials'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const adjustmentTypes = [
  { value: 'Inventory Recount', label: 'Inventory Recount', description: 'Regular count and verification', icon: '📋', color: 'blue' },
  { value: 'Damaged Goods', label: 'Damaged Goods', description: 'Items too damaged to sell', icon: '💔', color: 'red' },
  { value: 'Customer Return', label: 'Customer Return', description: 'Items returned by customers', icon: '↩️', color: 'orange' },
  { value: 'Supplier Delivery', label: 'Supplier Delivery', description: 'Stock received from suppliers', icon: '📦', color: 'green' },
  { value: 'Theft / Loss', label: 'Theft / Loss', description: 'Missing or stolen items', icon: '⚠️', color: 'red' },
  { value: 'Correction', label: 'Correction', description: 'System error correction', icon: '✏️', color: 'purple' },
]

const product = ref(null)
const submitting = ref(false)
const submitError = ref('')
const showAdjustmentDropdown = ref(false)
const toasts = ref([])
const drawer = reactive({
  open: false,
  variantId: null,
  mode: 'increase',
  input: '',
  search: '',
  selectedSerials: [],
  availableSerials: [],
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

function getSerialTarget(item) {
  if (!item) return 0

  const currentQty = Number(item.currentStock) || 0
  const adjQty = Number(item.quantityChange) || 0
  const existingSerialCount = getRowSerials(item).length

  if (isIncreaseAdjustment(form.adjustmentType)) {
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

const summaryText = computed(() => {
  const rows = activeRows()
  const variantCount = rows.length
  const totalUnits = rows.reduce((sum, item) => sum + Math.abs(getRowQty(item)), 0)
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
  showAdjustmentDropdown.value = false
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
  } catch (err) {
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
  drawer.availableSerials = []
  drawer.showExistingSerials = false
  drawer.lastAddedSerial = ''

  if (drawer.mode === 'decrease') {
    try {
      const response = await fetchSerials({ product_variant_id: item.id, status: 'available', per_page: 200 }, auth.accessToken)
      drawer.availableSerials = [...new Set((response.items ?? []).map((serial) => normalizeSerial(serial.serial_number || serial.serialNumber)).filter(Boolean))]
    } catch (err) {
      console.error('Failed to load serial inventory', err)
      drawer.availableSerials = []
    }
  }

  requestAnimationFrame(() => {
    const input = document.getElementById('serial-modal-input')
    input?.focus()
  })
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
  drawer.availableSerials = []
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

function selectFirstNSerials() {
  const item = getCurrentItem()
  if (!item) return
  const limit = getRequiredSerials(item)
  const available = drawer.availableSerials.filter((serial) => !drawer.selectedSerials.includes(serial))
  drawer.selectedSerials = available.slice(0, limit)
  item.serialNumbers = [...drawer.selectedSerials, ...Array.from({ length: Math.max(0, limit - drawer.selectedSerials.length) }, () => '')]
}

function toggleSelectedSerial(serial) {
  const item = getCurrentItem()
  if (!item) return

  const target = [...new Set(drawer.selectedSerials)]
  const next = target.includes(serial)
    ? target.filter((candidate) => candidate !== serial)
    : [...target, serial]

  drawer.selectedSerials = next
  item.serialNumbers = [...next, ...Array.from({ length: Math.max(0, getRequiredSerials(item) - next.length) }, () => '')]
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
    const message = err?.errors?.items?.[0] || err?.message || 'Unable to save stock adjustment. Please try again.'
    submitError.value = message
    pushToast('Stock adjustment failed', message, 'error')
  } finally {
    submitting.value = false
  }
}

function closeAdjustmentDropdown() {
  showAdjustmentDropdown.value = false
}

let leaveGuard = null

onMounted(() => {
  loadCatalog()
  document.addEventListener('click', closeAdjustmentDropdown)
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
  document.removeEventListener('click', closeAdjustmentDropdown)
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
      <div class="subhead">
        <RouterLink to="/stock" class="subhead__back" aria-label="Back to Stock Management">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
        <div>
          <h2 class="subhead__title">New Stock Adjustment</h2>
          <p class="subhead__desc">Manually adjust inventory levels for damages, returns, or corrections.</p>
        </div>
      </div>

      <div v-if="submitError" class="alert alert--error">
        {{ submitError }}
      </div>

      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">Adjustment Details</h3>
          </div>
          <div v-if="!isProductLocked" class="card__select">
            <label for="productSelect">Select Product</label>
            <div class="select-wrap select-wrap--enhanced">
              <select id="productSelect" :value="product?.id || ''" :disabled="isProductLocked" @change="e => selectProductById(e.target.value)">
                <option value="" disabled>Select a product to adjust...</option>
                <option v-for="item in catalog" :key="item.id" :value="item.id">
                  {{ item.name }} (SKU: {{ item.sku }}) — {{ item.currentStock }} in stock
                </option>
              </select>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </div>
          </div>
        </div>

        <div v-if="product" class="product-header">
          <div class="product-info">
            <img
              v-if="product.thumbnail"
              :src="product.thumbnail"
              :alt="product.name"
              class="product-info__thumb"
            />
            <span v-else class="product-info__thumb product-info__thumb--initials" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
            <div class="product-info__meta">
              <p class="product-info__name">{{ product.name }}</p>
              <p class="product-info__sub">SKU: {{ product.sku }} &nbsp;|&nbsp; Location: {{ product.location }}</p>
            </div>
          </div>
          <div class="adjustment-controls">
            <div class="control-field">
              <label for="adjustmentType">Adjustment Type</label>
              <div class="adjustment-dropdown-wrapper" @click.stop @mousedown.stop>
                <button
                  id="adjustmentType"
                  type="button"
                  class="adjustment-dropdown-btn"
                  :class="`adjustment-dropdown-btn--${selectedAdjustmentType.color}`"
                  @click.stop="showAdjustmentDropdown = !showAdjustmentDropdown"
                >
                  <span class="adjustment-dropdown-btn__icon">{{ selectedAdjustmentType.icon }}</span>
                  <span class="adjustment-dropdown-btn__label">{{ selectedAdjustmentType.label }}</span>
                  <svg class="adjustment-dropdown-btn__chevron" :style="{ transform: showAdjustmentDropdown ? 'rotate(180deg)' : 'rotate(0)' }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>

                <div v-if="showAdjustmentDropdown" class="adjustment-dropdown-menu" @click.stop>
                  <button
                    v-for="type in adjustmentTypes"
                    :key="type.value"
                    type="button"
                    class="adjustment-dropdown-item"
                    :class="{ 'adjustment-dropdown-item--active': form.adjustmentType === type.value }"
                    @click.stop="selectAdjustmentType(type)"
                  >
                    <span class="adjustment-dropdown-item__icon">{{ type.icon }}</span>
                    <div class="adjustment-dropdown-item__content">
                      <div class="adjustment-dropdown-item__label">{{ type.label }}</div>
                      <div class="adjustment-dropdown-item__description">{{ type.description }}</div>
                    </div>
                    <svg v-if="form.adjustmentType === type.value" class="adjustment-dropdown-item__check" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="product?.adjustments?.length" class="table-container">
          <div class="table-header">
            <span class="table-header__summary">{{ summaryText }}</span>
          </div>

          <table class="stock-table">
            <thead>
              <tr>
                <th class="th-no">No</th>
                <th class="th-sku">SKU</th>
                <th class="th-variant">Variant Info</th>
                <th class="th-current">Current Qty</th>
                <th class="th-stock-in">Stock In Qty</th>
                <th class="th-serialized">Serial</th>
                <th class="th-after">After Update</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in product.adjustments"
                :key="item.id"
                :data-row-invalid="getFilledSerialCount(item) !== getRequiredSerials(item) && Number(item.quantityChange) !== 0"
              >
                <td class="td-no">{{ index + 1 }}</td>
                <td class="td-sku">{{ item.sku || 'N/A' }}</td>
                <td class="td-variant">
                  <div class="variant-cell">
                    <img
                      v-if="product.thumbnail"
                      :src="product.thumbnail"
                      :alt="item.name"
                      class="variant-cell__thumb"
                    />
                    <span v-else class="variant-cell__thumb variant-cell__thumb--initials">{{ thumbInitials(item.name) }}</span>
                    <span class="variant-cell__name">{{ item.name }}</span>
                  </div>
                </td>
                <td class="td-current">{{ item.currentStock }}</td>
                <td class="td-stock-in">
                  <div class="quantity-input-cell">
                    <input
                      :id="`quantity-${item.id}`"
                      :value="item.quantityChange"
                      type="number"
                      :min="isIncreaseAdjustment(form.adjustmentType) ? 1 : -9999"
                      step="1"
                      inputmode="numeric"
                      required
                      @input="updateVariantQuantity(item, $event.target.valueAsNumber)"
                    />
                  </div>
                </td>
                <td class="td-serialized">
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
                    <span v-if="getRowQty(item) > 0 && getFilledSerialCount(item) === getRequiredSerials(item)" class="serial-trigger__check">✓</span>
                  </button>
                </td>
                <td class="td-after">{{ (Number(item.currentStock) || 0) + (Number(item.quantityChange) || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="field field--reason">
          <label for="reason">Reason for Adjustment</label>
          <textarea
            id="reason"
            v-model="form.reason"
            rows="3"
            placeholder="Monthly inventory recount. Found 2 additional units in warehouse back-shelf."
          ></textarea>
        </div>

      </section>

      <div class="actions">
        <BaseButton variant="ghost" :disabled="submitting" @click="cancel">Cancel</BaseButton>
        <div class="submit-wrap">
          <BaseButton
            variant="primary"
            :disabled="!product || !quantityIsValid || submitting"
            @click="complete"
            :title="incompleteRows.length ? incompleteTooltip : ''"
          >
            {{ submitting ? 'Saving...' : 'Create' }}
          </BaseButton>
        </div>
      </div>

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
              <span v-else class="serial-modal__thumb serial-modal__thumb--initials">{{ thumbInitials(getCurrentItem()?.name || product?.name || 'V') }}</span>
              <div class="serial-modal__variant-copy">
                <strong>{{ getCurrentItem()?.name || 'Variant' }}</strong>
                <span>{{ getCurrentItem()?.sku || product?.sku || 'SKU' }}</span>
              </div>
            </div>
            <button type="button" class="serial-modal__close" aria-label="Close" title="Close" @click="closeSerialDrawer(true)">×</button>
          </header>

          <div class="serial-modal__body">
            <div class="serial-modal__title-row">
              <div>
                <p class="serial-modal__eyebrow">Variant serials</p>
                <h3 id="serial-modal-title">
                  {{ getRequiredSerials(getCurrentItem()) === 1 ? 'Add 1 serial number' : `Add ${getRequiredSerials(getCurrentItem())} serial numbers` }}
                </h3>
              </div>
            </div>

            <div class="serial-modal__stats" aria-label="Serial stats">
              <div class="serial-modal__stat">
                <span>Existing</span>
                <strong>{{ getCurrentItem()?.currentStock ?? 0 }}</strong>
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
                <button type="button" class="serial-modal__add-btn" :disabled="!drawer.input.trim() || getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem())" @click="addSingleSerial(drawer.input)">Add</button>
              </div>
              <p class="serial-modal__helper">Tip: paste many serials separated by new lines, commas or spaces</p>
              <p v-if="getFilledSerialCount(getCurrentItem()) >= getRequiredSerials(getCurrentItem())" class="serial-modal__limit">All serials entered</p>
            </div>

            <div v-if="drawer.pendingExtras" class="serial-modal__banner">
              {{ drawer.pendingExtras }} extra ignored.
            </div>
            <div v-if="Object.keys(drawer.errors).length" class="serial-modal__error-list" aria-live="polite">
              <div v-for="(message, serial) in drawer.errors" :key="serial" class="serial-modal__error-item">
                <span>⚠</span>
                <span>{{ serial }}: {{ message }}</span>
              </div>
            </div>

            <div class="serial-modal__chips-wrap">
              <div v-if="!getRowSerials(getCurrentItem()).length" class="serial-modal__empty-state">
                <span aria-hidden="true">⌁</span>
                <p>No serials yet. Scan or paste to begin.</p>
              </div>
              <div v-else class="serial-modal__chips">
                <button
                  v-for="serial in getRowSerials(getCurrentItem())"
                  :key="`${serial}-${Math.random()}`"
                  type="button"
                  class="serial-modal__chip"
                  :class="{ 'serial-modal__chip--new': drawer.lastAddedSerial && serial === drawer.lastAddedSerial }"
                  @click="removeSerial(getCurrentItem(), serial)"
                  :title="`Remove ${serial}`"
                >
                  <span class="serial-modal__chip-index">#{{ getRowSerials(getCurrentItem()).indexOf(serial) + 1 }}</span>
                  <span class="serial-modal__chip-value">{{ serial }}</span>
                  <span aria-hidden="true" class="serial-modal__chip-remove">×</span>
                </button>
              </div>
            </div>

            <div class="serial-modal__existing">
              <button type="button" class="serial-modal__existing-toggle" @click="drawer.showExistingSerials = !drawer.showExistingSerials">
                <span>Existing serials ({{ drawer.availableSerials.length }})</span>
                <span>{{ drawer.showExistingSerials ? 'Hide' : 'Show' }}</span>
              </button>
              <div v-if="drawer.showExistingSerials" class="serial-modal__existing-panel">
                <div class="serial-modal__existing-search">
                  <input v-model="drawer.search" type="search" placeholder="Search serials" />
                </div>
                <div class="serial-modal__existing-list">
                  <div v-for="serial in drawer.availableSerials.filter(item => item.toLowerCase().includes(drawer.search.toLowerCase()))" :key="serial" class="serial-modal__existing-item">
                    {{ serial }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer class="serial-modal__footer">
            <button type="button" class="serial-modal__ghost" @click="() => { const item = getCurrentItem(); if (item) { item.serialNumbers = []; drawer.selectedSerials = []; drawer.errors = {}; drawer.pendingExtras = 0 } }">Clear all</button>
            <div class="serial-modal__footer-actions">
              <button type="button" class="serial-modal__secondary" @click="closeSerialDrawer(true)">Cancel</button>
              <button
                type="button"
                class="serial-modal__primary"
                :disabled="getFilledSerialCount(getCurrentItem()) !== getRequiredSerials(getCurrentItem()) || !getCurrentItem()"
                @click="saveDrawerSelection"
              >
                Save serials
              </button>
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

.subhead {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-body);
    flex-shrink: 0;

    &:hover { background: var(--surface-alt); text-decoration: none; }

    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__desc {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }
}

.alert {
  padding: 0.85rem 1.1rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 500;

  &--error {
    background: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  &__title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__select {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 0 0 auto;
    width: 320px;

    label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-body);
    }
  }
}

.product-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem;
  background: var(--surface-hover);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.product-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;

  &__thumb {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    object-fit: cover;
    background: var(--border-subtle);
    flex-shrink: 0;

    &--initials {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 700;
    }
  }

  &__meta {
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__sub {
    margin: 0.2rem 0 0;
    font-size: 0.75rem;
    color: var(--text-subtle);
  }
}

.adjustment-controls {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;

  @media (max-width: 900px) {
    width: 100%;
  }
}

.adjustment-dropdown-wrapper {
  position: relative;
}

.adjustment-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-strong);
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    border-color: rgb(var(--accent-rgb));
    background: var(--surface-hover);
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  &__icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__chevron {
    width: 18px;
    height: 18px;
    stroke: var(--text-muted);
    stroke-width: 2;
    flex-shrink: 0;
    transition: transform 0.2s ease, stroke 0.2s ease;
  }

  &--blue {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    color: #1e40af;

    .adjustment-dropdown-btn__chevron { stroke: #3b82f6; }

    &:hover {
      border-color: #2563eb;
      background: rgba(59, 130, 246, 0.15);
    }
  }

  &--red {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
    color: #991b1b;

    .adjustment-dropdown-btn__chevron { stroke: #ef4444; }

    &:hover {
      border-color: #dc2626;
      background: rgba(239, 68, 68, 0.15);
    }
  }

  &--orange {
    border-color: #f97316;
    background: rgba(249, 115, 22, 0.08);
    color: #9a3412;

    .adjustment-dropdown-btn__chevron { stroke: #f97316; }

    &:hover {
      border-color: #ea580c;
      background: rgba(249, 115, 22, 0.15);
    }
  }

  &--green {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.08);
    color: #166534;

    .adjustment-dropdown-btn__chevron { stroke: #22c55e; }

    &:hover {
      border-color: #16a34a;
      background: rgba(34, 197, 94, 0.15);
    }
  }

  &--purple {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.08);
    color: #6b21a8;

    .adjustment-dropdown-btn__chevron { stroke: #a855f7; }

    &:hover {
      border-color: #9333ea;
      background: rgba(168, 85, 247, 0.15);
    }
  }
}

.adjustment-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 1000;
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.adjustment-dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 1rem;
  border: none;
  background: transparent;
  color: var(--text-body);
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;

  &:last-child { border-bottom: none; }

  &:hover {
    background: var(--surface-hover);
  }

  &--active {
    background: rgb(var(--accent-rgb) / 0.1);
    color: rgb(var(--accent-rgb));
  }

  &__icon {
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__label {
    font-weight: 600;
    color: var(--text-strong);
    margin-bottom: 0.2rem;
  }

  &__description {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  &__check {
    width: 20px;
    height: 20px;
    color: rgb(var(--accent-rgb));
    flex-shrink: 0;
  }
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }
}

.table-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-x: auto;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-subtle);

  &__summary {
    font-size: 0.9rem;
    color: var(--text-body);
    font-weight: 500;

    strong {
      color: var(--text-strong);
      font-weight: 700;
      font-size: 1.1rem;
      margin-left: 0.5rem;
    }
  }
}

.stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  thead {
    background: var(--surface-hover);
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  th {
    padding: 0.9rem 0.75rem;
    text-align: left;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-right: 1px solid var(--border-subtle);

    &:last-child { border-right: none; }
  }

  td {
    padding: 1rem 0.75rem;
    color: var(--text-body);
    border-bottom: 1px solid var(--border-subtle);
    border-right: 1px solid var(--border-subtle);

    &:last-child { border-right: none; }
  }

  tbody tr {
    &:hover { background: var(--surface-hover); }
    &:last-child td { border-bottom: none; }
  }
}

.th-no, .td-no { width: 60px; }
.th-sku, .td-sku { width: 100px; }
.th-variant, .td-variant { min-width: 200px; }
.th-current, .td-current { width: 100px; text-align: center; }
.th-stock-in, .td-stock-in { width: 140px; }
.th-serialized, .td-serialized { width: 100px; text-align: center; }
.th-after, .td-after { width: 100px; text-align: center; }
.th-action, .td-action { width: 60px; text-align: center; }

.variant-cell {
  display: flex;
  align-items: center;
  gap: 0.8rem;

  &__thumb {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--border-subtle);
    flex-shrink: 0;

    &--initials {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 700;
    }
  }

  &__name {
    font-weight: 500;
    color: var(--text-strong);
  }
}

.quantity-input-cell {
  input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.65rem 0.8rem;
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
}

.serialized-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  background: rgb(var(--accent-rgb) / 0.15);
  border: 1px solid rgb(var(--accent-rgb) / 0.3);
  border-radius: 6px;
  color: rgb(var(--accent-rgb));
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.serialized-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5;
}

.serial-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 40px;
  width: 100%;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 214, 102, 0.35);
  background: rgba(255, 214, 102, 0.08);
  color: var(--text-strong);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled) {
    border-color: rgba(255, 214, 102, 0.52);
    background: rgba(255, 214, 102, 0.12);
  }

  &--incomplete {
    border-color: rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.1);
    color: #fca5a5;
  }

  &--complete {
    border-color: rgba(34, 197, 94, 0.45);
    background: rgba(34, 197, 94, 0.12);
    color: #86efac;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: var(--border-subtle);
    background: var(--surface-hover);
    color: var(--text-muted);
  }

  &__label {
    white-space: nowrap;
  }

  &__count {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__check {
    color: inherit;
    font-weight: 700;
  }
}

.serialized-none {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: rgb(var(--accent-rgb));
}

.serial-section {
  padding: 1.5rem;
  background: var(--surface-hover);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);

  &__head {
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0 0 0.3rem;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-strong);
  }

  &__desc {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
}

.serial-group {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  margin-bottom: 1rem;

  &:last-child { margin-bottom: 0; }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-strong);
    flex: 1;
  }

  &__count {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--surface-hover);
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    white-space: nowrap;
  }
}

.serial-inputs {
  display: grid;
  gap: 0.65rem;
}

.serial-input-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.serial-input-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

.serial-input {
  width: 100%;
  padding: 0.65rem 0.8rem;
  padding-right: 2.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-body);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder { color: var(--text-faint); }

  &:focus {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }
}

.serial-check {
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 0.35rem;
  color: var(--success, #22c55e);
  font-weight: 700;
  font-size: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--reason {
    padding-top: 1rem;
    border-top: 1px solid var(--border-subtle);
  }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  textarea { resize: vertical; }
}

.select-wrap {
  position: relative;

  select {
    appearance: none;
    padding-right: 2.2rem;
    cursor: pointer;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover { border-color: var(--border-subtle); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  svg {
    position: absolute;
    top: 50%;
    right: 0.8rem;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    stroke: var(--text-subtle);
    stroke-width: 1.8;
    pointer-events: none;
  }

  &--enhanced select {
    padding-right: 2.5rem;
    border: 2px solid var(--border);
    font-weight: 500;

    &:hover {
      border-color: rgb(var(--accent-rgb) / 0.5);
      background: var(--surface-hover);
    }

    &:focus {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }
}

.serial-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(15, 17, 20, 0.68);
  backdrop-filter: blur(4px);
  animation: serialModalFade 0.2s ease;
}

.serial-modal__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 640px);
  max-height: 85vh;
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  animation: serialModalScale 0.2s ease;
}

.serial-modal__header,
.serial-modal__footer {
  position: sticky;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border-subtle);
}

.serial-modal__footer {
  border-top: 1px solid var(--border-subtle);
  border-bottom: none;
  justify-content: flex-end;
  flex-wrap: wrap;
  background: rgba(20, 22, 27, 0.96);
}

.serial-modal__variant {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

.serial-modal__thumb {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--surface-hover);
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;

  &--initials {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-strong);
  }
}

.serial-modal__variant-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong {
    color: var(--text-strong);
    font-size: 0.96rem;
    font-weight: 700;
  }

  span {
    font-size: 0.76rem;
    color: var(--text-subtle);
  }
}

.serial-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-strong);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--accent-rgb) / 0.5);
    background: rgba(var(--accent-rgb) / 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb));
    outline-offset: 2px;
  }
}

.serial-modal__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  overflow-y: auto;
}

.serial-modal__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.serial-modal__title-row h3 {
  margin: 0;
  font-size: 1.35rem;
  color: var(--text-strong);
  line-height: 1.3;
}

.serial-modal__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.serial-modal__stat {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem 0.8rem;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-hover);

  span {
    color: var(--text-muted);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
  }

  strong {
    color: var(--text-strong);
    font-size: 1.05rem;
    font-weight: 700;
  }
}

.serial-modal__progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.serial-modal__progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.serial-modal__progress-state--complete {
  color: #86efac;
}

.serial-modal__progress-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.serial-modal__progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.85), rgba(var(--accent-rgb), 1));
  transition: width 0.2s ease;
}

.serial-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.serial-modal__field label {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.serial-modal__input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.serial-modal__input-row input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-hover);
  color: var(--text-strong);
  padding: 0.8rem 0.9rem;
  font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder {
    color: var(--text-muted);
  }

  &:focus {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.serial-modal__add-btn,
.serial-modal__ghost,
.serial-modal__secondary,
.serial-modal__primary {
  min-height: 42px;
  border-radius: 10px;
  padding: 0.7rem 1rem;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.serial-modal__add-btn,
.serial-modal__primary {
  background: rgb(var(--accent-rgb));
  border: 1px solid rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
}

.serial-modal__add-btn:hover:not(:disabled),
.serial-modal__primary:hover:not(:disabled) {
  filter: brightness(0.96);
}

.serial-modal__ghost,
.serial-modal__secondary {
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-strong);
}

.serial-modal__primary:disabled,
.serial-modal__add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.serial-modal__helper,
.serial-modal__limit {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.serial-modal__banner {
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(248, 113, 113, 0.45);
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.08);
  color: #fca5a5;
  font-size: 0.75rem;
  font-weight: 600;
}

.serial-modal__error-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.serial-modal__error-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(239, 68, 68, 0.08);
  color: #fca5a5;
  font-size: 0.78rem;
}

.serial-modal__chips-wrap {
  min-height: 120px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.01);
  padding: 0.75rem;
}

.serial-modal__empty-state {
  min-height: 120px;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 0.5rem;
  color: var(--text-muted);

  span {
    font-size: 1.7rem;
    opacity: 0.7;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.serial-modal__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.serial-modal__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.65rem 0.45rem 0.5rem;
  min-height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-strong);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover {
    border-color: rgba(var(--accent-rgb), 0.45);
  }

  &--new {
    border-color: rgba(var(--accent-rgb), 0.6);
    box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.15);
    background: rgba(var(--accent-rgb), 0.08);
  }
}

.serial-modal__chip-index {
  opacity: 0.72;
}

.serial-modal__chip-value {
  font-weight: 600;
}

.serial-modal__chip-remove {
  font-size: 1rem;
  opacity: 0.8;
}

.serial-modal__existing {
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.01);
}

.serial-modal__existing-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0.9rem;
  background: transparent;
  border: none;
  color: var(--text-strong);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.serial-modal__existing-panel {
  border-top: 1px solid var(--border-subtle);
  padding: 0.8rem;
}

.serial-modal__existing-search input {
  width: 100%;
  border: 1px solid var(--border-subtle);
  background: var(--surface-hover);
  color: var(--text-strong);
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
  font: inherit;
}

.serial-modal__existing-list {
  display: grid;
  gap: 0.45rem;
  max-height: 160px;
  overflow-y: auto;
  margin-top: 0.8rem;
}

.serial-modal__existing-item {
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-subtle);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.78rem;
  color: var(--text-body);
}

.serial-modal__footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-left: auto;
}

@keyframes serialModalFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes serialModalScale {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 640px) {
  .serial-modal {
    padding: 0;
    align-items: flex-end;
  }

  .serial-modal__panel {
    width: 100%;
    max-width: 100%;
    max-height: 92vh;
    border-radius: 18px 18px 0 0;
  }

  .serial-modal__header,
  .serial-modal__footer {
    padding: 0.9rem 1rem;
  }

  .serial-modal__body {
    padding: 1rem;
  }

  .serial-modal__input-row {
    flex-direction: column;
    align-items: stretch;
  }

  .serial-modal__add-btn,
  .serial-modal__primary,
  .serial-modal__secondary,
  .serial-modal__ghost {
    width: 100%;
  }

  .serial-modal__footer {
    justify-content: stretch;
  }

  .serial-modal__footer-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .serial-modal,
  .serial-modal__panel {
    animation: none;
  }
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}
</style>
