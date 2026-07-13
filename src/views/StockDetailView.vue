<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const router = useRouter()

// Sample inventory records (stands in for an API fetch by id), keyed to the
// rows on the Stock Management list.
const records = {
  1: {
    name: 'NVIDIA RTX 4090 Founders Edition',
    sku: 'NV-4090-FE',
    category: 'Graphics Cards',
    location: 'A-12-04',
    startDate: '23/june/26',
    lastUpdated: '28/june/26',
    onHand: 8,
    threshold: 5,
    unitPrice: 1599,
    availability: 'healthy',
  },
  2: {
    name: 'AMD Ryzen 9 7950X',
    sku: 'AMD-7950X-AM5',
    category: 'Processors',
    location: 'A-04-11',
    startDate: '13/june/26',
    lastUpdated: '26/june/26',
    onHand: 3,
    threshold: 10,
    unitPrice: 589,
    availability: 'low-stock',
  },
  3: {
    name: 'Corsair Vengeance 32GB DDR5',
    sku: 'COR-32D5-RGB',
    category: 'Memory',
    location: 'C-05-02',
    startDate: '05/june/26',
    lastUpdated: '24/june/26',
    onHand: 45,
    threshold: 20,
    unitPrice: 149,
    availability: 'healthy',
  },
  4: {
    name: 'Samsung 990 Pro 2TB NVMe',
    sku: 'SAM-990P-2TB',
    category: 'Storage',
    location: 'C-08-01',
    startDate: '08/june/26',
    lastUpdated: '22/june/26',
    onHand: 0,
    threshold: 15,
    unitPrice: 179,
    availability: 'out-of-stock',
  },
  5: {
    name: 'ASUS ROG Thor 1200W PSU',
    sku: 'AS-THOR-1200',
    category: 'Power Supplies',
    location: 'A-01-09',
    startDate: '01/june/26',
    lastUpdated: '21/june/26',
    onHand: 4,
    threshold: 3,
    unitPrice: 329,
    availability: 'healthy',
  },
  6: {
    name: 'NZXT H9 Flow Case (White)',
    sku: 'NZXT-H9F-W',
    category: 'Cases',
    location: 'W-04-12',
    startDate: '04/june/26',
    lastUpdated: '20/june/26',
    onHand: 12,
    threshold: 8,
    unitPrice: 159,
    availability: 'healthy',
  },
}

const item = computed(() => records[route.params.id] || records[1])

const availabilityLabels = {
  healthy: 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

// Sample adjustment history (most recent first).
const history = ref([
  { id: 1, date: '28/june/26', type: 'Inventory Recount', change: 2, balance: 8, by: 'Admin User' },
  { id: 2, date: '24/june/26', type: 'Customer Return', change: 1, balance: 6, by: 'Sophie L.' },
  { id: 3, date: '18/june/26', type: 'Damaged Goods', change: -1, balance: 5, by: 'Admin User' },
  { id: 4, date: '12/june/26', type: 'Supplier Delivery', change: 6, balance: 6, by: 'Admin User' },
])

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`
}
function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="page">
    <AppHeader title="Inventory & Stock Control" />

    <div class="page__body">
      <!-- Heading -->
      <section class="lead">
        <div class="lead__text">
          <div class="lead__row">
            <button type="button" class="lead__back" aria-label="Back to stock management" @click="router.back()">
              <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <h2 class="lead__title">{{ item.name }}</h2>
            <span class="badge" :class="`badge--${item.availability}`">{{ availabilityLabels[item.availability] }}</span>
          </div>
        </div>
      </section>

      <div class="grid">
        <!-- Adjustment history -->
        <section class="table-card">
          <header class="table-card__head">
            <h3 class="table-card__title">Adjustment History</h3>
          </header>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Change</th>
                <th>Balance</th>
                <th>Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in history" :key="entry.id">
                <td class="muted">{{ entry.date }}</td>
                <td>{{ entry.type }}</td>
                <td>
                  <span class="change" :class="entry.change >= 0 ? 'change--up' : 'change--down'">{{ signed(entry.change) }}</span>
                </td>
                <td class="balance">{{ entry.balance }} units</td>
                <td class="muted">{{ entry.by }}</td>
              </tr>
              <tr v-if="history.length === 0">
                <td colspan="5" class="table__empty">No adjustments recorded yet.</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Product information -->
        <section class="card">
          <h3 class="card__title">Product Information</h3>
          <div class="product">
            <span class="product__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
            <div>
              <p class="product__name">{{ item.name }}</p>
              <p class="product__sku">SKU: {{ item.sku }}</p>
            </div>
          </div>

          <dl class="info">
            <div class="info__row"><dt>Category</dt><dd>{{ item.category }}</dd></div>
            <div class="info__row"><dt>Warehouse Location</dt><dd>{{ item.location }}</dd></div>
            <div class="info__row"><dt>Start Date</dt><dd>{{ item.startDate }}</dd></div>
            <div class="info__row"><dt>Last Updated</dt><dd>{{ item.lastUpdated }}</dd></div>
          </dl>
        </section>
      </div>
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

/* Heading */
.lead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.4rem;
  }

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #4a5160;
    cursor: pointer;
    &:hover { background: #eceef1; }
    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__title { margin: 0; font-size: 1.4rem; font-weight: 700; color: $color-text; }
}

/* Layout */
.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

/* History table */
.table-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  overflow: hidden;

  &__head { padding: 1.1rem 1.25rem; border-bottom: 1px solid $divider; }

  &__title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }
}

.table {
  width: 100%;
  border-collapse: collapse;

  th, td { text-align: left; padding: 0.85rem 1.25rem; vertical-align: middle; }

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

  td { font-size: 0.86rem; color: $color-text; }

  .muted { color: $muted; }

  &__empty { text-align: center; color: $muted; padding: 2.5rem 1rem; }
}

.change {
  font-weight: 700;
  &--up { color: #1f9d57; }
  &--down { color: #d14343; }
}

.balance { font-weight: 600; }

/* Product info card */
.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }
}

.product {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid $divider;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 10px;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.78rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__name { margin: 0; font-size: 0.9rem; font-weight: 700; color: $color-text; }
  &__sku { margin: 0.2rem 0 0; font-size: 0.74rem; color: $muted; }
}

.info {
  margin: 0;
  padding-top: 0.5rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0;

    & + & { border-top: 1px solid $divider; }

    dt { font-size: 0.82rem; color: $muted; }
    dd { margin: 0; font-size: 0.85rem; font-weight: 600; color: $color-text; }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;

  &--healthy { background: #e6f7ee; color: #1f9d57; }
  &--low-stock { background: rgba($accent, 0.2); color: #b8890b; }
  &--out-of-stock { background: #fdecec; color: #d14343; }
}
</style>
