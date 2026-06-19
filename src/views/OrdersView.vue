<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

const router = useRouter()

// Status tabs — counts mirror the mock; "all" shows everything.
const tabs = [
  { key: 'all', label: 'All Orders', count: 142 },
  { key: 'pending', label: 'Pending', count: 24 },
  { key: 'processing', label: 'Processing', count: 12 },
  { key: 'completed', label: 'Completed', count: 98 },
  { key: 'cancelled', label: 'Cancelled', count: 8 },
]
const activeTab = ref('all')

const search = ref('')

const orders = ref([
  {
    id: '#ORD-1042',
    placedAt: 'Oct 25, 2023 10:30 AM',
    customer: 'Sarah Jenkins',
    item: 'Custom PC Build',
    spec: 'RTX 4090, i9-14900K, 64GB DDR5',
    payment: 'Online (QR Code)',
    paymentIcon: 'qr',
    amount: '$4,299.00',
    status: 'pending',
  },
  {
    id: '#ORD-1041',
    placedAt: 'Oct 25, 2023 09:15 AM',
    customer: 'Michael Chen',
    item: 'Gaming Peripherals',
    spec: 'Logitech G Pro Keyboard, G502 Mouse',
    payment: 'Cash on Delivery',
    paymentIcon: 'card',
    amount: '$249.98',
    status: 'processing',
  },
  {
    id: '#ORD-1040',
    placedAt: 'Oct 24, 2023 04:45 PM',
    customer: 'David Smith',
    item: 'Upgrade Kit',
    spec: '32GB RAM, 2TB Samsung NVMe SSD',
    payment: 'Online (QR Code)',
    paymentIcon: 'qr',
    amount: '$385.50',
    status: 'completed',
  },
  {
    id: '#ORD-1039',
    placedAt: 'Oct 24, 2023 02:20 PM',
    customer: 'Emma Wilson',
    item: 'Display Monitor',
    spec: 'ASUS ROG Swift 27" 144Hz',
    payment: 'Bank Transfer',
    paymentIcon: 'card',
    amount: '$549.00',
    status: 'pending',
  },
  {
    id: '#ORD-1038',
    placedAt: 'Oct 24, 2023 11:10 AM',
    customer: 'James Carter',
    item: 'External Storage',
    spec: '10TB WD Elements Hard Drive',
    payment: 'Online (QR Code)',
    paymentIcon: 'qr',
    amount: '$199.00',
    status: 'completed',
  },
  {
    id: '#ORD-1037',
    placedAt: 'Oct 23, 2023 05:02 PM',
    customer: 'Olivia Brown',
    item: 'Mechanical Keyboard',
    spec: 'Keychron Q1, Gateron Brown',
    payment: 'Cash on Delivery',
    paymentIcon: 'card',
    amount: '$189.00',
    status: 'cancelled',
  },
  {
    id: '#ORD-1036',
    placedAt: 'Oct 23, 2023 01:48 PM',
    customer: 'Liam Nguyen',
    item: 'Power Supply',
    spec: 'Corsair RM1000x 1000W 80+ Gold',
    payment: 'Bank Transfer',
    paymentIcon: 'card',
    amount: '$199.99',
    status: 'processing',
  },
])

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// Tab + search filtering
const filteredOrders = computed(() => {
  const q = search.value.trim().toLowerCase()
  return orders.value.filter((order) => {
    const matchesTab = activeTab.value === 'all' || order.status === activeTab.value
    const matchesSearch =
      !q ||
      order.id.toLowerCase().includes(q) ||
      order.customer.toLowerCase().includes(q) ||
      order.item.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  })
})

// Row selection
const selected = ref(new Set())
const allSelected = computed(
  () =>
    filteredOrders.value.length > 0 &&
    filteredOrders.value.every((o) => selected.value.has(o.id)),
)
function toggleRow(id) {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}
function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(filteredOrders.value.map((o) => o.id))
  }
}

// Actions
function viewOrder(order) {
  // Strip the leading '#' so the id reads cleanly in the URL.
  router.push({ name: 'order-detail', params: { id: order.id.replace(/^#/, '') } })
}
function printOrder() {
  window.print()
}
</script>

<template>
  <div class="page">
    <AppHeader title="Orders Management" />

    <div class="page__body">
      <!-- Toolbar -->
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input
            v-model="search"
            type="search"
            placeholder="Search by Order ID, Customer, or Product..."
          />
        </label>

        <div class="select">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          Filter Status
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="select">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" stroke-linecap="round" />
          </svg>
          Oct 2023
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="primary" :to="{ name: 'order-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          Create New Order
        </BaseButton>
      </section>

      <!-- Table card with status tabs -->
      <section class="table-card">
        <header class="tabs">
          <nav class="tabs__list">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="tabs__tab"
              :class="{ 'is-active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              {{ tab.label }} ({{ tab.count }})
            </button>
          </nav>
          <div class="tabs__meta">
            <span class="tabs__count">Showing 1-{{ filteredOrders.length }} of 142</span>
            <div class="tabs__nav">
              <button type="button" class="icon-btn" aria-label="Previous page">
                <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              <button type="button" class="icon-btn" aria-label="Next page">
                <svg viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            </div>
          </div>
        </header>

        <table class="table">
          <thead>
            <tr>
              <th class="table__check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>Order Detail</th>
              <th>Items &amp; Specs</th>
              <th>Payment</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.id">
              <td class="table__check">
                <input
                  type="checkbox"
                  :checked="selected.has(order.id)"
                  @change="toggleRow(order.id)"
                />
              </td>
              <td>
                <p class="order__id">{{ order.id }}</p>
                <p class="order__date">{{ order.placedAt }}</p>
                <p class="order__customer">{{ order.customer }}</p>
              </td>
              <td>
                <p class="item__name">{{ order.item }}</p>
                <p class="item__spec">{{ order.spec }}</p>
              </td>
              <td>
                <div class="payment">
                  <span class="payment__icon" aria-hidden="true">
                    <svg v-if="order.paymentIcon === 'qr'" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3M21 21v.01M17 21h.01M21 17v.01" stroke-linecap="round" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none">
                      <rect x="2.5" y="5" width="19" height="14" rx="2" />
                      <path d="M2.5 9.5h19" stroke-linecap="round" />
                    </svg>
                  </span>
                  <span class="payment__label">{{ order.payment }}</span>
                </div>
              </td>
              <td class="amount">{{ order.amount }}</td>
              <td>
                <span class="badge" :class="`badge--${order.status}`">
                  {{ statusLabels[order.status] }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    title="View order"
                    aria-label="View order"
                    @click="viewOrder(order)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    title="Print order"
                    aria-label="Print order"
                    @click="printOrder(order)"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M6 9V3h12v6" stroke-linejoin="round" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" stroke-linejoin="round" />
                      <rect x="6" y="14" width="12" height="7" rx="1" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredOrders.length === 0">
              <td colspan="7" class="table__empty">No orders match your filters.</td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <footer class="pagination">
          <p class="pagination__info">
            Showing 1 to {{ filteredOrders.length }} of 142 orders
          </p>
          <div class="pagination__controls">
            <button type="button" class="page-btn">Previous</button>
            <button type="button" class="page-btn page-btn--active">1</button>
            <button type="button" class="page-btn">2</button>
            <button type="button" class="page-btn">3</button>
            <span class="page-ellipsis">…</span>
            <button type="button" class="page-btn">15</button>
            <button type="button" class="page-btn">Next</button>
          </div>
        </footer>
      </section>
    </div>
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

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: #f4f5f7;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within {
      background: #fff;
      border-color: #e6e8ec;
    }
  }

  &__search-icon {
    display: inline-flex;
    color: $muted;
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__spacer { flex: 1; }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: $color-text;
    &:focus { outline: none; }
  }
}

.select {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: #4a5160;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;

  svg { width: 14px; height: 14px; stroke: $muted; stroke-width: 1.8; }
}

/* Table card */
.table-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  overflow: visible;
}

/* Status tabs */
.tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 1rem 0;
  border-bottom: 1px solid $divider;
  flex-wrap: wrap;

  &__list {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  &__tab {
    position: relative;
    padding: 0.7rem 0.85rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    color: $muted;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;

    &:hover { color: $color-text; }

    &.is-active {
      color: #1f242d;
      border-bottom-color: $accent;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding-bottom: 0.5rem;
  }

  &__count { font-size: 0.78rem; color: $muted; }

  &__nav { display: flex; gap: 0.3rem; }
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1rem;
    vertical-align: middle;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #9099a6;
    border-bottom: 1px solid $divider;
    background: #fafbfc;
  }

  tbody tr + tr td { border-top: 1px solid $divider; }
  tbody tr:hover { background: #fafbfc; }

  &__check { width: 44px; }
  &__actions-head { text-align: right; }

  &__empty {
    text-align: center;
    color: $muted;
    font-size: 0.88rem;
    padding: 2.5rem 1rem;
  }

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: $accent;
    cursor: pointer;
  }
}

/* Order detail cell */
.order {
  &__id {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 700;
    color: #a8850a;
  }
  &__date {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: $muted;
  }
  &__customer {
    margin: 0.3rem 0 0;
    font-size: 0.86rem;
    font-weight: 600;
    color: $color-text;
  }
}

/* Items cell */
.item {
  &__name {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 600;
    color: $color-text;
  }
  &__spec {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: $muted;
  }
}

/* Payment cell */
.payment {
  display: flex;
  align-items: center;
  gap: 0.55rem;

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: #f4f5f7;
    color: #6b7280;
    flex-shrink: 0;
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.7; }
  }

  &__label { font-size: 0.84rem; color: #4a5160; }
}

.amount { font-size: 0.9rem; font-weight: 700; color: $color-text; }

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;

  &--pending { background: #fff2d6; color: #b8890b; }
  &--processing { background: rgba($accent, 0.22); color: #a8780a; }
  &--completed { background: #e6f7ee; color: #1f9d57; }
  &--cancelled { background: #fdecec; color: #d14343; }
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;

  &:hover { background: #f6f7f9; color: $color-text; border-color: #dfe2e7; }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid $divider;
  flex-wrap: wrap;

  &__info { margin: 0; font-size: 0.82rem; color: $muted; }
  &__controls { display: flex; align-items: center; gap: 0.4rem; }
}

.page-ellipsis { color: $muted; padding: 0 0.2rem; }

.page-btn {
  min-width: 36px;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  color: #4a5160;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  cursor: pointer;

  &:hover { background: #f6f7f9; }

  &--active {
    background: $accent;
    border-color: $accent;
    color: #1f242d;
  }
}
</style>
