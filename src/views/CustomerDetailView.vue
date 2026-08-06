<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { findCustomerAccount } from '@/data/customerAccounts'

const route = useRoute()
const router = useRouter()

const customer = computed(() => findCustomerAccount(route.params.id))

const statusLabels = { active: 'Active', vip: 'VIP', inactive: 'Inactive' }

function initials(name) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'customers' })
}
</script>

<template>
  <div class="page">
    <AppHeader title="Customer Detail" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <button type="button" class="back-btn" aria-label="Back to customers" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <h2 class="subhead__title">Customer Detail</h2>
      </div>

      <!-- Not found -->
      <section v-if="!customer" class="empty">
        <p>This customer could not be found.</p>
        <BaseButton variant="ghost" :to="{ name: 'customers' }">Back to Customers</BaseButton>
      </section>

      <div v-else class="grid">
        <!-- Profile card -->
        <section class="card card--profile">
          <span class="avatar" :class="customer.avatar ? 'avatar--photo' : `avatar--${customer.tone}`">
            <img v-if="customer.avatar" :src="customer.avatar" :alt="customer.name" />
            <span v-else aria-hidden="true">{{ initials(customer.name) }}</span>
          </span>
          <p class="profile__name">{{ customer.name }}</p>
          <p class="profile__email">{{ customer.email }}</p>
          <span class="badge" :class="`badge--${customer.status}`">{{ statusLabels[customer.status] }}</span>
        </section>

        <!-- Details column -->
        <div class="col">
          <section class="card">
            <h3 class="card__title">Contact Information</h3>
            <dl class="kv">
              <div class="kv__row"><dt>Full Name</dt><dd>{{ customer.name }}</dd></div>
              <div class="kv__row"><dt>Email Address</dt><dd>{{ customer.email }}</dd></div>
              <div class="kv__row"><dt>Phone</dt><dd>{{ customer.phone || '—' }}</dd></div>
              <div class="kv__row"><dt>Address</dt><dd>{{ customer.address || '—' }}</dd></div>
              <div class="kv__row"><dt>Account Status</dt><dd>{{ statusLabels[customer.status] }}</dd></div>
            </dl>
          </section>

          <section class="card">
            <h3 class="card__title">Account Summary</h3>
            <div class="summary">
              <div class="summary__item">
                <p class="summary__label">Total Spent</p>
                <p class="summary__value summary__value--accent">{{ customer.spent }}</p>
              </div>
              <div class="summary__item">
                <p class="summary__label">Completed Orders</p>
                <p class="summary__value">{{ customer.orders }}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
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

/* Sub header */
.subhead {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  &__title { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-strong); }
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  flex-shrink: 0;
  background: var(--bg);
  border: none;
  border-radius: 9px;
  color: var(--text-body);
  cursor: pointer;
  &:hover { background: var(--surface-hover); }
  svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.9; }
}

/* Layout — details on the left, profile card on the right. */
.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.col {
  order: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card--profile { order: 2; }

@media (max-width: 900px) {
  .col { order: 2; }
  .card--profile { order: 1; }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  &--profile { text-align: center; }
}

/* Profile */
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--ink-on-solid);
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

.profile {
  &__name { margin: 0.75rem 0 0; font-size: 1.05rem; font-weight: 700; color: var(--text-strong); }
  &__email { margin: 0.2rem 0 0.8rem; font-size: 0.82rem; color: var(--text-subtle); }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.7rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;

  &--active { background: var(--success-bg); color: var(--success); }
  &--vip { background: var(--violet-bg); color: var(--violet); }
  &--inactive { background: var(--surface-track); color: var(--text-muted); }
}

/* Key/value */
.kv {
  margin: 0;

  &__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0;

    & + & { border-top: 1px solid var(--border-subtle); }

    dt { margin: 0; font-size: 0.82rem; color: var(--text-subtle); flex-shrink: 0; }
    dd { margin: 0; font-size: 0.86rem; font-weight: 600; color: var(--text-strong); text-align: right; }
  }
}

/* Account summary */
.summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 480px) { grid-template-columns: 1fr; }

  &__item {
    padding: 1rem;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    background: var(--surface-sunken);
  }

  &__label {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__value {
    margin: 0.35rem 0 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-strong);

    &--accent { color: var(--accent-ink); }
  }
}

/* Empty state */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  color: var(--text-subtle);
  font-size: 0.9rem;
}
</style>
