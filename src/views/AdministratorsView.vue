<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  fetchAdministrators,
  createAdministrator,
  updateAdministrator,
  deleteAdministrator,
  resetAdministratorPassword,
} from '@/services/administrators'
import { formatRoleName } from '@/services/masterData'
import { useAuthStore } from '@/stores/auth'
import { useMasterDataStore } from '@/stores/masterData'

// State
const auth = useAuthStore()
const masterData = useMasterDataStore()
const search = ref('')
const administrators = ref([])
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const perPage = ref(15)

// Form state
const showFormModal = ref(false)
const editingAdmin = ref(null)
const formLoading = ref(false)
const formError = ref('')
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  passwordConfirm: '',
  roleId: null,
})

// Password reset state
const showResetModal = ref(false)
const resetLoading = ref(false)
const resetError = ref('')
const resetMessage = ref('')
const resetForm = reactive({
  target: null,
  password: '',
  passwordConfirm: '',
})

// Confirmation modal
const showConfirmModal = ref(false)
const confirmAction = reactive({
  type: '', // 'delete' or 'reset'
  target: null,
  loading: false,
})

// Computed properties
const canResetPassword = computed(() => auth.hasPermission('administrators.password-reset'))
const canCreateAdmin = computed(() => auth.hasPermission('administrators.create'))
const canEditAdmin = computed(() => auth.hasPermission('administrators.update'))
const canDeleteAdmin = computed(() => auth.hasPermission('administrators.delete'))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return administrators.value
  return administrators.value.filter(
    (a) =>
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q),
  )
})

const formValid = computed(() => {
  if (!form.firstName.trim() || !form.lastName.trim()) return false
  if (!form.email.trim() || !form.email.includes('@')) return false
  if (!editingAdmin.value && !form.password) return false
  if (form.password && form.password !== form.passwordConfirm) return false
  if (form.password && form.password.length < 8) return false
  if (!form.roleId) return false
  return true
})

const availableRoles = computed(() => {
  const roles = masterData.getAdminRoles()
  return roles.length > 0
    ? roles
    : [
        { id: 1, name: 'admin', guard_name: 'api' },
        { id: 2, name: 'manager', guard_name: 'api' },
        { id: 3, name: 'staff', guard_name: 'api' },
      ]
})

const resetValid = computed(
  () =>
    resetForm.password.length >= 8 &&
    resetForm.password === resetForm.passwordConfirm,
)

// Load administrators
async function loadAdministrators() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetchAdministrators(auth.accessToken, currentPage.value, perPage.value)
    administrators.value = response.data
    if (response.meta) {
      totalPages.value = response.meta.last_page || 1
    }
  } catch (err) {
    error.value = err.message || 'Failed to load administrators'
  } finally {
    loading.value = false
  }
}

// Initialize master data
async function initializeMasterData() {
  try {
    await masterData.loadMasterData(auth.accessToken)
    // Set default role to first available role
    if (availableRoles.value.length > 0 && !form.roleId) {
      form.roleId = availableRoles.value[0].id
    }
  } catch (err) {
    console.error('Failed to initialize master data:', err)
    // Fallback role will be used from availableRoles computed property
  }
}

// Open create form
function openCreateForm() {
  editingAdmin.value = null
  form.firstName = ''
  form.lastName = ''
  form.email = ''
  form.password = ''
  form.passwordConfirm = ''
  form.roleId = availableRoles.value[0]?.id || 1
  formError.value = ''
  showFormModal.value = true
}

// Open edit form
function openEditForm(admin) {
  editingAdmin.value = admin
  form.firstName = admin.first_name
  form.lastName = admin.last_name
  form.email = admin.email
  form.password = ''
  form.passwordConfirm = ''
  form.roleId = admin.roles?.[0]?.id || availableRoles.value[0]?.id || 1
  formError.value = ''
  showFormModal.value = true
}

// Submit form (create or update)
async function submitForm() {
  if (!formValid.value || formLoading.value) return

  formLoading.value = true
  formError.value = ''

  try {
    const data = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password || undefined,
      roleId: form.roleId,
    }

    if (editingAdmin.value) {
      await updateAdministrator(editingAdmin.value.id, data, auth.accessToken)
    } else {
      await createAdministrator(data, auth.accessToken)
    }

    showFormModal.value = false
    await loadAdministrators()
  } catch (err) {
    formError.value =
      err.errors?.email?.[0] ||
      err.errors?.password?.[0] ||
      err.message ||
      'Failed to save administrator'
  } finally {
    formLoading.value = false
  }
}

// Open delete confirmation
function openDeleteConfirm(admin) {
  confirmAction.type = 'delete'
  confirmAction.target = admin
  showConfirmModal.value = true
}

// Confirm and delete
async function confirmDelete() {
  if (confirmAction.loading || !confirmAction.target) return

  confirmAction.loading = true
  try {
    await deleteAdministrator(confirmAction.target.id, auth.accessToken)
    showConfirmModal.value = false
    await loadAdministrators()
  } catch (err) {
    formError.value = err.message || 'Failed to delete administrator'
    showConfirmModal.value = false
  } finally {
    confirmAction.loading = false
  }
}

// Open password reset
function openResetForm(admin) {
  if (!canResetPassword.value) return
  resetForm.target = admin
  resetForm.password = ''
  resetForm.passwordConfirm = ''
  resetError.value = ''
  resetMessage.value = ''
  showResetModal.value = true
}

// Submit password reset
async function submitReset() {
  if (!resetValid.value || resetLoading.value || !resetForm.target) return

  resetLoading.value = true
  resetError.value = ''

  try {
    await resetAdministratorPassword(resetForm.target.id, resetForm.password, auth.accessToken)
    resetMessage.value = `Password reset for ${resetForm.target.first_name} ${resetForm.target.last_name}.`
    showResetModal.value = false
    setTimeout(() => {
      resetMessage.value = ''
    }, 5000)
  } catch (err) {
    resetError.value = err.errors?.password?.[0] || err.message || 'Failed to reset password'
  } finally {
    resetLoading.value = false
  }
}

// Helper: format name
function formatName(admin) {
  return `${admin.first_name} ${admin.last_name}`
}

// Helper: get initials
function getInitials(admin) {
  return `${admin.first_name.charAt(0)}${admin.last_name.charAt(0)}`.toUpperCase()
}

// Helper: get role badge color
function getRoleColor(role) {
  const colors = {
    'super-admin': 'danger',
    admin: 'info',
  }
  return colors[role] || 'info'
}

// Load on mount
onMounted(async () => {
  await initializeMasterData()
  await loadAdministrators()
})
</script>

<template>
  <div class="page">
    <AppHeader title="Manage Administrators" />

    <div class="page__body">
      <!-- Success message -->
      <p v-if="resetMessage" class="alert alert--success" role="status">
        {{ resetMessage }}
      </p>

      <!-- Error message -->
      <p v-if="error" class="alert alert--error" role="alert">
        {{ error }}
      </p>

      <!-- Toolbar: search + create -->
      <section class="toolbar">
        <label class="search">
          <span class="search__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input
            v-model="search"
            type="search"
            placeholder="Search by name or email..."
            class="search__input"
          />
        </label>

        <BaseButton
          v-if="canCreateAdmin"
          variant="primary"
          :disabled="loading"
          @click="openCreateForm"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke-linecap="round" />
              <circle cx="9.5" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" stroke-linecap="round" />
            </svg>
          </template>
          Add Administrator
        </BaseButton>
      </section>

      <!-- Loading state -->
      <div v-if="loading && administrators.length === 0" class="grid">
        <div v-for="i in 4" :key="i" class="card card--loading">
          <div class="skeleton skeleton--avatar"></div>
          <div class="card__body">
            <div class="skeleton skeleton--text" style="width: 40%; margin-bottom: 0.5rem"></div>
            <div class="skeleton skeleton--text" style="width: 60%; height: 0.6rem"></div>
          </div>
        </div>
      </div>

      <!-- Administrators grid -->
      <section v-else class="grid">
        <article
          v-for="admin in filtered"
          :key="admin.id"
          class="card"
          :class="{ 'card--loading': loading }"
        >
          <span class="card__avatar">
            <img
              v-if="admin.avatar"
              :src="admin.avatar"
              :alt="formatName(admin)"
              class="card__avatar-img"
            />
            <span v-else class="card__avatar-initials">{{ getInitials(admin) }}</span>
          </span>

          <div class="card__body">
            <h3 class="card__name">{{ formatName(admin) }}</h3>
            <p class="card__email">{{ admin.email }}</p>
            <div class="card__meta">
              <span
                v-for="role in admin.roles"
                :key="role.id"
                class="badge"
                :class="`badge--${getRoleColor(role.name)}`"
              >
                {{ role.name.replace('-', ' ') }}
              </span>
              <span v-if="admin.is_active" class="status status--active">
                <span class="status__dot"></span>
                Active
              </span>
              <span v-else class="status status--inactive">
                <span class="status__dot"></span>
                Inactive
              </span>
            </div>
          </div>

          <div class="card__actions">
            <button
              v-if="canResetPassword && admin.id !== auth.user?.id"
              type="button"
              class="icon-btn"
              :title="`Reset password for ${formatName(admin)}`"
              @click="openResetForm(admin)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="7.5" cy="15.5" r="3.5" />
                <path d="m10 13 8-8M15 5l4 4M18 3l3 3" stroke-linecap="round" />
              </svg>
            </button>

            <button
              v-if="canEditAdmin && admin.id !== auth.user?.id"
              type="button"
              class="icon-btn"
              title="Edit administrator"
              @click="openEditForm(admin)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            <button
              v-if="canDeleteAdmin && admin.id !== auth.user?.id"
              type="button"
              class="icon-btn icon-btn--danger"
              title="Delete administrator"
              @click="openDeleteConfirm(admin)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        </article>

        <p v-if="filtered.length === 0 && !loading" class="grid__empty">
          No administrators found.
        </p>
      </section>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <BaseButton
          :disabled="currentPage === 1 || loading"
          variant="ghost"
          @click="currentPage--; loadAdministrators()"
        >
          Previous
        </BaseButton>
        <span class="pagination__info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <BaseButton
          :disabled="currentPage === totalPages || loading"
          variant="ghost"
          @click="currentPage++; loadAdministrators()"
        >
          Next
        </BaseButton>
      </div>
    </div>

    <!-- Create/Edit Modal - Enhanced Layout -->
    <Teleport to="body">
      <div v-if="showFormModal" class="modal" @click.self="showFormModal = false">
        <div class="modal__dialog modal__dialog--enhanced" role="dialog" aria-modal="true">
          <header class="modal__head modal__head--enhanced">
            <div>
              <button
                type="button"
                class="modal__back"
                :disabled="formLoading"
                @click="showFormModal = false"
              >
                ← BACK TO ADMINISTRATORS
              </button>
              <h2 class="modal__title modal__title--enhanced">
                {{ editingAdmin ? `Edit ${formatName(editingAdmin)}` : 'Add Administrator' }}
              </h2>
            </div>
          </header>

          <form class="modal__body modal__body--enhanced" @submit.prevent="submitForm">
            <!-- Left Column: Form Fields -->
            <div class="form__column form__column--left">
              <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>

              <!-- Basic Information Section -->
              <div class="form__section">
                <h3 class="form__section-title">Basic Information</h3>

                <div class="form-row">
                  <label class="field">
                    <span class="field__label">FIRST NAME *</span>
                    <input
                      v-model="form.firstName"
                      type="text"
                      class="field__input"
                      placeholder="e.g. John"
                      required
                    />
                  </label>

                  <label class="field">
                    <span class="field__label">LAST NAME *</span>
                    <input
                      v-model="form.lastName"
                      type="text"
                      class="field__input"
                      placeholder="e.g. Doe"
                      required
                    />
                  </label>
                </div>

                <label class="field">
                  <span class="field__label">EMAIL ADDRESS *</span>
                  <input
                    v-model="form.email"
                    type="email"
                    class="field__input"
                    placeholder="you@example.com"
                    required
                  />
                </label>
              </div>

              <!-- Role Section -->
              <div class="form__section">
                <h3 class="form__section-title">Role Assignment</h3>

                <label class="field">
                  <span class="field__label">
                    ROLE *
                    <span v-if="masterData.isLoading" class="field__loading" aria-live="polite">
                      (Loading roles...)
                    </span>
                    <span v-else-if="masterData.hasError" class="field__loading field__loading--error" aria-live="assertive">
                      (Error loading roles)
                    </span>
                  </span>
                  <select
                    v-model.number="form.roleId"
                    class="field__input field__select"
                    :class="{ 'field__input--error': masterData.hasError }"
                    required
                    :disabled="masterData.isLoading"
                    aria-describedby="role-error"
                  >
                    <option :value="null" disabled>
                      {{ masterData.isLoading ? 'Loading roles...' : availableRoles.length === 0 ? 'No roles available' : 'Select a role' }}
                    </option>
                    <option
                      v-for="role in availableRoles"
                      :key="role.id"
                      :value="role.id"
                    >
                      {{ formatRoleName(role.name) }}
                    </option>
                  </select>
                  <span id="role-error" class="field__error">
                    <span v-if="masterData.hasError">
                      Failed to load roles. Using defaults. Please try again or contact support.
                    </span>
                    <span v-else-if="!form.roleId && showFormModal">
                      Please select a role
                    </span>
                  </span>
                  <p class="field__help">
                    Select the administrator's role: Admin (full access), Manager (content management), or Staff (limited access)
                  </p>
                </label>
              </div>

              <!-- Security Section -->
              <div class="form__section">
                <h3 class="form__section-title">Security</h3>

                <label class="field">
                  <span class="field__label">
                    PASSWORD {{ editingAdmin ? '(leave blank to keep current)' : '*' }}
                  </span>
                  <input
                    v-model="form.password"
                    type="password"
                    class="field__input"
                    placeholder="••••••••"
                    :required="!editingAdmin"
                    minlength="8"
                  />
                  <span v-if="form.password" class="field__hint">Minimum 8 characters required</span>
                </label>

                <label class="field">
                  <span class="field__label">CONFIRM PASSWORD</span>
                  <input
                    v-model="form.passwordConfirm"
                    type="password"
                    class="field__input"
                    placeholder="••••••••"
                    minlength="8"
                  />
                  <span
                    v-if="form.password && form.password !== form.passwordConfirm"
                    class="field__error"
                  >
                    Passwords do not match
                  </span>
                </label>
              </div>
            </div>

            <!-- Right Column: Sidebar -->
            <div class="form__column form__column--right">
              <div class="form__sidebar">
                <!-- Admin Profile Card -->
                <div class="admin-card">
                  <div class="admin-card__avatar">
                    <span v-if="form.firstName && form.lastName" class="admin-card__initials">
                      {{ form.firstName.charAt(0) }}{{ form.lastName.charAt(0) }}
                    </span>
                    <span v-else class="admin-card__placeholder">?</span>
                  </div>
                  <h3 class="admin-card__name">
                    {{ form.firstName && form.lastName ? `${form.firstName} ${form.lastName}` : 'New Administrator' }}
                  </h3>
                  <p class="admin-card__email">{{ form.email || 'email@example.com' }}</p>
                  <BaseButton variant="secondary" class="admin-card__button">
                    📷 Upload Photo
                  </BaseButton>
                </div>

                <!-- Role Badge -->
                <div class="form__info-box">
                  <p class="form__info-label">ASSIGNED ROLE</p>
                  <div v-if="form.roleId" class="role-badge">
                    {{ formatRoleName(availableRoles.find(r => r.id === form.roleId)?.name || 'Select role') }}
                  </div>
                  <div v-else class="role-badge role-badge--empty">
                    Not assigned
                  </div>
                </div>

                <!-- Status Info -->
                <div class="form__info-box">
                  <p class="form__info-label">ACCOUNT STATUS</p>
                  <p class="form__status-info">Active administrators can log in and access the system</p>
                </div>
              </div>
            </div>
          </form>

          <!-- Footer -->
          <footer class="modal__foot modal__foot--enhanced">
            <BaseButton
              variant="ghost"
              type="button"
              :disabled="formLoading"
              @click="showFormModal = false"
            >
              Cancel
            </BaseButton>
            <BaseButton variant="primary" type="submit" :disabled="!formValid || formLoading">
              {{ formLoading ? 'Saving...' : editingAdmin ? 'Update Administrator' : 'Create Administrator' }}
            </BaseButton>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- Password Reset Modal -->
    <Teleport to="body">
      <div v-if="showResetModal" class="modal" @click.self="showResetModal = false">
        <div class="modal__dialog" role="dialog" aria-modal="true">
          <header class="modal__head">
            <h2 class="modal__title">Reset Administrator Password</h2>
            <button
              type="button"
              class="modal__close"
              :disabled="resetLoading"
              @click="showResetModal = false"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <form class="modal__body" @submit.prevent="submitReset">
            <p class="reset-info">
              Set a new password for
              <strong>{{ resetForm.target ? formatName(resetForm.target) : '' }}</strong>
              . Their active admin sessions will be signed out.
            </p>

            <p v-if="resetError" class="alert alert--error" role="alert">{{ resetError }}</p>

            <label class="field">
              <span class="field__label">New Password *</span>
              <input
                v-model="resetForm.password"
                type="password"
                class="field__input"
                placeholder="••••••••"
                minlength="8"
                required
              />
            </label>

            <label class="field">
              <span class="field__label">Confirm Password *</span>
              <input
                v-model="resetForm.passwordConfirm"
                type="password"
                class="field__input"
                placeholder="••••••••"
                minlength="8"
                required
              />
              <span
                v-if="resetForm.passwordConfirm && resetForm.password !== resetForm.passwordConfirm"
                class="field__error"
              >
                Passwords do not match
              </span>
            </label>

            <footer class="modal__foot">
              <BaseButton
                variant="ghost"
                type="button"
                :disabled="resetLoading"
                @click="showResetModal = false"
              >
                Cancel
              </BaseButton>
              <BaseButton variant="primary" type="submit" :disabled="!resetValid || resetLoading">
                {{ resetLoading ? 'Resetting...' : 'Reset Password' }}
              </BaseButton>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showConfirmModal" class="modal" @click.self="showConfirmModal = false">
        <div class="modal__dialog modal__dialog--sm" role="dialog" aria-modal="true">
          <header class="modal__head">
            <h2 class="modal__title">Confirm Delete</h2>
          </header>

          <div class="modal__body">
            <p class="confirm-text">
              Are you sure you want to delete
              <strong>{{ confirmAction.target ? formatName(confirmAction.target) : '' }}</strong
              >? This action cannot be undone.
            </p>
          </div>

          <footer class="modal__foot modal__foot--danger">
            <BaseButton
              variant="ghost"
              type="button"
              :disabled="confirmAction.loading"
              @click="showConfirmModal = false"
            >
              Cancel
            </BaseButton>
            <BaseButton
              variant="danger"
              type="button"
              :disabled="confirmAction.loading"
              @click="confirmDelete"
            >
              {{ confirmAction.loading ? 'Deleting...' : 'Delete' }}
            </BaseButton>
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
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: var(--bg);
  }
}

.alert {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
  animation: slideIn 0.3s ease-out;

  &--success {
    background: var(--success-bg);
    border: 1px solid var(--success-border);
    color: var(--success);
  }

  &--error {
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;
}

.search {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 220px;
  max-width: 420px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 0.85rem;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--accent);
  }

  &__icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg {
      width: 16px;
      height: 16px;
    }
  }

  &__input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.5rem 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);

    &:focus {
      outline: none;
    }

    &::placeholder {
      color: var(--text-subtle);
    }
  }
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;

  &__empty {
    grid-column: 1 / -1;
    margin: 0;
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.9rem;
    padding: 3rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
  }
}

/* Card */
.card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;
  transition: all 0.15s ease;

  &:hover:not(.card--loading) {
    border-color: var(--border);
    box-shadow: 0 4px 12px rgba(20, 23, 28, 0.08);
  }

  &--loading {
    pointer-events: none;
    opacity: 0.6;
  }

  &__avatar {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 700;

    &-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &-initials {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-strong);
    word-break: break-word;
  }

  &__email {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-subtle);
    word-break: break-all;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.2rem;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }
}

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  border-radius: 6px;
  white-space: nowrap;

  &--info {
    color: var(--info);
    background: var(--info-bg);
  }

  &--danger {
    color: var(--danger);
    background: var(--danger-bg);
  }
}

/* Status */
.status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-subtle);

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &--active {
    color: var(--success);
    .status__dot {
      background: var(--success);
    }
  }

  &--inactive {
    color: var(--text-subtle);
    .status__dot {
      background: var(--text-subtle);
    }
  }
}

/* Icon button */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  color: var(--text-body);
  cursor: pointer;
  transition: all 0.15s ease;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--border);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--danger {
    color: var(--danger);
    border-color: var(--danger-border);

    &:hover:not(:disabled) {
      background: var(--danger-bg);
      border-color: var(--danger);
    }
  }
}

/* Skeleton loaders */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--border-subtle) 25%,
    var(--border) 50%,
    var(--border-subtle) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;

  &--avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &--text {
    width: 100%;
    height: 0.8rem;
    border-radius: 4px;
  }
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;

  &__info {
    font-size: 0.9rem;
    color: var(--text-subtle);
    min-width: 150px;
    text-align: center;
  }
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--backdrop);
  animation: fadeIn 0.2s ease-out;

  &__dialog {
    width: 100%;
    max-width: 500px;
    background: var(--surface);
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(20, 23, 28, 0.3);
    overflow: hidden;
    animation: slideUp 0.3s ease-out;

    &--sm {
      max-width: 400px;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-strong);
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
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      background: var(--bg);
      color: var(--text-strong);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;

    &--danger {
      justify-content: space-between;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Form fields */
.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-body);
    text-transform: capitalize;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__loading {
    font-size: 0.75rem;
    color: var(--text-subtle);
    font-weight: 400;
    text-transform: none;
    animation: pulse 1.5s infinite;

    &--error {
      color: var(--danger);
      animation: none;
    }
  }

  &__input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--bg);
    transition: border-color 0.15s ease;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--surface);
    }

    &--error {
      border-color: var(--danger);

      &:focus {
        border-color: var(--danger);
        box-shadow: 0 0 0 3px rgba(var(--danger-rgb, 239, 68, 68), 0.1);
      }
    }

    &::placeholder {
      color: var(--text-subtle);
    }

    option {
      color: var(--text-strong);
      background: var(--surface);
      padding: 0.5rem;

      &:hover {
        background: var(--accent);
        color: white;
      }

      &:disabled {
        color: var(--text-muted);
        background: var(--bg);
      }
    }
  }

  &__hint {
    font-size: 0.75rem;
    color: var(--text-subtle);
  }

  &__error {
    font-size: 0.75rem;
    color: var(--danger);
    animation: slideIn 0.3s ease-out;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.reset-info,
.confirm-text {
  margin: 0;
  color: var(--text-body);
  line-height: 1.5;
  font-size: 0.9rem;

  strong {
    font-weight: 700;
    color: var(--text-strong);
  }
}

/* Enhanced Modal Layout */
.modal__dialog--enhanced {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.modal__head--enhanced {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.modal__back {
  display: inline-flex;
  align-items: center;
  background: transparent;
  border: none;
  color: var(--text-subtle);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0;
  transition: color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--text-strong);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.modal__title--enhanced {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-strong);
  word-break: break-word;
}

.modal__body--enhanced {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal__foot--enhanced {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg);
}

/* Form Columns */
.form__column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &--left {
    flex: 1;
    min-width: 0;
  }

  &--right {
    flex: 0 0 300px;
  }
}

/* Form Sections */
.form__section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;

  &-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-strong);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

/* Sidebar */
.form__sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1.5rem;
}

.form__info-box {
  padding: 1rem;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form__info-label {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form__status-info {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-body);
  line-height: 1.4;
}

/* Admin Profile Card */
.admin-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent) 100%);
  border-radius: 14px;
  color: white;
  text-align: center;

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  &__initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__name {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    word-break: break-word;
    line-height: 1.2;
  }

  &__email {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.85);
    word-break: break-all;
  }

  &__button {
    width: 100%;
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }
}

/* Role Badge */
.role-badge {
  padding: 0.5rem 0.75rem;
  background: var(--accent);
  color: white;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;

  &--empty {
    background: var(--border-subtle);
    color: var(--text-subtle);
  }
}

/* Field Helpers */
.field__select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 1.25em 1.25em;
  padding-right: 2rem;

  &:disabled {
    opacity: 0.6;
  }
}

.field__help {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  color: var(--text-subtle);
  line-height: 1.4;
}

/* Responsive */
@media (max-width: 900px) {
  .modal__dialog--enhanced {
    max-width: 100%;
  }

  .modal__body--enhanced {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .form__column--right {
    flex: 0 0 auto;
  }

  .form__sidebar {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .admin-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .page__body {
    padding: 1rem;
    gap: 1rem;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search {
    max-width: 100%;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .card {
    flex-direction: row;
    align-items: center;

    &__meta {
      flex-wrap: nowrap;
      overflow-x: auto;
    }
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .form__section {
    padding: 1rem;
  }

  .admin-card {
    padding: 1rem;
  }

  .modal__foot--enhanced {
    flex-direction: column;
  }

  .modal__foot--enhanced > * {
    width: 100%;
  }

  .form__sidebar {
    grid-template-columns: 1fr;
  }
}
</style>
