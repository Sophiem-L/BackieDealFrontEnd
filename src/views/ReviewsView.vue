<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOLBAR_SELECT } from '@/lib/selectPresets'
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

function initials(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'C'
}
</script>

<template>
  <div class="page">
    <AppHeader title="Customer Ratings" />

    <div class="page__body">
      <section class="intro">
        <div>
          <h2 class="intro__title">Customer reviews</h2>
          <p class="intro__description">
            Review customer feedback, ratings, and moderation status.
          </p>
        </div>
        <span class="intro__count">{{ total.toLocaleString() }} reviews</span>
      </section>

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
            aria-label="Search reviews or customers"
            placeholder="Search reviews or customers..."
          />
        </label>

        <Select v-model="statusFilter">
          <SelectTrigger
            :class="TOOLBAR_SELECT.trigger"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent :class="TOOLBAR_SELECT.content">
            <SelectItem
              v-for="option in statusOptions"
              :key="option.value"
              :value="option.value"
              :class="TOOLBAR_SELECT.item"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="ratingFilter">
          <SelectTrigger
            :class="TOOLBAR_SELECT.trigger"
            aria-label="Filter by rating"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent :class="TOOLBAR_SELECT.content">
            <SelectItem
              v-for="option in ratingOptions"
              :key="option"
              :value="option"
              :class="TOOLBAR_SELECT.item"
            >
              {{ option === 'all' ? 'All ratings' : `${option} stars` }}
            </SelectItem>
          </SelectContent>
        </Select>
      </section>

      <p v-if="error" class="page__error" role="alert">{{ error }}</p>

      <section class="table-card">
        <div class="table-card__summary">
          <span class="table-card__summary-label">Review queue</span>
          <span v-if="total > 0" class="table-card__summary-count">
            Showing {{ rangeStart }}-{{ rangeEnd }} of {{ total.toLocaleString() }}
          </span>
          <span v-else class="table-card__summary-count">No reviews found</span>
        </div>

        <div class="table-scroll">
          <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Review</th>
              <th>Status</th>
              <th>Helpful</th>
              <th class="table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="review in reviews" :key="review.id" class="table__row">
              <td>
                <div class="customer">
                  <span class="customer__avatar" aria-hidden="true">
                    {{ initials(review.customerName) }}
                  </span>
                  <div class="customer__meta">
                    <p class="customer__name">{{ review.customerName }}</p>
                    <p class="customer__email">{{ review.customerEmail || 'No email' }}</p>
                  </div>
                </div>
              </td>

              <td>
                <div class="product">
                  <img
                    v-if="review.productThumbnail"
                    class="product__image"
                    :src="review.productThumbnail"
                    :alt="`${review.productName} product`"
                    loading="lazy"
                  />
                  <span v-else class="product__placeholder" aria-hidden="true">
                    {{ initials(review.productName) }}
                  </span>
                  <div class="product__meta">
                    <p class="product__name">{{ review.productName }}</p>
                    <p class="product__sku">{{ review.productSku || 'No SKU' }}</p>
                  </div>
                </div>
              </td>

              <td>
                <div class="rating-box">
                  <div class="rating-box__line">
                    <span
                      class="rating-box__stars"
                      role="img"
                      :aria-label="`${review.rating} out of 5 stars`"
                    >{{ reviewStars(review.rating) }}</span>
                    <span class="rating-box__score">{{ review.rating }}/5</span>
                    <span v-if="review.isVerified" class="rating-box__verified">Verified</span>
                  </div>
                  <p class="review__title">{{ review.title }}</p>
                  <p v-if="review.comment" class="review__comment">{{ review.comment }}</p>
                </div>
              </td>

              <td>
                <span class="status-badge" :class="`status-badge--${reviewTone(review.status)}`">
                  <span class="status-badge__dot" aria-hidden="true"></span>
                  {{ reviewStatuses[normalizeStatus(review.status)] }}
                </span>
              </td>

              <td>
                <div class="helpful">
                  <span class="helpful__score">{{ review.helpfulScore }}</span>
                  <span class="helpful__detail">
                    <strong>{{ review.helpfulCount }}</strong>
                    {{ review.helpfulCount === 1 ? 'helpful vote' : 'helpful votes' }}
                  </span>
                </div>
              </td>

              <td>
                <div v-if="canUpdate" class="row-actions" :aria-busy="submittingId === review.id">
                  <button
                    v-if="review.status !== 'approved'"
                    type="button"
                    class="action-btn action-btn--success"
                    :disabled="submittingId === review.id"
                    :aria-label="`Approve review by ${review.customerName}`"
                    @click="setStatus(review, 'approved')"
                  >
                    Approve
                  </button>
                  <button
                    v-if="review.status !== 'rejected'"
                    type="button"
                    class="action-btn action-btn--danger"
                    :disabled="submittingId === review.id"
                    :aria-label="`Reject review by ${review.customerName}`"
                    @click="setStatus(review, 'rejected')"
                  >
                    Reject
                  </button>
                  <button
                    v-if="review.status !== 'hidden'"
                    type="button"
                    class="action-btn action-btn--muted"
                    :disabled="submittingId === review.id"
                    :aria-label="`Hide review by ${review.customerName}`"
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
        </div>

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

.intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  &__title {
    margin: 0;
    color: var(--text-strong);
    font-size: 1.15rem;
    font-weight: 700;
  }

  &__description {
    margin: 0.3rem 0 0;
    color: var(--text-subtle);
    font-size: 0.84rem;
  }

  &__count {
    flex-shrink: 0;
    padding: 0.45rem 0.75rem;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
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
    min-width: min(260px, 100%);
    display: flex;
    align-items: center;
    padding: 0 0.75rem;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;

    &:focus-within {
      border-color: rgb(var(--accent-rgb));
      background: var(--surface);
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.1);
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

}

.table-card {
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  &__summary-label {
    color: var(--text-strong);
    font-size: 0.88rem;
    font-weight: 700;
  }

  &__summary-count {
    color: var(--text-subtle);
    font-size: 0.8rem;
  }
}

.table-scroll {
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;

  th,
  td {
    padding: 1rem 1.1rem;
    text-align: left;
    vertical-align: middle;
    border-bottom: 1px solid var(--border-subtle);
  }

  th {
    background: var(--surface-alt);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    font-weight: 700;
  }

  tbody tr {
    transition: background-color 0.15s ease;

    &:hover {
      background: var(--surface-alt);
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  td:nth-child(1) { min-width: 210px; }
  td:nth-child(2) { min-width: 230px; }
  td:nth-child(3) { min-width: 320px; }
  td:nth-child(4) { min-width: 120px; }
  td:nth-child(5) { min-width: 110px; }
  td:last-child { min-width: 210px; }
}

.customer,
.product {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.customer__avatar,
.product__placeholder,
.product__image {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--border-subtle);
  border-radius: 11px;
}

.customer__avatar {
  color: rgb(var(--accent-rgb));
  background: rgb(var(--accent-rgb) / 0.1);
  font-size: 0.72rem;
  font-weight: 700;
}

.product__image {
  object-fit: cover;
  background: var(--surface-alt);
}

.product__placeholder {
  color: var(--text-subtle);
  background: var(--surface-alt);
  font-size: 0.72rem;
  font-weight: 700;
}

.customer__meta,
.product__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.customer__name,
.product__name {
  margin: 0;
  color: var(--text-strong);
  font-weight: 600;
  line-height: 1.35;
}

.product__name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.customer__email,
.product__sku,
.review__comment,
.muted-copy {
  margin: 0;
  color: var(--text-subtle);
  font-size: 0.76rem;
}

.customer__email,
.product__sku {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rating-box {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 180px;
}

.rating-box__line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.rating-box__stars {
  color: #fbbf24;
  font-size: 0.9rem;
  line-height: 1;
  letter-spacing: 0.08em;
}

.rating-box__score {
  color: var(--text-strong);
  font-size: 0.76rem;
  font-weight: 600;
}

.rating-box__verified {
  padding: 0.15rem 0.42rem;
  color: #16834a;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.22);
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 600;
}

.review__title {
  margin: 0.15rem 0 0;
  color: var(--text-strong);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.4;
}

.review__comment {
  line-height: 1.45;
  max-width: 48ch;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid transparent;
}

.status-badge__dot {
  width: 6px;
  height: 6px;
  margin-right: 0.38rem;
  border-radius: 50%;
  background: currentColor;
}

.status-badge--warning {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.35);
  color: #a96800;
}

.status-badge--success {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.32);
  color: #16834a;
}

.status-badge--danger {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.32);
  color: #c03939;
}

.status-badge--muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.32);
  color: var(--text-subtle);
}

.helpful {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.helpful__score {
  color: var(--text-strong);
  font-size: 0.9rem;
  font-weight: 700;
}

.helpful__detail {
  color: var(--text-subtle);
  font-size: 0.7rem;

  strong {
    color: var(--text-body);
    font-weight: 600;
  }
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.action-btn {
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.42rem 0.6rem;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(20, 23, 28, 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb));
    outline-offset: 2px;
  }

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
  padding: 2rem 1.1rem;
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

  .intro {
    align-items: flex-start;

    &__description {
      max-width: 42ch;
      line-height: 1.45;
    }
  }

  .toolbar {
    align-items: stretch;

    &__search {
      flex-basis: 100%;
    }

    :deep([role='combobox']) {
      flex: 1;
    }
  }

  .table-card__summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }
}

@media (max-width: 480px) {
  .intro {
    flex-direction: column;
  }

  .toolbar {
    padding: 0.75rem;
  }
}
</style>
