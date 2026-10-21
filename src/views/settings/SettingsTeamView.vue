<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import { fetchAdministrators } from '@/services/administrators'
import { useAuthStore } from '@/stores/auth'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const router = useRouter()
const administrators = ref([])
const search = ref('')
const roleFilter = ref('')
const loading = ref(true)
const error = ref('')

const canViewMembers = computed(() => auth.hasPermission('administrators.view'))
const canManageMembers = computed(() => canViewMembers.value && (auth.hasPermission('administrators.create') || auth.hasPermission('administrators.update')))
const roleOptions = computed(() => [...new Set([
  ...administrators.value.flatMap((admin) => (Array.isArray(admin.roles) ? admin.roles : []).map((role) => typeof role === 'string' ? role : role.name)),
].filter(Boolean))].sort())
const members = computed(() => administrators.value.map((admin) => {
  const name = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.name || admin.email
  const roleNames = (Array.isArray(admin.roles) ? admin.roles : []).map((role) => typeof role === 'string' ? role : role.name).filter(Boolean)
  return {
    id: admin.id,
    name,
    email: admin.email,
    roles: roleNames,
    status: admin.is_active ? 'Active' : 'Inactive',
    lastActive: formatLastActive(admin.last_login_at),
    avatar: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  }
}).filter((member) => {
  const query = search.value.trim().toLocaleLowerCase()
  const matchesSearch = !query || `${member.name} ${member.email}`.toLocaleLowerCase().includes(query)
  const matchesRole = !roleFilter.value || member.roles.includes(roleFilter.value)
  return matchesSearch && matchesRole
}))

function formatLastActive(value) {
  if (!value) return 'Never active'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

async function loadMembers() {
  loading.value = true
  error.value = ''
  if (!canViewMembers.value) {
    error.value = 'You need Administrators view permission to see team members.'
    loading.value = false
    return
  }
  try {
    const adminResponse = await fetchAdministrators(auth.accessToken, 1, 100)
    const payload = adminResponse?.data
    const firstPage = Array.isArray(payload) ? payload : payload?.items || payload?.data || []
    const lastPage = payload?.pagination?.last_page || 1
    const remainingPages = await Promise.all(Array.from(
      { length: Math.max(0, lastPage - 1) },
      (_, index) => fetchAdministrators(auth.accessToken, index + 2, 100),
    ))
    administrators.value = [
      ...firstPage,
      ...remainingPages.flatMap((response) => response?.data?.items || response?.data?.data || []),
    ]
  } catch (err) {
    error.value = err.message || 'Unable to load team members.'
  } finally {
    loading.value = false
  }
}

function manageMembers() {
  router.push('/administrators')
}

onMounted(loadMembers)
</script>

<template>
  <SettingsShell
    breadcrumb="Team"
    title="Team"
    description="Review members, invite new team access, and manage roles across the workspace."
    :dirty="false"
  >
    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Members</p>
          <h2>Members</h2>
        </div>
      </div>

      <div class="toolbar">
        <input v-model="search" type="search" placeholder="Search administrators" aria-label="Search administrators" />
        <select v-model="roleFilter" aria-label="Filter team by role">
          <option value="">All roles</option>
          <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Member</th><th>Role</th><th>Status</th><th>Last active</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="5" class="table-state">Loading administrator records…</td></tr>
            <tr v-else-if="error"><td colspan="5" class="table-state table-state--error">{{ error }} <button type="button" @click="loadMembers">Retry</button></td></tr>
            <tr v-else-if="!members.length"><td colspan="5" class="table-state">No administrators match this search.</td></tr>
            <tr v-for="member in members" v-else :key="member.id">
              <td>
                <div class="member-cell">
                  <span class="avatar">{{ member.avatar }}</span>
                  <div>
                    <strong>{{ member.name }}</strong>
                    <small>{{ member.email }}</small>
                  </div>
                </div>
              </td>
              <td><span v-for="role in member.roles" :key="role" class="role-chip">{{ role }}</span><span v-if="!member.roles.length">—</span></td>
              <td>{{ member.status }}</td>
              <td>{{ member.lastActive }}</td>
              <td><button v-if="canManageMembers" class="menu-button" type="button" :aria-label="`Manage ${member.name}`" @click="manageMembers">Manage</button><span v-else>—</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <BaseButton v-if="canManageMembers" class="inline-button" variant="ghost" @click="manageMembers">Manage administrators</BaseButton>
    </section>

    <div v-if="toast" class="settings-toast" role="status">{{ toast }}</div>
  </SettingsShell>
</template>

<style scoped lang="scss">
.settings-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 1.15rem 1.2rem;
}

.settings-section__header {
  margin-bottom: 1rem;
}

.settings-section__eyebrow {
  margin: 0 0 0.2rem;
  color: var(--accent-ink);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-section__header h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.1rem;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.toolbar input,
.toolbar select {
  min-height: 40px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-hover);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  color: var(--text-strong);
  font: inherit;
}

.toolbar input {
  flex: 1;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.75rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-body);
}

th {
  color: var(--text-muted);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.avatar {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: rgba(var(--accent-rgb) / 0.14);
  color: var(--text-strong);
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 50%;
}

.member-cell strong,
.member-cell small {
  display: block;
}

.member-cell small {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.role-chip {
  display: inline-flex;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(var(--accent-rgb) / 0.08);
  color: var(--text-strong);
  font-size: 0.7rem;
  font-weight: 700;
}

.table-state { padding: 1.5rem; color: var(--text-muted); text-align: center; }
.table-state--error { color: var(--danger); }
.table-state button { margin-left: 0.5rem; border: 0; background: transparent; color: var(--accent-ink); cursor: pointer; }

.menu-button,
.inline-button {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  padding: 0.55rem 0.75rem;
  font: inherit;
  cursor: pointer;
}

.inline-button {
  margin-top: 0.9rem;
}

.settings-toast {
  position: fixed;
  right: 1.2rem;
  bottom: 1.2rem;
  background: rgba(27, 31, 37, 0.95);
  color: var(--text-strong);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 0.75rem 0.9rem;
  box-shadow: 0 12px 28px rgba(0,0,0,0.24);
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .toolbar {
    flex-direction: column;
  }
}
</style>
