<script setup>
import { ref, computed, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  role: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'save'])
const auth = useAuthStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const searchPermission = ref('')
const loading = ref(false)
const modules = ref([])

// Fetch permissions and role assignments from backend when modal opens
async function loadPermissionsAndRoleData() {
  if (!props.role?.id) return
  loading.value = true
  try {
    const [permsRes, roleRes] = await Promise.all([
      apiFetch('/admin/permissions?per_page=100', { token: auth.accessToken }),
      apiFetch(`/admin/roles/${props.role.id}`, { token: auth.accessToken })
    ])

    const allPermissions = permsRes?.data?.items || []
    const assignedPermissions = roleRes?.data?.permissions || []
    const assignedIds = assignedPermissions.map((p) => p.id)

    // Group permissions dynamically by their module prefix (e.g. "users.view" -> "users")
    const groupedMap = {}
    allPermissions.forEach((p) => {
      const parts = p.name.split('.')
      const moduleName = parts.length > 1 ? parts[0] : 'general'
      if (!groupedMap[moduleName]) {
        groupedMap[moduleName] = []
      }
      groupedMap[moduleName].push({
        id: p.id,
        name: p.name,
        checked: assignedIds.includes(p.id)
      })
    })

    modules.value = Object.keys(groupedMap).map((modName) => ({
      name: modName.charAt(0).toUpperCase() + modName.slice(1),
      checked: false,
      indeterminate: false,
      permissions: groupedMap[modName]
    }))

    modules.value.forEach(m => updateModuleState(m))
  } catch (err) {
    console.error('Failed to load permission matrix data:', err)
  } finally {
    loading.value = false
  }
}

// Filter modules and permissions based on search keyword
const filteredModules = computed(() => {
  if (!searchPermission.value) return modules.value
  const keyword = searchPermission.value.toLowerCase()
  return modules.value
    .map((m) => {
      const moduleMatch = m.name.toLowerCase().includes(keyword)
      const filteredPerms = m.permissions.filter((p) =>
        p.name.toLowerCase().includes(keyword)
      )
      if (moduleMatch || filteredPerms.length > 0) {
        return {
          ...m,
          permissions: moduleMatch ? m.permissions : filteredPerms,
        }
      }
      return null
    })
    .filter(Boolean)
})

const isAllChecked = computed(() => {
  return modules.value.length > 0 && modules.value.every((m) => m.permissions.every((p) => p.checked))
})

function toggleAll() {
  const newValue = !isAllChecked.value
  modules.value.forEach((m) => {
    m.checked = newValue
    m.permissions.forEach((p) => (p.checked = newValue))
  })
}

function updateModuleState(module) {
  const total = module.permissions.length
  const checked = module.permissions.filter((p) => p.checked).length
  module.checked = checked === total
  module.indeterminate = checked > 0 && checked < total
}

function toggleModule(module) {
  module.indeterminate = false
  module.permissions.forEach((p) => {
    p.checked = module.checked
  })
}

function togglePermission(module, perm) {
  perm.checked = !perm.checked
  updateModuleState(module)
}

function checkedCount(module) {
  return module.permissions.filter((p) => p.checked).length
}

async function handleSave() {
  if (!props.role?.id) return
  loading.value = true

  const selectedPermissionIds = modules.value
    .flatMap((m) => m.permissions)
    .filter((p) => p.checked)
    .map((p) => p.id)

  try {
    await apiFetch(`/admin/roles/${props.role.id}/permissions`, {
      method: 'POST',
      token: auth.accessToken,
      body: { permissions: selectedPermissionIds },
    })

    emit('save', { roleId: props.role.id, permissionIds: selectedPermissionIds })
    isOpen.value = false
  } catch (err) {
    alert(err.message || 'Failed to update role permissions.')
  } finally {
    loading.value = false
  }
}

// Load backend permissions when modal opens
watch(isOpen, (val) => {
  if (val) {
    searchPermission.value = ''
    loadPermissionsAndRoleData()
  }
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="isOpen = false">
    <div class="modal-card" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <div>
          <h3 class="modal-title">Manage Permissions</h3>
          <p class="modal-subtitle">
            Assign or remove permissions for the <span class="highlight">{{ role?.name }}</span> role
          </p>
        </div>
        <button type="button" class="close-btn" @click="isOpen = false">&times;</button>
      </div>

      <!-- Search + Check All Action bar -->
      <div class="modal-toolbar">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="searchPermission"
            type="text"
            placeholder="Search by module or permission name..."
            class="search-input"
          />
        </div>
        <BaseButton variant="secondary" @click="toggleAll">
          {{ isAllChecked ? 'Uncheck All' : 'Check All' }}
        </BaseButton>
      </div>

      <!-- Body Grid Cards -->
      <div class="modal-body">
        <div v-if="loading && modules.length === 0" class="empty-state">
          Loading permissions...
        </div>
        <div v-else-if="filteredModules.length === 0" class="empty-state">
          No permissions found.
        </div>
        <div v-else class="modules-grid">
          <div v-for="module in filteredModules" :key="module.name" class="module-card">
            <!-- Module Header -->
            <div class="module-header">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="module.checked"
                  :indeterminate.prop="module.indeterminate"
                  @change="toggleModule(module)"
                />
                <span class="module-name">{{ module.name }}</span>
              </label>
              <span class="badge">{{ checkedCount(module) }} / {{ module.permissions.length }}</span>
            </div>

            <!-- Permission Items -->
            <div class="module-content">
              <div
                v-for="perm in module.permissions"
                :key="perm.id"
                class="perm-row"
                @click="togglePermission(module, perm)"
              >
                <label class="checkbox-label" @click.stop>
                  <input
                    type="checkbox"
                    v-model="perm.checked"
                    @change="updateModuleState(module)"
                  />
                  <span class="perm-name">{{ perm.name }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="modal-footer">
        <BaseButton variant="secondary" @click="isOpen = false">Cancel</BaseButton>
        <BaseButton variant="primary" :disabled="loading" @click="handleSave">
          {{ loading ? 'Saving...' : 'Save Permissions' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$divider: #eef0f3;
$accent: #f4c10f;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-card {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 1050px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid $divider;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  .modal-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .modal-subtitle {
    margin: 0.2rem 0 0;
    font-size: 0.82rem;
    color: #6b7280;

    .highlight {
      color: #2563eb;
      font-weight: 600;
    }
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #9ca3af;
    &:hover { color: #111827; }
  }
}

.modal-toolbar {
  padding: 1rem 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  border-bottom: 1px solid $divider;
  background: #fafbfc;

  .search-box {
    flex-grow: 1;
    position: relative;
    display: flex;
    align-items: center;

    .search-icon {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: #9ca3af;
    }

    .search-input {
      width: 100%;
      padding: 0.6rem 0.8rem 0.6rem 2.4rem;
      border: 1px solid $divider;
      border-radius: 8px;
      font-size: 0.85rem;
      outline: none;
      background: #fff;
      &:focus { border-color: #2563eb; }
    }
  }
}

.modal-body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: #f8fafc;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 1rem;
}

.module-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .module-header {
    padding: 0.85rem 1rem;
    background: #f1f3f5;
    border-bottom: 1px solid $divider;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .module-name {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .badge {
      font-size: 0.72rem;
      padding: 0.15rem 0.5rem;
      background: #e2e8f0;
      border-radius: 999px;
      font-weight: 600;
      color: #475569;
    }
  }

  .module-content {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;

    .perm-row {
      display: flex;
      align-items: center;
      padding: 0.4rem 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      background: rgba(207, 204, 204, 0.08);

      &:hover { background: rgba(207, 204, 204, 0.2); }

      .perm-name {
        font-size: 0.82rem;
        color: #334155;
      }
    }
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-size: 0.88rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid $divider;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: #fff;
}
</style>