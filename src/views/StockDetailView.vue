<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { fetchStockDetail } from '@/services/stock'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const error = ref('')
const item = ref(null)
const history = ref([])

const availabilityLabels = {
  healthy: 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
}

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`
}

function thumbInitials(name) {
  return String(name ?? '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .slice(0, 2)
    .toUpperCase()
}

const brokenThumb = ref(false)
function onThumbError() {
  brokenThumb.value = true
}

async function loadDetail() {
  const id = route.params.id
  if (!id) return

  loading.value = true
  error.value = ''
  try {
    const result = await fetchStockDetail(id, auth.accessToken)
    item.value = result.item
    history.value = result.movements
  } catch (err) {
    error.value = err.message || 'Unable to load stock details. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDetail()
})

watch(() => route.params.id, () => {
  loadDetail()
})
</script>

<template>
  <div class="page">
    <AppHeader title="Inventory & Stock Control" />

    <div class="page__body">
      <div v-if="loading" class="lead">
        <p class="muted">Loading stock details...</p>
      </div>

      <div v-else-if="error" class="lead">
        <div class="lead__row">
          <button type="button" class="lead__back" aria-label="Back to stock management" @click="router.back()">
            <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <p class="error-text">{{ error }}</p>
        </div>
      </div>

      <template v-else-if="item">
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

          <section class="card">
            <h3 class="card__title">Product Information</h3>
            <div class="product">
              <img
                v-if="item.thumbnail && !brokenThumb"
                :src="item.thumbnail"
                :alt="item.name"
                class="product__thumb product__thumb--img"
                @error="onThumbError"
              />
              <span v-else class="product__thumb" aria-hidden="true">{{ thumbInitials(item.name) }}</span>
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
      </template>
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
    color: var(--text-body);
    cursor: pointer;
    &:hover { background: var(--surface-hover); }
    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.9; }
  }

  &__title { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-strong); }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;

  &__head { padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); }

  &__title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
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
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  td { font-size: 0.86rem; color: var(--text-strong); }

  .muted { color: var(--text-subtle); }

  &__empty { text-align: center; color: var(--text-subtle); padding: 2.5rem 1rem; }
}

.change {
  font-weight: 700;
  &--up { color: var(--success); }
  &--down { color: var(--danger); }
}

.balance { font-weight: 600; }

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
}

.product {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 10px;
    background: var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-weight: 700;
    flex-shrink: 0;

    &--img {
      object-fit: cover;
    }
  }

  &__name { margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--text-strong); }
  &__sku { margin: 0.2rem 0 0; font-size: 0.74rem; color: var(--text-subtle); }
}

.error-text {
  color: var(--danger);
  font-size: 0.9rem;
  margin: 0;
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

    & + & { border-top: 1px solid var(--border-subtle); }

    dt { font-size: 0.82rem; color: var(--text-subtle); }
    dd { margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--text-strong); }
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

  &--healthy { background: var(--success-bg); color: var(--success); }
  &--low-stock { background: rgb(var(--accent-rgb) / 0.2); color: var(--accent-ink); }
  &--out-of-stock { background: var(--danger-bg); color: var(--danger); }
}
</style>
