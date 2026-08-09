<script setup>
import { computed, ref } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import ReportExportMenu from './ReportExportMenu.vue'
import { userActions, actionStaff, actionEventTypes } from '@/data/reports'

const staff = ref('All Staff')
const eventType = ref('All Events')
const search = ref('')

const COLUMNS = [
  { key: 'at', label: 'Time' },
  { key: 'staff', label: 'Staff' },
  { key: 'eventType', label: 'Event' },
  { key: 'description', label: 'Description' },
  { key: 'ip', label: 'IP Address' },
]

// The option lists already carry their own "All …" sentinel, so the filters
// compare against it rather than keeping a separate empty state.
const rows = computed(() => {
  const term = search.value.trim().toLowerCase()

  return userActions.filter((row) => {
    if (staff.value !== 'All Staff' && row.staff !== staff.value) return false
    if (eventType.value !== 'All Events' && row.eventType !== eventType.value) return false
    if (!term) return true

    return (
      row.description.toLowerCase().includes(term) ||
      row.staff.toLowerCase().includes(term) ||
      row.eventType.toLowerCase().includes(term) ||
      row.ip.includes(term)
    )
  })
})

const summary = computed(() => {
  const byStaff = new Map()
  for (const row of rows.value) {
    byStaff.set(row.staff, (byStaff.get(row.staff) ?? 0) + 1)
  }

  const busiest = [...byStaff.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    actions: rows.value.length,
    staff: byStaff.size,
    events: new Set(rows.value.map((row) => row.eventType)).size,
    busiest: busiest ? busiest[0] : '—',
  }
})

const EXPORT_COLUMNS = [
  { key: 'at', label: 'Time', width: 22, value: (r) => r.at },
  { key: 'staff', label: 'Staff', width: 20, value: (r) => r.staff },
  { key: 'role', label: 'Role', width: 20, value: (r) => r.role },
  { key: 'eventType', label: 'Event', width: 20, value: (r) => r.eventType },
  { key: 'description', label: 'Description', width: 56, value: (r) => r.description },
  { key: 'ip', label: 'IP Address', width: 18, value: (r) => r.ip },
]
</script>

<template>
  <ReportPanel
    title="User action tracking"
    subtitle="What staff did in the admin, and from which address."
  >
    <template #actions>
      <label class="searchbox">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" stroke-linecap="round" />
        </svg>
        <input v-model="search" type="search" placeholder="Search actions…" />
      </label>

      <Select v-model="staff">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by staff">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21a7 7 0 0 1 14 0" stroke-linecap="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in actionStaff"
            :key="option"
            :value="option"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="eventType">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by event type">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in actionEventTypes"
            :key="option"
            :value="option"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <ReportExportMenu
        sheet="User Actions"
        tab="user-actions"
        :rows="rows"
        :columns="EXPORT_COLUMNS"
      />
    </template>

    <ul class="strip">
      <li>
        <span class="strip__label">Actions logged</span>
        <span class="strip__value">{{ summary.actions.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Staff involved</span>
        <span class="strip__value">{{ summary.staff.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Event types</span>
        <span class="strip__value">{{ summary.events.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Most active</span>
        <span class="strip__value strip__value--text">{{ summary.busiest }}</span>
      </li>
    </ul>

    <ReportTable :columns="COLUMNS" :row-count="rows.length" empty="No actions match these filters.">
      <tr v-for="row in rows" :key="row.id">
        <td class="dim">{{ row.at }}</td>
        <td>
          <span class="cell-name">{{ row.staff }}</span>
          <span class="cell-role">{{ row.role }}</span>
        </td>
        <td><span class="chip">{{ row.eventType }}</span></td>
        <td class="desc">{{ row.description }}</td>
        <td class="mono">{{ row.ip }}</td>
      </tr>
    </ReportTable>
  </ReportPanel>
</template>

<style scoped lang="scss">

.strip {
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, 1fr);
  }

  li {
    background: var(--surface-sunken);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 0.85rem 1rem;
  }

  &__label {
    display: block;
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--text-subtle);
    margin-bottom: 0.3rem;
  }

  &__value {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-strong);

    &--text {
      font-size: 0.95rem;
    }
  }
}

.cell-name {
  display: block;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.cell-role {
  display: block;
  font-size: 0.74rem;
  color: var(--text-subtle);
  margin-top: 0.15rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  background: var(--surface-track);
  border-radius: 999px;
}

.desc {
  font-size: 0.84rem;
  color: var(--text-body);
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dim {
  font-size: 0.8rem;
  color: var(--text-subtle);
}

/* Matches the Visitors tab so an address looks the same wherever it appears. */
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: var(--text-body);
}
</style>
