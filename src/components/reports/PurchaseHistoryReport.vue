<script setup>
import { computed, ref } from 'vue'
import ReportPanel from './ReportPanel.vue'
import ReportTable from './ReportTable.vue'
import ReportSubTable from './ReportSubTable.vue'
import ExpandToggle from './ExpandToggle.vue'
import ReportExportMenu from './ReportExportMenu.vue'
import { purchaseHistory } from '@/data/reports'
import { currency } from '@/lib/format'

const search = ref('')

const COLUMNS = [
  { key: 'expand', label: '' },
  { key: 'customer', label: 'Customer' },
  { key: 'orders', label: 'Orders', align: 'right' },
  { key: 'lifetime', label: 'Lifetime Total', align: 'right' },
  { key: 'last', label: 'Last Order' },
]

const ORDER_COLUMNS = [
  { key: 'number', label: 'Order #' },
  { key: 'date', label: 'Date' },
  { key: 'items', label: 'Items', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total', align: 'right' },
]

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return purchaseHistory

  return purchaseHistory.filter(
    (row) =>
      row.name.toLowerCase().includes(term) ||
      row.email.toLowerCase().includes(term) ||
      row.orders.some((order) => order.number.toLowerCase().includes(term)),
  )
})

const summary = computed(() => {
  const orders = rows.value.reduce((sum, row) => sum + row.orderCount, 0)
  const lifetime = rows.value.reduce((sum, row) => sum + row.lifetimeTotal, 0)

  return {
    customers: rows.value.length,
    orders,
    // Rounded so float drift doesn't surface as 3212.9200000000005.
    lifetime: Math.round(lifetime * 100) / 100,
    // Guarded: an empty search result would otherwise divide by zero and show NaN.
    avgOrder: orders ? Math.round((lifetime / orders) * 100) / 100 : 0,
  }
})

const expanded = ref(new Set())

function toggle(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

const EXPORT_COLUMNS = [
  { key: 'customer', label: 'Customer', width: 22, value: (r) => r.name },
  { key: 'email', label: 'Email', width: 28, value: (r) => r.email },
  { key: 'orders', label: 'Orders', width: 10, align: 'right', format: '#,##0', total: true, value: (r) => r.orderCount },
  { key: 'lifetime', label: 'Lifetime Total', width: 18, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.lifetimeTotal },
  { key: 'last', label: 'Last Order', width: 18, value: (r) => r.lastOrder },
]
</script>

<template>
  <ReportPanel
    title="Customer purchase history"
    subtitle="Lifetime orders per customer. Expand a row for the full order list."
  >
    <template #actions>
      <label class="searchbox">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" stroke-linecap="round" />
        </svg>
        <input v-model="search" type="search" placeholder="Search name, email or order #…" />
      </label>

      <ReportExportMenu
        sheet="Purchase History"
        tab="purchase-history"
        :rows="rows"
        :columns="EXPORT_COLUMNS"
      />
    </template>

    <ul class="strip">
      <li>
        <span class="strip__label">Customers</span>
        <span class="strip__value">{{ summary.customers.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Orders</span>
        <span class="strip__value">{{ summary.orders.toLocaleString() }}</span>
      </li>
      <li>
        <span class="strip__label">Lifetime total</span>
        <span class="strip__value">{{ currency.format(summary.lifetime) }}</span>
      </li>
      <li>
        <span class="strip__label">Avg. order value</span>
        <span class="strip__value">{{ currency.format(summary.avgOrder) }}</span>
      </li>
    </ul>

    <ReportTable
      :columns="COLUMNS"
      :row-count="rows.length"
      empty="No customers match this search."
    >
      <template v-for="row in rows" :key="row.customerId">
        <tr>
          <td class="cell-toggle">
            <!-- A customer with no orders has nothing to expand, so it gets no
                 control rather than one that opens an empty table. -->
            <ExpandToggle
              v-if="row.orderCount > 0"
              :expanded="expanded.has(row.customerId)"
              :controls="`customer-orders-${row.customerId}`"
              :label="`orders for ${row.name}`"
              @toggle="toggle(row.customerId)"
            />
          </td>
          <td>
            <span class="cell-name">{{ row.name }}</span>
            <span class="cell-email">{{ row.email }}</span>
          </td>
          <td class="table__right num">{{ row.orderCount.toLocaleString() }}</td>
          <td class="table__right money">{{ currency.format(row.lifetimeTotal) }}</td>
          <td class="dim">{{ row.lastOrder }}</td>
        </tr>

        <ReportSubTable
          v-if="row.orderCount > 0 && expanded.has(row.customerId)"
          :id="`customer-orders-${row.customerId}`"
          :span="COLUMNS.length"
          :columns="ORDER_COLUMNS"
          :caption="`${row.orderCount} orders`"
        >
          <tr v-for="order in row.orders" :key="order.number">
            <td class="ordernum">{{ order.number }}</td>
            <td class="dim">{{ order.date }}</td>
            <td class="sub__right">{{ order.items }}</td>
            <td>
              <span class="badge" :class="`badge--${order.status.toLowerCase()}`">
                {{ order.status }}
              </span>
            </td>
            <td class="sub__right money">{{ currency.format(order.total) }}</td>
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
  }
}

.cell-toggle {
  width: 44px;
}

.cell-name {
  display: block;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.cell-email {
  display: block;
  font-size: 0.74rem;
  color: var(--text-subtle);
  margin-top: 0.15rem;
}

.num {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.money {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-strong);
}

.dim {
  font-size: 0.8rem;
  color: var(--text-subtle);
}

.ordernum {
  font-weight: 600;
  color: var(--text-strong);
}

/* Same status vocabulary as the Orders page, so a status means one thing
   across the admin. */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 999px;

  &--completed {
    background: var(--success-bg);
    color: var(--success);
  }

  &--processing {
    background: var(--info-bg);
    color: var(--info);
  }

  &--pending {
    background: rgb(var(--accent-rgb) / 0.18);
    color: var(--accent-ink);
  }

  &--cancelled {
    background: var(--danger-bg);
    color: var(--danger);
  }
}
</style>
