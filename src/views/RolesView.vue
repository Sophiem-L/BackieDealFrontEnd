<script setup>
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { roles } from '@/data/roles'

// Placeholder handlers — wire to a real create/edit flow when the roles
// endpoint exists. For now they keep the UI interactive.
function createRole() {
  // TODO: open create-custom-role flow
}

function editPermissions(role) {
  // TODO: open edit-permissions flow for `role`
  void role
}
</script>

<template>
  <div class="page">
    <AppHeader title="User Roles & Permissions" />

    <div class="page__body">
      <!-- Section heading + primary action -->
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">Define Access Levels</h2>
          <p class="head__subtitle">Control what each administrator can see and do.</p>
        </div>

        <BaseButton variant="primary" @click="createRole">
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
              <th class="table__actions-head">Actions</th>
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
              <td>
                <div class="row-actions">
                  <button type="button" class="link-btn" @click="editPermissions(role)">
                    Edit Permissions
                  </button>
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

/* Section heading */
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
    color: var(--text-strong);
  }

  &__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }
}

/* Table */
.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
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
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  &__actions-head { text-align: right; }

  &__empty { text-align: center; color: var(--text-subtle); font-size: 0.88rem; padding: 2.5rem 1rem; }
}

.role-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-strong);
}

.admins {
  font-size: 0.85rem;
  color: var(--text-body);

  &__count { font-weight: 700; color: var(--text-strong); }
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
  color: var(--text-muted);
  background: var(--surface-track);
  border-radius: 999px;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.link-btn {
  padding: 0;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-body);
  cursor: pointer;

  &:hover { color: var(--accent-ink); text-decoration: underline; }
}
</style>
