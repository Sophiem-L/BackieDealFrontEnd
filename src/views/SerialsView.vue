<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { fetchSerials, lookupSerial, receiveSerials } from '@/services/serials'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const rows = ref([])
const pagination = ref({})
const query = ref('')
const status = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const lookup = ref('')
const lookupResult = ref(null)
const products = ref([])
const form = ref({ product_id: '', serial_numbers: '', warehouse: '', receiving_reference: '' })

const statusOptions = ['available', 'reserved', 'sold', 'returned', 'in_service', 'repaired', 'damaged', 'lost']
const page = computed(() => pagination.value.current_page || 1)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchSerials({ q: query.value, status: status.value, page: page.value, per_page: 20 }, auth.accessToken)
    rows.value = data.items || []
    pagination.value = data.pagination || {}
  } catch (err) {
    error.value = err.message || 'Unable to load serial numbers.'
  } finally {
    loading.value = false
  }
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
    await receiveSerials({
      ...form.value,
      serial_numbers: form.value.serial_numbers.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
    }, auth.accessToken)
    form.value.serial_numbers = ''
    notice.value = 'Serial numbers received.'
    await load()
  } catch (err) {
    error.value = err.message || 'Unable to receive serial numbers.'
  } finally {
    saving.value = false
  }
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

onMounted(() => Promise.all([load(), loadProducts()]))
</script>

<template>
  <div class="page">
    <AppHeader title="Serial Numbers" />
    <div class="page__body">
      <section class="card">
        <h2 class="card__title">Receive Serialized Stock</h2>
        <form class="form-grid" @submit.prevent="receive">
          <label>Product<select v-model="form.product_id" required><option value="">Select product</option><option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }} · {{ product.sku }}</option></select></label>
          <label>Warehouse<input v-model="form.warehouse" placeholder="Main warehouse" /></label>
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
        <div class="table-card__head"><h2 class="table-card__title">Inventory Serials</h2><div class="filters"><input v-model="query" placeholder="Search serial, product, SKU" @keyup.enter="load" /><select v-model="status" @change="load"><option value="">All statuses</option><option v-for="value in statusOptions" :key="value" :value="value">{{ value }}</option></select><BaseButton variant="ghost" @click="load">Search</BaseButton></div></div>
        <p v-if="loading" class="table__empty">Loading serials…</p>
        <table v-else class="table"><thead><tr><th>Serial</th><th>Product</th><th>Status</th><th>Warehouse</th><th>Customer</th><th>Warranty</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td><strong>{{ row.serial_number }}</strong></td><td>{{ row.product?.name || '—' }}<small>{{ row.product?.sku }}</small></td><td><span class="badge">{{ row.status }}</span></td><td>{{ row.warehouse || '—' }}</td><td>{{ row.customer?.name || row.customer?.email || '—' }}</td><td>{{ row.warranty_status || '—' }}<small>{{ row.warranty_end_at || '' }}</small></td></tr><tr v-if="rows.length === 0"><td colspan="6" class="table__empty">No serialized products found.</td></tr></tbody></table>
      </section>
    </div>
  </div>
</template>

<style scoped>
.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.form-grid label { display: flex; flex-direction: column; gap: .35rem; color: var(--text-muted); font-size: .8rem; }
.form-grid input, .form-grid select, .form-grid textarea, .lookup input, .filters input, .filters select { padding: .65rem; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface); color: var(--text-strong); }
.form-grid__wide { grid-column: span 2; }
.lookup, .filters { display: flex; gap: .6rem; align-items: center; }
.lookup input { flex: 1; }
.lookup-result { display: flex; gap: 1rem; margin-top: 1rem; padding: .8rem; background: var(--surface-hover); border-radius: 8px; }
small { display: block; color: var(--text-muted); }
@media (max-width: 800px) { .form-grid { grid-template-columns: 1fr; } .form-grid__wide { grid-column: auto; } .filters { flex-wrap: wrap; } }
</style>
