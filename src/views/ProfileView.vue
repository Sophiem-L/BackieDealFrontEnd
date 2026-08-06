<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const profile = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

// Snapshot of the last saved/loaded values, used to detect edits.
const savedProfile = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

const passwords = reactive({
  current: '',
  next: '',
  confirm: '',
})

const showCurrent = ref(false)
const showPasswordModal = ref(false)

function openPasswordModal() {
  passwords.current = ''
  passwords.next = ''
  passwords.confirm = ''
  passwordError.value = ''
  passwordMessage.value = ''
  showCurrent.value = false
  showPasswordModal.value = true
}

function closePasswordModal() {
  showPasswordModal.value = false
}

function onModalKeydown(event) {
  if (event.key === 'Escape') closePasswordModal()
}

watch(showPasswordModal, (open) => {
  if (typeof document === 'undefined') return
  if (open) {
    document.addEventListener('keydown', onModalKeydown)
  } else {
    document.removeEventListener('keydown', onModalKeydown)
  }
})

const loadingProfile = ref(false)
const savingProfile = ref(false)
const profileError = ref('')
const profileMessage = ref('')

const savingPassword = ref(false)
const passwordError = ref('')
const passwordMessage = ref('')

const displayName = computed(
  () => `${profile.firstName} ${profile.lastName}`.trim() || auth.user?.name || 'Admin',
)

const initials = computed(() => {
  const parts = displayName.value.split(/\s+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return letters.toUpperCase() || 'AD'
})

const isProfileDirty = computed(
  () =>
    profile.firstName !== savedProfile.firstName ||
    profile.lastName !== savedProfile.lastName ||
    profile.email !== savedProfile.email ||
    profile.phone !== savedProfile.phone,
)

function applyProfile(data) {
  profile.firstName = data.first_name ?? ''
  profile.lastName = data.last_name ?? ''
  profile.email = data.email ?? ''
  profile.phone = data.phone ?? ''
  // Sync the snapshot so the Update button starts disabled until an edit.
  savedProfile.firstName = profile.firstName
  savedProfile.lastName = profile.lastName
  savedProfile.email = profile.email
  savedProfile.phone = profile.phone
}

// GET /admin/auth/me -> { data: { first_name, last_name, email, phone, name, roles } }
async function loadProfile() {
  loadingProfile.value = true
  profileError.value = ''
  try {
    const response = await apiFetch('/admin/auth/me', { token: auth.accessToken })
    const data = response?.data ?? {}
    applyProfile(data)
    auth.setUser({ ...(auth.user ?? {}), ...data })
  } catch (err) {
    profileError.value = err.message || 'Failed to load your profile.'
  } finally {
    loadingProfile.value = false
  }
}

// PATCH /admin/auth/profile
async function saveProfile() {
  savingProfile.value = true
  profileError.value = ''
  profileMessage.value = ''
  try {
    const response = await apiFetch('/admin/auth/profile', {
      method: 'PATCH',
      token: auth.accessToken,
      body: {
        first_name: profile.firstName,
        last_name: profile.lastName,
        email: profile.email,
        phone: profile.phone || null,
      },
    })
    const data = response?.data ?? {}
    applyProfile(data)
    auth.setUser({ ...(auth.user ?? {}), ...data })
    profileMessage.value = 'Profile saved successfully.'
  } catch (err) {
    profileError.value = err.message || 'Failed to save your profile.'
  } finally {
    savingProfile.value = false
  }
}

// POST /admin/auth/change-password
async function updatePassword() {
  passwordError.value = ''
  passwordMessage.value = ''

  if (passwords.next !== passwords.confirm) {
    passwordError.value = 'New password and confirmation do not match.'
    return
  }

  savingPassword.value = true
  try {
    await apiFetch('/admin/auth/change-password', {
      method: 'POST',
      token: auth.accessToken,
      body: {
        current_password: passwords.current,
        new_password: passwords.next,
        new_password_confirmation: passwords.confirm,
      },
    })
    passwords.current = ''
    passwords.next = ''
    passwords.confirm = ''
    passwordMessage.value = 'Password changed successfully.'
    showPasswordModal.value = false
  } catch (err) {
    passwordError.value = err.message || 'Failed to change your password.'
  } finally {
    savingPassword.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <div class="page">
    <AppHeader title="My Account Settings" />

    <div class="page__body">
      <!-- Identity strip -->
      <section class="identity">
        <span class="identity__avatar">{{ initials }}</span>
        <div class="identity__meta">
          <h2>{{ displayName }}</h2>
          <p>{{ profile.email }}</p>
        </div>
        <!-- No actions here: Logout belongs to the sidebar, and Update Profile
             sits at the bottom of the last card. -->
      </section>

      <!-- Personal information -->
      <section class="card">
        <h3 class="card__title">Personal Information</h3>

        <p v-if="profileMessage" class="alert alert--success" role="status">{{ profileMessage }}</p>
        <p v-if="profileError" class="alert alert--error" role="alert">{{ profileError }}</p>

        <div class="grid">
          <div class="field">
            <label for="firstName">First Name</label>
            <input id="firstName" v-model="profile.firstName" type="text" :disabled="loadingProfile" />
          </div>
          <div class="field">
            <label for="lastName">Last Name</label>
            <input id="lastName" v-model="profile.lastName" type="text" :disabled="loadingProfile" />
          </div>
          <div class="field">
            <label for="email">Email Address</label>
            <input id="email" v-model="profile.email" type="email" :disabled="loadingProfile" />
          </div>
          <div class="field">
            <label for="phone">Phone Number</label>
            <input id="phone" v-model="profile.phone" type="tel" :disabled="loadingProfile" />
          </div>
        </div>
      </section>

      <!-- Security -->
      <section class="card">
        <h3 class="card__title card__title--lock">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-linecap="round" />
          </svg>
          Security &amp; Password
        </h3>

        <p v-if="passwordMessage" class="alert alert--success" role="status">{{ passwordMessage }}</p>

        <div class="security">
          <div class="security__meta">
            <p class="security__label">Password</p>
            <p class="security__hint">Keep your account secure with a strong password you don't use elsewhere.</p>
          </div>
          <button type="button" class="btn btn--outline" @click="openPasswordModal">
            Change Password
          </button>
        </div>
      </section>

      <!-- Page-level action, outside the cards: it saves the Personal
           Information fields, not anything in the Security card. -->
      <div class="page-actions">
        <button
          type="button"
          class="btn btn--primary"
          :disabled="savingProfile || loadingProfile || !isProfileDirty"
          @click="saveProfile"
        >
          {{ savingProfile ? 'Updating…' : 'Update Profile' }}
        </button>
      </div>
    </div>

    <!-- Change password modal -->
    <Teleport to="body">
      <div v-if="showPasswordModal" class="modal" @click.self="closePasswordModal">
        <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="passwordModalTitle">
          <header class="modal__header">
            <h3 id="passwordModalTitle" class="modal__title">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-linecap="round" />
              </svg>
              Change Password
            </h3>
            <button type="button" class="modal__close" aria-label="Close" @click="closePasswordModal">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="modal__body">
            <p v-if="passwordError" class="alert alert--error" role="alert">{{ passwordError }}</p>

            <div class="field">
              <label for="current">Current Password</label>
              <div class="field__control">
                <input
                  id="current"
                  v-model="passwords.current"
                  :type="showCurrent ? 'text' : 'password'"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="field__toggle"
                  :aria-label="showCurrent ? 'Hide password' : 'Show password'"
                  @click="showCurrent = !showCurrent"
                >
                  <svg v-if="showCurrent" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none">
                    <path d="M3 3l18 18" stroke-linecap="round" />
                    <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4-.85" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="field">
              <label for="newPassword">New Password</label>
              <input id="newPassword" v-model="passwords.next" type="password" autocomplete="new-password" />
            </div>

            <div class="field">
              <label for="confirmPassword">Confirm New Password</label>
              <input id="confirmPassword" v-model="passwords.confirm" type="password" autocomplete="new-password" />
            </div>
          </div>

          <footer class="modal__footer">
            <button type="button" class="btn btn--ghost btn--neutral" :disabled="savingPassword" @click="closePasswordModal">
              Cancel
            </button>
            <button type="button" class="btn btn--primary" :disabled="savingPassword" @click="updatePassword">
              {{ savingPassword ? 'Updating…' : 'Update Password' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
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
    width: 100%;
  }
}

.identity {
  display: flex;
  align-items: center;
  gap: 1rem;

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: $radius;
    background: var(--secondary);
    color: var(--surface);
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__meta {
    flex: 1;
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--text-strong);
    }

    p {
      margin: 0.2rem 0 0;
      font-size: 0.85rem;
      color: var(--text-subtle);
    }
  }

}

/* Page-level save action, below the cards. */
.page-actions {
  display: flex;
  justify-content: flex-end;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.5rem;


  &__title {
    margin: 0 0 1.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);

    &--lock {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      svg {
        width: 16px;
        height: 16px;
        stroke: rgb(var(--accent-rgb));
        stroke-width: 1.8;
      }
    }
  }
}

.alert {
  margin: 0 0 1rem;
  padding: 0.7rem 0.85rem;
  font-size: 0.82rem;
  border-radius: 10px;
  border: 1px solid transparent;

  &--success {
    color: var(--success-ink);
    background: var(--success-bg);
    border-color: var(--success-border);
  }

  &--error {
    color: var(--danger);
    background: var(--danger-bg);
    border-color: var(--danger-border);
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.1rem 1.5rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }

  .field + .field {
    margin-top: 0;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & + .field {
    margin-top: 1.1rem;
  }

  &--narrow {
    max-width: 360px;
  }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder {
      color: var(--text-faint);
    }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    &:disabled {
      background: var(--bg);
      color: var(--text-subtle);
      cursor: not-allowed;
    }
  }

  &__control {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;

    &:focus-within {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    input {
      border: none;
      background: transparent;
      box-shadow: none;

      &:focus {
        box-shadow: none;
      }
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    padding: 0 0.8rem;
    background: transparent;
    border: none;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover {
      color: var(--text-strong);
      border-color: transparent;
    }

    svg {
      width: 17px;
      height: 17px;
      stroke: currentColor;
      stroke-width: 1.7;
    }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter 0.15s ease, background-color 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: none;
    pointer-events: none;
  }

  &--primary {
    background: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);

    &:hover {
      filter: brightness(0.96);
      border-color: transparent;
    }
  }

  &--ghost {
    background: var(--surface);
    border-color: var(--border);
    color: var(--danger);

    &:hover {
      background: var(--danger-bg);
      border-color: var(--danger-border);
    }
  }

  &--outline {
    background: var(--surface);
    border-color: rgb(var(--accent-rgb));
    color: var(--accent-ink);

    &:hover {
      background: rgb(var(--accent-rgb) / 0.12);
      border-color: rgb(var(--accent-rgb));
    }
  }

  &--neutral {
    color: var(--text-body);

    &:hover {
      background: var(--bg);
      border-color: var(--border);
    }
  }
}

.security {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__meta {
    min-width: 0;
  }

  &__label {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__hint {
    margin: 0.25rem 0 0;
    font-size: 0.82rem;
    color: var(--text-subtle);
    max-width: 40ch;
  }
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: var(--backdrop);
  backdrop-filter: blur(2px);

  &__dialog {
    width: 100%;
    max-width: 460px;
    background: var(--surface);
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(15, 20, 30, 0.25);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2.5rem);
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-strong);

    svg {
      width: 18px;
      height: 18px;
      stroke: rgb(var(--accent-rgb));
      stroke-width: 1.8;
    }
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover {
      background: var(--bg);
      color: var(--text-strong);
    }

    svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
  }

  &__body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
