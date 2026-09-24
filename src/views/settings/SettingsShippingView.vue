<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettingsSection, saveSettingsSection, FALLBACK_SETTINGS } from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.shipping))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')

const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  try {
    const remote = await fetchSettingsSection('shipping', auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
  } catch (error) {
    console.warn('Shipping settings failed to load from API.', error)
  }
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
</script>

<template>
  <SettingsShell
    breadcrumb="Shipping"
    title="Shipping"
    description="Manage delivery zones, rates, packaging, and storefront shipping options."
    :dirty="dirty()"
    :saving="saving"
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

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Regions</th><th>Methods</th><th>Rates</th></tr>
          </thead>
          <tbody>
            <tr v-for="zone in form.zones" :key="zone.name">
              <td>{{ zone.name }}</td>
              <td>{{ zone.regions }}</td>
              <td>{{ zone.methods }}</td>
              <td>{{ zone.rates }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="inline-button" type="button">Add zone</button>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Delivery options</p>
          <h2>Delivery options</h2>
        </div>
      </div>

      <div class="toggle-list">
        <div v-for="option in form.delivery" :key="option.id" class="toggle-row">
          <div>
            <strong>{{ option.name }}</strong>
            <small>{{ option.days }}</small>
          </div>
          <div class="toggle-row__meta">
            <span>{{ option.price }}</span>
            <label class="switch">
              <input v-model="option.enabled" type="checkbox" />
              <span />
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Origin & packaging</p>
          <h2>Origin & packaging</h2>
        </div>
      </div>

      <div class="field-grid">
        <label class="field field--wide"><span>Warehouse address</span><textarea v-model="form.warehouse" rows="3" /></label>
        <label class="field"><span>Default package weight</span><input v-model="form.packageWeight" type="number" step="0.1" /></label>
        <label class="field"><span>Free shipping threshold</span><input v-model="form.freeShippingThreshold" type="number" step="1" /></label>
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
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
