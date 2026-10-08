<template>
  <div class="page">
    <AppHeader title="Edit Custom Role" />

    <div class="page__body">
      <p v-if="errors.general" class="alert">{{ errors.general }}</p>

      <!-- Main Form Card -->
      <section class="card">
        <div class="card__accent-bar"></div>
        
        <header class="card__header">
          <h2 class="card__title">Role information</h2>
        </header>

        <div v-if="loadingData" class="perm-state text-center py-4">Loading role details...</div>
        <form v-else @submit.prevent="handleUpdate" class="card__body">
          <!-- Role Name -->
          <div class="form-group">
            <label class="form-label" for="role-name">
              Name <span class="required">*</span>
            </label>
            <input
              id="role-name"
              v-model="form.name"
              type="text"
              class="form-input"
              placeholder="Enter name"
              required
            />
          </div>

          <!-- Status Select -->
          <div class="form-group">
            <label class="form-label" for="role-status">
              Status <span class="required">*</span>
            </label>
            <div class="select-wrapper">
              <select id="role-status" v-model="form.status" class="form-select">
                <option :value="1">Active</option>
                <option :value="2">Inactive</option>
              </select>
              <span class="select-icon">▼</span>
            </div>
          </div>

          <!-- Permission Selection Grid (Replaces Description) -->
          <div class="form-group mt-2">
            <div class="perm-head">
              <label class="form-label">Assign Permissions</label>
              <button type="button" class="btn-text" @click="toggleAllPermissions">
                {{ isAllChecked ? 'Uncheck All' : 'Check All' }}
              </button>
            </div>

            <div v-if="loadingPermissions" class="perm-state">Loading permissions...</div>
            <div v-else class="modules-grid">
              <div v-for="module in modules" :key="module.name" class="module-card">
                <div class="module-card__head">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      :checked="module.checked"
                      :indeterminate.prop="module.indeterminate"
                      @change="toggleModule(module)"
                    />
                    <strong>{{ module.name }}</strong>
                  </label>
                  <span class="badge">
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
        </form>
      </section>

      <!-- Bottom Floating Action Bar -->
      <footer class="bottom-actions">
        <button type="button" class="btn-back" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Back
        </button>
        <button type="button" class="btn-save" :disabled="loading || loadingData" @click="handleUpdate">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" />
            <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2" />
            <polyline points="7 3 7 8 15 8" stroke="currentColor" stroke-width="2" />
          </svg>
          {{ loading ? 'Updating...' : 'Save' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const roleId = route.params.id

const form = ref({
  name: '',
  status: 1,
})

const loadingData = ref(false)
const loadingPermissions = ref(false)
const loading = ref(false)
const errors = ref({})
const modules = ref([])

function goBack() {
  router.push('/roles')
}

// Fetch existing Role details and full permission list from Backend
async function loadRoleData() {
  loadingData.value = true
  loadingPermissions.value = true
  try {
    const [roleRes, permRes] = await Promise.all([
      apiFetch(`/admin/roles/${roleId}`, { token: auth.accessToken }),
      apiFetch('/admin/permissions?per_page=150', { token: auth.accessToken }),
    ])

    const roleData = roleRes?.data ?? {}
    form.value.name = roleData.name ?? ''
    form.value.status = roleData.deleted_at ? 2 : 1

    const assignedIds = new Set((roleData.permissions ?? []).map((p) => p.id))
    const allPerms = permRes?.data?.items ?? []

    const grouped = {}
    allPerms.forEach((p) => {
      const mod = p.name.includes('.') ? p.name.split('.')[0] : 'general'
      if (!grouped[mod]) grouped[mod] = []
      grouped[mod].push({
        id: p.id,
        name: p.name,
        checked: assignedIds.has(p.id),
      })
    })

    modules.value = Object.keys(grouped).map((name) => {
      const mod = { name: name.toUpperCase(), permissions: grouped[name] }
      updateModuleState(mod)
      return mod
    })
  } catch (err) {
    errors.value.general = err.message || 'Unable to load role details.'
  } finally {
    loadingData.value = false
    loadingPermissions.value = false
  }
}

onMounted(loadRoleData)

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

function toggleAllPermissions() {
  const target = !isAllChecked.value
  modules.value.forEach((m) => {
    m.permissions.forEach((p) => { p.checked = target })
    updateModuleState(m)
  })
}

function checkedCount(module) {
  return module.permissions.filter((p) => p.checked).length
}

async function handleUpdate() {
  if (!form.value.name.trim()) {
    errors.value.general = 'Role name is required.'
    return
  }

  loading.value = true
  errors.value = {}

  try {
    const selectedPermissionIds = modules.value
      .flatMap((m) => m.permissions)
      .filter((p) => p.checked)
      .map((p) => p.id)

    // Send PUT request to Laravel update method with synced permissions
    await apiFetch(`/admin/roles/${roleId}`, {
      method: 'PUT',
      token: auth.accessToken,
      body: {
        name: form.value.name.trim(),
        guard_name: 'api',
        permissions: selectedPermissionIds,
      },
    })
    router.push('/roles')
  } catch (err) {
    const fieldError = Object.values(err.errors ?? {})[0]
    errors.value.general = (Array.isArray(fieldError) ? fieldError[0] : fieldError) || err.message || 'Unable to update role.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 4rem;
  }
}

.alert {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
}

.card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);

  &__accent-bar {
    height: 4px;
    background: rgb(var(--accent-rgb));
  }

  &__header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-strong);
  }

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-body);

  .required {
    color: var(--danger);
  }
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  outline: none;
  color: var(--text-strong);
  background: var(--surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &:focus {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.16);
  }

  &::placeholder {
    color: var(--text-subtle);
  }
}

.select-wrapper {
  position: relative;
  width: 100%;
}

.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  outline: none;
  appearance: none;
  background: var(--surface);
  color: var(--text-strong);
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &:focus {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.16);
  }
}

.select-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: var(--text-subtle);
  pointer-events: none;
}

.perm-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-text {
  background: transparent;
  border: none;
  color: var(--accent-ink);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.perm-state {
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 1rem 0;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
}

.module-card {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;

  &__head {
    padding: 0.65rem 0.85rem;
    background: var(--surface-sunken);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__body {
    padding: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-strong);
  cursor: pointer;

  input {
    accent-color: rgb(var(--accent-rgb));
  }
}

.badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: var(--surface-track);
  color: var(--text-body);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  font-weight: 600;
}

.perm-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: var(--surface-sunken);
  border-radius: 6px;
  transition: background-color 150ms ease;
  cursor: pointer;

  input {
    accent-color: rgb(var(--accent-rgb));
    flex-shrink: 0;
  }

  &:hover {
    background: var(--surface-alt);
  }

  &__name {
    font-size: 0.8rem;
    color: var(--text-body);
  }
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--surface);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0 2rem;
  z-index: 50;
  box-shadow: 0 -4px 12px rgb(0 0 0 / 0.08);
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.25rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-body);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: var(--surface-hover);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb));
    outline-offset: 2px;
  }

  svg { width: 16px; height: 16px; }
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--ink-on-accent);
  background: rgb(var(--accent-rgb));
  border: 1px solid rgb(var(--accent-rgb));
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled) {
    filter: brightness(0.94);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-ink);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg { width: 16px; height: 16px; }
}

@media (max-width: 640px) {
  .page__body {
    padding: 1rem;
  }

  .card__header,
  .card__body {
    padding: 1rem;
  }

  .modules-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
    gap: 0.75rem;
  }

  .bottom-actions {
    padding-inline: 1rem;
  }
}
</style>