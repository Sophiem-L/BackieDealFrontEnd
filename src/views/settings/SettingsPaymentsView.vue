<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettingsSection, saveSettingsSection, FALLBACK_SETTINGS } from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.payments))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')

const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  try {
    const remote = await fetchSettingsSection('payments', auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
  } catch (error) {
    console.warn('Payment settings failed to load from API.', error)
  }
})

async function save() {
  saving.value = true

  try {
    const remote = await saveSettingsSection('payments', form, auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
    toast.value = 'Payment settings saved.'
  } catch (error) {
    toast.value = 'Unable to save payment settings right now.'
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
    breadcrumb="Payments"
    title="Payments"
    description="Configure payment providers, checkout rules, and transaction settings."
    :dirty="dirty()"
    :saving="saving"
    @save="save"
    @discard="discard"
  >
    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Providers</p>
          <h2>Available payment methods</h2>
        </div>
      </div>

      <div class="provider-grid">
        <div v-for="provider in form.providers" :key="provider.id" class="provider-card">
          <div class="provider-card__head">
            <span class="provider-card__logo">{{ provider.name.slice(0, 1) }}</span>
            <div>
              <strong>{{ provider.name }}</strong>
              <span :class="['status-pill', `status-pill--${provider.status.toLowerCase().replace(/\s+/g, '-')}`]">{{ provider.status }}</span>
            </div>
          </div>
          <div class="provider-card__meta">
            <label class="switch">
              <input v-model="provider.enabled" type="checkbox" />
              <span />
            </label>
            <span class="mode-badge">{{ provider.mode }}</span>
          </div>
          <button type="button">Configure</button>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Checkout rules</p>
          <h2>Checkout rules</h2>
        </div>
      </div>

      <div class="field-grid">
        <label class="field"><span>Minimum order amount</span><input v-model="form.minimumOrder" type="number" placeholder="15" /></label>
        <label class="field field--wide"><span>Payment instructions</span><textarea v-model="form.instructions" rows="3" placeholder="Please pay the total upon delivery..." /></label>
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

.provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.provider-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0.95rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-hover);
}

.provider-card__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.provider-card__logo {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
  font-weight: 800;
}

.provider-card__head div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.provider-card__head strong {
  color: var(--text-strong);
  font-size: 0.9rem;
}

.status-pill {
  display: inline-block;
  width: fit-content;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 700;
}

.status-pill--active { background: rgba(34,197,94,0.12); color: #86efac; }
.status-pill--inactive { background: rgba(148,163,184,0.12); color: #cbd5e1; }
.status-pill--needs-setup { background: rgba(234,179,8,0.12); color: #facc15; }

.provider-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.mode-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.provider-card button {
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  padding: 0.6rem 0.8rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
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
  transition: background 0.15s ease;
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
  .provider-grid,
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
