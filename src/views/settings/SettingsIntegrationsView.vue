<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettingsSection, saveSettingsSection, FALLBACK_SETTINGS } from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.integrations))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')
const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  try {
    const remote = await fetchSettingsSection('integrations', auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
  } catch (error) {
    console.warn('Integration settings failed to load from API.', error)
  }
})

async function save() {
  saving.value = true

  try {
    const remote = await saveSettingsSection('integrations', form, auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
    toast.value = 'Integrations saved.'
  } catch (error) {
    toast.value = 'Unable to save integration settings right now.'
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
    breadcrumb="Integrations"
    title="Integrations"
    description="Connect analytics, messaging, and webhook tools for your storefront workflow."
    :dirty="dirty()"
    :saving="saving"
    @save="save"
    @discard="discard"
  >
    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Connections</p>
          <h2>Connected tools</h2>
        </div>
      </div>

      <div class="card-grid">
        <div v-for="card in form.cards" :key="card.id" class="integration-card">
          <div class="integration-card__top">
            <span class="integration-card__icon">{{ card.name.charAt(0) }}</span>
            <span :class="['status-pill', card.status === 'Connected' ? 'status-pill--active' : card.status === 'Not connected' ? 'status-pill--inactive' : 'status-pill--needs']">{{ card.status }}</span>
          </div>
          <strong>{{ card.name }}</strong>
          <small>{{ card.description }}</small>
          <button type="button">{{ card.enabled ? 'Manage' : 'Connect' }}</button>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Webhooks</p>
          <h2>Webhooks</h2>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Endpoint</th><th>Events</th><th>Secret</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in form.webhooks" :key="item.endpoint">
              <td>{{ item.endpoint }}</td>
              <td>{{ item.events }}</td>
              <td>{{ item.secret }}</td>
              <td>{{ item.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="inline-button" type="button">Add webhook</button>
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

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.integration-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-height: 180px;
  padding: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-hover);
}

.integration-card__top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.integration-card__icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgb(var(--accent-rgb));
  color: var(--ink-on-accent);
  font-weight: 700;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
}

.status-pill--active { background: rgba(34,197,94,0.12); color: #86efac; }
.status-pill--inactive { background: rgba(148,163,184,0.12); color: #cbd5e1; }
.status-pill--needs { background: rgba(234,179,8,0.12); color: #facc15; }

.integration-card strong {
  color: var(--text-strong);
  font-size: 0.94rem;
}

.integration-card small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.5;
}

.integration-card button,
.inline-button {
  width: fit-content;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  padding: 0.55rem 0.8rem;
  font: inherit;
  cursor: pointer;
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
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
