<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  Barcode,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  PackageCheck,
  Plus,
  Search,
  X,
} from '@lucide/vue'
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { downloadCsv } from '@/services/tableExport'
import {
  bulkUpdateStatus,
  exportSerials,
  fetchSerialHistory,
  fetchSerials,
  fetchSerialSummary,
  lookupSerial,
  receiveSerials,
  updateSerial,
} from '@/services/serials'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const receiveSection = ref(null)
const lookupInput = ref(null)
const rows = ref([])
const pagination = ref({})
const products = ref([])
const loading = ref(true)
const saving = ref(false)
const exporting = ref(false)
const error = ref('')
const notice = ref('')
const noticeUndoIds = ref([])
const lookup = ref('')
const lookupState = ref('idle')
const lookupResult = ref(null)
const lookupError = ref('')
const history = ref([])
const selectedSerial = ref(null)
const detailLoading = ref(false)
const selectedStatus = ref('')
const selectedIds = ref([])
const batchExisting = ref([])
const batchChecking = ref(false)
const sort = ref({ key: 'created_at', direction: 'desc' })
const filters = ref({ query: '', status: '', productId: '', warehouse: '', receivedFrom: '', receivedTo: '' })
const form = ref({ product_id: '', product_label: '', serial_numbers: '', receiving_reference: '', warehouse: '' })
const summary = ref({ by_status: {}, total: 0, available: 0, reserved: 0, sold: 0 })
const page = ref(1)
const perPage = ref(20)
const statusOptions = ['available', 'reserved', 'sold', 'returned', 'in_service', 'repaired', 'replaced', 'damaged', 'lost', 'cancelled']
let batchCheckTimer
let noticeTimer

const parsedSerials = computed(() => form.value.serial_numbers
  .split(/[\r\n,]+/)
  .map((serial) => serial.trim())
  .filter(Boolean))
const duplicateSerials = computed(() => {
  const seen = new Set()
  const duplicates = new Set()
  parsedSerials.value.forEach((serial) => {
    const key = serial.toLowerCase()
    if (seen.has(key)) duplicates.add(serial)
    seen.add(key)
  })
  return [...duplicates]
})
const uniqueSerials = computed(() => {
  const seen = new Set()
  return parsedSerials.value.filter((serial) => {
    const key = serial.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const invalidSerials = computed(() => uniqueSerials.value.filter((serial) =>
  !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$/.test(serial)))
const availableBatch = computed(() => uniqueSerials.value.filter((serial) =>
  !duplicateSerials.value.some((duplicate) => duplicate.toLowerCase() === serial.toLowerCase())
  && !invalidSerials.value.includes(serial)
  && !batchExisting.value.some((existing) => existing.serial.toLowerCase() === serial.toLowerCase())))
const selectedProduct = computed(() => products.value.find((product) => String(product.id) === String(form.value.product_id)))
const warehouses = computed(() => [...new Set(rows.value.map((row) => row.warehouse).filter(Boolean))].sort())
const activeFilters = computed(() => [
  filters.value.query && { key: 'query', label: `Search: ${filters.value.query}` },
  filters.value.productId && { key: 'productId', label: `Product: ${products.value.find((item) => String(item.id) === filters.value.productId)?.name || 'Selected'}` },
  filters.value.status && { key: 'status', label: `Status: ${formatStatus(filters.value.status)}` },
  filters.value.warehouse && { key: 'warehouse', label: `Warehouse: ${filters.value.warehouse}` },
  filters.value.receivedFrom && { key: 'receivedFrom', label: `From: ${filters.value.receivedFrom}` },
  filters.value.receivedTo && { key: 'receivedTo', label: `To: ${filters.value.receivedTo}` },
].filter(Boolean))
const totalPages = computed(() => pagination.value.last_page || 1)
const firstRow = computed(() => pagination.value.total ? (page.value - 1) * perPage.value + 1 : 0)
const lastRow = computed(() => Math.min(page.value * perPage.value, pagination.value.total || rows.value.length))
const sortedRows = computed(() => [...rows.value].sort((a, b) => {
  const left = a[sort.value.key] ?? ''
  const right = b[sort.value.key] ?? ''
  const comparison = String(left).localeCompare(String(right), undefined, { numeric: true })
  return sort.value.direction === 'asc' ? comparison : -comparison
}))
const emptyInventory = computed(() => !loading.value && rows.value.length === 0 && !activeFilters.value.length && !summary.value.total)
const emptyResults = computed(() => !loading.value && rows.value.length === 0 && !emptyInventory.value)

const statCards = computed(() => [
  { key: '', label: 'Total', count: summary.value.total || 0, icon: PackageCheck, tone: 'neutral', note: 'All tracked units' },
  { key: 'available', label: 'Available', count: summary.value.available || 0, icon: Check, tone: 'success', note: 'Ready to sell' },
  { key: 'reserved', label: 'Reserved', count: summary.value.reserved || 0, icon: Clock3, tone: 'info', note: 'Held for orders' },
  { key: 'sold', label: 'Sold', count: summary.value.sold || 0, icon: PackageCheck, tone: 'neutral', note: 'Completed sales' },
  { key: 'damaged', label: 'Damaged', count: summary.value.by_status?.damaged || 0, icon: AlertTriangle, tone: 'danger', note: 'Needs attention' },
])

function formatStatus(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function warrantyHint(value) {
  if (!value) return ''
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
  if (Number.isNaN(days)) return ''
  if (days < 0) return 'Expired'
  if (days <= 30) return `Expires in ${days} days`
  return ''
}

function setNotice(message, undoIds = []) {
  notice.value = message
  noticeUndoIds.value = undoIds
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 9000)
}

function requestParams(targetPage = page.value) {
  return {
    q: filters.value.query.trim(),
    status: filters.value.status,
    product_id: filters.value.productId,
    warehouse: filters.value.warehouse,
    received_from: filters.value.receivedFrom,
    received_to: filters.value.receivedTo,
    page: targetPage,
    per_page: perPage.value,
  }
}

async function load(targetPage = page.value) {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchSerials(requestParams(targetPage), auth.accessToken)
    rows.value = data.items || []
    pagination.value = data.pagination || {}
    page.value = pagination.value.current_page || targetPage
    selectedIds.value = selectedIds.value.filter((id) => rows.value.some((row) => row.id === id))
  } catch (err) {
    error.value = err.message || 'Unable to load serial numbers.'
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try { summary.value = await fetchSerialSummary(auth.accessToken) } catch { summary.value = { by_status: {}, total: 0, available: 0, reserved: 0, sold: 0 } }
}

async function loadProducts() {
  try {
    const response = await apiFetch('/admin/products?per_page=200', { token: auth.accessToken })
    products.value = response?.data?.items || response?.data || []
  } catch (err) {
    error.value = err.message || 'Unable to load products.'
  }
}

function applyStatusFilter(status) {
  filters.value.status = filters.value.status === status ? '' : status
  page.value = 1
  load(1)
}

function clearFilters() {
  filters.value = { query: '', status: '', productId: '', warehouse: '', receivedFrom: '', receivedTo: '' }
  page.value = 1
  load(1)
}

function removeFilter(key) {
  filters.value[key] = ''
  page.value = 1
  load(1)
}

function selectProduct() {
  const found = products.value.find((product) => `${product.name} · ${product.sku || 'No SKU'}` === form.value.product_label)
  form.value.product_id = found ? found.id : ''
}

function removeBatchSerial(serial) {
  const removeKey = serial.toLowerCase()
  form.value.serial_numbers = parsedSerials.value
    .filter((item) => item.toLowerCase() !== removeKey)
    .join('\n')
}

watch(() => form.value.serial_numbers, (value) => {
  window.clearTimeout(batchCheckTimer)
  batchExisting.value = []
  const candidates = [...new Set(value.split(/[\r\n,]+/).map((serial) => serial.trim()).filter(Boolean))]
  if (!candidates.length) return
  batchChecking.value = true
  batchCheckTimer = window.setTimeout(async () => {
    const found = await Promise.all(candidates.map(async (serial) => {
      try {
        const match = await lookupSerial(serial, auth.accessToken)
        return match?.serial_number ? { serial: match.serial_number, status: match.status } : null
      } catch {
        return null
      }
    }))
    batchExisting.value = found.filter(Boolean)
    batchChecking.value = false
  }, 550)
})

async function receive() {
  if (!canReceive.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  const receivedCount = availableBatch.value.length
  try {
    const response = await receiveSerials({
      product_id: form.value.product_id,
      receiving_reference: form.value.receiving_reference.trim() || null,
      warehouse: form.value.warehouse || null,
      serial_numbers: availableBatch.value,
      receiving_quantity: availableBatch.value.length,
    }, auth.accessToken)
    const receivedItems = response.items || []
    const undoIds = receivedItems.map((item) => item.id).filter(Boolean)
    form.value.serial_numbers = ''
    form.value.receiving_reference = ''
    batchExisting.value = []
    setNotice(`${receivedCount} serial${receivedCount === 1 ? '' : 's'} received successfully.`, undoIds)
    await Promise.all([load(1), loadSummary()])
  } catch (err) {
    error.value = err.message || 'Unable to receive serial numbers.'
  } finally {
    saving.value = false
  }
}

const canReceive = computed(() => Boolean(
  form.value.product_id && availableBatch.value.length && !saving.value && !batchChecking.value
  && !duplicateSerials.value.length && !invalidSerials.value.length && !batchExisting.value.length,
))

async function undoReceive() {
  if (!noticeUndoIds.value.length) return
  try {
    await bulkUpdateStatus(noticeUndoIds.value, 'cancelled', auth.accessToken)
    noticeUndoIds.value = []
    setNotice('Received serials were cancelled.')
    await Promise.all([load(1), loadSummary()])
  } catch (err) {
    error.value = err.message || 'Unable to undo receiving.'
  }
}

async function showDetails(row) {
  selectedSerial.value = row
  selectedStatus.value = row.status
  detailLoading.value = true
  try { history.value = await fetchSerialHistory(row.id, auth.accessToken) }
  catch (err) { error.value = err.message || 'Unable to load serial history.' }
  finally { detailLoading.value = false }
}

async function saveStatus() {
  if (!selectedSerial.value || selectedStatus.value === selectedSerial.value.status) return
  try {
    selectedSerial.value = await updateSerial(selectedSerial.value.id, { status: selectedStatus.value }, auth.accessToken)
    history.value = await fetchSerialHistory(selectedSerial.value.id, auth.accessToken)
    await Promise.all([load(), loadSummary()])
    setNotice('Serial status updated.')
  } catch (err) { error.value = err.message || 'Unable to update serial status.' }
}

async function markDamaged(row) {
  try {
    await updateSerial(row.id, { status: 'damaged' }, auth.accessToken)
    await Promise.all([load(), loadSummary()])
    setNotice(`${row.serial_number} marked as damaged.`)
  } catch (err) { error.value = err.message || 'Unable to update serial status.' }
}

async function scanLookup() {
  const serial = lookup.value.trim()
  if (!serial) return
  lookupState.value = 'loading'
  lookupError.value = ''
  try {
    lookupResult.value = await lookupSerial(serial, auth.accessToken)
    lookupState.value = 'result'
    await showDetails(lookupResult.value)
  } catch (err) {
    lookupResult.value = null
    lookupError.value = err.message || 'Serial number not found.'
    lookupState.value = 'not-found'
    selectedSerial.value = null
  }
}

function focusLookup() { lookupInput.value?.focus() }
function handleShortcut(event) {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return
  event.preventDefault()
  focusLookup()
}
function closeDrawer() {
  selectedSerial.value = null
  if (lookupState.value === 'result') lookupState.value = 'idle'
}

function toggleRow(row) {
  selectedIds.value = selectedIds.value.includes(row.id)
    ? selectedIds.value.filter((id) => id !== row.id)
    : [...selectedIds.value, row.id]
}
function togglePageSelection() {
  selectedIds.value = selectedIds.value.length === rows.value.length ? [] : rows.value.map((row) => row.id)
}

async function bulkStatus(event) {
  const nextStatus = event.target.value
  if (!nextStatus || !selectedIds.value.length) return
  try {
    await bulkUpdateStatus(selectedIds.value, nextStatus, auth.accessToken)
    selectedIds.value = []
    event.target.value = ''
    await Promise.all([load(), loadSummary()])
    setNotice('Selected serial statuses updated.')
  } catch (err) { error.value = err.message || 'Unable to update selected serials.' }
}

async function moveSelected(event) {
  const warehouse = event.target.value
  if (!warehouse || !selectedIds.value.length) return
  try {
    const selectedRows = rows.value.filter((row) => selectedIds.value.includes(row.id))
    await Promise.all(selectedRows.map((row) => updateSerial(row.id, { warehouse }, auth.accessToken)))
    selectedIds.value = []
    event.target.value = ''
    await load()
    setNotice('Selected serials moved to the new warehouse.')
  } catch (err) { error.value = err.message || 'Unable to move selected serials.' }
}

async function exportInventory() {
  exporting.value = true
  try {
    const result = selectedIds.value.length
      ? { data: rows.value.filter((row) => selectedIds.value.includes(row.id)) }
      : await exportSerials(requestParams(1), auth.accessToken)
    const exportRows = (result.data || []).map((row) => ({
      serial: row.serial_number,
      product: row.product?.name,
      sku: row.product?.sku,
      status: row.status,
      warehouse: row.warehouse,
      customer: row.customer?.name || row.customer?.email,
      warranty_end: row.warranty?.end_at,
      received: row.created_at,
    }))
    downloadCsv(exportRows, [
      { key: 'serial', label: 'Serial' }, { key: 'product', label: 'Product' },
      { key: 'sku', label: 'SKU' }, { key: 'status', label: 'Status' },
      { key: 'warehouse', label: 'Warehouse' }, { key: 'customer', label: 'Customer' },
      { key: 'warranty_end', label: 'Warranty expiry' }, { key: 'received', label: 'Received' },
    ], 'serial-inventory.csv')
    setNotice(`${exportRows.length} serials exported.`)
  } catch (err) { error.value = err.message || 'Unable to export serials.' }
  finally { exporting.value = false }
}

function printLabels(rowsToPrint = rows.value.filter((row) => selectedIds.value.includes(row.id))) {
  if (!rowsToPrint.length) return
  const labels = rowsToPrint.map((row) => `<div class="serial-label"><strong>${escapeHtml(row.serial_number)}</strong><span>${escapeHtml(row.product?.name || '')}</span><small>${escapeHtml(row.product?.sku || '')}</small></div>`).join('')
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return
  printWindow.document.write(`<title>Serial labels</title><style>body{font:14px sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px}.serial-label{border:1px solid #888;padding:12px;display:grid;gap:5px;break-inside:avoid}.serial-label strong{font:700 16px monospace}</style>${labels}`)
  printWindow.document.close()
  printWindow.print()
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function changeSort(key) {
  sort.value = { key, direction: sort.value.key === key && sort.value.direction === 'asc' ? 'desc' : 'asc' }
}

async function copySerial(serial) {
  try {
    await navigator.clipboard.writeText(serial)
    setNotice('Serial number copied.')
  } catch {
    error.value = 'Unable to copy this serial number.'
  }
}

watch([perPage], () => { page.value = 1; load(1) })
onMounted(async () => {
  window.addEventListener('keydown', handleShortcut)
  await Promise.all([load(1), loadProducts(), loadSummary()])
  await nextTick()
  focusLookup()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut)
  window.clearTimeout(batchCheckTimer)
  window.clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="serial-page">
    <AppHeader title="Serial Numbers" />
    <main class="serial-content">
      <section class="page-heading">
        <div>
          <p class="eyebrow">Inventory control</p>
          <h1>Serial Numbers</h1>
          <p class="page-subtitle">Receive, trace and manage every serialized unit.</p>
        </div>
        <BaseButton variant="ghost" :disabled="exporting" @click="exportInventory">
          <template #icon><Download /></template>{{ exporting ? 'Preparing…' : 'Export CSV' }}
        </BaseButton>
      </section>

      <form class="scanner-bar" role="search" @submit.prevent="scanLookup">
        <Barcode class="scanner-icon" aria-hidden="true" />
        <input ref="lookupInput" v-model="lookup" aria-label="Look up a serial number" placeholder="Scan or enter a serial number" autocomplete="off" />
        <kbd aria-hidden="true">/</kbd>
        <BaseButton type="submit" :disabled="lookupState === 'loading'">{{ lookupState === 'loading' ? 'Looking up…' : 'Lookup' }}</BaseButton>
      </form>

      <section class="stats-grid" aria-label="Serial inventory summary">
        <button
          v-for="stat in statCards"
          :key="stat.label"
          type="button"
          class="stat-card"
          :class="[`stat-card--${stat.tone}`, { 'is-selected': filters.status === stat.key && stat.key !== '' }]"
          :aria-pressed="filters.status === stat.key && stat.key !== ''"
          @click="applyStatusFilter(stat.key)"
        >
          <span class="stat-card__icon"><component :is="stat.icon" /></span>
          <span class="stat-card__label">{{ stat.label }}</span>
          <strong>{{ Number(stat.count).toLocaleString() }}</strong>
          <span class="stat-card__note">{{ stat.note }}</span>
        </button>
      </section>

      <section ref="receiveSection" class="panel receive-panel" aria-labelledby="receive-title">
        <div class="section-heading">
          <div><span class="section-kicker">Inbound inventory</span><h2 id="receive-title">Receive serialized stock</h2></div>
          <span class="section-step">01</span>
        </div>
        <div class="receive-layout">
          <form class="receive-form" @submit.prevent="receive">
            <div class="field-grid">
              <label class="field field--product">
                <span>Product <i aria-hidden="true">Required</i></span>
                <input v-model="form.product_label" list="serial-products" placeholder="Search by product or SKU" autocomplete="off" @change="selectProduct" @input="selectProduct" />
                <datalist id="serial-products"><option v-for="product in products" :key="product.id" :value="`${product.name} · ${product.sku || 'No SKU'}`" /></datalist>
                <small v-if="form.product_label && !selectedProduct" class="field-error">Choose a product from the list.</small>
              </label>
              <label class="field">
                <span>Receiving reference</span>
                <input v-model="form.receiving_reference" placeholder="e.g. PO-1001" />
              </label>
              <label class="field">
                <span>Warehouse</span>
                <select v-model="form.warehouse" aria-label="Choose warehouse">
                  <option value="">Unassigned</option>
                  <option v-for="warehouse in warehouses" :key="warehouse" :value="warehouse">{{ warehouse }}</option>
                </select>
              </label>
            </div>
            <label class="field serial-field">
              <span>Serial numbers <i aria-hidden="true">Required</i></span>
              <textarea v-model="form.serial_numbers" rows="4" placeholder="Paste serials, one per line, comma-separated, or scan them here" spellcheck="false" />
            </label>
            <div class="batch-status" aria-live="polite">
              <div class="batch-summary">
                <span>{{ parsedSerials.length }} serial{{ parsedSerials.length === 1 ? '' : 's' }} detected</span>
                <span v-if="duplicateSerials.length" class="validation validation--warning">{{ duplicateSerials.length }} duplicate{{ duplicateSerials.length === 1 ? '' : 's' }}</span>
                <span v-if="batchChecking" class="validation">Checking existing serials…</span>
                <span v-else-if="batchExisting.length" class="validation validation--danger">{{ batchExisting.length }} already in stock</span>
                <span v-if="invalidSerials.length" class="validation validation--danger">{{ invalidSerials.length }} invalid format</span>
                <span v-if="parsedSerials.length && !duplicateSerials.length && !batchExisting.length && !invalidSerials.length && !batchChecking" class="validation validation--success"><Check /> Ready to receive</span>
              </div>
              <div v-if="parsedSerials.length" class="serial-chips" aria-label="Detected serials">
                <span v-for="serial in uniqueSerials" :key="serial" class="serial-chip" :class="{ 'serial-chip--error': duplicateSerials.some((item) => item.toLowerCase() === serial.toLowerCase()) || invalidSerials.includes(serial), 'serial-chip--exists': batchExisting.some((item) => item.serial.toLowerCase() === serial.toLowerCase()) }">
                  <code>{{ serial }}</code>
                  <button type="button" :aria-label="`Remove serial ${serial}`" @click="removeBatchSerial(serial)"><X /></button>
                </span>
              </div>
              <p v-if="invalidSerials.length" class="field-error">Use letters, numbers, dots, slashes, underscores or hyphens (up to 191 characters).</p>
            </div>
            <div class="form-actions">
              <button type="button" class="text-button" :disabled="!form.serial_numbers" @click="form.serial_numbers = ''">Clear</button>
              <BaseButton type="submit" :disabled="!canReceive">{{ saving ? 'Receiving…' : `Receive ${availableBatch.length} serial${availableBatch.length === 1 ? '' : 's'}` }}<template #icon><Plus /></template></BaseButton>
            </div>
          </form>

          <aside class="batch-preview" aria-label="Batch preview">
            <div class="preview-head"><span class="preview-icon"><PackageCheck /></span><span>Batch preview</span></div>
            <strong>{{ availableBatch.length }}</strong>
            <span class="preview-caption">{{ availableBatch.length === 1 ? 'serial ready' : 'serials ready' }} to receive</span>
            <div class="preview-divider" />
            <dl>
              <div><dt>Product</dt><dd>{{ selectedProduct?.name || 'Not selected' }}</dd></div>
              <div><dt>Reference</dt><dd>{{ form.receiving_reference || 'Not added' }}</dd></div>
              <div><dt>Warehouse</dt><dd>{{ form.warehouse || 'Unassigned' }}</dd></div>
            </dl>
            <p class="preview-note">Duplicate and previously received serials are excluded until resolved.</p>
          </aside>
        </div>
      </section>

      <p v-if="error" class="toast toast--error" role="alert"><AlertTriangle />{{ error }}<button type="button" aria-label="Dismiss error" @click="error = ''"><X /></button></p>
      <p v-if="notice" class="toast toast--success" role="status"><Check />{{ notice }}<button v-if="noticeUndoIds.length" type="button" class="undo-button" @click="undoReceive">Undo</button><button type="button" aria-label="Dismiss notification" @click="notice = ''"><X /></button></p>

      <section class="panel inventory-panel" aria-labelledby="inventory-title">
        <div class="inventory-heading">
          <div><span class="section-kicker">Browse and manage</span><h2 id="inventory-title">Inventory serials <span>{{ (pagination.total || 0).toLocaleString() }}</span></h2></div>
          <button type="button" class="export-link" :disabled="exporting" @click="exportInventory"><Download />Export CSV</button>
        </div>
        <form class="filter-grid" @submit.prevent="page = 1; load(1)">
          <label class="search-filter"><Search aria-hidden="true" /><input v-model="filters.query" aria-label="Search serial, product or SKU" placeholder="Serial, product or SKU" /></label>
          <select v-model="filters.productId" aria-label="Filter by product"><option value="">All products</option><option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option></select>
          <select v-model="filters.status" aria-label="Filter by status"><option value="">All statuses</option><option v-for="value in statusOptions" :key="value" :value="value">{{ formatStatus(value) }}</option></select>
          <select v-model="filters.warehouse" aria-label="Filter by warehouse"><option value="">All warehouses</option><option v-for="warehouse in warehouses" :key="warehouse" :value="warehouse">{{ warehouse }}</option></select>
          <label class="date-filter"><span>From</span><input v-model="filters.receivedFrom" type="date" aria-label="Received from date" /></label>
          <label class="date-filter"><span>To</span><input v-model="filters.receivedTo" type="date" aria-label="Received to date" /></label>
          <BaseButton type="submit" variant="ghost">Search</BaseButton>
        </form>
        <div v-if="activeFilters.length" class="active-filters">
          <span>Filters</span>
          <button v-for="filter in activeFilters" :key="filter.key" type="button" class="filter-chip" @click="removeFilter(filter.key)">{{ filter.label }}<X /></button>
          <button type="button" class="text-button clear-filters" @click="clearFilters">Clear all</button>
        </div>

        <div v-if="selectedIds.length" class="bulk-bar" aria-live="polite">
          <strong>{{ selectedIds.length }} selected</strong>
          <label><span class="sr-only">Change status of selected serials</span><select aria-label="Change selected status" @change="bulkStatus"><option value="">Change status</option><option v-for="value in statusOptions" :key="value" :value="value">{{ formatStatus(value) }}</option></select></label>
          <label><span class="sr-only">Move selected serials to warehouse</span><select aria-label="Move selected to warehouse" @change="moveSelected"><option value="">Move to warehouse</option><option v-for="warehouse in warehouses" :key="warehouse" :value="warehouse">{{ warehouse }}</option></select></label>
          <button type="button" @click="exportInventory"><Download />Export</button>
          <button type="button" @click="printLabels()"><Barcode />Print labels</button>
          <button type="button" class="bulk-clear" @click="selectedIds = []">Clear selection</button>
        </div>

        <div v-if="loading" class="table-wrap" aria-label="Loading serials" aria-busy="true">
          <div class="skeleton-head"><span v-for="n in 7" :key="n" /></div>
          <div v-for="n in 6" :key="n" class="skeleton-row"><span v-for="cell in 7" :key="cell" /></div>
        </div>
        <div v-else-if="emptyInventory" class="empty-state">
          <span class="empty-icon"><Barcode /></span>
          <h3>No serialized products yet</h3>
          <p>Once you receive serialized stock, each unit will appear here for tracking.</p>
          <BaseButton @click="receiveSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })"><template #icon><Plus /></template>Receive your first serials</BaseButton>
        </div>
        <div v-else-if="emptyResults" class="empty-state empty-state--compact">
          <span class="empty-icon"><Search /></span>
          <h3>No results match your filters</h3>
          <p>Try adjusting your search or clear the active filters.</p>
          <button type="button" class="text-button" @click="clearFilters">Clear filters</button>
        </div>
        <div v-else class="table-wrap">
          <table class="serial-table">
            <thead><tr>
              <th class="check-col"><input type="checkbox" :checked="rows.length > 0 && selectedIds.length === rows.length" aria-label="Select all serials on this page" @change="togglePageSelection" /></th>
              <th><button type="button" class="sort-button" @click="changeSort('serial_number')">Serial <ChevronDown /></button></th>
              <th>Product</th><th>Status</th><th>Warehouse</th><th>Customer</th><th>Warranty</th>
              <th><button type="button" class="sort-button" @click="changeSort('created_at')">Received <ChevronDown /></button></th><th><span class="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>
              <tr v-for="row in sortedRows" :key="row.id" :class="{ 'is-selected': selectedIds.includes(row.id) }" @click="showDetails(row)">
                <td class="check-col" @click.stop><input type="checkbox" :checked="selectedIds.includes(row.id)" :aria-label="`Select ${row.serial_number}`" @change="toggleRow(row)" /></td>
                <td><span class="serial-cell"><code>{{ row.serial_number }}</code><button type="button" :aria-label="`Copy serial ${row.serial_number}`" @click.stop="copySerial(row.serial_number)"><Copy /></button></span></td>
                <td><span class="product-cell"><span class="product-thumb">{{ (row.product?.name || 'P').slice(0, 1).toUpperCase() }}</span><span>{{ row.product?.name || '—' }}<small>{{ row.product?.sku || 'No SKU' }}</small></span></span></td>
                <td><span class="status-badge" :class="`status-badge--${row.status}`"><span />{{ formatStatus(row.status) }}</span></td>
                <td>{{ row.warehouse || '—' }}</td><td>{{ row.customer?.name || row.customer?.email || '—' }}</td>
                <td><span>{{ formatDate(row.warranty?.end_at) }}</span><small v-if="warrantyHint(row.warranty?.end_at)" class="warranty-warning">{{ warrantyHint(row.warranty?.end_at) }}</small></td>
                <td>{{ formatDate(row.created_at) }}</td>
                <td class="row-actions" @click.stop><details><summary aria-label="Open serial actions"><ChevronDown /></summary><div class="row-menu"><button type="button" @click="showDetails(row)">View details</button><button type="button" @click="showDetails(row)">Change status</button><button type="button" :disabled="row.status === 'damaged'" @click="markDamaged(row)">Mark damaged</button><button type="button" @click="printLabels([row])">Print label</button></div></details></td>
              </tr>
            </tbody>
          </table>
          <div class="mobile-rows">
            <article v-for="row in sortedRows" :key="row.id" class="mobile-row" @click="showDetails(row)">
              <input type="checkbox" :checked="selectedIds.includes(row.id)" :aria-label="`Select ${row.serial_number}`" @click.stop @change="toggleRow(row)" />
              <div class="mobile-row__main"><code>{{ row.serial_number }}</code><strong>{{ row.product?.name || '—' }}</strong><span>{{ row.product?.sku || 'No SKU' }}</span><span class="status-badge" :class="`status-badge--${row.status}`"><span />{{ formatStatus(row.status) }}</span></div>
              <ChevronRight aria-hidden="true" />
            </article>
          </div>
          <footer class="table-footer">
            <span>Showing {{ firstRow }}–{{ lastRow }} of {{ (pagination.total || 0).toLocaleString() }}</span>
            <label>Rows per page<select v-model.number="perPage"><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select></label>
            <div class="pagination"><button type="button" aria-label="Previous page" :disabled="page <= 1" @click="load(page - 1)"><ChevronLeft /></button><span>Page {{ page }} of {{ totalPages }}</span><button type="button" aria-label="Next page" :disabled="page >= totalPages" @click="load(page + 1)"><ChevronRight /></button></div>
          </footer>
        </div>
      </section>
    </main>

    <div v-if="lookupState === 'not-found'" class="drawer-backdrop" @click.self="lookupState = 'idle'">
      <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="not-found-title">
        <div class="drawer-heading"><div><span class="section-kicker">Scanner lookup</span><h2 id="not-found-title">Serial not found</h2></div><button type="button" class="icon-button" aria-label="Close lookup" @click="lookupState = 'idle'"><X /></button></div>
        <div class="not-found"><span class="empty-icon"><Barcode /></span><code>{{ lookup }}</code><p>{{ lookupError }}</p><BaseButton @click="lookupState = 'idle'; receiveSection?.scrollIntoView({ behavior: 'smooth', block: 'center' }); form.serial_numbers = lookup"><template #icon><Plus /></template>Receive this serial</BaseButton></div>
      </aside>
    </div>

    <div v-if="selectedSerial" class="drawer-backdrop" @click.self="closeDrawer">
      <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="drawer-heading"><div><span class="section-kicker">Serial detail</span><h2 id="detail-title">{{ selectedSerial.serial_number }}</h2></div><button type="button" class="icon-button" aria-label="Close serial details" @click="closeDrawer"><X /></button></div>
        <div class="drawer-product"><span class="product-thumb product-thumb--large">{{ (selectedSerial.product?.name || 'P').slice(0, 1).toUpperCase() }}</span><div><strong>{{ selectedSerial.product?.name || 'Unknown product' }}</strong><small>{{ selectedSerial.product?.sku || 'No SKU' }}<span v-if="selectedSerial.variant?.name"> · {{ selectedSerial.variant.name }}</span></small></div></div>
        <span class="status-badge" :class="`status-badge--${selectedSerial.status}`"><span />{{ formatStatus(selectedSerial.status) }}</span>
        <dl class="detail-grid">
          <div><dt>Warehouse</dt><dd>{{ selectedSerial.warehouse || 'Unassigned' }}</dd></div>
          <div><dt>Customer</dt><dd>{{ selectedSerial.customer?.name || selectedSerial.customer?.email || '—' }}</dd></div>
          <div><dt>Order</dt><dd><RouterLink v-if="selectedSerial.order?.id" :to="`/orders/${selectedSerial.order.id}`">{{ selectedSerial.order.order_number || 'View order' }}</RouterLink><span v-else>—</span></dd></div>
          <div><dt>Warranty started</dt><dd>{{ formatDate(selectedSerial.warranty?.start_at) }}</dd></div>
          <div><dt>Warranty expires</dt><dd>{{ formatDate(selectedSerial.warranty?.end_at) }}</dd></div>
          <div><dt>Received</dt><dd>{{ formatDate(selectedSerial.created_at) }}</dd></div>
        </dl>
        <label class="field"><span>Change status</span><select v-model="selectedStatus"><option v-for="value in statusOptions" :key="value" :value="value">{{ formatStatus(value) }}</option></select></label>
        <BaseButton :disabled="selectedStatus === selectedSerial.status" @click="saveStatus">Save status</BaseButton>
        <div class="history-section"><h3>History</h3><p v-if="detailLoading" class="history-loading">Loading activity…</p><ol v-else-if="history.length" class="history-list"><li v-for="event in history" :key="event.id"><span class="history-dot" /><div><strong>{{ formatStatus(event.event) }}</strong><small>{{ event.previous_status ? `${formatStatus(event.previous_status)} → ` : '' }}{{ formatStatus(event.new_status) }}</small><time>{{ formatDate(event.created_at) }}</time></div></li></ol><p v-else class="history-loading">No history recorded yet.</p></div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.serial-page{min-height:100vh;background:var(--bg);color:var(--text-strong);--serial-accent:#f5cd3a;--serial-surface:var(--surface);--serial-raised:var(--surface-sunken);--serial-border:var(--border-strong);--serial-muted:var(--text-muted);--serial-primary:var(--text-strong)}
.serial-content{width:min(100%,1440px);margin:0 auto;padding:28px clamp(16px,2.4vw,36px) 48px;display:grid;gap:20px}
.page-heading,.section-heading,.inventory-heading,.drawer-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}
.page-heading h1{margin:2px 0 0;font-size:24px;font-weight:600;line-height:1.2}.eyebrow,.section-kicker{display:block;margin:0;color:var(--serial-muted);font-size:12px;font-weight:500}.page-subtitle{margin:7px 0 0;color:var(--text-body);font-size:14px}
.scanner-bar{display:flex;align-items:center;gap:12px;min-height:58px;padding:8px 10px 8px 16px;border:1px solid var(--border);border-radius:12px;background:var(--serial-surface);box-shadow:0 8px 28px rgb(0 0 0 / .12)}.scanner-icon{width:20px;height:20px;color:var(--serial-muted)}.scanner-bar input{flex:1;min-width:0;height:40px;border:0;outline:0;background:transparent;color:var(--text-strong);font:400 15px inherit}.scanner-bar input::placeholder{color:var(--text-subtle)}.scanner-bar kbd{padding:3px 7px;border:1px solid var(--border);border-radius:5px;color:var(--text-muted);font:12px inherit}.scanner-bar :deep(.btn){min-height:40px}
.stats-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.stat-card{position:relative;display:grid;grid-template-columns:36px 1fr;grid-template-rows:auto auto auto;column-gap:12px;align-items:center;min-height:116px;padding:16px;text-align:left;background:var(--serial-surface);border:1px solid var(--border);border-radius:12px;color:var(--text-strong);cursor:pointer;transition:border-color .16s ease,background-color .16s ease,transform .16s ease}.stat-card:hover{background:var(--surface-alt);transform:translateY(-1px)}.stat-card.is-selected{border-color:var(--serial-accent);box-shadow:0 0 0 1px var(--serial-accent)}.stat-card__icon{grid-row:1 / 4;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--surface-hover);color:var(--text-muted)}.stat-card__icon :deep(svg){width:18px;height:18px}.stat-card--success .stat-card__icon{background:var(--success-bg);color:var(--success)}.stat-card--info .stat-card__icon{background:var(--info-bg);color:var(--info)}.stat-card--danger .stat-card__icon{background:var(--danger-bg);color:var(--danger)}.stat-card__label{color:var(--text-body);font-size:13px;font-weight:500}.stat-card strong{margin-top:2px;font-size:24px;font-weight:600;line-height:1.1}.stat-card__note{margin-top:2px;color:var(--serial-muted);font-size:12px}
.panel{min-width:0;border:1px solid var(--border);border-radius:12px;background:var(--serial-surface)}.receive-panel{padding:20px}.section-heading{margin-bottom:20px}.section-heading h2,.inventory-heading h2,.drawer-heading h2{margin:3px 0 0;font-size:16px;font-weight:600}.section-step{color:var(--text-subtle);font-size:12px;font-variant-numeric:tabular-nums}.receive-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(240px,.75fr);gap:24px}.receive-form{display:grid;gap:16px;min-width:0}.field-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px}.field{display:grid;gap:7px;min-width:0;color:var(--text-body);font-size:13px;font-weight:500}.field>span{display:flex;justify-content:space-between;gap:8px}.field i{color:var(--text-muted);font-size:11px;font-style:normal;font-weight:400}.field input,.field select,.field textarea,.filter-grid input,.filter-grid select,.bulk-bar select,.table-footer select{width:100%;min-width:0;height:38px;padding:0 11px;border:1px solid var(--border-strong);border-radius:8px;background:var(--serial-raised);color:var(--text-strong);font:400 13px inherit}.field textarea{height:auto;min-height:104px;padding:10px 11px;resize:vertical;line-height:1.5}.field input::placeholder,.field textarea::placeholder,.filter-grid input::placeholder{color:var(--text-subtle);opacity:1}.field input:focus,.field select:focus,.field textarea:focus,.filter-grid input:focus,.filter-grid select:focus,.bulk-bar select:focus,.table-footer select:focus{outline:2px solid var(--serial-accent);outline-offset:1px}.serial-field{gap:8px}.batch-status{display:grid;gap:10px}.batch-summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:var(--text-body);font-size:12px}.validation{display:inline-flex;align-items:center;gap:4px;color:var(--text-muted)}.validation svg{width:13px;height:13px}.validation--warning{color:#e3aa37}.validation--danger{color:var(--danger)}.validation--success{color:var(--success)}.serial-chips{display:flex;flex-wrap:wrap;gap:6px}.serial-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:3px 5px 3px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-alt)}.serial-chip code{overflow:hidden;color:var(--text-body);font:12px ui-monospace,SFMono-Regular,Consolas,monospace;text-overflow:ellipsis}.serial-chip--error,.serial-chip--exists{border-color:var(--danger-border);background:var(--danger-bg)}.serial-chip button,.toast>button:not(.undo-button){display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--text-muted);cursor:pointer}.serial-chip button:hover,.toast>button:hover{background:var(--surface-hover);color:var(--text-strong)}.serial-chip button svg,.toast svg{width:14px;height:14px}.field-error{color:var(--danger);font-size:12px}.form-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding-top:2px}.text-button{padding:8px 10px;border:0;border-radius:7px;background:transparent;color:var(--text-body);font:500 13px inherit;cursor:pointer}.text-button:hover{background:var(--surface-hover);color:var(--text-strong)}.text-button:disabled{opacity:.5;cursor:not-allowed}.form-actions :deep(.btn){min-height:40px}.batch-preview{align-self:stretch;padding:18px;border:1px solid var(--border);border-radius:10px;background:var(--serial-raised)}.preview-head{display:flex;align-items:center;gap:9px;color:var(--text-body);font-size:13px;font-weight:500}.preview-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--surface-hover);color:var(--text-secondary)}.preview-icon svg{width:16px;height:16px}.batch-preview>strong{display:block;margin-top:24px;font-size:36px;font-weight:600;line-height:1}.preview-caption{display:block;margin-top:5px;color:var(--text-muted);font-size:13px}.preview-divider{height:1px;margin:18px 0 14px;background:var(--border)}.batch-preview dl,.detail-grid{display:grid;gap:12px;margin:0}.batch-preview dl div,.detail-grid div{display:flex;justify-content:space-between;gap:12px}.batch-preview dt,.detail-grid dt{color:var(--text-muted);font-size:12px}.batch-preview dd,.detail-grid dd{max-width:60%;margin:0;color:var(--text-strong);font-size:12px;text-align:right;overflow-wrap:anywhere}.preview-note{margin:18px 0 0;color:var(--text-muted);font-size:11px;line-height:1.5}
.toast{display:flex;align-items:center;gap:10px;margin:0;padding:11px 14px;border-radius:9px;font-size:13px}.toast--error{background:var(--danger-bg);color:var(--danger)}.toast--success{background:var(--success-bg);color:var(--success)}.toast>svg{flex:none}.toast>button:last-child{margin-left:auto}.undo-button{padding:5px 9px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;font:600 12px inherit;cursor:pointer}
.inventory-panel{padding:20px}.inventory-heading{margin-bottom:18px}.inventory-heading h2{display:flex;align-items:center;gap:9px}.inventory-heading h2 span{padding:2px 7px;border-radius:999px;background:var(--surface-hover);color:var(--text-muted);font-size:11px;font-weight:500}.export-link{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:0;border-radius:7px;background:transparent;color:var(--text-body);font:500 13px inherit;cursor:pointer}.export-link:hover{background:var(--surface-hover)}.export-link svg{width:15px;height:15px}.filter-grid{display:grid;grid-template-columns:minmax(170px,1.35fr) repeat(3,minmax(130px,1fr)) minmax(145px, .8fr) minmax(145px,.8fr) auto;gap:8px;align-items:center}.filter-grid>select,.filter-grid>button{height:38px}.filter-grid :deep(.btn){height:38px;padding:0 14px}.search-filter{position:relative;display:flex;align-items:center}.search-filter>svg{position:absolute;left:10px;width:15px;height:15px;color:var(--text-muted);pointer-events:none}.search-filter input{padding-left:32px}.date-filter{display:flex;align-items:center;gap:5px;height:38px;padding:0 8px;border:1px solid var(--border-strong);border-radius:8px;background:var(--serial-raised);color:var(--text-muted);font-size:11px}.date-filter input{height:34px;padding:0;border:0;background:transparent;font-size:12px}.date-filter input:focus{outline:0}.active-filters{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:12px;color:var(--text-muted);font-size:12px}.filter-chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:3px 8px;border:1px solid var(--border);border-radius:999px;background:var(--surface-alt);color:var(--text-body);font:400 11px inherit;cursor:pointer}.filter-chip svg{width:12px;height:12px}.clear-filters{padding:4px 6px;font-size:12px}.bulk-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-alt)}.bulk-bar strong{margin-right:auto;font-size:12px}.bulk-bar select{width:auto;height:34px;font-size:12px}.bulk-bar>button{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--text-body);font:500 12px inherit;cursor:pointer}.bulk-bar>button:hover{background:var(--surface-hover)}.bulk-bar>button svg{width:14px;height:14px}.bulk-bar .bulk-clear{color:var(--text-muted)}
.table-wrap{width:100%;overflow-x:auto}.serial-table{width:100%;border-collapse:separate;border-spacing:0;text-align:left}.serial-table thead{position:sticky;top:0;z-index:1;background:var(--serial-surface)}.serial-table th{height:42px;padding:0 9px;border-bottom:1px solid var(--border);color:var(--text-muted);font-size:11px;font-weight:500;white-space:nowrap}.serial-table td{height:58px;padding:8px 9px;border-bottom:1px solid var(--border);color:var(--text-body);font-size:12px;white-space:nowrap}.serial-table tbody tr{cursor:pointer;transition:background .12s ease}.serial-table tbody tr:hover,.serial-table tbody tr.is-selected{background:var(--surface-alt)}.check-col{width:34px;padding-left:4px!important;padding-right:4px!important}.check-col input,.mobile-row>input{width:15px;height:15px;margin:0;accent-color:var(--serial-accent);cursor:pointer}.sort-button{display:inline-flex;align-items:center;gap:4px;padding:4px 0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}.sort-button svg{width:12px;height:12px}.serial-cell{display:flex;align-items:center;gap:6px}.serial-cell code,.mobile-row code{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--text-strong)}.serial-cell button{display:grid;place-items:center;width:25px;height:25px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--text-muted);cursor:pointer;opacity:0}.serial-table tr:hover .serial-cell button,.serial-cell button:focus-visible{opacity:1}.serial-cell button:hover{background:var(--surface-hover);color:var(--text-strong)}.serial-cell button svg{width:13px;height:13px}.product-cell{display:flex;align-items:center;gap:8px;max-width:210px;white-space:normal}.product-cell>span:last-child{overflow:hidden;text-overflow:ellipsis}.product-thumb{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:7px;background:var(--surface-hover);color:var(--text-body);font-size:12px;font-weight:600}.product-cell small,.serial-table td>small{display:block;margin-top:2px;color:var(--text-muted);font-size:11px}.status-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:var(--surface-hover);color:var(--text-body);font-size:11px;font-weight:500}.status-badge>span{width:6px;height:6px;border-radius:50%;background:currentColor}.status-badge--available{background:var(--success-bg);color:var(--success)}.status-badge--reserved{background:var(--info-bg);color:var(--info)}.status-badge--sold{background:var(--surface-hover);color:var(--text-body)}.status-badge--damaged,.status-badge--lost{background:var(--danger-bg);color:var(--danger)}.status-badge--returned,.status-badge--repaired{background:var(--success-bg);color:var(--success)}.warranty-warning{display:block;margin-top:3px;color:var(--danger);font-size:11px}.row-actions{width:36px}.row-actions details{position:relative}.row-actions summary{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;color:var(--text-muted);list-style:none;cursor:pointer}.row-actions summary::-webkit-details-marker{display:none}.row-actions summary:hover{background:var(--surface-hover);color:var(--text-strong)}.row-actions summary svg{width:15px;height:15px}.row-menu{position:absolute;right:0;z-index:4;display:grid;min-width:155px;padding:5px;border:1px solid var(--border);border-radius:8px;background:var(--serial-surface);box-shadow:var(--shadow-md)}.row-menu button{padding:8px 9px;border:0;border-radius:5px;background:transparent;color:var(--text-body);font:400 12px inherit;text-align:left;cursor:pointer}.row-menu button:hover{background:var(--surface-hover)}.row-menu button:disabled{opacity:.5;cursor:not-allowed}.mobile-rows{display:none}.table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;color:var(--text-muted);font-size:12px}.table-footer>label{display:flex;align-items:center;gap:7px}.table-footer select{width:70px;height:32px;padding:0 7px}.pagination{display:flex;align-items:center;gap:9px}.pagination button,.icon-button{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--border);border-radius:7px;background:var(--serial-surface);color:var(--text-body);cursor:pointer}.pagination button:hover,.icon-button:hover{background:var(--surface-hover)}.pagination button:disabled{opacity:.4;cursor:not-allowed}.pagination svg{width:15px;height:15px}
.empty-state{display:grid;justify-items:center;gap:9px;padding:52px 20px;text-align:center}.empty-icon{display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--border);border-radius:14px;background:var(--surface-alt);color:var(--text-muted)}.empty-icon svg{width:23px;height:23px}.empty-state h3{margin:7px 0 0;color:var(--text-strong);font-size:16px;font-weight:600}.empty-state p,.not-found p{max-width:420px;margin:0 0 8px;color:var(--text-muted);font-size:13px;line-height:1.5}.empty-state--compact{padding:38px 20px}.empty-state--compact .empty-icon{width:42px;height:42px}.skeleton-head,.skeleton-row{display:grid;grid-template-columns:24px 1.1fr 1.6fr .8fr 1fr 1fr 1fr;gap:20px;align-items:center;min-width:850px}.skeleton-head{height:42px;border-bottom:1px solid var(--border)}.skeleton-row{height:58px;border-bottom:1px solid var(--border)}.skeleton-head span,.skeleton-row span{height:12px;border-radius:4px;background:linear-gradient(90deg,var(--surface-hover),var(--surface-alt),var(--surface-hover));background-size:200% 100%;animation:skeleton 1.4s ease infinite}.skeleton-row span:first-child{width:16px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.drawer-backdrop{position:fixed;inset:0;z-index:40;display:flex;justify-content:flex-end;background:var(--backdrop)}.detail-drawer{display:grid;align-content:start;gap:20px;width:min(440px,100%);height:100%;padding:24px;overflow-y:auto;background:var(--serial-surface);border-left:1px solid var(--border);box-shadow:var(--shadow-md)}.drawer-heading{align-items:flex-start}.drawer-heading h2{font-size:18px;overflow-wrap:anywhere}.icon-button{flex:none}.icon-button svg{width:17px;height:17px}.drawer-product{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);border-radius:9px;background:var(--serial-raised)}.product-thumb--large{width:42px;height:42px;font-size:15px}.drawer-product div{display:grid;gap:4px}.drawer-product strong{font-size:13px}.drawer-product small{color:var(--text-muted);font-size:12px}.detail-grid{grid-template-columns:1fr 1fr;padding:16px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.detail-grid div{display:grid;gap:5px}.detail-grid dd{max-width:none;text-align:left;font-size:12px}.history-section h3{margin:0 0 14px;font-size:14px;font-weight:600}.history-list{display:grid;gap:0;margin:0;padding:0;list-style:none}.history-list li{position:relative;display:flex;gap:12px;min-height:54px}.history-list li:not(:last-child)::before{position:absolute;top:13px;bottom:-2px;left:5px;width:1px;background:var(--border);content:''}.history-dot{z-index:1;flex:none;width:11px;height:11px;margin-top:3px;border:2px solid var(--serial-accent);border-radius:50%;background:var(--serial-surface)}.history-list li div{display:grid;gap:4px}.history-list strong{font-size:12px}.history-list small,.history-list time,.history-loading{color:var(--text-muted);font-size:11px}.history-loading{margin:0}.not-found{display:grid;justify-items:center;gap:14px;padding:30px 10px;text-align:center}.not-found code{color:var(--text-strong);font:600 14px ui-monospace,SFMono-Regular,Consolas,monospace}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--serial-accent);outline-offset:2px}.stat-card:focus-visible{outline-offset:3px}
@keyframes skeleton{to{background-position:-200% 0}}
.stat-card.is-selected{border-color:var(--border-strong);background:var(--surface-alt);box-shadow:inset 0 0 0 1px var(--border-strong)}
@media(max-width:1150px){.stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.field-grid{grid-template-columns:1fr 1fr}.field--product{grid-column:span 2}.filter-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.search-filter{grid-column:span 2}}
@media(max-width:760px){.serial-content{padding-top:20px}.receive-layout{grid-template-columns:1fr}.batch-preview{display:none}.filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.search-filter{grid-column:span 2}.filter-grid :deep(.btn){grid-column:span 2}.serial-table{min-width:950px}.table-footer{flex-wrap:wrap}.table-footer>span{width:100%}.skeleton-head,.skeleton-row{min-width:850px}}
@media(max-width:560px){.serial-content{gap:14px;padding-inline:12px}.page-heading{align-items:flex-start}.page-heading :deep(.btn){padding:8px 10px;font-size:12px}.page-subtitle{max-width:250px}.scanner-bar{gap:8px;padding-left:11px}.scanner-bar input{font-size:13px}.scanner-bar kbd{display:none}.scanner-bar :deep(.btn){padding-inline:10px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.stat-card{min-height:98px;padding:11px;grid-template-columns:30px 1fr;column-gap:8px}.stat-card__icon{width:30px;height:30px}.stat-card strong{font-size:21px}.stat-card__note{font-size:11px}.receive-panel,.inventory-panel{padding:14px}.section-heading{margin-bottom:14px}.field-grid{grid-template-columns:1fr}.field--product{grid-column:auto}.filter-grid{grid-template-columns:1fr 1fr}.filter-grid>select{font-size:12px}.date-filter{gap:2px;padding-inline:5px}.date-filter span{font-size:10px}.active-filters{align-items:flex-start}.bulk-bar{align-items:stretch}.bulk-bar strong{width:100%}.bulk-bar select{max-width:100%;font-size:11px}.serial-table{display:none}.mobile-rows{display:grid}.mobile-row{display:flex;align-items:flex-start;gap:11px;padding:13px 2px;border-bottom:1px solid var(--border);cursor:pointer}.mobile-row>input{margin-top:4px}.mobile-row__main{display:grid;flex:1;gap:4px;min-width:0}.mobile-row__main>strong{font-size:13px}.mobile-row__main>span:not(.status-badge){color:var(--text-muted);font-size:11px}.mobile-row>svg{width:16px;height:16px;margin-top:3px;color:var(--text-muted)}.table-footer{gap:10px}.pagination{margin-left:auto}.table-footer>label{font-size:11px}.detail-drawer{padding:18px}.detail-grid{gap:14px 10px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style>
