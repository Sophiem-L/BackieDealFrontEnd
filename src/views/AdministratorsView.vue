<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  fetchAdministrators,
  fetchAdministrator,
  createAdministrator,
  updateAdministrator,
  deleteAdministrator,
  resetAdministratorPassword,
} from '@/services/administrators'
import { fetchRolePermissions, formatRoleName } from '@/services/masterData'
import { useAuthStore } from '@/stores/auth'
import { useMasterDataStore } from '@/stores/masterData'

// State
const auth = useAuthStore()
const masterData = useMasterDataStore()
const router = useRouter()
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
  phone: '',
  recoveryEmail: '',
  password: '',
  passwordConfirm: '',
  roleId: null,
  isActive: true,
})
const rolePermissionNames = ref([])
const rolePermissionsLoading = ref(false)
const rolePermissionsError = ref('')

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

// Detail state
const detailAdmin = ref(null)
const detailLoading = ref(false)
const detailError = ref('')

// Confirmation modal
const showConfirmModal = ref(false)
const confirmAction = reactive({
  type: '', // 'delete' or 'reset'
  target: null,
  loading: false,
})

// Computed properties
const canViewAdmin = computed(() => auth.hasPermission('administrators.view'))

const canResetPassword = computed(() => auth.hasPermission('administrators.password-reset'))
const canCreateAdmin = computed(() => auth.hasPermission('administrators.create'))
const canEditAdmin = computed(() => auth.hasPermission('administrators.update'))
const canDeleteAdmin = computed(() => auth.hasPermission('administrators.delete'))
const isEditingSelf = computed(() =>
  Boolean(
    editingAdmin.value &&
    auth.user?.id != null &&
    String(editingAdmin.value.id) === String(auth.user.id),
  ),
)

const detailPermissionGroups = computed(() => {
  const groupLabels = {
    admin: 'Account & authentication',
    administrators: 'Administrators',
    banners: 'Banners',
    brands: 'Brands',
    categories: 'Categories',
    client: 'Customer access',
    content: 'Website content',
    customers: 'Customers',
    dashboard: 'Dashboard',
    logs: 'Activity logs',
    media: 'Media',
    orders: 'Orders',
    permissions: 'Permissions',
    product: 'Products',
    'product-serials': 'Product serials',
    products: 'Products',
    promotions: 'Promotions',
    roles: 'Roles',
    settings: 'Settings',
    stock: 'Stock management',
    users: 'Users',
  }

  const groups = new Map()

  for (const permission of Array.isArray(detailAdmin.value?.permissions) ? detailAdmin.value.permissions : []) {
    const [resource, action] = permission.split('.')
    const key = resource || 'unknown'
    const normalizedResource = key === 'product' ? 'products' : key
    const group = groups.get(normalizedResource) || {
      key: normalizedResource,
      label: groupLabels[normalizedResource] || formatPermissionResource(normalizedResource),
      permissions: [],
    }

    group.permissions.push({
      name: permission,
      action: action || 'access',
    })
    groups.set(normalizedResource, group)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => group)
})

const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase()
  if (!q) return administrators.value
  return administrators.value.filter(
    (admin) =>
      `${admin.first_name} ${admin.last_name}`.toLocaleLowerCase().includes(q) ||
      admin.email.toLocaleLowerCase().includes(q),
  )
})

const adminRows = computed(() =>
  filtered.value.map((admin) => {
    const firstName = admin.first_name || ''
    const lastName = admin.last_name || ''
    const roles = Array.isArray(admin.roles) ? admin.roles : []

    return {
      source: admin,
      id: admin.id,
      name: `${firstName} ${lastName}`.trim() || admin.name || admin.email || 'Administrator',
      initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?',
      email: admin.email || 'No email provided',
      avatar: admin.avatar,
      roles: roles.map((role) => ({
        id: role.id,
        label: formatRoleName(role.name),
        color: role.name === 'super-admin' ? 'danger' : 'info',
      })),
      isActive: admin.is_active,
    }
  }),
)

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

const permissionGroups = computed(() => {
  const groupLabels = {
    admin: 'Account & authentication', administrators: 'Administrators', banners: 'Banners',
    brands: 'Brands', categories: 'Categories', client: 'Customer access', content: 'Website content',
    customers: 'Customers', dashboard: 'Dashboard', logs: 'Activity logs', media: 'Media', orders: 'Orders',
    permissions: 'Permissions', product: 'Products', 'product-serials': 'Product serials', products: 'Products',
    promotions: 'Promotions', roles: 'Roles', settings: 'Settings', stock: 'Stock management', users: 'Users',
  }
  const groups = new Map()

  for (const name of rolePermissionNames.value) {
    const [resource = 'unknown', action = 'access'] = name.split('.')
    const key = resource === 'product' ? 'products' : resource
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: groupLabels[key] || formatPermissionResource(key),
        permissions: [],
      })
    }
    groups.get(key).permissions.push({
      name,
      action,
    })
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group)
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
    const payload = response?.data
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
    const meta = Array.isArray(payload) ? null : payload?.meta

    administrators.value = items
    totalPages.value = meta?.last_page || 1
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
  form.phone = ''
  form.recoveryEmail = ''
  form.password = ''
  form.passwordConfirm = ''
  form.roleId = availableRoles.value[0]?.id || 1
  form.isActive = true
  formError.value = ''
  rolePermissionNames.value = []
  showFormModal.value = true
}

// Open edit form
async function openEditForm(admin) {
  editingAdmin.value = admin
  form.firstName = admin.first_name || ''
  form.lastName = admin.last_name || ''
  form.email = admin.email || ''
  form.phone = admin.phone || ''
  form.recoveryEmail = admin.recovery_email || ''
  form.password = ''
  form.passwordConfirm = ''
  const assignedRole = admin.roles?.[0]
  const assignedRoleId = typeof assignedRole === 'object'
    ? assignedRole?.id
    : availableRoles.value.find((role) => role.name === assignedRole)?.id
  form.roleId = assignedRoleId || availableRoles.value[0]?.id || 1
  form.isActive = Boolean(admin.is_active)
  formError.value = ''
  closeDetail()
  await loadRolePermissions(form.roleId)
  showFormModal.value = true
}

function closeForm() {
  if (formLoading.value) return
  showFormModal.value = false
  editingAdmin.value = null
  rolePermissionsError.value = ''
}

async function loadRolePermissions(roleId) {
  rolePermissionsLoading.value = true
  rolePermissionsError.value = ''
  rolePermissionNames.value = []
  try {
    const permissions = await fetchRolePermissions(roleId, auth.accessToken)
    rolePermissionNames.value = permissions
      .map((permission) => typeof permission === 'string' ? permission : permission?.name)
      .filter(Boolean)
  } catch (err) {
    rolePermissionsError.value = err.message || 'Unable to load role permissions.'
  } finally {
    rolePermissionsLoading.value = false
  }
}

function closeDetail() {
  detailAdmin.value = null
  detailError.value = ''
}

async function openDetail(admin) {
  if (!canViewAdmin.value) return

  detailLoading.value = true
  detailError.value = ''
  detailAdmin.value = admin

  try {
    const response = await fetchAdministrator(admin.id, auth.accessToken)
    detailAdmin.value = response?.data || admin
  } catch (err) {
    detailError.value = err.message || 'Failed to load administrator details.'
  } finally {
    detailLoading.value = false
  }
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
      phone: form.phone.trim(),
      recoveryEmail: form.recoveryEmail.trim(),
      password: form.password || undefined,
      passwordConfirm: form.passwordConfirm || undefined,
      roleId: form.roleId,
      isActive: form.isActive,
    }

    if (editingAdmin.value) {
      await updateAdministrator(editingAdmin.value.id, data, auth.accessToken)
    } else {
      await createAdministrator(data, auth.accessToken)
    }

    const changedOwnPassword = isEditingSelf.value && Boolean(data.password)
    showFormModal.value = false

    if (changedOwnPassword) {
      await auth.logout()
      await router.replace({ name: 'login' })
      return
    }

    editingAdmin.value = null
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
    closeDetail()
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

function formatPermissionResource(resource) {
  return resource
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatPermissionAction(action) {
  return action
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// Helper: get initials
function getInitials(admin) {
  return `${admin.first_name.charAt(0)}${admin.last_name.charAt(0)}`.toUpperCase()
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

    <div id="administrator-page-body" class="page__body" :class="{ 'page__body--editing': Boolean(editingAdmin) }">
      <!-- Success message -->
      <p v-if="resetMessage" class="alert alert--success" role="status">
        {{ resetMessage }}
      </p>

      <!-- Error message -->
      <p v-if="error" class="alert alert--error" role="alert">
        {{ error }}
      </p>

      <!-- Administrator detail page -->
      <section v-if="detailAdmin" class="detail-page" aria-labelledby="administrator-detail-title">
        <nav class="detail-breadcrumb" aria-label="Breadcrumb">
          <button type="button" class="detail-breadcrumb__link" @click="closeDetail">
            Administrators
          </button>
          <span aria-hidden="true">/</span>
          <span>{{ detailAdmin.name || formatName(detailAdmin) }}</span>
        </nav>

        <div v-if="detailLoading" class="detail-loading-card" aria-live="polite">
          <div class="detail-loading-card__profile">
            <span class="skeleton skeleton--avatar"></span>
            <div class="detail-loading-card__copy">
              <span class="skeleton skeleton--text skeleton--text--name"></span>
              <span class="skeleton skeleton--text skeleton--text--email"></span>
            </div>
          </div>
          <div class="detail-loading-card__grid">
            <span class="skeleton skeleton--text"></span>
            <span class="skeleton skeleton--text"></span>
            <span class="skeleton skeleton--text"></span>
            <span class="skeleton skeleton--text"></span>
          </div>
        </div>

        <div v-else-if="detailError" class="detail-error-card" role="alert">
          <span class="detail-error-card__icon" aria-hidden="true">!</span>
          <div>
            <h2>Unable to load administrator</h2>
            <p>{{ detailError }}</p>
          </div>
          <BaseButton variant="secondary" type="button" @click="closeDetail">Back to administrators</BaseButton>
        </div>

        <template v-else>
          <div class="detail-page__header">
            <div class="detail-page__identity">
              <span class="detail-page__avatar">
                <img
                  v-if="detailAdmin.avatar"
                  :src="detailAdmin.avatar"
                  :alt="detailAdmin.name || formatName(detailAdmin)"
                />
                <span v-else>{{ getInitials(detailAdmin) }}</span>
              </span>
              <div>
                <div class="detail-page__eyebrow">Administrator profile</div>
                <h1 id="administrator-detail-title">{{ detailAdmin.name || formatName(detailAdmin) }}</h1>
                <p>{{ detailAdmin.email || 'No email provided' }}</p>
              </div>
            </div>

            <div class="detail-page__actions">
              <BaseButton variant="ghost" type="button" @click="closeDetail">
                <template #icon>←</template>
                Back to list
              </BaseButton>
              <BaseButton
                v-if="canEditAdmin"
                variant="primary"
                type="button"
                @click="openEditForm(detailAdmin)"
              >
                Edit administrator
              </BaseButton>
            </div>
          </div>

          <div class="detail-layout">
            <div class="detail-main">
              <section class="detail-card">
                <div class="detail-card__heading">
                  <div>
                    <span class="detail-card__eyebrow">Account</span>
                    <h2>Account information</h2>
                  </div>
                  <span
                    class="status status--active"
                    :class="detailAdmin.is_active ? 'status--active' : 'status--inactive'"
                  >
                    <span class="status__dot"></span>
                    {{ detailAdmin.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>

                <dl class="detail-list">
                  <div class="detail-list__item">
                    <dt>Full name</dt>
                    <dd>{{ detailAdmin.name || formatName(detailAdmin) }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Email address</dt>
                    <dd>{{ detailAdmin.email || 'Not provided' }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Phone number</dt>
                    <dd>{{ detailAdmin.phone || 'Not provided' }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Account type</dt>
                    <dd>{{ detailAdmin.is_admin ? 'Administrator' : 'User' }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Super administrator</dt>
                    <dd>{{ detailAdmin.is_super_admin ? 'Yes' : 'No' }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Last login</dt>
                    <dd>{{ detailAdmin.last_login_at ? new Date(detailAdmin.last_login_at).toLocaleString() : 'Never' }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Created</dt>
                    <dd>{{ detailAdmin.created_at ? new Date(detailAdmin.created_at).toLocaleString() : '—' }}</dd>
                  </div>
                  <div class="detail-list__item">
                    <dt>Updated</dt>
                    <dd>{{ detailAdmin.updated_at ? new Date(detailAdmin.updated_at).toLocaleString() : '—' }}</dd>
                  </div>
                </dl>
              </section>

              <section class="detail-card">
                <div class="detail-card__heading">
                  <div>
                    <span class="detail-card__eyebrow">Access</span>
                    <h2>Roles & permissions</h2>
                  </div>
                </div>
                <div class="detail-role-section">
                  <span class="detail-label">Assigned roles</span>
                  <div v-if="detailAdmin.roles?.length" class="role-chip-list">
                    <span v-for="role in detailAdmin.roles" :key="role.id" class="role-chip">
                      {{ formatRoleName(role.name) }}
                    </span>
                  </div>
                  <p v-else class="detail-empty">No role assigned.</p>
                </div>
                <div class="detail-permission-section">
                  <span class="detail-label">System permissions</span>
                  <div v-if="detailPermissionGroups.length" class="permission-groups">
                    <section v-for="group in detailPermissionGroups" :key="group.key" class="permission-group">
                      <h3>{{ group.label }}</h3>
                      <div class="permission-list">
                        <span v-for="permission in group.permissions" :key="permission.name" class="permission-chip">
                          {{ formatPermissionAction(permission.action) }}
                          <span class="permission-chip__resource">{{ permission.name.split('.')[0] }}</span>
                        </span>
                      </div>
                    </section>
                  </div>
                  <p v-else class="detail-empty">No permissions assigned.</p>
                </div>
              </section>
            </div>

            <aside class="detail-sidebar">
              <section class="detail-card detail-card--security">
                <div class="detail-card__heading">
                  <div>
                    <span class="detail-card__eyebrow">Security</span>
                    <h2>Account security</h2>
                  </div>
                </div>
                <ul class="security-list">
                  <li>
                    <span class="security-list__icon" aria-hidden="true">✓</span>
                    <span><strong>Active account</strong><small>{{ detailAdmin.is_active ? 'Ready to sign in' : 'Account is disabled' }}</small></span>
                  </li>
                  <li>
                    <span class="security-list__icon" aria-hidden="true">✓</span>
                    <span><strong>Secure profile</strong><small>Passwords are never exposed</small></span>
                  </li>
                  <li>
                    <span class="security-list__icon" aria-hidden="true">✓</span>
                    <span><strong>Session protection</strong><small>Active sessions are revoked on password reset</small></span>
                  </li>
                </ul>
              </section>

              <section class="detail-card detail-card--actions">
                <div class="detail-card__heading">
                  <div>
                    <span class="detail-card__eyebrow">Manage</span>
                    <h2>Account actions</h2>
                  </div>
                </div>
                <div class="detail-action-list">
                  <BaseButton
                    v-if="canResetPassword && detailAdmin.id !== auth.user?.id"
                    variant="secondary"
                    type="button"
                    class="detail-action-button"
                    @click="openResetForm(detailAdmin)"
                  >
                    Reset password
                  </BaseButton>
                  <BaseButton
                    v-if="canEditAdmin"
                    variant="secondary"
                    type="button"
                    class="detail-action-button"
                    @click="openEditForm(detailAdmin)"
                  >
                    Edit profile
                  </BaseButton>
                  <BaseButton
                    v-if="canDeleteAdmin && detailAdmin.id !== auth.user?.id"
                    variant="danger"
                    type="button"
                    class="detail-action-button"
                    @click="openDeleteConfirm(detailAdmin)"
                  >
                    Delete account
                  </BaseButton>
                </div>
              </section>
            </aside>
          </div>
        </template>
      </section>

      <!-- List content -->
      <template v-if="!detailAdmin && !editingAdmin">
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
      <section v-if="loading && administrators.length === 0" class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Administrator</th>
              <th>Role</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 4" :key="i" class="table__row table__row--loading">
              <td>
                <div class="administrator">
                  <span class="skeleton skeleton--avatar"></span>
                  <span class="administrator__meta">
                    <span class="skeleton skeleton--text skeleton--text--name"></span>
                    <span class="skeleton skeleton--text skeleton--text--email"></span>
                  </span>
                </div>
              </td>
              <td><span class="skeleton skeleton--text skeleton--text--badge"></span></td>
              <td><span class="skeleton skeleton--text skeleton--text--badge"></span></td>
              <td><span class="skeleton skeleton--text skeleton--text--action"></span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Administrators list -->
      <section v-else class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Administrator</th>
              <th>Role</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="admin in adminRows"
              :key="admin.id"
              v-memo="[admin, loading, canViewAdmin, canResetPassword, canEditAdmin, canDeleteAdmin, auth.user?.id]"
              class="table__row"
              :class="{ 'table__row--busy': loading }"
            >
              <td>
                <div class="administrator">
                  <span class="administrator__avatar">
                    <img
                      v-if="admin.avatar"
                      :src="admin.avatar"
                      :alt="admin.name"
                      class="administrator__avatar-img"
                    />
                    <span v-else class="administrator__avatar-initials">{{ admin.initials }}</span>
                  </span>
                  <span class="administrator__meta">
                    <strong class="administrator__name">{{ admin.name }}</strong>
                    <span class="administrator__email">{{ admin.email }}</span>
                  </span>
                </div>
              </td>
              <td>
                <span
                  v-for="role in admin.roles"
                  :key="role.id"
                  class="badge"
                  :class="`badge--${role.color}`"
                >
                  {{ role.label }}
                </span>
              </td>
              <td>
                <span v-if="admin.isActive" class="status status--active">
                  <span class="status__dot"></span>
                  Active
                </span>
                <span v-else class="status status--inactive">
                  <span class="status__dot"></span>
                  Inactive
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    v-if="canViewAdmin"
                    type="button"
                    class="icon-btn"
                    :title="`View details for ${admin.name}`"
                    :aria-label="`View details for ${admin.name}`"
                    @click="openDetail(admin.source)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                  <button
                    v-if="canResetPassword && admin.id !== auth.user?.id"
                    type="button"
                    class="icon-btn"
                    :title="`Reset password for ${admin.name}`"
                    :aria-label="`Reset password for ${admin.name}`"
                    @click="openResetForm(admin.source)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="7.5" cy="15.5" r="3.5" />
                      <path d="m10 13 8-8M15 5l4 4M18 3l3 3" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    v-if="canEditAdmin"
                    type="button"
                    class="icon-btn"
                    :title="`Edit ${admin.name}`"
                    :aria-label="`Edit ${admin.name}`"
                    @click="openEditForm(admin.source)"
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
                    aria-label="Delete administrator"
                    @click="openDeleteConfirm(admin.source)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="adminRows.length === 0 && !loading">
              <td colspan="4" class="table__empty">No administrators found.</td>
            </tr>
          </tbody>
        </table>
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
      </template>
    </div>

    <!-- Create/Edit Modal - Enhanced Layout -->
    <Teleport :to="editingAdmin ? '#administrator-page-body' : 'body'">
      <div v-if="showFormModal" class="modal" :class="{ 'modal--page': editingAdmin }" @click.self="!editingAdmin && closeForm()">
        <div
          class="modal__dialog modal__dialog--enhanced"
          :class="{ 'modal__dialog--page': editingAdmin }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="administrator-form-title"
        >
          <header class="modal__head modal__head--enhanced">
            <div>
              <button
                type="button"
                class="modal__back"
                :disabled="formLoading"
                @click="closeForm"
              >
                ← BACK TO ADMINISTRATORS
              </button>
              <h2 id="administrator-form-title" class="modal__title modal__title--enhanced">
                {{ editingAdmin ? `Edit ${formatName(editingAdmin)}` : 'Add Administrator' }}
              </h2>
            </div>
          </header>

          <form id="administrator-form" class="modal__body modal__body--enhanced" @submit.prevent="submitForm">
            <!-- Left Column: Form Fields -->
            <div class="form__column form__column--left">
              <p v-if="formError" class="alert alert--error" role="alert">{{ formError }}</p>

              <!-- Basic Information Section -->
              <div class="form__section">
                <h3 class="form__section-title">Administrator Profile</h3>

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
                    :readonly="Boolean(editingAdmin)"
                  />
                  <span v-if="editingAdmin" class="field__hint">Email addresses cannot be changed here.</span>
                </label>

                <label class="field">
                  <span class="field__label">PHONE NUMBER</span>
                  <input
                    v-model="form.phone"
                    type="tel"
                    class="field__input"
                    placeholder="Add a phone number"
                  />
                </label>

                <label class="field">
                  <span class="field__label">RECOVERY EMAIL</span>
                  <input
                    v-model="form.recoveryEmail"
                    type="email"
                    class="field__input"
                    placeholder="recovery@example.com"
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
                    :disabled="masterData.isLoading || isEditingSelf"
                    aria-describedby="role-error"
                    @change="editingAdmin && loadRolePermissions(form.roleId)"
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
                  <p v-if="isEditingSelf" class="field__help">
                    Your own role cannot be changed here.
                  </p>
                </label>

              </div>

              <section v-if="editingAdmin" class="form__section">
                <h3 class="form__section-title">Security</h3>

                <label class="field">
                  <span class="field__label">NEW PASSWORD (OPTIONAL)</span>
                  <input
                    v-model="form.password"
                    type="password"
                    class="field__input"
                    placeholder="••••••••"
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
                  <span v-if="form.password && form.password !== form.passwordConfirm" class="field__error">
                    Passwords do not match
                  </span>
                </label>
              </section>

              <section v-if="editingAdmin" class="form__section">
                <h3 class="form__section-title">Account Status</h3>
                <label class="field">
                  <span class="field__label">STATUS *</span>
                  <select v-model="form.isActive" class="field__input field__select" :disabled="isEditingSelf">
                    <option :value="true">Active</option>
                    <option :value="false">Inactive</option>
                  </select>
                  <span v-if="isEditingSelf" class="field__hint">Your own account status cannot be changed here.</span>
                </label>
              </section>

              <section v-if="editingAdmin" class="form__section">
                <h3 class="form__section-title">Permissions (Read only)</h3>
                <p class="field__help">Permissions are inherited from the selected role and cannot be changed here.</p>
                <p v-if="rolePermissionsLoading" class="detail-empty" aria-live="polite">Loading permissions...</p>
                <p v-else-if="rolePermissionsError" class="field__error" role="alert">{{ rolePermissionsError }}</p>
                <div v-else-if="permissionGroups.length" class="permission-groups">
                  <section v-for="group in permissionGroups" :key="group.key" class="permission-group">
                    <h4>{{ group.label }}</h4>
                    <div class="permission-list">
                      <span v-for="permission in group.permissions" :key="permission.name" class="permission-chip">
                        {{ formatPermissionAction(permission.action) }}
                        <span class="permission-chip__resource">{{ permission.name.split('.')[0] }}</span>
                      </span>
                    </div>
                  </section>
                </div>
                <p v-else class="detail-empty">No permissions assigned to this role.</p>
              </section>

              <!-- Security Section -->
              <div v-if="!editingAdmin" class="form__section">
                <h3 class="form__section-title">Security</h3>

                <label class="field">
                  <span class="field__label">
                    {{ editingAdmin ? 'NEW PASSWORD (OPTIONAL)' : 'PASSWORD *' }}
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
                  <p class="form__status-info">
                    {{ form.isActive ? 'Active administrators can log in and access the system' : 'Inactive administrators cannot log in' }}
                  </p>
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
              @click="closeForm"
            >
              Cancel
            </BaseButton>
            <BaseButton variant="primary" type="submit" form="administrator-form" :disabled="!formValid || formLoading">
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
            <div class="confirm-warning">
              <span class="confirm-warning__icon" aria-hidden="true">!</span>
              <p>
                Delete <strong>{{ confirmAction.target ? formatName(confirmAction.target) : '' }}</strong>
                and remove their administrator access permanently.
              </p>
            </div>
            <p class="confirm-text">
              This action cannot be undone. The administrator will no longer be able to sign in.
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
              {{ confirmAction.loading ? 'Deleting...' : 'Delete Administrator' }}
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

/* Table */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1.25rem;
    vertical-align: middle;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  tbody tr + tr td {
    border-top: 1px solid var(--border-subtle);
  }

  tbody tr:hover {
    background: var(--surface-sunken);
  }

  &__row--busy {
    opacity: 0.5;
    pointer-events: none;
  }

  &__actions-head {
    text-align: right;
  }

  &__empty {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;
  }
}

.administrator {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 50%;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-weight: 700;
  }

  &__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__avatar-initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    color: var(--text-strong);
    font-size: 0.88rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__email {
    margin-top: 0.15rem;
    color: var(--text-subtle);
    font-size: 0.76rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
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
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease;

  svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
  }

  &:hover:not(:disabled) {
    background: var(--surface-alt);
    color: var(--text-strong);
    border-color: var(--border);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 0.25);
    border-color: rgb(var(--accent-rgb));
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
      color: var(--danger);
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

  &--text--name {
    width: 160px;
    height: 0.85rem;
    margin-bottom: 0.35rem;
  }

  &--text--email {
    width: 210px;
    height: 0.7rem;
  }

  &--text--badge {
    width: 90px;
    height: 0.7rem;
  }

  &--text--action {
    width: 112px;
    height: 0.8rem;
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

.confirm-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.8rem;
  padding: 0.9rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
  color: var(--danger);

  p {
    margin: 0;
    line-height: 1.5;
  }
}

.confirm-warning__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--danger);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 800;
}

.detail-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.detail-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-subtle);
  font-size: 0.78rem;

  &__link {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.detail-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(20, 23, 28, 0.04);
}

.detail-page__identity {
  display: flex;
  align-items: center;
  gap: 1.15rem;
  min-width: 0;
}

.detail-page__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 20px;
  background: var(--border-subtle);
  color: var(--text-muted);
  font-size: 1.25rem;
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.detail-page__eyebrow,
.detail-card__eyebrow {
  margin-bottom: 0.25rem;
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.detail-page__identity h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  line-height: 1.2;
}

.detail-page__identity p {
  margin: 0.3rem 0 0;
  color: var(--text-subtle);
  font-size: 0.88rem;
}

.detail-page__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.25rem;
  align-items: start;
}

.detail-main,
.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-card {
  padding: 1.35rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(20, 23, 28, 0.035);
}

.detail-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);

  h2 {
    margin: 0;
    color: var(--text-strong);
    font-size: 1rem;
  }
}

.detail-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  margin: 0;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 0.32rem;
    min-width: 0;
    padding: 0.9rem 0.85rem;
    border-bottom: 1px solid var(--border-subtle);

    &:nth-last-child(-n + 2) {
      border-bottom: 0;
    }

    &:nth-child(odd) {
      border-right: 1px solid var(--border-subtle);
    }
  }

  dt {
    color: var(--text-subtle);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    color: var(--text-body);
    font-size: 0.84rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
}

.detail-role-section,
.detail-permission-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.detail-role-section + .detail-permission-section {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-subtle);
}

.detail-label {
  color: var(--text-subtle);
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.role-chip-list,
.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.role-chip,
.permission-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.38rem 0.68rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-alt);
  color: var(--text-body);
  font-size: 0.75rem;
  font-weight: 600;
}

.role-chip {
  color: var(--info);
  background: var(--info-bg);
  border-color: transparent;
}

.permission-groups {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.permission-group {
  padding: 0.85rem;
  background: var(--surface-alt);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;

  h3 {
    margin: 0 0 0.65rem;
    color: var(--text-strong);
    font-size: 0.78rem;
  }
}

.permission-chip {
  gap: 0.35rem;
  color: var(--accent);
  background: var(--accent-bg);
  border-color: transparent;
}

.permission-chip__resource {
  padding-left: 0.35rem;
  border-left: 1px solid rgb(var(--accent-rgb) / 0.22);
  color: var(--text-subtle);
  font-size: 0.68rem;
}

.detail-empty {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.8rem;
}

.security-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
  }

  strong,
  small {
    display: block;
  }

  strong {
    color: var(--text-body);
    font-size: 0.8rem;
  }

  small {
    margin-top: 0.15rem;
    color: var(--text-subtle);
    font-size: 0.72rem;
    line-height: 1.4;
  }
}

.security-list__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--success-bg);
  color: var(--success);
  font-size: 0.7rem;
  font-weight: 800;
}

.detail-action-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.detail-action-button {
  width: 100%;
}

.detail-loading-card,
.detail-error-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
}

.detail-loading-card__profile {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detail-loading-card__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.55rem;
}

.detail-loading-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.detail-loading-card__grid .skeleton {
  height: 76px;
  border-radius: 12px;
}

.detail-error-card {
  align-items: flex-start;
  color: var(--danger);

  h2 {
    margin: 0;
    color: var(--text-strong);
    font-size: 1rem;
  }

  p {
    margin: 0.35rem 0 0;
    color: var(--text-subtle);
    font-size: 0.8rem;
  }
}

.detail-error-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--danger-bg);
  font-weight: 800;
}

@media (max-width: 900px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .detail-sidebar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .detail-page__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-page__actions {
    width: 100%;
  }

  .detail-page__actions .button {
    flex: 1;
  }

  .detail-list,
  .detail-sidebar,
  .detail-loading-card__grid {
    grid-template-columns: 1fr;
  }

  .detail-list__item:nth-child(odd) {
    border-right: 0;
  }

  .detail-list__item:nth-last-child(-n + 2) {
    border-bottom: 1px solid var(--border-subtle);
  }

  .detail-list__item:last-child {
    border-bottom: 0;
  }
}

@media (max-width: 460px) {
  .detail-page__identity {
    align-items: flex-start;
  }

  .detail-page__avatar {
    width: 58px;
    height: 58px;
    border-radius: 16px;
  }

  .detail-page__actions {
    flex-direction: column;
  }

  .detail-page__actions .button {
    width: 100%;
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

/* Edit mode is a page section; create mode keeps the compact modal. */
.page__body--editing {
  min-height: calc(100vh - 60px);
  align-content: start;
}

.modal--page {
  position: static;
  inset: auto;
  z-index: auto;
  display: block;
  padding: 0;
  background: transparent;
  animation: none;
}

.modal__dialog--page {
  width: 100%;
  max-width: none;
  max-height: none;
  min-height: 0;
  margin: 0;
  overflow: visible;
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  box-shadow: none;
  animation: none;
}

.modal--page .modal__head--enhanced {
  flex-direction: row;
  align-items: center;
  min-height: 76px;
  padding: 1rem 1.5rem;
}

.modal--page .modal__title--enhanced {
  margin-top: 0.15rem;
  font-size: 1.25rem;
}

.modal--page .modal__body--enhanced {
  width: 100%;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
  align-content: start;
  gap: 1.25rem;
  overflow: visible;
  padding: 1.5rem;
}

.modal--page .form__column {
  gap: 1rem;
}

.modal--page .form__sidebar {
  position: sticky;
  top: 1rem;
}

.modal--page .modal__foot--enhanced {
  padding: 1rem 1.5rem;
}

@media (max-width: 900px) {
  .modal--page .modal__body--enhanced {
    grid-template-columns: minmax(0, 1fr);
  }

  .modal--page .form__sidebar {
    position: static;
  }
}

@media (max-width: 600px) {
  .modal--page .modal__head--enhanced {
    align-items: flex-start;
    flex-direction: column;
    padding: 1rem;
  }

  .modal--page .modal__body--enhanced {
    gap: 0.85rem;
    padding: 1rem;
  }

  .modal--page .modal__foot--enhanced {
    gap: 0.5rem;
    padding: 1rem;
  }
}
</style>
