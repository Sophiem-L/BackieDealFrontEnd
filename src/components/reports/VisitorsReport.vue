<script setup>
import { computed, ref } from 'vue'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import ReportSubTable from './ReportSubTable.vue'
import ExpandToggle from './ExpandToggle.vue'
import ReportExportMenu from './ReportExportMenu.vue'
import { visitorLogs } from '@/data/reports'

const search = ref('')

const COLUMNS = [
  { key: 'expand', label: '' },
  { key: 'ip', label: 'IP Address' },
  { key: 'visits', label: 'Visits', align: 'right' },
  { key: 'firstSeen', label: 'First Seen' },
  { key: 'lastSeen', label: 'Last Seen' },
  { key: 'lastPage', label: 'Last Page' },
]

const HIT_COLUMNS = [
  { key: 'at', label: 'Time' },
  { key: 'action', label: 'Action' },
  { key: 'targetUrl', label: 'Target URL' },
  { key: 'sessionId', label: 'Session' },
]

// Search reaches into the hits as well as the summary: an admin looking for who
// hit /checkout shouldn't have to expand eight rows to find out.
const rows = computed(() => {
  const term = search.value.trim().toLowerCase()

  const scoped = term
    ? visitorLogs.filter(
        (log) =>
          log.ip.toLowerCase().includes(term) ||
          log.lastPage.toLowerCase().includes(term) ||
          log.hits.some(
            (hit) =>
              hit.targetUrl.toLowerCase().includes(term) ||
              hit.action.toLowerCase().includes(term),
          ),
      )
    : visitorLogs

  return [...scoped].sort((a, b) => b.visits - a.visits)
})

// Follows the search rather than reporting the whole log, so the strip and the
// table below it never disagree.
const summary = computed(() => {
  const visits = rows.value.reduce((sum, row) => sum + row.visits, 0)
  const hits = rows.value.reduce((sum, row) => sum + row.hits.length, 0)

  return {
    addresses: rows.value.length,
    visits,
    hits,
    busiest: rows.value[0]?.ip ?? '—',
  }
})

const expanded = ref(new Set())

// A Set, not a single id: comparing two addresses' sessions side by side is the
// main reason to open these at all.
function toggle(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const EXPORT_COLUMNS = [
  { key: 'ip', label: 'IP Address', width: 18, value: (r) => r.ip },
  { key: 'visits', label: 'Visits', width: 10, align: 'right', format: '#,##0', total: true, value: (r) => r.visits },
  { key: 'hits', label: 'Logged Hits', width: 14, align: 'right', format: '#,##0', total: true, value: (r) => r.hits.length },
  { key: 'firstSeen', label: 'First Seen', width: 22, value: (r) => r.firstSeen },
  { key: 'lastSeen', label: 'Last Seen', width: 22, value: (r) => r.lastSeen },
  { key: 'lastPage', label: 'Last Page', width: 40, value: (r) => r.lastPage },
]
</script>

<template>
  <ReportPanel
    title="Visitor tracking"
    subtitle="Recorded IP addresses and the pages each one reached."
  >
    <template #actions>
      <label class="searchbox">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" stroke-linecap="round" />
        </svg>
        <input v-model="search" type="search" placeholder="Search IP, URL or action…" />
      </label>

      <ReportExportMenu sheet="Visitors" tab="visitors" :rows="rows" :columns="EXPORT_COLUMNS" />
    </template>

    <ul class="strip">
      <li>
        <span class="strip__label">IP addresses</span>
        <span class="strip__value">{{ summary.addresses.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Total visits</span>
        <span class="strip__value">{{ summary.visits.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Logged hits</span>
        <span class="strip__value">{{ summary.hits.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Busiest address</span>
        <span class="strip__value strip__value--text mono">{{ summary.busiest }}</span>
      </li>
    </ul>

    <ReportTable :columns="COLUMNS" :row-count="rows.length" empty="No visitors match this search.">
      <template v-for="row in rows" :key="row.id">
        <tr>
          <td class="cell-toggle">
            <ExpandToggle
              :expanded="expanded.has(row.id)"
              :controls="`visitor-hits-${row.id}`"
              :label="`activity for ${row.ip}`"
              @toggle="toggle(row.id)"
            />
          </td>
          <td class="mono cell-ip">{{ row.ip }}</td>
          <td class="table__right num">{{ row.visits.toLocaleString() }}</td>
          <td class="dim">{{ row.firstSeen }}</td>
          <td class="dim">{{ row.lastSeen }}</td>
          <td class="mono url">{{ row.lastPage }}</td>
        </tr>

        <ReportSubTable
          v-if="expanded.has(row.id)"
          :id="`visitor-hits-${row.id}`"
          :span="COLUMNS.length"
          :columns="HIT_COLUMNS"
          :caption="`${row.hits.length} logged hits`"
        >
          <tr v-for="(hit, index) in row.hits" :key="`${row.id}-${index}`">
            <td class="dim">{{ hit.at }}</td>
            <td><span class="tag" :class="`tag--${hit.action}`">{{ hit.action }}</span></td>
            <td class="mono">{{ hit.targetUrl }}</td>
            <td class="mono dim">{{ hit.sessionId }}</td>
          </tr>
        </ReportSubTable>
      </template>
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

.cell-toggle {
  width: 44px;
}

.cell-ip {
  font-weight: 600;
  color: var(--text-strong);
}

.num {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.dim {
  font-size: 0.8rem;
  color: var(--text-subtle);
}

/* Tabular figures so addresses and session ids align down the column. */
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
}

.url {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-body);
}

/* Distinct tones per action, so an expanded session reads as a funnel rather
   than as an undifferentiated list. */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 999px;
  background: var(--surface-track);
  color: var(--text-muted);

  &--page_view {
    background: var(--surface-track);
    color: var(--text-muted);
  }

  &--search {
    background: var(--info-bg);
    color: var(--info);
  }

  &--product_view {
    background: rgb(var(--accent-rgb) / 0.18);
    color: var(--accent-ink);
  }

  &--add_to_cart {
    background: var(--violet-bg);
    color: var(--violet);
  }

  &--checkout {
    background: var(--success-bg);
    color: var(--success);
  }
}
</style>
