<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => Boolean(route.params.id))

const promotionTypes = ['Percentage Discount', 'Fixed Amount', 'Free Gift', 'Free Shipping']

const form = reactive({
  name: '',
  code: '',
  type: 'Percentage Discount',
  description: '',
  active: true,
  banner: 'linear-gradient(135deg, #b3091a 0%, #2b0a0a 100%)',
  bannerImage: '',
  discountValue: '',
  minimumSpend: '0.00',
  startDate: '',
  endDate: '',
  totalLimit: '',
  perCustomerLimit: '',
  currentUsage: 0,
})

// Prefill when editing (stands in for an API fetch).
if (isEdit.value) {
  Object.assign(form, {
    name: 'Black Friday Sale 2023',
    code: 'BLACKFRIDAY23',
    type: 'Percentage Discount',
    description:
      'Annual store-wide clearance sale for Black Friday. Applies to all hardware components and gaming peripherals.',
    active: true,
    discountValue: '30',
    minimumSpend: '0.00',
    startDate: '2023-11-20',
    endDate: '2023-11-30',
    totalLimit: '500',
    perCustomerLimit: '1',
    currentUsage: 245,
  })
}

const pageTitle = computed(() =>
  isEdit.value ? `Edit Promotion: ${form.name || 'Promotion'}` : 'New Promotion',
)

const bannerInput = ref(null)
function pickBanner() {
  bannerInput.value?.click()
}
function onBannerChange(event) {
  const file = event.target.files?.[0]
  if (file) form.bannerImage = URL.createObjectURL(file)
}
function clearBanner(event) {
  event.stopPropagation()
  form.bannerImage = ''
  if (bannerInput.value) bannerInput.value.value = ''
}

const usagePercent = computed(() => {
  const limit = Number(form.totalLimit)
  if (!limit) return 0
  return Math.min(100, Math.round((Number(form.currentUsage) / limit) * 100))
})

function save() {
  // TODO: POST/PUT to the promotions API.
  router.push('/promotions')
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/promotions" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__title">{{ isEdit ? 'Edit Promotion' : 'New Promotion' }}</span>
          </span>
        </RouterLink>

      </div>

      <div class="grid">
        <!-- Main column -->
        <div class="col">
          <section class="card">
            <h3 class="card__title">Promotion Details</h3>
            <div class="field">
              <label for="name">Promotion Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. Black Friday Sale 2023" />
            </div>
            <div class="row">
              <div class="field">
                <label for="code">Promo Code</label>
                <input id="code" v-model="form.code" type="text" placeholder="e.g. BLACKFRIDAY23" />
              </div>
              <div class="field">
                <label for="type">Promotion Type</label>
                <div class="select-wrap">
                  <select id="type" v-model="form.type">
                    <option v-for="t in promotionTypes" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" v-model="form.description" rows="3" placeholder="Notes for your team..."></textarea>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Rules &amp; Conditions</h3>
            <div class="row">
              <div class="field">
                <label for="discount">Discount Value</label>
                <div class="affix affix--suffix">
                  <input id="discount" v-model="form.discountValue" type="text" placeholder="0" />
                  <span>%</span>
                </div>
              </div>
              <div class="field">
                <label for="minSpend">Minimum Spend</label>
                <div class="affix">
                  <span>$</span>
                  <input id="minSpend" v-model="form.minimumSpend" type="text" placeholder="0.00" />
                </div>
              </div>
            </div>
            <div class="row">
              <div class="field">
                <label for="start">Start Date</label>
                <input id="start" v-model="form.startDate" type="date" />
              </div>
              <div class="field">
                <label for="end">End Date</label>
                <input id="end" v-model="form.endDate" type="date" />
              </div>
            </div>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Status</h3>
            <div class="status" :class="{ 'status--on': form.active }">
              <span class="status__text">{{ form.active ? 'Active' : 'Inactive' }}</span>
              <ToggleSwitch v-model="form.active" />
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Banner Preview</h3>
            <button
              type="button"
              class="banner"
              :class="{ 'banner--image': form.bannerImage }"
              :style="form.bannerImage ? null : { background: form.banner }"
              @click="pickBanner"
            >
              <img v-if="form.bannerImage" :src="form.bannerImage" alt="Banner preview" class="banner__img" />
              <span class="banner__title">{{ form.name || 'Banner Preview' }}</span>

              <span class="banner__upload">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
                </svg>
                {{ form.bannerImage ? 'Change image' : 'Upload banner' }}
              </span>

              <span
                v-if="form.bannerImage"
                class="banner__remove"
                role="button"
                aria-label="Remove banner image"
                @click="clearBanner"
              >
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
              </span>
            </button>
            <input
              ref="bannerInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              @change="onBannerChange"
            />
            <p class="card__hint">
              This banner will be displayed on the storefront home page and checkout during the campaign period.
              Recommended: 1200x400px.
            </p>
          </section>

          <section class="card">
            <h3 class="card__title">Usage Limits</h3>
            <div class="field">
              <label for="totalLimit">Total Usage Limit</label>
              <input id="totalLimit" v-model="form.totalLimit" type="number" min="0" placeholder="500" />
            </div>
            <div class="field">
              <label for="perCustomer">Per Customer Limit</label>
              <input id="perCustomer" v-model="form.perCustomerLimit" type="number" min="0" placeholder="1" />
            </div>

            <div v-if="isEdit" class="usage">
              <div class="usage__head">
                <span>Current Usage</span>
                <span class="usage__value">{{ form.currentUsage }} / {{ form.totalLimit || '∞' }}</span>
              </div>
              <div class="usage__bar">
                <div class="usage__fill" :style="{ width: usagePercent + '%' }"></div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Form actions -->
      <div class="actions">
        <BaseButton variant="ghost" to="/promotions">Cancel</BaseButton>
        <BaseButton variant="primary" @click="save">
          {{ isEdit ? 'Update Promotion' : 'Create Promotion' }}
        </BaseButton>
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

.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__back {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;

    &:hover { text-decoration: none; }

    svg { width: 22px; height: 22px; stroke: var(--text-muted); stroke-width: 1.8; }
    span { display: flex; flex-direction: column; line-height: 1.2; }
  }

  &__crumb {
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__title { font-size: 1.1rem; font-weight: 700; color: var(--text-strong); }
  &__actions { display: flex; gap: 0.6rem; }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 920px) { grid-template-columns: 1fr; }
}

/* Bottom action bar */
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
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

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--text-subtle);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & + .field { margin-top: 1rem; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  input,
  textarea,
  select {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  textarea { resize: vertical; }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  .field + .field { margin-top: 0; }

  @media (max-width: 560px) { grid-template-columns: 1fr; }
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
    stroke: var(--text-subtle);
    stroke-width: 1.8;
    pointer-events: none;
  }
}

.affix {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 0.8rem;

  &:focus-within {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  span { color: var(--text-subtle); font-size: 0.9rem; }

  input {
    border: none;
    box-shadow: none;
    padding-inline: 0.5rem;
    &:focus { box-shadow: none; }
  }

  &--suffix { flex-direction: row; }
}

.status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background: var(--bg);

  &--on { background: var(--success-bg); }

  &__text {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--success-ink);
  }
}

.banner {
  position: relative;
  width: 100%;
  height: 110px;
  padding: 0;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;

  &:hover .banner__upload { opacity: 1; }

  &__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__title {
    position: relative;
    z-index: 1;
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-on-solid);
    text-shadow: 0 1px 4px var(--backdrop);
    text-align: center;
    padding: 0 0.75rem;
  }

  &--image .banner__title { display: none; }

  &__upload {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-on-solid);
    background: var(--backdrop);
    opacity: 0;
    transition: opacity 0.15s ease;

    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__remove {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--backdrop);
    color: var(--ink-on-solid);
    cursor: pointer;

    &:hover { background: var(--danger); }

    svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; }
  }
}

.usage {
  margin-top: 1.25rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
    margin-bottom: 0.45rem;
  }

  &__value { color: var(--accent-ink); }

  &__bar {
    height: 8px;
    border-radius: 999px;
    background: var(--surface-hover);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    background: rgb(var(--accent-rgb));
    transition: width 0.2s ease;
  }
}
</style>
