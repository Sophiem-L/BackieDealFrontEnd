<script setup>
import { computed, ref } from 'vue'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import GranularityTabs from './GranularityTabs.vue'
import TrendChart from './TrendChart.vue'
import { customerOrders } from '@/data/reports'
import { exportReport, reportFileName } from '@/services/reportExport'

const granularity = ref('monthly')

const COLUMNS = [
  { key: 'period', label: 'Period' },
  { key: 'orders', label: 'Orders', align: 'right' },
  { key: 'uniqueCustomers', label: 'Unique Customers', align: 'right' },
  { key: 'newCustomers', label: 'New', align: 'right' },
  { key: 'returningCustomers', label: 'Returning', align: 'right' },
  { key: 'split', label: 'New vs Returning' },
  { key: 'avgItems', label: 'Avg. Items / Order', align: 'right' },
]

const rows = computed(() => customerOrders[granularity.value])

const points = computed(() => rows.value.map((row) => ({ label: row.period, value: row.orders })))

const totals = computed(() => {
  const orders = rows.value.reduce((sum, row) => sum + row.orders, 0)
  const newCustomers = rows.value.reduce((sum, row) => sum + row.newCustomers, 0)
  const returning = rows.value.reduce((sum, row) => sum + row.returningCustomers, 0)
  return { orders, newCustomers, returning }
})

function newPct(row) {
  const unique = row.uniqueCustomers
  return unique ? (row.newCustomers / unique) * 100 : 0
}

const exporting = ref(false)

async function onExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    await exportReport({
      sheet: 'Customer Orders',
      filename: reportFileName('customer-orders', granularity.value),
      rows: rows.value,
      columns: [
        { label: 'Period', width: 20, value: (r) => r.period },
        { label: 'Orders', width: 12, align: 'right', format: '#,##0', total: true, value: (r) => r.orders },
        { label: 'Unique Customers', width: 20, align: 'right', format: '#,##0', total: true, value: (r) => r.uniqueCustomers },
        { label: 'New Customers', width: 18, align: 'right', format: '#,##0', total: true, value: (r) => r.newCustomers },
        { label: 'Returning', width: 14, align: 'right', format: '#,##0', total: true, value: (r) => r.returningCustomers },
        { label: 'Avg. Items / Order', width: 18, align: 'right', format: '0.0', value: (r) => r.avgItems },
      ],
    })
  } catch (err) {
    console.error('Customer orders export failed', err)
    window.alert('Sorry, the export could not be generated. Please try again.')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="stack">
    <ReportPanel title="Customer orders" subtitle="Order volume across the selected period.">
      <template #actions>
        <GranularityTabs v-model="granularity" />
        <span class="legend"><i></i> Orders</span>
      </template>

      <p class="metric">
        {{ totals.orders.toLocaleString() }}<span> orders across {{ rows.length }} periods</span>
      </p>

      <TrendChart :points="points" unit="orders" />
    </ReportPanel>

    <ReportPanel title="Breakdown" subtitle="New versus returning customers per period.">
      <template #actions>
        <button type="button" class="btn-export" :disabled="exporting" @click="onExport">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
          </svg>
          {{ exporting ? 'Exporting…' : 'Export' }}
        </button>
      </template>

      <ReportTable :columns="COLUMNS" :row-count="rows.length">
        <tr v-for="row in rows" :key="row.period">
          <td class="cell-period">{{ row.period }}</td>
          <td class="table__right num">{{ row.orders.toLocaleString() }}</td>
          <td class="table__right num">{{ row.uniqueCustomers.toLocaleString() }}</td>
          <td class="table__right num">{{ row.newCustomers.toLocaleString() }}</td>
          <td class="table__right num">{{ row.returningCustomers.toLocaleString() }}</td>
          <td>
            <div
              class="split"
              :title="`${row.newCustomers} new · ${row.returningCustomers} returning`"
            >
              <div class="split__new" :style="{ width: newPct(row) + '%' }"></div>
            </div>
          </td>
          <td class="table__right num">{{ row.avgItems.toFixed(1) }}</td>
        </tr>
      </ReportTable>

      <p class="footnote">
        <i class="dot dot--new"></i> New
        <i class="dot dot--ret"></i> Returning
        <span>· {{ totals.newCustomers.toLocaleString() }} new and
          {{ totals.returning.toLocaleString() }} returning in this period</span>
      </p>
    </ReportPanel>
  </div>
</template>

<style scoped lang="scss">

.stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.metric {
  margin: 0 0 1rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-strong);

  span {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-subtle);
  }
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: var(--text-subtle);

  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: rgb(var(--accent-rgb));
  }
}

.cell-period {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.num {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

/* Proportional new-vs-returning bar: the track is the returning share, the fill
   the new share, so the two always read as one whole. */
.split {
  min-width: 120px;
  height: 8px;
  border-radius: 999px;
  background: var(--info);
  overflow: hidden;

  &__new {
    height: 100%;
    border-radius: 999px 0 0 999px;
    background: rgb(var(--accent-rgb));
  }
}

.footnote {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 1rem 0 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-subtle);

  span {
    font-weight: 500;
  }
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;

  &--new {
    background: rgb(var(--accent-rgb));
  }

  &--ret {
    background: var(--info);
    margin-left: 0.5rem;
  }
}
</style>
