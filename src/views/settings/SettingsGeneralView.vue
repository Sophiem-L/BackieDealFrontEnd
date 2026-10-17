<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettingsSection, saveSettingsSection, FALLBACK_SETTINGS } from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.general))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')

const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  try {
    const remote = await fetchSettingsSection('general', auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
  } catch (error) {
    console.warn('General settings failed to load from API.', error)
  }
})

async function save() {
  saving.value = true

  try {
    const remote = await saveSettingsSection('general', form, auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
    toast.value = 'General settings saved successfully.'
  } catch (error) {
    toast.value = 'Unable to save general settings right now.'
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
    breadcrumb="General"
    title="General"
    description="Manage your store profile, address, and branding details."
    :dirty="dirty()"
    :saving="saving"
    @save="save"
    @discard="discard"
  >
    <section class="settings-card">
      <div class="settings-section">
        <div class="settings-section__header">
          <div>
            <p class="settings-section__eyebrow">Store profile</p>
            <h2>Store profile</h2>
          </div>
        </div>

        <div class="field-grid">
          <label class="field"><span>Name</span><input v-model="form.storeName" placeholder="Beckie Deal Webstore" /></label>
          <label class="field"><span>Store URL</span><input v-model="form.storeUrl" placeholder="beckiedeal.com" /></label>
          <label class="field"><span>Contact email</span><input v-model="form.contactEmail" type="email" placeholder="orders@yourstore.com" /></label>
          <label class="field"><span>Phone</span><input v-model="form.phone" placeholder="+855 12 345 678" /></label>
          <label class="field"><span>Timezone</span><select v-model="form.timezone"><option value="Asia/Phnom_Penh">Asia/Phnom_Penh</option><option value="UTC">UTC</option><option value="America/Los_Angeles">America/Los_Angeles</option></select></label>
          <label class="field"><span>Currency</span><select v-model="form.currency"><option value="USD">USD</option><option value="KHR">KHR</option><option value="THB">THB</option></select></label>
          <label class="field"><span>Language</span><select v-model="form.language"><option value="English">English</option><option value="Khmer">Khmer</option></select></label>
          <label class="field"><span>Weight unit</span><select v-model="form.weightUnit"><option value="kg">kg</option><option value="lb">lb</option></select></label>
          <label class="field"><span>Length unit</span><select v-model="form.lengthUnit"><option value="cm">cm</option><option value="in">in</option></select></label>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section">
        <div class="settings-section__header">
          <div>
            <p class="settings-section__eyebrow">Address</p>
            <h2>Address</h2>
          </div>
        </div>

        <div class="field-grid">
          <label class="field field--wide"><span>Business address</span><textarea v-model="form.businessAddress" rows="3" placeholder="Street, city, country" /></label>
          <label class="field"><span>Country</span><input v-model="form.country" placeholder="Cambodia" /></label>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-section">
        <div class="settings-section__header">
          <div>
            <p class="settings-section__eyebrow">Branding</p>
            <h2>Branding</h2>
          </div>
        </div>

        <div class="upload-grid">
          <div class="upload-box">
            <div class="upload-box__preview dark"><span>Logo</span></div>
            <div class="upload-box__details">
              <strong>Store logo</strong>
              <small>PNG, JPG, WebP up to 2MB</small>
              <button type="button">Upload logo</button>
            </div>
          </div>
          <div class="upload-box">
            <div class="upload-box__preview light"><span>Favicon</span></div>
            <div class="upload-box__details">
              <strong>Favicon</strong>
              <small>ICO or PNG up to 2MB</small>
              <button type="button">Upload favicon</button>
            </div>
          </div>
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
.field select,
.field textarea {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-hover);
  border-radius: 10px;
  color: var(--text-strong);
  padding: 0.7rem 0.8rem;
  font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field textarea {
  resize: vertical;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: rgb(var(--accent-rgb));
  box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 0.18);
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.upload-box {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--surface-hover);
}

.upload-box__preview {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid rgba(255,255,255,0.1);
}

.upload-box__preview.dark {
  background: #1b1d22;
  color: #f5f4ef;
}

.upload-box__preview.light {
  background: #f6f2e7;
  color: #1f1f1f;
}

.upload-box__details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.upload-box__details strong {
  color: var(--text-strong);
  font-size: 0.86rem;
}

.upload-box__details small {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.upload-box__details button {
  width: fit-content;
  margin-top: 0.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  padding: 0.45rem 0.7rem;
  font: inherit;
  cursor: pointer;
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
  .upload-grid {
    grid-template-columns: 1fr;
  }
}
</style>
