<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import {
  fetchReviews,
  reviewStars,
  reviewStatuses,
  reviewTone,
  updateReview,
} from '@/services/reviews'

const auth = useAuthStore()

const reviews = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const statusFilter = ref('all')
const ratingFilter = ref('all')
const page = ref(1)
const perPage = ref(15)
const lastPage = ref(1)
const total = ref(0)
const submittingId = ref(null)

const canUpdate = computed(() => auth.hasPermission('reviews.update'))

const statusOptions = Object.entries(reviewStatuses).map(([value, label]) => ({ value, label }))
const ratingOptions = ['all', '5', '4', '3', '2', '1']

let searchTimer = null

function normalizeStatus(value) {
  return value && value in reviewStatuses ? value : 'pending'
}

async function loadReviews() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetchReviews(auth.accessToken, {
      page: page.value,
      perPage: perPage.value,
      q: search.value,
      status: statusFilter.value,
      rating: ratingFilter.value,
    })

    reviews.value = response.items
    total.value = response.pagination?.total ?? 0
    lastPage.value = Math.max(1, response.pagination?.last_page ?? 1)
  } catch (err) {
    error.value = err.message || 'Unable to load customer ratings.'
    reviews.value = []
    total.value = 0
    lastPage.value = 1
  } finally {
    loading.value = false
  }
}

function scheduleLoad() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadReviews()
  }, 250)
}

watch(search, scheduleLoad)
watch(statusFilter, () => {
  page.value = 1
  loadReviews()
})
watch(ratingFilter, () => {
  page.value = 1
  loadReviews()
})
watch(page, () => loadReviews())

onMounted(loadReviews)

async function setStatus(review, status) {
  if (!canUpdate.value) return

  submittingId.value = review.id
  try {
    await updateReview(review.id, { status }, auth.accessToken)
    await loadReviews()
  } catch (err) {
    error.value = err.message || 'Could not update this review.'
  } finally {
    submittingId.value = null
  }
}

const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * perPage.value + 1))
const rangeEnd = computed(() =>
  total.value === 0 ? 0 : Math.min(page.value * perPage.value, total.value),
)
</script>

<template>
  <div class="page">
    <AppHeader title="Customer Ratings" />

    <div class="page__body">
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input v-model="search" type="search" placeholder="Search reviews or customers..." />
        </label>

        <label class="toolbar__select">
          <span>Status</span>
          <select v-model="statusFilter">
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="toolbar__select toolbar__select--compact">
          <span>Rating</span>
          <select v-model="ratingFilter">
            <option value="all">All ratings</option>
            <option
              v-for="option in ratingOptions.filter((item) => item !== 'all')"
              :key="option"
              :value="option"
            >
              {{ option }} stars
            </option>
          </select>
        </label>
      </section>

      <p v-if="error" class="page__error" role="alert">{{ error }}</p>

      <section class="table-card">
        <div class="table-card__summary">
          <span v-if="total > 0"
            >Showing {{ rangeStart }}-{{ rangeEnd }} of {{ total.toLocaleString() }} reviews</span
          >
          <span v-else>No reviews found</span>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Helpful</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="review in reviews" :key="review.id" class="table__row">
              <td>
                <div class="customer">
                  <div class="customer__meta">
                    <p class="customer__name">{{ review.customerName }}</p>
                    <p class="customer__email">{{ review.customerEmail || 'No email' }}</p>
                  </div>
                </div>
              </td>

              <td>
                <div class="product">
                  <div class="product__meta">
                    <p class="product__name">{{ review.productName }}</p>
                    <p class="product__sku">{{ review.productSku || 'No SKU' }}</p>
                  </div>
                </div>
              </td>

              <td>
                <div class="rating-box">
                  <span class="rating-box__stars" :title="`${review.rating} / 5`">{{
                    reviewStars(review.rating)
                  }}</span>
                  <span class="rating-box__score">{{ review.rating }}/5</span>
                  <p class="review__title" v-if="review.title">{{ review.title }}</p>
                  <p class="review__comment" v-if="review.comment">{{ review.comment }}</p>
                </div>
              </td>

              <td>
                <span class="status-badge" :class="`status-badge--${reviewTone(review.status)}`">
                  {{ reviewStatuses[normalizeStatus(review.status)] }}
                </span>
              </td>

              <td>
                <div class="helpful">
                  <strong>{{ review.helpfulScore }}</strong>
                  <span>{{ review.helpfulCount }} helpful</span>
                </div>
              </td>

              <td>
                <div v-if="canUpdate" class="row-actions">
                  <button
                    v-if="review.status !== 'approved'"
                    type="button"
                    class="action-btn action-btn--success"
                    :disabled="submittingId === review.id"
                    @click="setStatus(review, 'approved')"
                  >
                    Approve
                  </button>
                  <button
                    v-if="review.status !== 'rejected'"
                    type="button"
                    class="action-btn action-btn--danger"
                    :disabled="submittingId === review.id"
                    @click="setStatus(review, 'rejected')"
                  >
                    Reject
                  </button>
                  <button
                    v-if="review.status !== 'hidden'"
                    type="button"
                    class="action-btn action-btn--muted"
                    :disabled="submittingId === review.id"
                    @click="setStatus(review, 'hidden')"
                  >
                    Hide
                  </button>
                </div>
                <span v-else class="muted-copy">No permission</span>
              </td>
            </tr>

            <tr v-if="loading">
              <td colspan="6" class="table__empty">Loading reviews…</td>
            </tr>
            <tr v-else-if="reviews.length === 0">
              <td colspan="6" class="table__empty">
                {{
                  search.trim()
                    ? 'No reviews match your search.'
                    : 'No customer reviews have been submitted yet.'
                }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="lastPage > 1" class="pager">
          <button
            type="button"
            class="pager__button"
            :disabled="page === 1"
            @click="page = Math.max(1, page - 1)"
          >
            Previous
          </button>
          <span class="pager__label">Page {{ page }} of {{ lastPage }}</span>
          <button
            type="button"
            class="pager__button"
            :disabled="page >= lastPage"
            @click="page = Math.min(lastPage, page + 1)"
          >
            Next
          </button>
        </div>
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
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
  }

  &__error {
    margin: 0;
    font-size: 0.82rem;
    color: var(--danger);
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.85rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  &__search {
    flex: 1;
    min-width: 260px;
    display: flex;
    align-items: center;
    padding: 0 0.75rem;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;

    &:focus-within {
      border-color: var(--border);
      background: var(--surface);
    }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);

    svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.65rem 0.6rem;
    color: var(--text-strong);
    font-family: inherit;
    font-size: 0.9rem;

    &:focus {
      outline: none;
    }
  }

  &__select {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.1rem 0.7rem;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    color: var(--text-body);
    font-size: 0.8rem;
    transition: border-color 150ms ease, box-shadow 150ms ease;

    &:focus-within {
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.14);
    }

    &--compact {
      min-width: 150px;
    }

    select {
      border: none;
      background: transparent;
      color: var(--text-strong);
      padding: 0.6rem 0;
      font: inherit;
      outline: none;
      color-scheme: inherit;
      cursor: pointer;

      option {
        color: var(--text-strong);
        background: var(--surface);
      }
    }
  }
}

.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  &__summary {
    display: flex;
    justify-content: flex-end;
    padding: 0.8rem 1.1rem 0;
    color: var(--text-subtle);
    font-size: 0.8rem;
  }
}

.table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 0.95rem 1.1rem;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border-subtle);
  }

  th {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    font-weight: 700;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.customer,
.product {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.customer__meta,
.product__meta {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.customer__name,
.product__name {
  margin: 0;
  color: var(--text-strong);
  font-weight: 600;
}

.customer__email,
.product__sku,
.review__comment,
.muted-copy {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.76rem;
}

.rating-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rating-box__stars {
  color: #fbbf24;
  letter-spacing: 0.08em;
}

.rating-box__score {
  font-size: 0.8rem;
  color: var(--text-body);
  font-weight: 600;
}

.review__title {
  margin: 0.18rem 0 0;
  color: var(--text-strong);
  font-size: 0.8rem;
  font-weight: 700;
}

.review__comment {
  line-height: 1.45;
  max-width: 38ch;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.status-badge--warning {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.35);
  color: #f8b333;
}

.status-badge--success {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.32);
  color: #47c77d;
}

.status-badge--danger {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.32);
  color: #f26f6f;
}

.status-badge--muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.32);
  color: #a5b4c8;
}

.helpful {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  color: var(--text-subtle);
  font-size: 0.76rem;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.action-btn {
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.42rem 0.7rem;
  font: inherit;
  font-size: 0.76rem;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.action-btn--success {
  border-color: rgba(34, 197, 94, 0.32);
  background: rgba(34, 197, 94, 0.12);
  color: #2fbf69;
}

.action-btn--danger {
  border-color: rgba(239, 68, 68, 0.32);
  background: rgba(239, 68, 68, 0.1);
  color: #dc6363;
}

.action-btn--muted {
  background: var(--surface-alt);
  color: var(--text-body);
}

.table__empty {
  padding: 1.3rem 1.1rem;
  text-align: center;
  color: var(--text-subtle);
}

.table__actions-head {
  width: 210px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 0 1.15rem;
  color: var(--text-subtle);
  font-size: 0.82rem;
}

.pager__button {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  color: var(--text-body);
  border-radius: 8px;
  padding: 0.45rem 0.8rem;
  font: inherit;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@media (max-width: 768px) {
  .page__body {
    padding: 1rem;
  }

  .table {
    min-width: 820px;
  }

  .table-card {
    overflow-x: auto;
  }
}
</style>
