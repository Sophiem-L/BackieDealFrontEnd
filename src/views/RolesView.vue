<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import RolePermissionModal from '@/components/RolePermissionModal.vue'

const router = useRouter()

const roles = ref([])
const loading = ref(false)

// Track which row's action menu is currently open
const activeDropdownId = ref(null)

// Permission modal state
const isPermissionModalOpen = ref(false)
const currentSelectedRole = ref(null)

// Fetch roles from your Laravel backend API
const fetchRoles = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('accessToken') // Updated to use accessToken
    console.log("Token:", localStorage.getItem('accessToken'));
    const response = await fetch('http://127.0.0.1:8000/api/v1/admin/roles', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
    
    const res = await response.json()
    if (res && res.status === 'success' && res.data && res.data.items) {
      roles.value = res.data.items
    }
  } catch (error) {
    console.error('Failed to fetch roles:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchRoles()
})

function toggleMenu(id) {
  activeDropdownId.value = activeDropdownId.value === id ? null : id
}

function handleCreateRole() {
  activeDropdownId.value = null
  router.push('/roles/create')
}

function editRole(role) {
  activeDropdownId.value = null
  router.push(`/roles/${role.id}/edit`)
}

function openPermissions(role) {
  activeDropdownId.value = null
  currentSelectedRole.value = role
  isPermissionModalOpen.value = true
}

async function deleteRole(role) {
  activeDropdownId.value = null
  if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return

  try {
    const token = localStorage.getItem('accessToken') // Updated to use accessToken
    const response = await fetch(`http://127.0.0.1:8000/api/v1/admin/roles/${role.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })

    if (response.ok) {
      roles.value = roles.value.filter(r => r.id !== role.id)
    } else {
      console.error('Failed to delete role')
    }
  } catch (error) {
    console.error('Error deleting role:', error)
  }
}

function saveRolePermissions({ roleId, permissionIds }) {
  console.log(`Saving permissions for Role ID ${roleId}:`, permissionIds)
}
</script>

<template>
  <div class="page" @click="activeDropdownId = null">
    <AppHeader title="User Roles & Permissions" />

    <div class="page__body">
      <!-- Section heading + primary action -->
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">Define Access Levels</h2>
          <p class="head__subtitle">Control what each administrator can see and do.</p>
        </div>

        <BaseButton variant="primary" @click="handleCreateRole">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </template>
          Create Custom Role
        </BaseButton>
      </section>

      <!-- Roles table -->
      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Status</th>
              <th class="table__actions-head">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.id">
              <td class="role-name">{{ role.name }}</td>
              <td class="role-description">
                {{ role.description || 'Guard name: ' + role.guard_name }}
              </td>
              <td>
                <span :class="['status-badge', role.deleted_at ? 'inactive' : 'active']">
                  {{ role.deleted_at ? 'Inactive' : 'Active' }}
                </span>
              </td>
              <td class="table__actions-cell">
                <!-- 3-dot Action Menu container -->
                <div class="dropdown" @click.stop>
                  <button 
                    type="button" 
                    class="action-trigger-btn" 
                    @click="toggleMenu(role.id)"
                  >
                    <svg class="dots-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <circle cx="12" cy="5" r="2.5" />
                      <circle cx="12" cy="12" r="2.5" />
                      <circle cx="12" cy="19" r="2.5" />
                    </svg>
                  </button>

                  <!-- Dropdown Menu Box -->
                  <div v-if="activeDropdownId === role.id" class="dropdown-menu">
                    <!-- Edit Action -->
                    <button type="button" class="dropdown-item edit" @click="editRole(role)">
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit
                    </button>

                    <!-- Permission Action -->
                    <button type="button" class="dropdown-item permission" @click="openPermissions(role)">
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                      </svg>
                      Permission
                    </button>

                    <!-- Delete Action -->
                    <button type="button" class="dropdown-item delete" @click="deleteRole(role)">
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="roles.length === 0 && !loading">
              <td colspan="4" class="table__empty">No roles defined yet.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Permission Matrix Modal Integration -->
    <RolePermissionModal
      v-model="isPermissionModalOpen"
      :role="currentSelectedRole"
      @save="saveRolePermissions"
    />
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
  }
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-strong, #111827);
  }

  &__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: $muted;
  }
}

.table-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  overflow: visible;
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.9rem 1.25rem; vertical-align: middle; }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9099a6;
    border-bottom: 1px solid $divider;
  }

  tbody tr + tr td { border-top: 1px solid $divider; }
  tbody tr:hover { background: #fafbfc; }

  &__actions-head { text-align: right; }
  &__actions-cell { text-align: right; position: relative; }

  &__empty { text-align: center; color: $muted; font-size: 0.88rem; padding: 2.5rem 1rem; }
}

.role-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-strong, #111827);
  text-transform: capitalize;
}

.role-description {
  font-size: 0.85rem;
  color: #4a5160;
  max-width: 350px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 999px;

  &.active {
    color: #065f46;
    background: #d1fae5;
  }

  &.inactive {
    color: #9f1239;
    background: #ffe4e6;
  }
}

.dropdown {
  position: relative;
  display: inline-block;
}

.action-trigger-btn {
  background: #f1f3f5;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4a5160;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;

  &:hover {
    background: #e2e8f0;
  }

  .dots-icon {
    display: block;
    fill: #4a5160;
  }
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: #ffffff;
  border: 1px solid $divider;
  box-shadow: 0px 10px 25px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 0.4rem;
  min-width: 150px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 0.8rem;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;

  .dropdown-icon {
    width: 16px;
    height: 16px;
  }

  &.edit {
    color: #8b5cf6;
    &:hover { background: #f5f3ff; }
  }

  &.permission {
    color: #0ea5e9;
    &:hover { background: #f0f9ff; }
  }

  &.delete {
    color: #ef4444;
    &:hover { background: #fef2f2; }
  }
}
</style>