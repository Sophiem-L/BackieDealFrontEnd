<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { customerAccounts } from '@/data/customerAccounts'

const router = useRouter()
const search = ref('')

const statusLabels = { active: 'Active', vip: 'VIP', inactive: 'Inactive' }

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return customerAccounts
  return customerAccounts.filter(
    (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
  )
})

function viewCustomer(customer) {
  router.push({ name: 'customer-detail', params: { id: customer.id } })
}

function editCustomer(customer) {
  router.push({ name: 'customer-edit', params: { id: customer.id } })
}

function deleteCustomer(customer) {
  if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return
  const index = customerAccounts.indexOf(customer)
  if (index !== -1) customerAccounts.splice(index, 1)
}

function initials(name) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
</script>

<template>
  <div class="page">
    <AppHeader title="Manage Customers" />

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
          <input v-model="search" type="search" placeholder="Search customers..." />
        </label>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="primary" :to="{ name: 'customer-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke-linecap="round" />
              <circle cx="9.5" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" stroke-linecap="round" />
            </svg>
          </template>
          Add Customer
        </BaseButton>
      </section>

      <!-- Table -->
      <section class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Total Spent</th>
              <th>Orders</th>
              <th>Account Status</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="customer in filtered"
              :key="customer.id"
              class="table__row"
              @click="viewCustomer(customer)"
            >
              <td>
                <div class="customer">
                  <span class="customer__avatar" :class="customer.avatar ? 'customer__avatar--photo' : `customer__avatar--${customer.tone}`">
                    <img v-if="customer.avatar" :src="customer.avatar" :alt="customer.name" />
                    <span v-else aria-hidden="true">{{ initials(customer.name) }}</span>
                  </span>
                  <div class="customer__meta">
                    <p class="customer__name">{{ customer.name }}</p>
                    <p class="customer__email">{{ customer.email }}</p>
                  </div>
                </div>
              </td>
              <td class="spent">{{ customer.spent }}</td>
              <td class="orders">{{ customer.orders }} Completed Orders</td>
              <td>
                <span class="badge" :class="`badge--${customer.status}`">{{ statusLabels[customer.status] }}</span>
              </td>
              <td>
                <div class="row-actions">
                  <button type="button" class="icon-btn" title="Edit customer" aria-label="Edit customer" @click.stop="editCustomer(customer)">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                      <path d="M13.5 6.5l3 3" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" title="Delete customer" aria-label="Delete customer" @click.stop="deleteCustomer(customer)">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="5" class="table__empty">No customers match your search.</td>
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

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within { background: var(--surface); border-color: var(--border); }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);
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
    color: var(--text-strong);
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

  &__row { cursor: pointer; }

  &__actions-head { text-align: left; }

  &__empty { text-align: center; color: var(--text-subtle); font-size: 0.88rem; padding: 2.5rem 1rem; }
}

.customer {
  display: flex;
  align-items: center;
  gap: 0.8rem;

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--ink-on-solid);
    flex-shrink: 0;
    overflow: hidden;

    img { width: 100%; height: 100%; object-fit: cover; }

    &--photo { background: var(--border-subtle); }
    &--blue { background: var(--info); }
    &--green { background: var(--success-solid); }
    &--violet { background: var(--violet); }
    &--amber { background: var(--accent-ink); }
    &--rose { background: var(--rose); }
    &--slate { background: var(--neutral-solid); }
  }

  &__name { margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--text-strong); }
  &__email { margin: 0.15rem 0 0; font-size: 0.76rem; color: var(--text-subtle); }
}

.spent { font-size: 0.9rem; font-weight: 700; color: var(--text-strong); }
.orders { font-size: 0.84rem; color: var(--text-body); }

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;

  &--active { background: var(--success-bg); color: var(--success); }
  &--vip { background: var(--violet-bg); color: var(--violet); }
  &--inactive { background: var(--surface-track); color: var(--text-muted); }
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover { background: var(--surface-alt); color: var(--text-strong); border-color: var(--border); }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }

  &--danger:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger-border); }
}
</style>
