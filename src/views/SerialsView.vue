<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { fetchSerial, fetchSerialHistory, fetchSerials, fetchSerialSummary, lookupSerial, receiveSerials, updateSerial } from '@/services/serials'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const rows = ref([])
const pagination = ref({})
const query = ref('')
const status = ref('')
const productId = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const lookup = ref('')
const lookupResult = ref(null)
const products = ref([])
const summary = ref({ by_status: {}, total: 0, available: 0 })
const history = ref([])
const selectedSerial = ref(null)
const detailLoading = ref(false)
const selectedStatus = ref('')
const form = ref({ product_id: '', serial_numbers: '', receiving_reference: '' })

const statusOptions = ['available', 'reserved', 'sold', 'returned', 'in_service', 'repaired', 'replaced', 'damaged', 'lost', 'cancelled']
const page = computed(() => pagination.value.current_page || 1)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchSerials({ q: query.value, status: status.value, product_id: productId.value, page: page.value, per_page: 20 }, auth.accessToken)
    rows.value = data.items || []
    pagination.value = data.pagination || {}
  } catch (err) {
    error.value = err.message || 'Unable to load serial numbers.'
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  try { summary.value = await fetchSerialSummary(auth.accessToken) } catch { summary.value = { by_status: {}, total: 0, available: 0 } }
}

async function loadProducts() {
  const response = await apiFetch('/admin/products?per_page=200', { token: auth.accessToken })
  products.value = response?.data?.items || response?.data || []
}

async function receive() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const serialNumbers = form.value.serial_numbers.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean)
    const duplicates = serialNumbers.filter((value, index) => serialNumbers.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) !== index)
    if (duplicates.length) throw new Error(`Duplicate serial numbers: ${[...new Set(duplicates)].join(', ')}`)
    await receiveSerials({
      ...form.value,
      serial_numbers: serialNumbers,
    }, auth.accessToken)
    form.value.serial_numbers = ''
    notice.value = 'Serial numbers received.'
    await Promise.all([load(), loadSummary()])
  } catch (err) {
    error.value = err.message || 'Unable to receive serial numbers.'
  } finally {
    saving.value = false
  }
}

async function showDetails(row) {
  selectedSerial.value = row
  selectedStatus.value = row.status
  detailLoading.value = true
  try { history.value = await fetchSerialHistory(row.id, auth.accessToken) } catch (err) { error.value = err.message || 'Unable to load serial history.' } finally { detailLoading.value = false }
}

async function saveStatus() {
  if (!selectedSerial.value || selectedStatus.value === selectedSerial.value.status) return
  try {
    selectedSerial.value = await updateSerial(selectedSerial.value.id, { status: selectedStatus.value }, auth.accessToken)
    history.value = await fetchSerialHistory(selectedSerial.value.id, auth.accessToken)
    await Promise.all([load(), loadSummary()])
    notice.value = 'Serial status updated.'
  } catch (err) { error.value = err.message || 'Unable to update serial status.' }
}

async function scanLookup() {
  if (!lookup.value.trim()) return
  try {
    lookupResult.value = await lookupSerial(lookup.value.trim(), auth.accessToken)
    error.value = ''
  } catch (err) {
    lookupResult.value = null
    error.value = err.message || 'Serial number not found.'
  }
}

onMounted(() => Promise.all([load(), loadProducts(), loadSummary()]))
</script>

<template>
  <div class="page">
    <AppHeader title="Serial Numbers" />
    <div class="page__body">
      <section class="summary-grid" aria-label="Serial inventory summary">
        <div class="summary-card"><span>Total units</span><strong>{{ summary.total }}</strong></div>
        <div class="summary-card summary-card--accent"><span>Available</span><strong>{{ summary.available }}</strong></div>
        <div class="summary-card"><span>Reserved</span><strong>{{ summary.by_status?.reserved || 0 }}</strong></div>
        <div class="summary-card"><span>Sold</span><strong>{{ summary.by_status?.sold || 0 }}</strong></div>
        <div class="summary-card summary-card--danger"><span>Damaged</span><strong>{{ summary.by_status?.damaged || 0 }}</strong></div>
      </section>
      <section class="card">
        <h2 class="card__title">Receive Serialized Stock</h2>
        <form class="form-grid" @submit.prevent="receive">
          <label>Product<select v-model="form.product_id" required><option value="">Select product</option><option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }} · {{ product.sku }}</option></select></label>
          <label>Receiving reference<input v-model="form.receiving_reference" placeholder="PO-1001" /></label>
          <label class="form-grid__wide">Serial numbers<textarea v-model="form.serial_numbers" rows="3" placeholder="One serial per line or comma separated" required /></label>
          <BaseButton type="submit" :disabled="saving">{{ saving ? 'Receiving…' : 'Receive serials' }}</BaseButton>
        </form>
      </section>

      <section class="card">
        <h2 class="card__title">Scanner Lookup</h2>
        <form class="lookup" @submit.prevent="scanLookup"><input v-model="lookup" autofocus placeholder="Scan or enter serial number" /><BaseButton type="submit">Lookup</BaseButton></form>
        <div v-if="lookupResult" class="lookup-result"><strong>{{ lookupResult.serial_number }}</strong><span>{{ lookupResult.product?.name }} · {{ lookupResult.status }}</span><span v-if="lookupResult.customer">Customer: {{ lookupResult.customer.name || lookupResult.customer.email }}</span></div>
      </section>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <section class="table-card">
        <div class="table-card__head"><h2 class="table-card__title">Inventory Serials</h2><div class="filters"><input v-model="query" aria-label="Search serials" placeholder="Search serial, product, SKU" @keyup.enter="load" /><select v-model="productId" aria-label="Filter product"><option value="">All products</option><option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }}</option></select><select v-model="status" aria-label="Filter status" @change="load"><option value="">All statuses</option><option v-for="value in statusOptions" :key="value" :value="value">{{ value }}</option></select><BaseButton variant="ghost" @click="load">Search</BaseButton></div></div>
        <p v-if="loading" class="table__empty">Loading serials…</p>
        <table v-else class="table"><thead><tr><th>Serial</th><th>Product</th><th>Status</th><th>Warehouse</th><th>Customer</th><th>Warranty</th><th></th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td><strong>{{ row.serial_number }}</strong></td><td>{{ row.product?.name || '—' }}<small>{{ row.product?.sku }}</small></td><td><span class="badge" :class="`badge--${row.status}`">{{ row.status }}</span></td><td>{{ row.warehouse || '—' }}</td><td>{{ row.customer?.name || row.customer?.email || '—' }}</td><td>{{ row.warranty_status || '—' }}<small>{{ row.warranty_end_at || '' }}</small></td><td><button type="button" class="details-button" @click="showDetails(row)">Details</button></td></tr><tr v-if="rows.length === 0"><td colspan="7" class="table__empty">No serialized products found.</td></tr></tbody></table>
      </section>

      <aside v-if="selectedSerial" class="details-panel" aria-label="Serial details">
        <div class="details-panel__head"><div><span class="eyebrow">Serial detail</span><h2>{{ selectedSerial.serial_number }}</h2></div><button type="button" class="close-button" aria-label="Close details" @click="selectedSerial = null">×</button></div>
        <p class="details-panel__product">{{ selectedSerial.product?.name }}<span v-if="selectedSerial.variant"> · {{ selectedSerial.variant.name }}</span></p>
        <label class="detail-field">Status<select v-model="selectedStatus"><option v-for="value in statusOptions" :key="value" :value="value">{{ value }}</option></select></label>
        <BaseButton :disabled="selectedStatus === selectedSerial.status" @click="saveStatus">Save status</BaseButton>
        <h3>History</h3><p v-if="detailLoading" class="table__empty">Loading history…</p><ul v-else class="history-list"><li v-for="event in history" :key="event.id"><strong>{{ event.event }}</strong><span>{{ event.previous_status || '—' }} → {{ event.new_status || '—' }}</span><small>{{ event.created_at }}</small></li><li v-if="!history.length" class="table__empty">No history yet.</li></ul>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; }
.page__body { width: min(100%, 1280px); margin: 0 auto; padding: 1.5rem 1.25rem 2rem; display: grid; gap: 1rem; }
.card, .table-card, .details-panel { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.25rem; }
.card__title, .table-card__title { margin: 0 0 1rem; color: var(--text-strong); font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.form-grid label, .detail-field { display: flex; flex-direction: column; gap: .4rem; color: var(--text-muted); font-size: 12px; }
.form-grid input, .form-grid select, .form-grid textarea, .lookup input, .filters input, .filters select, .detail-field select { min-height: 38px; padding: .65rem .75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-sunken); color: var(--text-strong); font: inherit; }
.form-grid textarea { min-height: 92px; resize: vertical; }
.form-grid__wide { grid-column: span 2; }
.lookup, .filters { display: flex; gap: .6rem; align-items: center; }
.lookup input { flex: 1; }
.lookup-result { display: flex; gap: 1rem; margin-top: 1rem; padding: .8rem; background: var(--surface-sunken); border: 1px solid var(--border-subtle); border-radius: 8px; }
.summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: .75rem; }
.summary-card { display: grid; gap: .35rem; padding: .9rem 1rem; background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 10px; }
.summary-card span, .eyebrow { color: var(--text-muted); font-size: 12px; }
.summary-card strong { color: var(--text-strong); font-size: 1.35rem; }
.summary-card--accent { border-color: rgb(var(--accent-rgb) / .45); }.summary-card--danger { border-color: var(--danger-border); }
.table-card { min-width: 0; overflow: auto; }.table-card__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }.table-card__title { margin: 0; }
.table { width: 100%; border-collapse: collapse; min-width: 760px; }.table th, .table td { padding: .75rem .6rem; border-bottom: 1px solid var(--border-subtle); text-align: left; font-size: 13px; }.table th { color: var(--text-muted); font-size: 12px; font-weight: 600; }.table td { color: var(--text-body); }.table small { display: block; color: var(--text-muted); font-size: 12px; }
.badge { display: inline-flex; padding: .25rem .5rem; border-radius: 999px; background: var(--surface-hover); color: var(--text-body); font-size: 12px; font-weight: 600; }.badge--available { color: var(--success); background: var(--success-bg); }.badge--sold, .badge--damaged { color: var(--danger); background: var(--danger-bg); }.badge--reserved { color: var(--accent-ink); background: rgb(var(--accent-rgb) / .16); }
.details-button, .close-button { border: 0; background: transparent; color: var(--accent-ink); cursor: pointer; }.details-button:hover { text-decoration: underline; }.details-panel { display: grid; gap: .85rem; }.details-panel__head { display: flex; align-items: flex-start; justify-content: space-between; }.details-panel h2 { margin: .2rem 0 0; color: var(--text-strong); font-size: 1.1rem; }.details-panel h3 { margin: .5rem 0 0; color: var(--text-strong); font-size: 13px; }.close-button { color: var(--text-muted); font-size: 1.5rem; line-height: 1; }.details-panel__product { margin: 0; color: var(--text-body); font-size: 13px; }.history-list { display: grid; gap: .55rem; margin: 0; padding: 0; list-style: none; }.history-list li { display: grid; gap: .2rem; padding: .7rem; background: var(--surface-sunken); border-radius: 8px; }.history-list span, .history-list small { color: var(--text-muted); font-size: 12px; }.table__empty { padding: 1.5rem; color: var(--text-muted); text-align: center; }.notice { margin: 0; padding: .75rem 1rem; color: var(--success); background: var(--success-bg); border-radius: 8px; }.notice--error { color: var(--danger); background: var(--danger-bg); }
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(3, 1fr); }.form-grid { grid-template-columns: 1fr; }.form-grid__wide { grid-column: auto; }.table-card__head { align-items: stretch; flex-direction: column; }.filters { flex-wrap: wrap; }.filters input { flex: 1 1 180px; } }
@media (max-width: 560px) { .summary-grid { grid-template-columns: repeat(2, 1fr); }.lookup-result { align-items: flex-start; flex-direction: column; }.page__body { padding-inline: .75rem; }.card, .table-card, .details-panel { padding: 1rem; } }
</style>
