<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, ChevronRight, ImagePlus, Save, Settings2 } from '@lucide/vue'
import AppHeader from '@/components/AppHeader.vue'
import { checkPaywayConnection, fetchStoreSettings, updateStoreSettings } from '@/services/storeSettings'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY = 'bekie-admin-store-settings'
const auth = useAuthStore()

const settings = reactive({
  storeName: 'Beckie Deal Webstore',
  storeUrl: 'https://beckiedeal.com',
  contactEmail: 'support@beckiedeal.com',
  timezone: '(GMT-08:00) Pacific Time',
  currency: 'USD',
  logo: '',
  favicon: '',
  paymentMethods: ['aba_payway', 'cod'],
  abaEnabled: false,
  codEnabled: true,
  codInstructions: 'Pay cash when your order is delivered.',
  shippingOrigin: '123 Market Street, San Francisco, CA',
  freeShippingThreshold: 100,
  defaultShippingRate: 8.95,
  localPickup: false,
  deliveryEstimate: '3–5 business days',
  taxEnabled: true,
  taxIncluded: false,
  defaultTaxRate: 8.25,
  taxRegistrationNumber: '',
  orderNotifications: true,
  lowStockNotifications: true,
  customerMessageNotifications: true,
  notificationEmail: 'support@beckiedeal.com',
  defaultTeamRole: 'Staff',
  requireInviteApproval: true,
  sessionTimeout: '8 hours',
  analyticsId: '',
  pixelId: '',
  webhookUrl: '',
  webhookSecret: '',
})

const activeSection = ref('general')
const saving = ref(false)
const message = ref('')
const error = ref('')
const checkingPayway = ref(false)
const paywayCheck = ref(null)

const sections = [
  { key: 'general', label: 'General' },
  { key: 'payments', label: 'Payments' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'taxes', label: 'Taxes' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'team', label: 'Team' },
  { key: 'integrations', label: 'Integrations' },
]

const hasBranding = computed(() => Boolean(settings.logo || settings.favicon))

function applySettings(data) {
  Object.assign(settings, data)
  if (data.paymentMethods?.length) settings.paymentMethods = [...data.paymentMethods]
}

async function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    applySettings(saved)
    const remote = await fetchStoreSettings(auth.accessToken)
    applySettings(remote)
    await runPaywayCheck()
  } catch {
    if (!window.localStorage.getItem(STORAGE_KEY)) error.value = 'Store settings could not be loaded.'
  }
}

async function runPaywayCheck() {
  checkingPayway.value = true
  try {
    paywayCheck.value = await checkPaywayConnection(auth.accessToken)
  } catch (err) {
    paywayCheck.value = {
      connected: false,
      message: err.message || 'Unable to check the ABA PayWay connection.',
    }
  } finally {
    checkingPayway.value = false
  }
}

function selectImage(event, field) {
  const file = event.target.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    error.value = 'Images must be smaller than 2MB.'
    event.target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    settings[field] = String(reader.result)
    error.value = ''
  }
  reader.readAsDataURL(file)
}

function clearImage(field) {
  settings[field] = ''
}

function togglePaymentMethod(method, enabled) {
  const methods = new Set(settings.paymentMethods)
  if (enabled) methods.add(method)
  else methods.delete(method)
  settings.paymentMethods = [...methods]
}

async function saveSettings() {
  saving.value = true
  message.value = ''
  error.value = ''

  try {
    const saved = await updateStoreSettings(settings, auth.accessToken)
    applySettings(saved)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    message.value = 'Store settings saved.'
  } catch {
    error.value = 'Store settings could not be saved in this browser.'
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="settings-page">
    <AppHeader :title="`Store Settings — ${settings.storeName}`" />

    <main class="settings-page__body">
      <aside class="settings-nav" aria-label="Settings sections">
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          :class="{ active: activeSection === section.key }"
          @click="activeSection = section.key"
        >
          {{ section.label }}
          <ChevronRight v-if="activeSection === section.key" :size="14" />
        </button>
      </aside>

      <section class="settings-card">
        <header class="settings-card__header">
          <div>
            <div class="section-kicker"><Settings2 :size="14" /> Store configuration</div>
            <h1>{{ sections.find((section) => section.key === activeSection)?.label }} Store Settings</h1>
            <p>Manage your public shop credentials, addresses, and details.</p>
          </div>
          <button class="save-button" type="button" :disabled="saving" @click="saveSettings">
            <Save :size="15" />
            {{ saving ? 'Saving…' : 'Save Changes' }}
          </button>
        </header>

        <p v-if="message" class="notice notice--success" role="status"><Check :size="15" /> {{ message }}</p>
        <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

        <template v-if="activeSection === 'general'">
          <div class="form-grid">
            <label class="field">
              <span>Store Name</span>
              <input v-model.trim="settings.storeName" type="text" autocomplete="organization" />
            </label>
            <label class="field">
              <span>Store URL</span>
              <input v-model.trim="settings.storeUrl" type="url" autocomplete="url" />
            </label>
            <label class="field">
              <span>Customer Contact Email</span>
              <input v-model.trim="settings.contactEmail" type="email" autocomplete="email" />
            </label>
            <label class="field">
              <span>Timezone</span>
              <select v-model="settings.timezone">
                <option>(GMT-08:00) Pacific Time</option>
                <option>(GMT-05:00) Eastern Time</option>
                <option>(GMT+00:00) Greenwich Mean Time</option>
                <option>(GMT+08:00) Singapore Time</option>
              </select>
            </label>
            <label class="field field--currency">
              <span>Store Currency</span>
              <select v-model="settings.currency">
                <option value="USD">USD ($) — US Dollar</option>
                <option value="KHR">KHR (៛) — Cambodian Riel</option>
              </select>
            </label>
          </div>

          <div class="branding">
            <div class="branding__heading">
              <h2>Store Branding</h2>
              <span v-if="hasBranding">Custom assets selected</span>
            </div>
            <div class="upload-grid">
              <div class="upload-field">
                <span class="field-label">Store Logo</span>
                <div class="upload-box">
                  <div class="asset-preview asset-preview--logo">
                    <img v-if="settings.logo" :src="settings.logo" alt="Store logo preview" />
                    <ImagePlus v-else :size="20" />
                  </div>
                  <div class="upload-copy">
                    <label class="upload-button">{{ settings.logo ? 'Replace Logo' : 'Upload New Logo' }}<input type="file" accept="image/png,image/jpeg,image/webp" @change="selectImage($event, 'logo')" /></label>
                    <button v-if="settings.logo" class="remove-button" type="button" @click="clearImage('logo')">Remove</button>
                    <small>PNG, JPG or WebP up to 2MB</small>
                  </div>
                </div>
              </div>
              <div class="upload-field">
                <span class="field-label">Favicon</span>
                <div class="upload-box">
                  <div class="asset-preview asset-preview--favicon">
                    <img v-if="settings.favicon" :src="settings.favicon" alt="Favicon preview" />
                    <ImagePlus v-else :size="17" />
                  </div>
                  <div class="upload-copy">
                    <label class="upload-button">{{ settings.favicon ? 'Replace Favicon' : 'Upload Favicon' }}<input type="file" accept="image/png,image/x-icon,image/webp" @change="selectImage($event, 'favicon')" /></label>
                    <button v-if="settings.favicon" class="remove-button" type="button" @click="clearImage('favicon')">Remove</button>
                    <small>ICO, PNG or WebP up to 2MB</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="activeSection === 'payments'">
          <div class="payment-intro">
            <div>
              <h2>Payment methods</h2>
              <p>Choose how customers can pay at checkout. At least one method must be enabled.</p>
            </div>
            <span class="payment-count">{{ settings.paymentMethods.length }} enabled</span>
          </div>
          <div class="payment-methods">
            <label class="payment-method" :class="{ 'payment-method--active': settings.paymentMethods.includes('aba_payway') }">
              <input :checked="settings.paymentMethods.includes('aba_payway')" type="checkbox" @change="togglePaymentMethod('aba_payway', $event.target.checked)" />
              <span class="payment-method__mark payment-method__mark--aba">A</span>
              <span class="payment-method__copy"><strong>ABA PayWay</strong><small>Accept ABA PayWay QR and online payments.</small></span>
              <span class="payment-method__check"><Check :size="13" /></span>
            </label>
            <label class="payment-method" :class="{ 'payment-method--active': settings.paymentMethods.includes('cod') }">
              <input :checked="settings.paymentMethods.includes('cod')" type="checkbox" @change="togglePaymentMethod('cod', $event.target.checked)" />
              <span class="payment-method__mark payment-method__mark--cod">$</span>
              <span class="payment-method__copy"><strong>Cash on delivery</strong><small>Allow customers to pay when their order arrives.</small></span>
              <span class="payment-method__check"><Check :size="13" /></span>
            </label>
          </div>
          <div class="payment-divider"></div>
          <div class="form-grid form-grid--payment">
            <label class="field field--wide"><span>COD Instructions</span><textarea v-model.trim="settings.codInstructions" rows="2"></textarea></label>
          </div>
          <div class="credentials-heading"><div><h2>ABA PayWay connection</h2><p>Payment credentials are securely managed by the backend.</p></div><button class="check-button" type="button" :disabled="checkingPayway" @click="runPaywayCheck">{{ checkingPayway ? 'Checking…' : 'Check connection' }}</button></div>
          <div v-if="paywayCheck" class="payway-result" :class="paywayCheck.connected ? 'payway-result--success' : 'payway-result--warning'" role="status">
            <span class="status__dot"></span>
            <div><strong>{{ paywayCheck.connected ? 'Connected to ABA PayWay' : 'ABA PayWay connection warning' }}</strong><small>{{ paywayCheck.message }}<template v-if="paywayCheck.code"> (Code: {{ paywayCheck.code }})</template></small></div>
            <span class="status" :class="paywayCheck.connected ? 'status--ready' : 'status--offline'">{{ paywayCheck.connected ? 'Connected' : 'Not connected' }}</span>
          </div>
        </template>

        <template v-else-if="activeSection === 'shipping'">
          <div class="form-grid">
            <label class="field field--wide"><span>Shipping Origin</span><input v-model.trim="settings.shippingOrigin" type="text" /></label>
            <label class="field"><span>Delivery Estimate</span><input v-model.trim="settings.deliveryEstimate" type="text" /></label>
            <label class="field"><span>Free Shipping Over</span><input v-model.number="settings.freeShippingThreshold" type="number" min="0" step="0.01" /></label>
            <label class="field"><span>Default Shipping Rate</span><input v-model.number="settings.defaultShippingRate" type="number" min="0" step="0.01" /></label>
          </div>
          <div class="settings-list">
            <label class="setting-toggle"><span><strong>Local pickup</strong><small>Allow customers to collect orders from the store.</small></span><input v-model="settings.localPickup" type="checkbox" /><i></i></label>
          </div>
        </template>

        <template v-else-if="activeSection === 'taxes'">
          <div class="settings-list settings-list--top">
            <label class="setting-toggle"><span><strong>Collect sales tax</strong><small>Apply the default tax rate to taxable orders.</small></span><input v-model="settings.taxEnabled" type="checkbox" /><i></i></label>
            <label class="setting-toggle"><span><strong>Prices include tax</strong><small>Display tax-inclusive prices throughout the storefront.</small></span><input v-model="settings.taxIncluded" type="checkbox" /><i></i></label>
          </div>
          <div class="form-grid">
            <label class="field"><span>Default Tax Rate (%)</span><input v-model.number="settings.defaultTaxRate" type="number" min="0" max="100" step="0.01" /></label>
            <label class="field"><span>Tax Registration Number</span><input v-model.trim="settings.taxRegistrationNumber" type="text" placeholder="Optional" /></label>
          </div>
        </template>

        <template v-else-if="activeSection === 'notifications'">
          <div class="form-grid">
            <label class="field field--wide"><span>Notification Email</span><input v-model.trim="settings.notificationEmail" type="email" /></label>
          </div>
          <div class="settings-list">
            <label class="setting-toggle"><span><strong>New order notifications</strong><small>Receive an email whenever a customer places an order.</small></span><input v-model="settings.orderNotifications" type="checkbox" /><i></i></label>
            <label class="setting-toggle"><span><strong>Low stock alerts</strong><small>Get notified when products reach their stock threshold.</small></span><input v-model="settings.lowStockNotifications" type="checkbox" /><i></i></label>
            <label class="setting-toggle"><span><strong>Customer messages</strong><small>Receive notifications for new customer support messages.</small></span><input v-model="settings.customerMessageNotifications" type="checkbox" /><i></i></label>
          </div>
        </template>

        <template v-else-if="activeSection === 'team'">
          <div class="form-grid">
            <label class="field"><span>Default Team Role</span><select v-model="settings.defaultTeamRole"><option>Staff</option><option>Manager</option><option>Admin</option></select></label>
            <label class="field"><span>Session Timeout</span><select v-model="settings.sessionTimeout"><option>1 hour</option><option>8 hours</option><option>24 hours</option><option>30 days</option></select></label>
          </div>
          <div class="settings-list">
            <label class="setting-toggle"><span><strong>Require invite approval</strong><small>Admins must approve new team members before access is granted.</small></span><input v-model="settings.requireInviteApproval" type="checkbox" /><i></i></label>
          </div>
        </template>

        <template v-else-if="activeSection === 'integrations'">
          <div class="form-grid">
            <label class="field"><span>Google Analytics ID</span><input v-model.trim="settings.analyticsId" type="text" placeholder="G-XXXXXXXXXX" /></label>
            <label class="field"><span>Meta Pixel ID</span><input v-model.trim="settings.pixelId" type="text" placeholder="Optional" /></label>
            <label class="field field--wide"><span>Order Webhook URL</span><input v-model.trim="settings.webhookUrl" type="url" placeholder="https://example.com/webhooks/orders" /></label>
            <label class="field field--wide"><span>Webhook Secret</span><input v-model.trim="settings.webhookSecret" type="password" placeholder="Optional signing secret" /></label>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.settings-page { min-height: 100vh; background: var(--bg); }
.settings-page__body { display: grid; grid-template-columns: 200px minmax(0, 710px); align-items: start; gap: 1.25rem; max-width: 1100px; margin: 0 auto; padding: 1.65rem 1.5rem 3rem; }
.settings-nav { display: flex; flex-direction: column; gap: 0.18rem; padding-top: 0.15rem; }
.settings-nav button { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0.65rem 0.75rem; border: 0; border-radius: 5px; background: transparent; color: var(--text-body); font-family: inherit; font-size: 0.78rem; text-align: left; cursor: pointer; }
.settings-nav button:hover { background: var(--surface-alt); }.settings-nav button.active { background: rgb(var(--accent-rgb) / 0.12); color: var(--accent-ink); font-weight: 700; }
.settings-card { padding: 1.55rem 1.6rem 1.7rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); box-shadow: 0 2px 8px rgb(31 36 45 / 0.025); }
.settings-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 1.05rem; border-bottom: 1px solid var(--border-subtle); }
.section-kicker { display: inline-flex; align-items: center; gap: 0.35rem; margin-bottom: 0.45rem; color: var(--accent-ink); font-size: 0.65rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
h1, h2, p { margin-top: 0; } h1 { margin-bottom: 0.25rem; color: var(--text-strong); font-size: 1rem; } .settings-card__header p { margin: 0; color: var(--text-muted); font-size: 0.72rem; }
.save-button { display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; padding: 0.55rem 0.85rem; border: 0; border-radius: 7px; background: var(--violet); color: white; font-family: inherit; font-size: 0.72rem; font-weight: 700; cursor: pointer; }.save-button:disabled { opacity: 0.6; cursor: wait; }
.notice { display: flex; align-items: center; gap: 0.4rem; margin: 1rem 0 0; padding: 0.6rem 0.7rem; border-radius: 6px; font-size: 0.73rem; }.notice--success { color: var(--success-ink); background: var(--success-bg); }.notice--error { color: var(--danger); background: var(--danger-bg); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.05rem 0.8rem; padding-top: 1.25rem; }.field { display: flex; flex-direction: column; gap: 0.4rem; }.field--currency { max-width: 245px; }.field--wide { grid-column: 1 / -1; }.field span, .field-label { color: var(--text-body); font-size: 0.7rem; font-weight: 700; }.field input, .field select, .field textarea { width: 100%; min-height: 34px; padding: 0.5rem 0.65rem; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-strong); font-family: inherit; font-size: 0.73rem; outline: none; resize: vertical; }.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--violet); box-shadow: 0 0 0 3px rgb(124 58 237 / 0.1); }
.settings-list { display: flex; flex-direction: column; margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); }.settings-list--top { margin-top: 1.25rem; }.setting-toggle { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; border-bottom: 1px solid var(--border-subtle); cursor: pointer; }.setting-toggle span { display: flex; flex-direction: column; gap: 0.18rem; }.setting-toggle strong { color: var(--text-body); font-size: 0.74rem; }.setting-toggle small { color: var(--text-subtle); font-size: 0.65rem; }.setting-toggle input { position: absolute; opacity: 0; pointer-events: none; }.setting-toggle i { position: relative; display: inline-block; flex-shrink: 0; width: 34px; height: 20px; border-radius: 99px; background: var(--switch-track); transition: background 0.15s ease; }.setting-toggle i::after { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: var(--shadow-sm); content: ''; transition: transform 0.15s ease; }.setting-toggle input:checked + i { background: var(--violet); }.setting-toggle input:checked + i::after { transform: translateX(14px); }
.payment-intro, .credentials-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-top: 1.25rem; }.payment-intro h2, .credentials-heading h2 { margin: 0 0 0.2rem; color: var(--text-strong); font-size: 0.82rem; }.payment-intro p, .credentials-heading p { margin: 0; color: var(--text-subtle); font-size: 0.68rem; }.payment-count { flex-shrink: 0; padding: 0.28rem 0.5rem; border: 1px solid var(--border); border-radius: 99px; color: var(--text-muted); font-size: 0.63rem; font-weight: 700; }.payment-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; margin-top: 0.85rem; }.payment-method { position: relative; display: flex; align-items: center; gap: 0.65rem; min-height: 72px; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease; }.payment-method:hover { border-color: var(--violet); }.payment-method--active { border-color: var(--violet); background: rgb(124 58 237 / 0.045); box-shadow: 0 0 0 2px rgb(124 58 237 / 0.08); }.payment-method input { position: absolute; opacity: 0; pointer-events: none; }.payment-method__mark { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 7px; color: white; font-size: 0.85rem; font-weight: 800; }.payment-method__mark--aba { background: #3b5bd6; }.payment-method__mark--cod { background: #64748b; }.payment-method__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 0.18rem; }.payment-method__copy strong { color: var(--text-body); font-size: 0.73rem; }.payment-method__copy small { color: var(--text-subtle); font-size: 0.62rem; line-height: 1.35; }.payment-method__check { display: inline-flex; align-items: center; justify-content: center; width: 19px; height: 19px; border: 1px solid var(--border-strong); border-radius: 50%; color: transparent; }.payment-method--active .payment-method__check { border-color: var(--violet); background: var(--violet); color: white; }.payment-divider { margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); }.credentials-heading { padding-top: 1.2rem; }.status { flex-shrink: 0; padding: 0.28rem 0.5rem; border-radius: 99px; background: var(--surface-track); color: var(--text-muted); font-size: 0.62rem; font-weight: 700; }.status--ready { background: var(--success-bg); color: var(--success-ink); }
.branding { margin-top: 1.45rem; padding-top: 1.2rem; border-top: 1px solid var(--border-subtle); }.branding__heading { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }.branding h2 { margin: 0; color: var(--text-strong); font-size: 0.8rem; }.branding__heading span { color: var(--success); font-size: 0.65rem; }.upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }.upload-field { display: flex; flex-direction: column; gap: 0.4rem; }.upload-box { display: flex; align-items: center; gap: 0.7rem; min-height: 68px; padding: 0.65rem; border: 1px solid var(--border); border-radius: 7px; }.asset-preview { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 38px; height: 38px; overflow: hidden; border-radius: 7px; background: var(--violet); color: white; }.asset-preview--favicon { width: 30px; height: 30px; border-radius: 4px; }.asset-preview img { width: 100%; height: 100%; object-fit: cover; }.upload-copy { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; min-width: 0; }.upload-button { padding: 0.4rem 0.55rem; border: 1px solid var(--border); border-radius: 5px; color: var(--text-body); background: var(--surface); font-size: 0.65rem; font-weight: 700; cursor: pointer; }.upload-button input { display: none; }.upload-copy small { flex-basis: 100%; color: var(--text-subtle); font-size: 0.58rem; }.remove-button { border: 0; background: transparent; color: var(--danger); font-family: inherit; font-size: 0.62rem; cursor: pointer; }
.empty-section { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 270px; color: var(--text-subtle); text-align: center; }.empty-section svg { margin-bottom: 0.7rem; color: var(--accent-ink); }.empty-section h2 { margin-bottom: 0.25rem; color: var(--text-strong); font-size: 0.9rem; }.empty-section p { margin: 0; font-size: 0.73rem; }
.settings-card .save-button { background: rgb(var(--accent-rgb)); color: var(--ink-on-accent); }.settings-card .field input:focus, .settings-card .field select:focus, .settings-card .field textarea:focus { border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.16); }.settings-card .setting-toggle input:checked + i { background: rgb(var(--accent-rgb)); }.settings-card .payment-method:hover, .settings-card .payment-method--active { border-color: rgb(var(--accent-rgb)); }.settings-card .payment-method--active { background: rgb(var(--accent-rgb) / 0.07); box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 0.14); }.settings-card .payment-method--active .payment-method__check { border-color: rgb(var(--accent-rgb)); background: rgb(var(--accent-rgb)); }.settings-card .payment-method__mark--aba, .settings-card .asset-preview { background: rgb(var(--accent-rgb)); }
.status__dot { display: inline-block; width: 7px; height: 7px; margin-right: 0.3rem; border-radius: 50%; background: var(--danger); }.status--ready .status__dot { background: var(--success); }
.check-button { flex-shrink: 0; padding: 0.45rem 0.7rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-body); font-family: inherit; font-size: 0.66rem; font-weight: 700; cursor: pointer; }.check-button:hover:not(:disabled) { border-color: rgb(var(--accent-rgb)); color: var(--text-strong); }.check-button:disabled { opacity: 0.6; cursor: wait; }.payway-result { display: flex; align-items: center; gap: 0.55rem; margin-top: 0.85rem; padding: 0.7rem; border: 1px solid var(--success-border); border-radius: 7px; background: var(--success-bg); color: var(--success-ink); }.payway-result--warning { border-color: var(--danger-border); background: var(--danger-bg); color: var(--danger); }.payway-result > div { display: flex; flex: 1; flex-direction: column; gap: 0.15rem; }.payway-result strong { font-size: 0.7rem; }.payway-result small { color: var(--text-muted); font-size: 0.63rem; line-height: 1.35; }.payway-result--warning small { color: var(--danger); }.payway-result .status { background: transparent; }
.payway-result--success > .status__dot { background: var(--success); }
@media (max-width: 760px) { .settings-page__body { grid-template-columns: 1fr; padding-inline: 1rem; }.settings-nav { display: grid; grid-template-columns: repeat(2, 1fr); }.settings-card { padding: 1.1rem; } }
@media (max-width: 520px) { .settings-card__header { flex-direction: column; }.save-button { width: 100%; justify-content: center; }.form-grid, .upload-grid, .payment-methods { grid-template-columns: 1fr; }.field--currency, .field--wide { max-width: none; grid-column: auto; }.payment-intro, .credentials-heading { flex-direction: column; }.payment-count, .status { align-self: flex-start; } }
</style>
