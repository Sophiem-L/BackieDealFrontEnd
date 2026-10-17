<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettingsSection, saveSettingsSection, FALLBACK_SETTINGS } from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.taxes))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')

const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  try {
    const remote = await fetchSettingsSection('taxes', auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
  } catch (error) {
    console.warn('Tax settings failed to load from API.', error)
  }
})

async function save() {
  saving.value = true

  try {
    const remote = await saveSettingsSection('taxes', form, auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
    toast.value = 'Tax settings saved.'
  } catch (error) {
    toast.value = 'Unable to save tax settings right now.'
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
</script>

<template>
  <SettingsShell
    breadcrumb="Taxes"
    title="Taxes"
    description="Review tax rules and preview the final tax charge for customers."
    :dirty="dirty()"
    :saving="saving"
    @save="save"
    @discard="discard"
  >
    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Tax settings</p>
          <h2>Tax settings</h2>
        </div>
      </div>

      <div class="toggle-list">
        <label class="toggle-row">
          <span>
            <strong>Prices include tax</strong>
            <small>Display a tax-inclusive total across the storefront.</small>
          </span>
          <input v-model="form.pricesIncludeTax" type="checkbox" />
        </label>
        <label class="toggle-row">
          <span>
            <strong>Show tax at checkout</strong>
            <small>Display tax breakdown before customers complete payment.</small>
          </span>
          <input v-model="form.showTaxAtCheckout" type="checkbox" />
        </label>
      </div>

      <div class="field-grid">
        <label class="field"><span>Tax ID</span><input v-model="form.taxId" placeholder="VAT-2024-118" /></label>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Rates</p>
          <h2>Rates</h2>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Region</th><th>Name</th><th>Rate %</th><th>Applies to</th></tr>
          </thead>
          <tbody>
            <tr v-for="rate in form.rates" :key="rate.name">
              <td>{{ rate.region }}</td>
              <td>{{ rate.name }}</td>
              <td>{{ rate.rate }}%</td>
              <td>{{ rate.appliesTo }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="inline-button" type="button">Add tax rate</button>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Preview</p>
          <h2>Tax calculator</h2>
        </div>
      </div>

      <div class="preview-box">
        <div class="preview-box__line">
          <span>Price</span>
          <strong>$150.00</strong>
        </div>
        <div class="preview-box__line">
          <span>Region</span>
          <strong>Cambodia</strong>
        </div>
        <div class="preview-box__line preview-box__line--total">
          <span>Tax</span>
          <strong>$15.00</strong>
        </div>
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

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-hover);
  color: var(--text-strong);
}

.toggle-row span {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.toggle-row strong {
  font-size: 0.9rem;
}

.toggle-row small {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.toggle-row input {
  width: 38px;
  height: 22px;
  accent-color: rgb(var(--accent-rgb));
}

.field-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}

.field span {
  color: var(--text-body);
  font-size: 0.76rem;
  font-weight: 700;
}

.field input {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-hover);
  border-radius: 10px;
  color: var(--text-strong);
  padding: 0.7rem 0.8rem;
  font: inherit;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

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

.preview-box {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-hover);
}

.preview-box__line {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-body);
}

.preview-box__line--total {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-strong);
  font-weight: 700;
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
</style>
