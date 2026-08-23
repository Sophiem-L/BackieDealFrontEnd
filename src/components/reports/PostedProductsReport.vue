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
import { postedProducts, posterStaff, postedStatuses } from '@/data/reports'

const poster = ref('All Staff')
const status = ref('All Statuses')

const COLUMNS = [
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'postedBy', label: 'Posted By' },
  { key: 'postedAt', label: 'Posted' },
  { key: 'status', label: 'Status' },
  { key: 'unitsSold', label: 'Units Sold', align: 'right' },
]

const rows = computed(() =>
  postedProducts.filter((row) => {
    if (poster.value !== 'All Staff' && row.postedBy !== poster.value) return false
    if (status.value !== 'All Statuses' && row.status !== status.value) return false
    return true
  }),
)

const summary = computed(() => {
  const byPoster = new Map()
  for (const row of rows.value) {
    byPoster.set(row.postedBy, (byPoster.get(row.postedBy) ?? 0) + 1)
  }

  const top = [...byPoster.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    posted: rows.value.length,
    active: rows.value.filter((row) => row.status === 'Active').length,
    units: rows.value.reduce((sum, row) => sum + row.unitsSold, 0),
    topPoster: top ? top[0] : '—',
  }
})

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Product', width: 44, value: (r) => r.name },
  { key: 'sku', label: 'SKU', width: 18, value: (r) => r.sku },
  { key: 'category', label: 'Category', width: 20, value: (r) => r.category },
  { key: 'postedBy', label: 'Posted By', width: 20, value: (r) => r.postedBy },
  { key: 'role', label: 'Role', width: 20, value: (r) => r.role },
  { key: 'postedAt', label: 'Posted', width: 16, value: (r) => r.postedAt },
  { key: 'status', label: 'Status', width: 12, align: 'center', value: (r) => r.status },
  { key: 'unitsSold', label: 'Units Sold', width: 14, align: 'right', format: '#,##0', total: true, value: (r) => r.unitsSold },
]
</script>

<template>
  <ReportPanel
    title="Posted products"
    subtitle="Who listed each product, and how it has sold since."
  >
    <template #actions>
      <Select v-model="poster">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by staff">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21a7 7 0 0 1 14 0" stroke-linecap="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in posterStaff"
            :key="option"
            :value="option"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="status">
        <SelectTrigger :class="TOOLBAR_SELECT.trigger" aria-label="Filter by status">
          <svg :class="TOOLBAR_SELECT.icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          <SelectValue />
        </SelectTrigger>
        <SelectContent :class="TOOLBAR_SELECT.content">
          <SelectItem
            v-for="option in postedStatuses"
            :key="option"
            :value="option"
            :class="TOOLBAR_SELECT.item"
          >
            {{ option }}
          </SelectItem>
        </SelectContent>
      </Select>

      <ReportExportMenu
        sheet="Posted Products"
        tab="posted-products"
        :rows="rows"
        :columns="EXPORT_COLUMNS"
      />
    </template>

    <ul class="strip">
      <li>
        <span class="strip__label">Products posted</span>
        <span class="strip__value">{{ summary.posted.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Active listings</span>
        <span class="strip__value">{{ summary.active.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Units sold</span>
        <span class="strip__value">{{ summary.units.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Top poster</span>
        <span class="strip__value strip__value--text">{{ summary.topPoster }}</span>
      </li>
    </ul>

    <ReportTable
      :columns="COLUMNS"
      :row-count="rows.length"
      empty="No posted products match these filters."
    >
      <tr v-for="row in rows" :key="row.id">
        <td>
          <span class="cell-name">{{ row.name }}</span>
          <span class="cell-sku">{{ row.sku }}</span>
        </td>
        <td><span class="chip">{{ row.category }}</span></td>
        <td>
          <span class="cell-name">{{ row.postedBy }}</span>
          <span class="cell-sku">{{ row.role }}</span>
        </td>
        <td class="dim">{{ row.postedAt }}</td>
        <td>
          <span class="badge" :class="`badge--${row.status.toLowerCase()}`">{{ row.status }}</span>
        </td>
        <td class="table__right num">{{ row.unitsSold.toLocaleString() }}</td>
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

.cell-sku {
  display: block;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-subtle);
  margin-top: 0.15rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-track);
  border-radius: 999px;
}

.dim {
  font-size: 0.8rem;
  color: var(--text-subtle);
}

.num {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

/* Listing lifecycle, not order status — Active/Draft/Archived, matching the
   Products page. */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 999px;

  &--active {
    background: var(--success-bg);
    color: var(--success);
  }

  &--draft {
    background: rgb(var(--accent-rgb) / 0.18);
    color: var(--accent-ink);
  }

  &--archived {
    background: var(--surface-track);
    color: var(--text-muted);
  }
}
</style>
