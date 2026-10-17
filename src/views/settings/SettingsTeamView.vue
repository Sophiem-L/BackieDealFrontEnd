<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettingsSection, saveSettingsSection, FALLBACK_SETTINGS } from '@/services/settingsApi.js'
import SettingsShell from '@/views/settings/SettingsShell.vue'

const auth = useAuthStore()
const fallback = JSON.parse(JSON.stringify(FALLBACK_SETTINGS.team))
const initialState = ref(JSON.parse(JSON.stringify(fallback)))
const form = reactive(JSON.parse(JSON.stringify(fallback)))
const saving = ref(false)
const toast = ref('')
const dirty = () => JSON.stringify(form) !== JSON.stringify(initialState.value)

onMounted(async () => {
  try {
    const remote = await fetchSettingsSection('team', auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
  } catch (error) {
    console.warn('Team settings failed to load from API.', error)
  }
})

async function save() {
  saving.value = true

  try {
    const remote = await saveSettingsSection('team', form, auth.accessToken)
    Object.assign(form, JSON.parse(JSON.stringify(remote)))
    Object.assign(initialState.value, JSON.parse(JSON.stringify(remote)))
    toast.value = 'Team settings saved.'
  } catch (error) {
    toast.value = 'Unable to save team settings right now.'
    console.error(error)
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 2200)
  }
}

function discard() {
  Object.assign(form, JSON.parse(JSON.stringify(initialState.value)))
  toast.value = 'Changes discarded.'
  setTimeout(() => (toast.value = ''), 1400)
}
</script>

<template>
  <SettingsShell
    breadcrumb="Team"
    title="Team"
    description="Review members, invite new team access, and manage roles across the workspace."
    :dirty="dirty()"
    :saving="saving"
    @save="save"
    @discard="discard"
  >
    <section class="settings-card">
      <div class="settings-section__header">
        <div>
          <p class="settings-section__eyebrow">Members</p>
          <h2>Members</h2>
        </div>
      </div>

      <div class="toolbar">
        <input type="search" placeholder="Search members" />
        <select>
          <option v-for="filter in form.filters" :key="filter" :value="filter">{{ filter }}</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Member</th><th>Role</th><th>Status</th><th>Last active</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="member in form.members" :key="member.email">
              <td>
                <div class="member-cell">
                  <span class="avatar">{{ member.avatar }}</span>
                  <div>
                    <strong>{{ member.name }}</strong>
                    <small>{{ member.email }}</small>
                  </div>
                </div>
              </td>
              <td><span class="role-chip">{{ member.role }}</span></td>
              <td>{{ member.status }}</td>
              <td>{{ member.lastActive }}</td>
              <td><button class="menu-button" type="button">⋯</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="inline-button" type="button">Invite member</button>
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
