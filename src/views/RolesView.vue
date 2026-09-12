<template>
  <div class="page">
    <AppHeader title="System Roles & Permissions" />

    <div class="page__body">
      <!-- Toolbar -->
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" />
              <path d="m20 20-3.2-3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </span>
          <input
            v-model="search"
            type="search"
            placeholder="Search role by name..."
          />
        </label>

        <div class="toolbar__actions">
          <Select v-model="statusSelection">
            <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent :class="TOOLBAR_SELECT.content">
              <SelectItem
                v-for="item in STATUS_OPTIONS"
                :key="item.value"
                :value="item.value"
                :class="TOOLBAR_SELECT.item"
              >
                {{ item.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <BaseButton
            v-if="auth.hasPermission('roles.create')"
            variant="primary"
            @click="router.push('/roles/create')"
          >
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </template>
            Create Role
          </BaseButton>
        </div>
      </section>

      <!-- Table Section -->
      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th class="table__check">#</th>
              <th>Role Details</th>
              <th>Guard Name</th>
              <th>Assigned Permissions</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="table__state">Loading roles…</td>
            </tr>
            <tr v-else-if="error">
              <td colspan="6" class="table__state table__state--error">
                {{ error }}
                <button type="button" class="table__retry" @click="loadRoles">Retry</button>
              </td>
            </tr>
            <tr v-else-if="roles.length === 0">
              <td colspan="6" class="table__state">
                {{ hasFilters ? 'No roles match the current filters.' : 'No roles found.' }}
              </td>
            </tr>
            <tr v-for="(roleItem, index) in roles" v-else :key="roleItem.id">
              <td>{{ (page - 1) * PER_PAGE + index + 1 }}</td>
              <td>
                <div class="role-meta">
                  <span class="role-meta__name">{{ roleItem.name }}</span>
                  <span class="role-meta__id">ID: #{{ roleItem.id }}</span>
                </div>
              </td>
              <td><code>{{ roleItem.guard_name }}</code></td>
              <td>
                <div class="perm-badges">
                  <span class="badge badge--count">
                    {{ roleItem.permissions?.length ?? 0 }} Permissions
                  </span>
                  <template v-if="roleItem.permissions?.length">
                    <span
                      v-for="perm in roleItem.permissions.slice(0, 2)"
                      :key="perm.id"
                      class="badge badge--perm"
                    >
                      {{ perm.name }}
                    </span>
                    <span v-if="roleItem.permissions.length > 2" class="text-subtle">
                      +{{ roleItem.permissions.length - 2 }} more
                    </span>
                  </template>
                </div>
              </td>
              <td>
                <span class="badge" :class="roleItem.deleted_at ? 'badge--out-of-stock' : 'badge--in-stock'">
                  {{ roleItem.deleted_at ? 'Inactive' : 'Active' }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <!-- <button
                    v-if="auth.hasPermission('roles.assign-permission')"
                    type="button"
                    class="icon-btn"
                    title="Manage Permissions"
                    @click="openPermission(roleItem.id)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.7 5.7L11 17H9v2H7v2H4v-3.2l5.3-5.3A6 6 0 1 1 21 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    </svg>
                  </button> -->
                  <button
                    v-if="auth.hasPermission('roles.update')"
                    type="button"
                    class="icon-btn"
                    title="Edit role"
                    @click="router.push(`/roles/${roleItem.id}/edit`)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    v-if="auth.hasPermission('roles.delete')"
                    type="button"
                    class="icon-btn icon-btn--danger"
                    title="Delete role"
                    @click="deleteRole(roleItem)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <footer class="pagination">
          <p class="pagination__info">
            Showing {{ rangeStart }}-{{ rangeEnd }} of {{ total.toLocaleString() }} roles
          </p>
          <div class="pagination__controls">
            <button type="button" class="page-btn" :disabled="page <= 1 || loading" @click="prevPage">
              Previous
            </button>
            <button type="button" class="page-btn page-btn--active">{{ page }}</button>
            <button type="button" class="page-btn" :disabled="page >= lastPage || loading" @click="nextPage">
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- Permission Management Modal -->
    <div v-if="dialog" class="modal" role="dialog" aria-modal="true">
      <div class="modal__backdrop" @click="dialog = false"></div>
      <div class="modal__panel">
        <header class="modal__head">
          <div>
            <h2 class="modal__title">Manage Permissions</h2>
            <p class="modal__sub">Assign or remove permissions for role <strong>{{ activeRole?.name }}</strong></p>
          </div>
          <button type="button" class="modal__close" @click="dialog = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="modal__body">
          <div class="toolbar mb-2">
            <label class="toolbar__search">
              <input v-model="searchPermission" type="search" placeholder="Search module or permission..." />
            </label>

            <BaseButton variant="ghost" size="sm" @click="toggleAll">
              {{ isAllChecked ? 'Uncheck All' : 'Check All' }}
            </BaseButton>
          </div>

          <div class="modal__scroll pa-3">
            <div v-if="loadingPermissions" class="table__state">Loading permissions...</div>
            <div v-else-if="filteredModules.length === 0" class="table__state">No permissions found</div>
            <div v-else class="modules-grid">
              <div v-for="module in filteredModules" :key="module.name" class="module-card">
                <div class="module-card__head">
                  <label class="d-flex align-center gap-2">
                    <input
                      type="checkbox"
                      :checked="module.checked"
                      :indeterminate.prop="module.indeterminate"
                      @change="toggleModule(module)"
                    />
                    <strong>{{ module.name }}</strong>
                  </label>
                  <span class="badge badge--category">
                    {{ checkedCount(module) }} / {{ module.permissions.length }}
                  </span>
                </div>
                <div class="module-card__body">
                  <div
                    v-for="perm in module.permissions"
                    :key="perm.id"
                    class="perm-item"
                    @click="togglePermission(module, perm)"
                  >
                    <input
                      type="checkbox"
                      :checked="perm.checked"
                      @click.stop
                      @change="updateModuleState(module)"
                    />
                    <span class="perm-item__name">{{ perm.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="modal__foot">
          <div class="modal__foot-actions">
            <BaseButton variant="subtle" @click="dialog = false">Cancel</BaseButton>
            <BaseButton
              v-if="auth.hasPermission('roles.update')"
              variant="primary"
              :disabled="savingPermissions"
              @click="savePermissions"
            >
              {{ savingPermissions ? 'Saving…' : 'Save Permissions' }}
            </BaseButton>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const PER_PAGE = 10
const roles = ref([])
const search = ref('')
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')

const statusFilter = ref('')
const ANY_STATUS = 'any'
const STATUS_OPTIONS = [
  { value: ANY_STATUS, label: 'Status: Any' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const statusSelection = computed({
  get: () => (statusFilter.value === '' ? ANY_STATUS : statusFilter.value),
  set: (val) => {
    statusFilter.value = val === ANY_STATUS ? '' : val
  },
})

const hasFilters = computed(() => Boolean(search.value.trim() || statusFilter.value))

function listParams() {
  const params = new URLSearchParams({
    page: String(page.value),
    per_page: String(PER_PAGE),
  })
  const q = search.value.trim()
  if (q) params.set('q', q)
  if (statusFilter.value === 'inactive') params.set('only_trashed', 'true')
  if (statusFilter.value === 'any') params.set('with_trashed', 'true')
  return params
}

async function loadRoles() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/roles?${listParams().toString()}`, {
      token: auth.accessToken,
    })
    const data = response?.data ?? {}
    roles.value = data.items ?? []
    const pagination = data.pagination ?? {}
    total.value = pagination.total ?? roles.value.length
    lastPage.value = pagination.last_page ?? 1
  } catch (err) {
    error.value = err.message || 'Unable to load roles.'
    roles.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadRoles)

function applyFilters() {
  if (page.value !== 1) page.value = 1
  else loadRoles()
}

let searchTimer
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 350)
})
watch(statusFilter, applyFilters)
watch(page, loadRoles)

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PER_PAGE + 1))
const rangeEnd = computed(() => (page.value - 1) * PER_PAGE + roles.value.length)

function prevPage() { if (page.value > 1) page.value -= 1 }
function nextPage() { if (page.value < lastPage.value) page.value += 1 }

async function deleteRole(roleItem) {
  if (['admin', 'manager', 'staff'].includes(roleItem.name)) {
    window.alert(`The "${roleItem.name}" role is a platform role and cannot be deleted.`)
    return
  }
  if (!window.confirm(`Delete role "${roleItem.name}"?`)) return
  try {
    await apiFetch(`/admin/roles/${roleItem.id}`, { method: 'DELETE', token: auth.accessToken })
    await loadRoles()
  } catch (err) {
    window.alert(err.message || 'Failed to delete role.')
  }
}

/* Permission Modal Logic */
const dialog = ref(false)
const activeRole = ref(null)
const searchPermission = ref('')
const modules = ref([])
const loadingPermissions = ref(false)
const savingPermissions = ref(false)

async function openPermission(roleId) {
  dialog.value = true
  loadingPermissions.value = true
  try {
    const [roleRes, permRes] = await Promise.all([
      apiFetch(`/admin/roles/${roleId}`, { token: auth.accessToken }),
      apiFetch('/admin/permissions?per_page=150', { token: auth.accessToken }),
    ])
    activeRole.value = roleRes?.data
    const assignedIds = new Set((activeRole.value?.permissions ?? []).map((p) => p.id))
    const allPerms = permRes?.data?.items ?? []

    const grouped = {}
    allPerms.forEach((p) => {
      const mod = p.name.includes('.') ? p.name.split('.')[0] : 'general'
      if (!grouped[mod]) grouped[mod] = []
      grouped[mod].push({ id: p.id, name: p.name, checked: assignedIds.has(p.id) })
    })

    modules.value = Object.keys(grouped).map((name) => {
      const mod = { name: name.toUpperCase(), permissions: grouped[name] }
      updateModuleState(mod)
      return mod
    })
  } catch (err) {
    window.alert(err.message || 'Unable to load permissions.')
  } finally {
    loadingPermissions.value = false
  }
}

function updateModuleState(module) {
  const count = module.permissions.filter((p) => p.checked).length
  module.checked = count === module.permissions.length
  module.indeterminate = count > 0 && count < module.permissions.length
}

function toggleModule(module) {
  const next = !module.checked
  module.permissions.forEach((p) => { p.checked = next })
  updateModuleState(module)
}

function togglePermission(module, perm) {
  perm.checked = !perm.checked
  updateModuleState(module)
}

const isAllChecked = computed(() =>
  modules.value.length > 0 && modules.value.every((m) => m.permissions.every((p) => p.checked))
)

function toggleAll() {
  const target = !isAllChecked.value
  modules.value.forEach((m) => {
    m.permissions.forEach((p) => { p.checked = target })
    updateModuleState(m)
  })
}

const filteredModules = computed(() => {
  const q = searchPermission.value.trim().toLowerCase()
  if (!q) return modules.value
  return modules.value
    .map((m) => ({
      ...m,
      permissions: m.permissions.filter((p) => p.name.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
    }))
    .filter((m) => m.permissions.length > 0)
})

function checkedCount(module) {
  return module.permissions.filter((p) => p.checked).length
}

async function savePermissions() {
  if (!activeRole.value) return
  savingPermissions.value = true
  try {
    const ids = modules.value.flatMap((m) => m.permissions).filter((p) => p.checked).map((p) => p.id)
    await apiFetch(`/admin/roles/${activeRole.value.id}/permissions`, {
      method: 'POST',
      token: auth.accessToken,
      body: { permissions: ids },
    })
    dialog.value = false
    await loadRoles()
  } catch (err) {
    window.alert(err.message || 'Failed to save permissions.')
  } finally {
    savingPermissions.value = false
  }
}
</script>

<style scoped lang="scss">
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.cursor-pointer { cursor: pointer; }
.text-subtle { font-size: 0.75rem; color: var(--text-subtle); }

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

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within {
      background: var(--surface);
      border-color: var(--border);
    }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg { width: 16px; height: 16px; }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
    flex-wrap: wrap;
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    &:focus { outline: none; }
  }
}

.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: visible;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1rem;
    vertical-align: middle;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  &__check { width: 44px; }
  th#{&}__actions-head { text-align: center; }

  &__state {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;

    &--error { color: var(--danger); }
  }

  &__retry {
    margin-left: 0.6rem;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
  }
}

.role-meta {
  display: flex;
  flex-direction: column;

  &__name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--accent-ink);
  }

  &__id {
    font-size: 0.74rem;
    color: var(--text-subtle);
  }
}

.perm-badges {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 999px;

  &--category {
    background: var(--surface-track);
    color: var(--text-muted);
    font-weight: 600;
  }
  &--count {
    background: var(--surface-sunken);
    color: var(--text-strong);
    border: 1px solid var(--border);
  }
  &--perm {
    background: rgb(var(--accent-rgb) / 0.12);
    color: var(--accent-ink);
    font-weight: 500;
    text-transform: lowercase;
  }
  &--in-stock { background: var(--success-bg); color: var(--success); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

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

  &:hover:not(:disabled) { background: var(--surface-alt); color: var(--text-strong); }
  &--danger:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;

  &__info { margin: 0; font-size: 0.82rem; color: var(--text-subtle); }
  &__controls { display: flex; gap: 0.4rem; }
}

.page-btn {
  min-width: 36px;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--surface-alt); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &--active {
    background: rgb(var(--accent-rgb));
    border-color: rgb(var(--accent-rgb));
    color: var(--ink-on-accent);
  }
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;

  &__backdrop { position: absolute; inset: 0; background: var(--backdrop); }
  &__panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(920px, 100%);
    max-height: min(80vh, 720px);
    background: var(--surface);
    border-radius: 14px;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 18px 50px rgba(20, 24, 31, 0.2);
    overflow: hidden;
  }
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
  }
  &__title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-strong); }
  &__sub { margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--text-subtle); }
  &__close {
    display: inline-flex;
    padding: 0.35rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;
    svg { width: 18px; height: 18px; }
  }
  &__body {
    padding: 1.1rem 1.25rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-height: 0;
  }
  &__scroll { overflow: auto; border: 1px solid var(--border-subtle); border-radius: 10px; }
  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1.25rem;
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }
  &__foot-actions { display: flex; gap: 0.5rem; margin-left: auto; }
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.module-card {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface);

  &__head {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-sunken);
  }

  &__body {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}

.perm-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: var(--bg);
  border-radius: 6px;
  cursor: pointer;

  &__name {
    font-size: 0.8rem;
    color: var(--text-body);
  }
}
</style>