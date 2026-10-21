<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Save, Trash2 } from '@lucide/vue'
import BaseButton from '@/components/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import {
  createShippingMethod,
  deleteShippingMethod,
  fetchSettingsSection,
  fetchShippingMethods,
  saveSettingsSection,
  updateShippingMethod,
  FALLBACK_SETTINGS,
} from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.shipping))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')
const loadError = ref('')
const methods = ref([])
const methodsLoading = ref(true)
const methodsError = ref('')
const savingMethodId = ref(null)
const methodErrors = ref({})
const createErrors = ref({})
const createError = ref('')
const showMethodForm = ref(false)
const showZoneForm = ref(false)
const newZone = reactive({ name: '', regions: '', methods: '', rates: '' })
const newMethod = reactive({
  name: '', code: '', description: '', base_price: 0, price_per_kg: null,
  min_weight: null, max_weight: null, min_delivery_days: null,
  max_delivery_days: null, is_active: true, type: 'courier', sort_order: 0,
})

const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  const [settingsResult, methodsResult] = await Promise.allSettled([
    fetchSettingsSection('shipping', auth.accessToken),
    fetchShippingMethods(auth.accessToken),
  ])
  if (settingsResult.status === 'fulfilled') {
    Object.assign(form, JSON.parse(JSON.stringify(settingsResult.value)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(settingsResult.value)))
  } else {
    loadError.value = settingsResult.reason?.message || 'Shipping settings could not be loaded from the API. Saving is disabled.'
  }
  if (methodsResult.status === 'fulfilled') methods.value = methodsResult.value
  else methodsError.value = methodsResult.reason?.message || 'Unable to load checkout shipping methods.'
  methodsLoading.value = false
})

async function save() {
  saving.value = true

  try {
    const remote = await saveSettingsSection('shipping', form, auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
    toast.value = 'Shipping settings saved.'
  } catch (error) {
    toast.value = 'Unable to save shipping settings right now.'
    console.error(error)
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 2200)
  }
}

function discard() {
  Object.assign(form, JSON.parse(JSON.stringify(initialState.value)))
  toast.value = 'Changes discarded.'
  setTimeout(() => (toast.value = ''), 1400)
}

function addZone() {
  if (!newZone.name.trim() || !newZone.regions.trim()) return
  form.zones.push({ ...newZone, name: newZone.name.trim(), regions: newZone.regions.trim() })
  Object.assign(newZone, { name: '', regions: '', methods: '', rates: '' })
  showZoneForm.value = false
}

function validationMessages(error) {
  return Object.fromEntries(Object.entries(error.errors || {}).map(([key, messages]) => [
    key,
    Array.isArray(messages) ? messages.join(' ') : String(messages),
  ]))
}

function clearMethodError(id, field) {
  const errors = { ...methodErrors.value }
  if (!errors[id]) return
  const rowErrors = { ...errors[id] }
  delete rowErrors[field]
  if (Object.keys(rowErrors).length) errors[id] = rowErrors
  else delete errors[id]
  methodErrors.value = errors
}

function clearCreateError(field) {
  const errors = { ...createErrors.value }
  delete errors[field]
  createErrors.value = errors
  createError.value = ''
}

function removeZone(index) {
  const zone = form.zones[index]
  if (!window.confirm(`Remove the ${zone.name || 'unnamed'} zone?`)) return
  form.zones.splice(index, 1)
}

async function saveMethod(method) {
  savingMethodId.value = method.id
  methodsError.value = ''
  const nextErrors = { ...methodErrors.value }
  delete nextErrors[method.id]
  methodErrors.value = nextErrors
  try {
    const saved = await updateShippingMethod(method.id, method, auth.accessToken)
    const index = methods.value.findIndex((item) => item.id === method.id)
    if (index >= 0) methods.value[index] = saved
    toast.value = 'Checkout shipping method saved.'
  } catch (error) {
    const errors = validationMessages(error)
    if (Object.keys(errors).length) methodErrors.value = { ...methodErrors.value, [method.id]: errors }
    else methodsError.value = error.message || 'Unable to save shipping method.'
  } finally {
    savingMethodId.value = null
    setTimeout(() => (toast.value = ''), 2500)
  }
}

async function addMethod() {
  const code = newMethod.code.trim() || newMethod.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  createErrors.value = {}
  createError.value = ''
  try {
    const created = await createShippingMethod({ ...newMethod, code }, auth.accessToken)
    methods.value.push(created)
    Object.assign(newMethod, {
      name: '', code: '', description: '', base_price: 0, price_per_kg: null,
      min_weight: null, max_weight: null, min_delivery_days: null,
      max_delivery_days: null, is_active: true, type: 'courier', sort_order: methods.value.length,
    })
    showMethodForm.value = false
    toast.value = 'Checkout shipping method added.'
  } catch (error) {
    const errors = validationMessages(error)
    if (Object.keys(errors).length) createErrors.value = errors
    else createError.value = error.message || 'Unable to add shipping method.'
  }
}

async function removeMethod(method) {
  if (!window.confirm(`Remove ${method.name} from checkout?`)) return
  try {
    await deleteShippingMethod(method.id, auth.accessToken)
    methods.value = methods.value.filter((item) => item.id !== method.id)
    toast.value = 'Shipping method removed from checkout.'
  } catch (error) {
    methodsError.value = error.message || 'Unable to remove shipping method.'
  }
}
</script>

<template>
  <SettingsShell
    breadcrumb="Shipping"
    title="Shipping"
    description="Manage delivery zones, rates, packaging, and storefront shipping options."
    :dirty="dirty()"
    :saving="saving"
    :load-error="loadError"
    page-class="settings-shipping"
    @save="save"
    @discard="discard"
  >
    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Zones & rates</p>
          <h2>Zones & rates</h2>
        </div>
      </div>

      <div class="table-wrap zones-wrap">
        <table class="zones-table">
          <colgroup><col class="zone-name-col" /><col class="zone-regions-col" /><col class="zone-methods-col" /><col class="zone-rates-col" /><col class="zone-actions-col" /></colgroup>
          <thead>
            <tr><th scope="col">Zone name</th><th scope="col">Regions</th><th scope="col">Methods</th><th scope="col">Rates</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="(zone, index) in form.zones" :key="`${zone.name}-${index}`" class="zone-row">
              <td data-label="Zone name"><input v-model="zone.name" aria-label="Zone name" placeholder="Name" /></td>
              <td data-label="Regions"><input v-model="zone.regions" aria-label="Zone regions" placeholder="Regions" /></td>
              <td data-label="Methods"><input v-model="zone.methods" aria-label="Zone delivery methods" placeholder="Methods" /></td>
              <td data-label="Rates"><input v-model="zone.rates" aria-label="Zone rates" placeholder="Rates" /></td>
              <td data-label="Actions" class="actions-cell"><BaseButton class="icon-action" variant="danger" size="sm" :title="`Remove ${zone.name} zone`" :aria-label="`Remove ${zone.name} zone`" @click="removeZone(index)"><template #icon><Trash2 /></template><span class="sr-only">Remove {{ zone.name }} zone</span></BaseButton></td>
            </tr>
            <tr v-if="showZoneForm" class="zone-row zone-row--new">
              <td data-label="Zone name"><input v-model="newZone.name" aria-label="New zone name" placeholder="Name" /></td>
              <td data-label="Regions"><input v-model="newZone.regions" aria-label="New zone regions" placeholder="Regions" /></td>
              <td data-label="Methods"><input v-model="newZone.methods" aria-label="New zone methods" placeholder="Methods" /></td>
              <td data-label="Rates"><input v-model="newZone.rates" aria-label="New zone rates" placeholder="Rates" /></td>
              <td data-label="Actions" class="actions-cell"><BaseButton variant="primary" size="sm" :disabled="!newZone.name.trim() || !newZone.regions.trim()" @click="addZone">Add zone</BaseButton></td>
            </tr>
            <tr v-if="!form.zones.length && !showZoneForm"><td colspan="5" class="empty-cell">No delivery zones configured.</td></tr>
          </tbody>
        </table>
      </div>

      <div class="section-actions">
        <BaseButton variant="ghost" @click="showZoneForm = !showZoneForm">{{ showZoneForm ? 'Cancel' : 'Add zone' }}</BaseButton>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Delivery options</p>
          <h2>Delivery options</h2>
        </div>
      </div>

      <p v-if="methodsError" class="settings-error" role="alert">{{ methodsError }}</p>
      <div v-if="methodsLoading" class="loading-state" role="status"><span class="spinner" />Loading checkout shipping methods…</div>
      <div v-else class="table-wrap methods-wrap">
        <table class="methods-table">
          <colgroup><col class="method-name-col" /><col class="method-rate-col" /><col class="method-kg-col" /><col class="method-days-col" /><col class="method-checkout-col" /><col class="method-actions-col" /></colgroup>
          <thead><tr><th scope="col">Delivery method</th><th scope="col">Base rate</th><th scope="col">Rate / kg</th><th scope="col">Delivery window</th><th scope="col">Checkout</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            <tr v-for="method in methods" :key="method.id" class="method-row">
              <td data-label="Delivery method">
                <div class="method-identity"><strong>{{ method.name }}</strong><code>{{ method.code }}</code><small v-if="method.description">{{ method.description }}</small></div>
                <p v-if="methodErrors[method.id]?.name || methodErrors[method.id]?.code" class="field-error">{{ methodErrors[method.id]?.name || methodErrors[method.id]?.code }}</p>
              </td>
              <td data-label="Base rate"><div class="control-stack"><input v-model.number="method.base_price" type="number" min="0" step="0.01" inputmode="decimal" :aria-label="`Base rate for ${method.name}`" :aria-invalid="Boolean(methodErrors[method.id]?.base_price)" @input="clearMethodError(method.id, 'base_price')" /><small v-if="methodErrors[method.id]?.base_price" class="field-error">{{ methodErrors[method.id].base_price }}</small></div></td>
              <td data-label="Rate / kg"><div class="control-stack"><input v-model.number="method.price_per_kg" type="number" min="0" step="0.01" inputmode="decimal" :aria-label="`Rate per kg for ${method.name}`" :aria-invalid="Boolean(methodErrors[method.id]?.price_per_kg)" @input="clearMethodError(method.id, 'price_per_kg')" /><small v-if="methodErrors[method.id]?.price_per_kg" class="field-error">{{ methodErrors[method.id].price_per_kg }}</small></div></td>
              <td data-label="Delivery window"><div class="delivery-window">
                <div class="day-input"><label :for="`min-days-${method.id}`">Min</label><input :id="`min-days-${method.id}`" v-model.number="method.min_delivery_days" type="number" min="0" step="1" inputmode="numeric" :aria-label="`Minimum delivery days for ${method.name}`" :aria-invalid="Boolean(methodErrors[method.id]?.min_delivery_days)" @input="clearMethodError(method.id, 'min_delivery_days')" /></div>
                <span class="day-separator" aria-hidden="true">to</span>
                <div class="day-input"><label :for="`max-days-${method.id}`">Max</label><input :id="`max-days-${method.id}`" v-model.number="method.max_delivery_days" type="number" min="0" step="1" inputmode="numeric" :aria-label="`Maximum delivery days for ${method.name}`" :aria-invalid="Boolean(methodErrors[method.id]?.max_delivery_days)" @input="clearMethodError(method.id, 'max_delivery_days')" /></div>
              </div><small v-if="methodErrors[method.id]?.min_delivery_days || methodErrors[method.id]?.max_delivery_days" class="field-error">{{ methodErrors[method.id]?.min_delivery_days || methodErrors[method.id]?.max_delivery_days }}</small></td>
              <td data-label="Checkout"><label class="checkout-toggle"><input v-model="method.is_active" type="checkbox" :aria-label="`Show ${method.name} at checkout`" /><span>{{ method.is_active ? 'Visible' : 'Hidden' }}</span></label></td>
              <td data-label="Actions" class="actions-cell"><div class="row-actions"><BaseButton class="icon-action" variant="primary" size="sm" :disabled="savingMethodId === method.id" :title="savingMethodId === method.id ? `Saving ${method.name}` : `Save ${method.name}`" :aria-label="savingMethodId === method.id ? `Saving ${method.name}` : `Save ${method.name}`" @click="saveMethod(method)"><template #icon><Save /></template><span class="sr-only">{{ savingMethodId === method.id ? 'Saving' : 'Save' }} {{ method.name }}</span></BaseButton><BaseButton class="icon-action" variant="danger" size="sm" :disabled="savingMethodId === method.id" :title="`Remove ${method.name}`" :aria-label="`Remove ${method.name}`" @click="removeMethod(method)"><template #icon><Trash2 /></template><span class="sr-only">Remove {{ method.name }}</span></BaseButton></div></td>
            </tr>
            <tr v-if="!methods.length"><td colspan="6" class="empty-cell">No checkout delivery methods configured yet.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="section-actions"><BaseButton variant="ghost" :disabled="methodsLoading" @click="showMethodForm = !showMethodForm">{{ showMethodForm ? 'Cancel' : 'Add delivery method' }}</BaseButton></div>
      <form v-if="showMethodForm" class="method-form" @submit.prevent="addMethod">
        <div class="form-field"><label for="new-method-name">Method name</label><input id="new-method-name" v-model="newMethod.name" required placeholder="Express delivery" :aria-invalid="Boolean(createErrors.name)" @input="clearCreateError('name')" /><small v-if="createErrors.name" class="field-error">{{ createErrors.name }}</small></div>
        <div class="form-field"><label for="new-method-code">Internal code <span>Optional</span></label><input id="new-method-code" v-model="newMethod.code" placeholder="Generated from name" :aria-invalid="Boolean(createErrors.code)" @input="clearCreateError('code')" /><small v-if="createErrors.code" class="field-error">{{ createErrors.code }}</small></div>
        <div class="form-field"><label for="new-method-base">Base rate</label><input id="new-method-base" v-model.number="newMethod.base_price" type="number" min="0" step="0.01" required inputmode="decimal" :aria-invalid="Boolean(createErrors.base_price)" @input="clearCreateError('base_price')" /><small v-if="createErrors.base_price" class="field-error">{{ createErrors.base_price }}</small></div>
        <div class="form-field"><label for="new-method-kg">Rate per kg</label><input id="new-method-kg" v-model.number="newMethod.price_per_kg" type="number" min="0" step="0.01" inputmode="decimal" :aria-invalid="Boolean(createErrors.price_per_kg)" @input="clearCreateError('price_per_kg')" /><small v-if="createErrors.price_per_kg" class="field-error">{{ createErrors.price_per_kg }}</small></div>
        <div class="form-field"><label for="new-method-min">Minimum days</label><input id="new-method-min" v-model.number="newMethod.min_delivery_days" type="number" min="0" step="1" inputmode="numeric" :aria-invalid="Boolean(createErrors.min_delivery_days)" @input="clearCreateError('min_delivery_days')" /><small v-if="createErrors.min_delivery_days" class="field-error">{{ createErrors.min_delivery_days }}</small></div>
        <div class="form-field"><label for="new-method-max">Maximum days</label><input id="new-method-max" v-model.number="newMethod.max_delivery_days" type="number" min="0" step="1" inputmode="numeric" :aria-invalid="Boolean(createErrors.max_delivery_days)" @input="clearCreateError('max_delivery_days')" /><small v-if="createErrors.max_delivery_days" class="field-error">{{ createErrors.max_delivery_days }}</small></div>
        <p v-if="createError" class="settings-error form-error" role="alert">{{ createError }}</p>
        <div class="method-form__actions"><BaseButton type="submit" variant="primary">Create method</BaseButton></div>
      </form>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Origin & packaging</p>
          <h2>Origin & packaging</h2>
        </div>
      </div>

      <div class="field-grid">
        <label class="field field--wide"><span>Warehouse address</span><textarea v-model="form.warehouse" rows="3" placeholder="Street, city, country" /></label>
        <label class="field"><span>Default package weight <small>kg</small></span><input v-model.number="form.packageWeight" type="number" min="0" step="0.1" inputmode="decimal" /></label>
        <label class="field"><span>Free shipping threshold <small>USD</small></span><input v-model.number="form.freeShippingThreshold" type="number" min="0" step="1" inputmode="decimal" /></label>
      </div>

      <div class="example-box">
        Orders over ${{ form.freeShippingThreshold }} ship free.
      </div>
    </section>

    <div v-if="toast" class="settings-toast" role="status">{{ toast }}</div>
  </SettingsShell>
</template>

<style scoped lang="scss">
.settings-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 1.15rem 1.2rem;
}

.settings-section__header {
  margin-bottom: 1rem;
}

.settings-section__eyebrow {
  margin: 0 0 0.2rem;
  color: var(--accent-ink);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-section__header h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.1rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

table input:not([type='checkbox']) {
  width: 100%;
  min-width: 70px;
  min-height: 36px;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-hover);
  color: var(--text-strong);
  font: inherit;
}

.delivery-days { white-space: nowrap; }
.delivery-days input { width: 64px!important; }
.method-form { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 0.8rem; margin-top: 1rem; }
.method-form :deep(.btn) { align-self: end; min-height: 40px; }
.settings-help { color: var(--text-muted); font-size: 0.82rem; }
.settings-error { color: var(--danger); font-size: 0.82rem; }
.table-action { margin-right: 0.3rem; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-body); padding: 0.4rem 0.6rem; font: inherit; cursor: pointer; }
.table-action--danger { color: var(--danger); }

th, td {
  padding: 0.75rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-body);
}

th {
  color: var(--text-muted);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.inline-button {
  margin-top: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  padding: 0.6rem 0.8rem;
  font: inherit;
  cursor: pointer;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-hover);
}

.toggle-row strong {
  color: var(--text-strong);
  display: block;
}

.toggle-row small {
  color: var(--text-muted);
  display: block;
  margin-top: 0.1rem;
}

.toggle-row__meta {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--text-body);
}

.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch span {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(148,163,184,0.35);
}

.switch span::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}

.switch input:checked + span {
  background: rgb(var(--accent-rgb));
}

.switch input:checked + span::after {
  transform: translateX(16px);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}

.field--wide {
  grid-column: 1 / -1;
}

.field span {
  color: var(--text-body);
  font-size: 0.76rem;
  font-weight: 700;
}

.field input,
.field textarea {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-hover);
  border-radius: 10px;
  color: var(--text-strong);
  padding: 0.7rem 0.8rem;
  font: inherit;
}

.field textarea {
  resize: vertical;
}

.example-box {
  margin-top: 1rem;
  padding: 0.7rem 0.8rem;
  background: rgba(var(--accent-rgb) / 0.08);
  border: 1px solid rgba(var(--accent-rgb) / 0.2);
  border-radius: 10px;
  color: var(--text-strong);
  font-size: 0.86rem;
}

.settings-shipping :deep(.settings-page__content) {
  width: min(100%, 1440px);
  padding-inline: clamp(1rem, 3vw, 2.5rem);
}

.settings-shipping :deep(.settings-page__layout) {
  grid-template-columns: minmax(190px, 220px) minmax(0, 1fr);
  gap: 1.25rem;
}

.settings-shipping :deep(.settings-page__body) { min-width: 0; gap: 1rem; }
.settings-shipping .settings-card { min-width: 0; padding: clamp(1rem, 1.7vw, 1.5rem); }
.settings-shipping .settings-section__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.1rem; }
.settings-shipping .settings-section__eyebrow { margin-bottom: 0.25rem; color: var(--accent-ink); }
.settings-shipping .settings-section__header h2 { font-size: 1.05rem; font-weight: 650; }

.settings-shipping .table-wrap { width: 100%; overflow: visible; }
.settings-shipping .zones-table,
.settings-shipping .methods-table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; }
.zones-table .zone-name-col { width: 18%; }
.zones-table .zone-regions-col { width: 28%; }
.zones-table .zone-methods-col { width: 23%; }
.zones-table .zone-rates-col { width: 19%; }
.zones-table .zone-actions-col { width: 12%; }
.methods-table .method-name-col { width: 23%; }
.methods-table .method-rate-col { width: 13%; }
.methods-table .method-kg-col { width: 13%; }
.methods-table .method-days-col { width: 22%; }
.methods-table .method-checkout-col { width: 12%; }
.methods-table .method-actions-col { width: 17%; }

.settings-shipping th,
.settings-shipping td { padding: 0.75rem 0.55rem; vertical-align: middle; }
.settings-shipping th { color: var(--text-muted); font-size: 0.68rem; font-weight: 650; letter-spacing: 0.045em; white-space: normal; }
.settings-shipping td { color: var(--text-body); font-size: 0.82rem; }
.settings-shipping tbody tr:last-child td { border-bottom: 0; }
.settings-shipping .zones-table input,
.settings-shipping .methods-table input:not([type='checkbox']),
.settings-shipping .method-form input,
.settings-shipping .field-grid input,
.settings-shipping .field-grid textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface-hover);
  color: var(--text-strong);
  font: inherit;
  font-size: 0.82rem;
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.settings-shipping input::placeholder,
.settings-shipping textarea::placeholder { color: var(--text-subtle); opacity: 1; }
.settings-shipping input:focus-visible,
.settings-shipping textarea:focus-visible,
.settings-shipping select:focus-visible,
.settings-shipping button:focus-visible { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
.settings-shipping input[aria-invalid='true'] { border-color: var(--danger); }
.settings-shipping input:disabled,
.settings-shipping button:disabled { opacity: 0.55; cursor: not-allowed; }
.settings-shipping input[type='checkbox'] { width: 18px; height: 18px; min-height: 18px; accent-color: rgb(var(--accent-rgb)); cursor: pointer; }
.settings-shipping .zones-table input:hover,
.settings-shipping .methods-table input:not([type='checkbox']):hover { border-color: var(--border-strong); background: var(--surface); }
.settings-shipping .zones-table .zone-row:hover,
.settings-shipping .methods-table .method-row:hover { background: var(--surface-hover); }
.settings-shipping .zones-table .zone-row--new { background: rgb(var(--accent-rgb) / 0.035); }
.settings-shipping .actions-cell { text-align: right; }
.settings-shipping .row-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.4rem; }
.settings-shipping .row-actions :deep(.btn),
.settings-shipping .actions-cell :deep(.btn) { min-height: 34px; white-space: nowrap; }
.settings-shipping .icon-action :deep(.btn) { width: 36px; min-width: 36px; height: 36px; min-height: 36px; padding: 0; border-radius: 8px; }
.settings-shipping .icon-action :deep(.btn__icon svg) { width: 16px; height: 16px; }
.settings-shipping .icon-action:focus-visible :deep(.btn) { outline: 2px solid rgb(var(--accent-rgb)); outline-offset: 2px; }
.settings-shipping .method-identity { display: grid; min-width: 0; gap: 0.2rem; }
.settings-shipping .method-identity strong { overflow-wrap: anywhere; color: var(--text-strong); font-size: 0.87rem; font-weight: 650; }
.settings-shipping .method-identity code { width: fit-content; max-width: 100%; overflow-wrap: anywhere; color: var(--text-muted); font-size: 0.69rem; }
.settings-shipping .method-identity small { color: var(--text-subtle); font-size: 0.72rem; line-height: 1.4; }
.settings-shipping .delivery-window { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: end; gap: 0.35rem; }
.settings-shipping .day-input { display: grid; min-width: 0; gap: 0.25rem; }
.settings-shipping .day-input label { color: var(--text-muted); font-size: 0.65rem; }
.settings-shipping .day-separator { padding-bottom: 0.6rem; color: var(--text-muted); font-size: 0.72rem; }
.settings-shipping .checkout-toggle { display: inline-flex; align-items: center; gap: 0.45rem; color: var(--text-body); font-size: 0.75rem; cursor: pointer; }
.settings-shipping .control-stack { display: grid; min-width: 0; gap: 0.25rem; }
.settings-shipping .field-error { display: block; color: var(--danger); font-size: 0.69rem; line-height: 1.35; }
.settings-shipping .empty-cell { padding: 1.5rem 1rem; color: var(--text-muted); text-align: center; }
.settings-shipping .section-actions { display: flex; justify-content: flex-end; margin-top: 0.9rem; }
.settings-shipping .section-actions :deep(.btn) { min-height: 38px; }
.settings-shipping .method-form { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; margin-top: 1rem; padding: 1rem; border: 1px solid var(--border-subtle); border-radius: 10px; background: var(--surface-hover); }
.settings-shipping .form-field { display: grid; min-width: 0; gap: 0.35rem; }
.settings-shipping .form-field > label { color: var(--text-body); font-size: 0.75rem; font-weight: 600; }
.settings-shipping .form-field > label span { color: var(--text-muted); font-size: 0.68rem; font-weight: 400; }
.settings-shipping .method-form__actions { display: flex; align-items: end; }
.settings-shipping .method-form__actions :deep(.btn) { min-height: 40px; }
.settings-shipping .form-error { grid-column: 1 / -1; margin: 0; }
.settings-shipping .loading-state { display: flex; align-items: center; gap: 0.6rem; padding: 1.1rem; color: var(--text-muted); font-size: 0.82rem; }
.settings-shipping .spinner { width: 15px; height: 15px; border: 2px solid var(--border-strong); border-top-color: rgb(var(--accent-rgb)); border-radius: 50%; animation: shipping-spin 700ms linear infinite; }
.settings-shipping .settings-error { margin: 0 0 0.75rem; padding: 0.7rem 0.8rem; border: 1px solid var(--danger-border); border-radius: 8px; background: var(--danger-bg); color: var(--danger); font-size: 0.78rem; }
.settings-shipping .example-box { background: rgb(var(--accent-rgb) / 0.06); border-color: var(--border); }
.settings-shipping .settings-toast { z-index: 30; }
.settings-shipping .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@keyframes shipping-spin { to { transform: rotate(360deg); } }

@media (max-width: 1120px) {
  .settings-shipping .methods-table .method-name-col { width: 22%; }
  .settings-shipping .methods-table .method-days-col { width: 20%; }
  .settings-shipping .methods-table .method-checkout-col { width: 12%; }
  .settings-shipping .methods-table .method-actions-col { width: 19%; }
  .settings-shipping .methods-table th,
  .settings-shipping .methods-table td { padding-inline: 0.35rem; }
}

@media (max-width: 980px) {
  .settings-shipping :deep(.settings-page__layout) { grid-template-columns: minmax(0, 1fr); }
  .settings-shipping :deep(.settings-nav) { position: static; }
  .settings-shipping .methods-table colgroup,
  .settings-shipping .zones-table colgroup,
  .settings-shipping .methods-table thead,
  .settings-shipping .zones-table thead { display: none; }
  .settings-shipping .methods-table,
  .settings-shipping .methods-table tbody,
  .settings-shipping .zones-table,
  .settings-shipping .zones-table tbody { display: grid; gap: 0.75rem; }
  .settings-shipping .methods-table tr,
  .settings-shipping .zones-table tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem 0.9rem; padding: 1rem; border: 1px solid var(--border-subtle); border-radius: 10px; background: var(--surface-hover); }
  .settings-shipping .methods-table td,
  .settings-shipping .zones-table td { display: grid; grid-template-columns: minmax(90px, 0.55fr) minmax(0, 1fr); align-items: center; gap: 0.65rem; min-width: 0; padding: 0; border: 0; }
  .settings-shipping .methods-table td::before,
  .settings-shipping .zones-table td::before { content: attr(data-label); color: var(--text-muted); font-size: 0.68rem; font-weight: 600; }
  .settings-shipping .methods-table .actions-cell,
  .settings-shipping .zones-table .actions-cell { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
  .settings-shipping .methods-table .actions-cell::before,
  .settings-shipping .zones-table .actions-cell::before { content: none; }
  .settings-shipping .methods-table .method-identity { grid-column: 1 / -1; }
  .settings-shipping .methods-table td:first-child { grid-column: 1 / -1; display: block; }
  .settings-shipping .methods-table td:first-child::before { display: block; margin-bottom: 0.45rem; }
  .settings-shipping .delivery-window { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .settings-shipping .empty-cell { display: block!important; grid-column: 1 / -1; text-align: center; }
  .settings-shipping .empty-cell::before { content: none!important; }
  .settings-shipping .method-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .settings-shipping :deep(.settings-page__content) { padding: 1rem 0.75rem 2rem; }
  .settings-shipping :deep(.settings-nav) { gap: 0.2rem; padding: 0.5rem; }
  .settings-shipping :deep(.settings-nav__link) { flex: 0 0 auto; padding: 0.55rem 0.65rem; font-size: 0.78rem; }
  .settings-shipping .settings-card { padding: 0.9rem; }
  .settings-shipping .zones-table tr,
  .settings-shipping .methods-table tr { grid-template-columns: minmax(0, 1fr); gap: 0.7rem; padding: 0.8rem; }
  .settings-shipping .zones-table td,
  .settings-shipping .methods-table td { grid-template-columns: minmax(82px, 0.42fr) minmax(0, 1fr); }
  .settings-shipping .methods-table td:first-child { grid-column: auto; }
  .settings-shipping .methods-table td:first-child::before { margin-bottom: 0.35rem; }
  .settings-shipping .method-form { grid-template-columns: minmax(0, 1fr); padding: 0.8rem; }
  .settings-shipping .form-error { grid-column: auto; }
  .settings-shipping .section-actions { justify-content: stretch; }
  .settings-shipping .section-actions :deep(.btn) { width: 100%; }
  .settings-shipping .row-actions { justify-content: flex-start; }
  .settings-shipping .field-grid { grid-template-columns: minmax(0, 1fr); }
  .settings-shipping .field--wide { grid-column: auto; }
}

.settings-toast {
  position: fixed;
  right: 1.2rem;
  bottom: 1.2rem;
  background: rgba(27, 31, 37, 0.95);
  color: var(--text-strong);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 0.75rem 0.9rem;
  box-shadow: 0 12px 28px rgba(0,0,0,0.24);
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .field-grid,
  .method-form {
    grid-template-columns: 1fr;
  }
}
</style>
