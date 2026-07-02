<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'

const router = useRouter()

const adjustmentTypes = [
  'Inventory Recount',
  'Damaged Goods',
  'Customer Return',
  'Supplier Delivery',
  'Theft / Loss',
  'Correction',
]

// Sample selected product (stands in for the catalog picker result).
const product = ref({
  name: 'NVIDIA RTX 4090 Founders Edition',
  sku: 'NV-4090-FE',
  location: 'A-12-04',
  currentStock: 8,
  unitPrice: 1599,
  threshold: 5,
})

const form = reactive({
  adjustmentType: 'Inventory Recount',
  quantityChange: 2,
  reason: '',
})

function step(delta) {
  // Never let the resulting on-hand quantity go negative.
  const next = form.quantityChange + delta
  if (product.value.currentStock + next < 0) return
  form.quantityChange = next
}

const signedChange = computed(() =>
  form.quantityChange > 0 ? `+${form.quantityChange}` : `${form.quantityChange}`,
)

const newQuantity = computed(() =>
  Math.max(0, product.value.currentStock + form.quantityChange),
)

const valueChange = computed(() => form.quantityChange * product.value.unitPrice)

const formattedValueChange = computed(() => {
  const amount = Math.abs(valueChange.value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sign = valueChange.value > 0 ? '+' : valueChange.value < 0 ? '-' : ''
  return `${sign}$${amount}`
})

const systemStatus = computed(() => {
  if (newQuantity.value <= 0) return { key: 'out-of-stock', label: 'Out of Stock' }
  if (newQuantity.value <= product.value.threshold) return { key: 'low-stock', label: 'Low Stock' }
  return { key: 'healthy', label: 'Healthy' }
})

function thumbInitials(name) {
  return name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 2).toUpperCase()
}

function cancel() {
  router.push('/stock')
}
function complete() {
  // TODO: POST the adjustment to the inventory API.
  router.push('/stock')
}
</script>

<template>
  <div class="page">
    <AppHeader title="Stock Adjustment" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/stock" class="subhead__back" aria-label="Back to Stock Management">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </RouterLink>
        <div>
          <h2 class="subhead__title">New Stock Adjustment</h2>
          <p class="subhead__desc">Manually adjust inventory levels for damages, returns, or corrections.</p>
        </div>
      </div>

      <div class="grid">
        <!-- Main column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">Product Details</h3>

            <!-- Product picker -->
            <div class="picker">
              <span class="picker__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.2-3.2" stroke-linecap="round" />
                </svg>
              </span>
              <p class="picker__text">Search and select a product to adjust</p>
              <BaseButton variant="ghost" size="sm">Browse Catalog</BaseButton>
            </div>

            <!-- Selected product -->
            <div v-if="product" class="selected">
              <span class="selected__thumb" aria-hidden="true">{{ thumbInitials(product.name) }}</span>
              <div class="selected__meta">
                <p class="selected__name">{{ product.name }}</p>
                <p class="selected__sub">SKU: {{ product.sku }} &nbsp;|&nbsp; Location: {{ product.location }}</p>
              </div>
              <div class="selected__stock">
                <p class="selected__stock-label">Current Stock</p>
                <p class="selected__stock-value">{{ product.currentStock }} Units</p>
              </div>
            </div>

            <!-- Adjustment controls -->
            <div class="controls">
              <div class="field">
                <label for="adjustmentType">Adjustment Type</label>
                <div class="select-wrap">
                  <select id="adjustmentType" v-model="form.adjustmentType">
                    <option v-for="type in adjustmentTypes" :key="type" :value="type">{{ type }}</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
              </div>

              <div class="field">
                <label>Quantity Change</label>
                <div class="stepper">
                  <button type="button" class="stepper__btn" aria-label="Decrease" @click="step(-1)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke-linecap="round" /></svg>
                  </button>
                  <span class="stepper__value" :class="{ 'stepper__value--neg': form.quantityChange < 0 }">{{ signedChange }}</span>
                  <button type="button" class="stepper__btn" aria-label="Increase" @click="step(1)">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="field field--reason">
              <label for="reason">Reason for Adjustment</label>
              <textarea
                id="reason"
                v-model="form.reason"
                rows="3"
                placeholder="Monthly inventory recount. Found 2 additional units in warehouse back-shelf."
              ></textarea>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Adjustment Impact</h3>
            <dl class="impact">
              <div class="impact__row">
                <dt>New Quantity</dt>
                <dd class="impact__value impact__value--accent">{{ newQuantity }} Units</dd>
              </div>
              <div class="impact__row">
                <dt>Value Change</dt>
                <dd class="impact__value">{{ formattedValueChange }}</dd>
              </div>
              <div class="impact__row">
                <dt>System Status</dt>
                <dd>
                  <span class="badge" :class="`badge--${systemStatus.key}`">{{ systemStatus.label }}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section class="policy">
            <p class="policy__title">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Policy Reminder
            </p>
            <p class="policy__text">
              All manual adjustments are logged in the system audit trail. Large adjustments may
              require secondary approval from a Store Manager.
            </p>
          </section>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="actions">
        <BaseButton variant="ghost" @click="cancel">Cancel</BaseButton>
        <BaseButton variant="primary" @click="complete">Complete Adjustment</BaseButton>
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

.subhead {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  &__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid $divider;
    color: #4a5160;
    flex-shrink: 0;

    &:hover { background: #f6f7f9; text-decoration: none; }

    svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: $color-text;
  }

  &__desc {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
    color: $muted;
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

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

/* Product picker */
.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1.6rem 1rem;
  border: 1px dashed #d3d7dd;
  border-radius: 12px;
  background: #fafbfc;
  text-align: center;

  &__icon {
    display: inline-flex;
    color: $muted;
    svg { width: 26px; height: 26px; stroke: currentColor; stroke-width: 1.6; }
  }

  &__text {
    margin: 0;
    font-size: 0.85rem;
    color: $muted;
  }
}

/* Selected product */
.selected {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid $divider;
  border-radius: 12px;

  &__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__meta { flex: 1; min-width: 0; }

  &__name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: $color-text;
  }

  &__sub {
    margin: 0.2rem 0 0;
    font-size: 0.75rem;
    color: $muted;
  }

  &__stock { text-align: right; flex-shrink: 0; }

  &__stock-label {
    margin: 0;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: $muted;
  }

  &__stock-value {
    margin: 0.2rem 0 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: $color-text;
  }
}

/* Controls */
.controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1.25rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--reason { margin-top: 1.25rem; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4a5160;
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: $color-text;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: #b4b9c2; }

    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }
  }

  textarea { resize: vertical; }
}

.select-wrap {
  position: relative;

  select { appearance: none; padding-right: 2.2rem; cursor: pointer; }

  svg {
    position: absolute;
    top: 50%;
    right: 0.8rem;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    stroke: $muted;
    stroke-width: 1.8;
    pointer-events: none;
  }
}

/* Quantity stepper */
.stepper {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: stretch;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  overflow: hidden;

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f4f5f7;
    border: none;
    color: #4a5160;
    cursor: pointer;

    &:hover { background: #eceef1; }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; }
  }

  &__value {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 700;
    color: #1f9d57;
    padding: 0.65rem 0;

    &--neg { color: #d14343; }
  }
}

/* Adjustment impact */
.impact {
  margin: 0;
  display: flex;
  flex-direction: column;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem 0;

    & + & { border-top: 1px solid $divider; }

    dt {
      font-size: 0.85rem;
      color: $muted;
    }
  }

  &__value {
    font-size: 0.95rem;
    font-weight: 700;
    color: $color-text;

    &--accent { color: #1f9d57; }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;

  &--healthy { background: #e6f0ff; color: #2563c9; }
  &--low-stock { background: rgba($accent, 0.2); color: #b8890b; }
  &--out-of-stock { background: #fdecec; color: #d14343; }
}

/* Policy reminder */
.policy {
  background: #fff7ec;
  border: 1px solid #f6e2bf;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.5rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #c2730a;

    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__text {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #9a6a14;
  }
}

/* Footer actions */
.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}
</style>
