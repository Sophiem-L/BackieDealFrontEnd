<script setup>
import { computed, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { activityLogs, actionFilters, userFilters } from '@/data/activityLogs'

const actionFilter = ref('All Actions')
const userFilter = ref('All Users')

const filtered = computed(() =>
  activityLogs.filter((log) => {
    const actionOk = actionFilter.value === 'All Actions' || log.action === actionFilter.value
    const userOk = userFilter.value === 'All Users' || log.user === userFilter.value
    return actionOk && userOk
  }),
)

function exportLogs() {
  // TODO: wire to a real export endpoint. For now, download the current view as CSV.
  const header = ['Timestamp', 'User', 'Action Type', 'Details', 'Source']
  const rows = filtered.value.map((l) => [l.timestamp, l.user, l.action, l.details, l.ip])
  const csv = [header, ...rows]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'activity-logs.csv'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="page">
    <AppHeader title="System Logs & Activity" />

    <div class="page__body">
      <!-- Toolbar -->
      <section class="toolbar">
        <label class="select">
          <span class="select__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round" />
            </svg>
          </span>
          <select v-model="actionFilter">
            <option v-for="opt in actionFilters" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </label>

        <label class="select">
          <span class="select__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round" />
            </svg>
          </span>
          <select v-model="userFilter">
            <option v-for="opt in userFilters" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </label>

        <p class="toolbar__note">
          <span class="toolbar__note-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" stroke-linecap="round" />
            </svg>
          </span>
          Tracking all IP addresses and sensitive administrative changes.
        </p>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="ghost" @click="exportLogs">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3v12M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M5 21h14" stroke-linecap="round" />
            </svg>
          </template>
          Export logs
        </BaseButton>
      </section>

      <!-- Table -->
      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action Type</th>
              <th>Details</th>
              <th class="table__ip-head">Source</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filtered" :key="log.id">
              <td class="timestamp">{{ log.timestamp }}</td>
              <td class="user">{{ log.user }}</td>
              <td>
                <span class="action">{{ log.action }}</span>
              </td>
              <td class="details">{{ log.details }}</td>
              <td class="ip">{{ log.ip }}</td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="5" class="table__empty">No log entries match your filters.</td>
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

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__spacer { flex: 1; }

  &__note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-subtle);
  }

  &__note-icon {
    display: inline-flex;
    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }
  }
}

.select {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 0.7rem;

  &:focus-within { border-color: var(--border); }

  &__icon {
    display: inline-flex;
    color: var(--text-muted);
    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }
  }

  select {
    border: none;
    background: transparent;
    padding: 0.55rem 0.4rem 0.55rem 0;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-body);
    cursor: pointer;
    &:focus { outline: none; }
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

  &__ip-head { text-align: right; }

  &__empty { text-align: center; color: var(--text-subtle); font-size: 0.88rem; padding: 2.5rem 1rem; }
}

.timestamp { font-size: 0.8rem; color: var(--text-subtle); white-space: nowrap; }
.user { font-size: 0.88rem; font-weight: 700; color: var(--text-strong); }
.details { font-size: 0.85rem; color: var(--text-body); }

.action {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-body);
  background: var(--surface-track);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.ip {
  text-align: right;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: var(--text-faint);
  white-space: nowrap;
}
</style>
