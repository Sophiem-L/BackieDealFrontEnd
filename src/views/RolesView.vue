<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { roles as initialRoles } from '@/data/roles'
import RolePermissionModal from '@/components/RolePermissionModal.vue'

const router = useRouter()
const roles = ref(initialRoles)

// Track which row's action menu is currently open
const activeDropdownId = ref(null)

// Permission modal state
const isPermissionModalOpen = ref(false)
const currentSelectedRole = ref(null)

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

function deleteRole(role) {
  activeDropdownId.value = null
  // TODO: Trigger confirmation dialog and delete API request
  roles.value = roles.value.filter(r => r.id !== role.id)
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
              <th>Assigned Admins</th>
              <th>Core Permissions</th>
              <th class="table__actions-head">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.id">
              <td class="role-name">{{ role.name }}</td>
              <td class="admins">
                <span class="admins__count">{{ role.admins }}</span> Users
              </td>
              <td>
                <div class="perms">
                  <span v-for="perm in role.permissions" :key="perm" class="chip">{{ perm }}</span>
                </div>
              </td>
              <td class="table__actions-cell">
                <!-- 3-dot Action Menu container -->
                <div class="dropdown" @click.stop>
                  <button 
                    type="button" 
                    class="action-trigger-btn" 
                    @click="toggleMenu(role.id)"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
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
            <tr v-if="roles.length === 0">
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
    color: $color-text;
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
  color: $color-text;
}

.admins {
  font-size: 0.85rem;
  color: #4a5160;

  &__count { font-weight: 700; color: $color-text; }
}

.perms {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7280;
  background: #f1f3f5;
  border-radius: 999px;
  white-space: nowrap;
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

  &:hover {
    background: #e2e8f0;
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
</style>