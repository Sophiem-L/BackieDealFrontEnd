<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { fetchCustomer, initials as initialsOf, saveCustomer, toneFor } from '@/services/customers'
import { ACCEPT_ATTR, uploadImage } from '@/services/media'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Edit when the route carries a customer id; otherwise we're creating.
const customerId = computed(() => route.params.id || null)
const isEdit = computed(() => Boolean(customerId.value))

const statuses = [
  { key: 'active', label: 'Active' },
  { key: 'vip', label: 'VIP' },
  { key: 'inactive', label: 'Inactive' },
]

const form = reactive({
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
  avatar: '',
})

// The saved record, for the read-only account summary. Spend and order count
// are aggregates the API derives from orders — this screen cannot set them.
const existing = ref(null)
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
// Per-field messages from a 422, keyed by the API's field names.
const fieldErrors = ref({})

onMounted(async () => {
  if (!isEdit.value) return

  loading.value = true
  try {
    const customer = await fetchCustomer(customerId.value, auth.accessToken)
    existing.value = customer
    Object.assign(form, {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      status: customer.status,
      avatar: customer.avatar,
    })
  } catch (err) {
    error.value = err.message || 'Could not load this customer.'
  } finally {
    loading.value = false
  }
})

// New customers have no id yet, so their placeholder colour is fixed rather
// than derived — it settles once the record is saved.
const tone = computed(() => (existing.value ? existing.value.tone : toneFor(0)))

const fileInput = ref(null)
function pickPhoto() {
  fileInput.value?.click()
}

/**
 * Upload straight away and keep the URL that comes back.
 *
 * An object URL would only live as long as this tab, so the photo has to reach
 * the media endpoint before it can be saved against the customer.
 */
async function onPhotoChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploading.value = true
  error.value = ''
  try {
    const { url } = await uploadImage(file, { token: auth.accessToken, folder: 'customers' })
    form.avatar = url
  } catch (err) {
    error.value = err.message || 'Could not upload the photo.'
  } finally {
    uploading.value = false
  }
}

function removePhoto() {
  form.avatar = ''
}

const pageTitle = computed(() => (isEdit.value ? 'Edit Customer' : 'New Customer'))

const initials = computed(() => initialsOf(form.name) || '?')

async function save() {
  saving.value = true
  error.value = ''
  fieldErrors.value = {}
  try {
    await saveCustomer(customerId.value, form, auth.accessToken)
    router.push({ name: 'customers' })
  } catch (err) {
    error.value = err.message || 'Could not save the customer.'
    // `errors` is Laravel's validation bag: { field: [message, ...] }.
    fieldErrors.value = Object.fromEntries(
      Object.entries(err.errors ?? {}).map(([field, messages]) => [field, messages[0]]),
    )
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink :to="{ name: 'customers' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Back to Customers</span>
          </span>
        </RouterLink>
      </div>

      <form class="grid" @submit.prevent="save">
        <!-- Left column -->
        <div class="col col--side">
          <section class="card card--avatar">
            <span class="avatar" :class="form.avatar ? 'avatar--photo' : `avatar--${tone}`">
              <img v-if="form.avatar" :src="form.avatar" alt="Customer photo" />
              <span v-else aria-hidden="true">{{ initials }}</span>
            </span>
            <p class="avatar__name">{{ form.name || 'New Customer' }}</p>
            <p class="avatar__email">{{ form.email || 'email@example.com' }}</p>

            <div class="avatar__actions">
              <button type="button" class="photo-btn" :disabled="uploading" @click="pickPhoto">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15V3m0 0L8 7m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
                </svg>
                {{ uploading ? 'Uploading…' : form.avatar ? 'Change Photo' : 'Upload Photo' }}
              </button>
              <button v-if="form.avatar" type="button" class="photo-btn photo-btn--ghost" @click="removePhoto">
                Remove
              </button>
            </div>
            <input ref="fileInput" type="file" :accept="ACCEPT_ATTR" hidden @change="onPhotoChange" />
          </section>

          <section v-if="existing" class="card">
            <h3 class="card__title">Account Summary</h3>
            <div class="summary">
              <span class="summary__label">Total Spent</span>
              <span class="summary__value">{{ existing.spent }}</span>
            </div>
            <div class="summary">
              <span class="summary__label">Completed Orders</span>
              <span class="summary__value">{{ existing.orders }}</span>
            </div>
          </section>
        </div>

        <!-- Right column -->
        <div class="col col--main">
          <section class="card">
            <div class="field">
              <label for="name">Full Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. John Doe" />
              <p v-if="fieldErrors.name" class="field__error">{{ fieldErrors.name }}</p>
            </div>
            <div class="row">
              <div class="field">
                <label for="email">Email Address</label>
                <input id="email" v-model="form.email" type="email" placeholder="you@example.com" />
                <p v-if="fieldErrors.email" class="field__error">{{ fieldErrors.email }}</p>
              </div>
              <div class="field">
                <label for="phone">Phone</label>
                <input id="phone" v-model="form.phone" type="tel" placeholder="+855 12 000 000" />
                <p v-if="fieldErrors.phone" class="field__error">{{ fieldErrors.phone }}</p>
              </div>
            </div>
            <div class="field">
              <label for="address">Address</label>
              <textarea id="address" v-model="form.address" rows="2" placeholder="Street, district, city, postcode"></textarea>
              <p v-if="fieldErrors.address" class="field__error">{{ fieldErrors.address }}</p>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Account Status</h3>
            <div class="segmented" role="radiogroup" aria-label="Account status">
              <button
                v-for="s in statuses"
                :key="s.key"
                type="button"
                class="segmented__btn"
                :class="[`segmented__btn--${s.key}`, { 'is-active': form.status === s.key }]"
                role="radio"
                :aria-checked="form.status === s.key"
                @click="form.status = s.key"
              >
                {{ s.label }}
              </button>
            </div>
            <p class="card__hint card__hint--left">
              {{ form.status === 'vip'
                ? 'VIP customers are highlighted and may qualify for special offers.'
                : form.status === 'inactive'
                  ? 'Inactive accounts are hidden from default lists and cannot place orders.'
                  : 'Active customers can place orders and receive notifications.' }}
            </p>
          </section>
        </div>

        <!-- Form actions -->
        <div class="actions">
          <p v-if="error" class="actions__error" role="alert">{{ error }}</p>
          <BaseButton variant="ghost" :to="{ name: 'customers' }">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="saving || loading || uploading">
            {{ saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer' }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">

.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__back {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;
    &:hover { text-decoration: none; }
    svg { width: 22px; height: 22px; stroke: var(--text-muted); stroke-width: 1.8; }
    span { display: flex; flex-direction: column; line-height: 1.2; }
  }

  &__crumb {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__title { font-size: 1.1rem; font-weight: 700; color: var(--text-strong); }

  &__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

/* Details on the left, avatar/summary on the right. */
.col--main { order: 1; }
.col--side { order: 2; }

@media (max-width: 900px) {
  .col--side { order: 1; }
  .col--main { order: 2; }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

/* Bottom action bar spanning both columns */
.actions {
  grid-column: 1 / -1;
  order: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;

  /* Pushed left of the buttons so a long message wraps into the free space. */
  &__error {
    margin: 0 auto 0 0;
    font-size: 0.82rem;
    color: var(--danger);
  }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.74rem;
    color: var(--text-subtle);
    text-align: center;

    &--left { text-align: left; }
  }

  &--avatar { text-align: center; }
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ink-on-solid);
  overflow: hidden;

  img { width: 100%; height: 100%; object-fit: cover; }

  &--photo { background: var(--border-subtle); }
  &--blue { background: var(--info); }
  &--green { background: var(--success-solid); }
  &--violet { background: var(--violet); }
  &--amber { background: var(--accent-ink); }
  &--rose { background: var(--rose); }
  &--slate { background: var(--neutral-solid); }

  &__name { margin: 0.75rem 0 0; font-size: 1rem; font-weight: 700; color: var(--text-strong); }
  &__email { margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-subtle); }

  &__actions {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }
}

.photo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;

  &:hover { background: var(--surface-alt); }

  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

  &--ghost {
    color: var(--danger);
    border-color: transparent;
    &:hover { background: var(--danger-bg); }
  }
}

.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;

  & + & { border-top: 1px solid var(--border-subtle); }

  &__label { font-size: 0.82rem; color: var(--text-subtle); }
  &__value { font-size: 0.95rem; font-weight: 700; color: var(--text-strong); }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & + .field { margin-top: 1rem; }

  &__error {
    margin: 0;
    font-size: 0.75rem;
    color: var(--danger);
  }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }
    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  textarea { resize: vertical; }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  .field + .field { margin-top: 0; }

  @media (max-width: 620px) { grid-template-columns: 1fr; }
}

.segmented {
  display: inline-flex;
  gap: 0.4rem;
  flex-wrap: wrap;

  &__btn {
    padding: 0.5rem 1rem;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover { background: var(--surface-alt); }

    &.is-active { color: var(--text-strong); }
    &--active.is-active { background: var(--success-bg); border-color: var(--success-border); color: var(--success); }
    &--vip.is-active { background: var(--violet-bg); border-color: var(--violet-border); color: var(--violet); }
    &--inactive.is-active { background: var(--surface-track); border-color: var(--border); color: var(--text-body); }
  }
}
</style>
