<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
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

async function logout() {
  await auth.logout()
  router.push('/login')
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
        <div class="identity__actions">
          <button type="button" class="btn btn--ghost" @click="logout">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M10 8l-4 4 4 4M6 12h11" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Logout
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="savingProfile || loadingProfile || !isProfileDirty"
            @click="saveProfile"
          >
            {{ savingProfile ? 'Updating…' : 'Update Profile' }}
          </button>
        </div>
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
$accent: #f4c10f;
$muted: #8a909c;
$divider: #eef0f3;

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
    background: #35495e;
    color: #fff;
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
      color: $color-text;
    }

    p {
      margin: 0.2rem 0 0;
      font-size: 0.85rem;
      color: $muted;
    }
  }

  &__actions {
    display: flex;
    gap: 0.6rem;
  }
}

.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.5rem;

  &__title {
    margin: 0 0 1.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;

    &--lock {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      svg {
        width: 16px;
        height: 16px;
        stroke: $accent;
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
    color: #067647;
    background: #ecfdf3;
    border-color: #abefc6;
  }

  &--error {
    color: #b42318;
    background: #fef3f2;
    border-color: #fecdca;
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
    color: #4a5160;
  }

  input {
    width: 100%;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: $color-text;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder {
      color: #b4b9c2;
    }

    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }

    &:disabled {
      background: #f4f5f7;
      color: $muted;
      cursor: not-allowed;
    }
  }

  &__control {
    position: relative;
    display: flex;
    align-items: center;
    background: #f4f5f7;
    border: 1px solid #e6e8ec;
    border-radius: 10px;

    &:focus-within {
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
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
    color: $muted;
    cursor: pointer;

    &:hover {
      color: $color-text;
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
    background: $accent;
    color: #1f242d;

    &:hover {
      filter: brightness(0.96);
      border-color: transparent;
    }
  }

  &--ghost {
    background: #fff;
    border-color: #e6e8ec;
    color: #d14343;

    &:hover {
      background: #fff5f5;
      border-color: #f0c9c9;
    }
  }

  &--outline {
    background: #fff;
    border-color: $accent;
    color: #a8850a;

    &:hover {
      background: rgba($accent, 0.12);
      border-color: $accent;
    }
  }

  &--neutral {
    color: #4a5160;

    &:hover {
      background: #f4f5f7;
      border-color: #e6e8ec;
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
    color: $color-text;
  }

  &__hint {
    margin: 0.25rem 0 0;
    font-size: 0.82rem;
    color: $muted;
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
  background: rgba(17, 22, 30, 0.5);
  backdrop-filter: blur(2px);

  &__dialog {
    width: 100%;
    max-width: 460px;
    background: #fff;
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
    border-bottom: 1px solid $divider;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: $color-text;

    svg {
      width: 18px;
      height: 18px;
      stroke: $accent;
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
    color: $muted;
    cursor: pointer;

    &:hover {
      background: #f4f5f7;
      color: $color-text;
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
    border-top: 1px solid $divider;
  }
}
</style>
