<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import VariantEditor from '@/components/products/VariantEditor.vue'
import { apiFetch } from '@/services/api'
import { fromApiVariant, toApiVariants } from '@/services/variants'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Edit mode when the route carries a product key; otherwise we're creating.
// The param holds the product `uuid` — the API's route key.
const isEdit = computed(() => Boolean(route.params.id))
const productUuid = computed(() => route.params.id)
// Read-only view mode when opened with ?view=1 (the list's View icon).
const isView = computed(() => Boolean(route.query.view))

const loading = ref(false)
const saving = ref(false)
const error = ref('')

// Loaded from GET /admin/categories to populate the dropdown.
const categories = ref([])

// NOTE: there is no product↔promotion relation in the API (the promotions table
// has no product link and Product exposes no promotion relationship), so this
// list stays static and is NOT persisted on save. Flagged for the backend team.
const promotions = [
  { id: 1, name: 'Black Friday Sale', benefit: 'Up to 30% OFF', period: 'Nov 20 - Nov 30' },
  { id: 2, name: 'Intel 14th Gen Launch', benefit: 'Flat $50 OFF', period: 'Oct 15 - Oct 31' },
  { id: 3, name: 'Student Special', benefit: '10% OFF Storewide', period: 'Permanent' },
]

const form = reactive({
  name: '',
  sku: '',
  categoryId: '',
  description: '',
  imageUrl: '',
  stock: 0,
  lowStockThreshold: 5,
  availableForOrder: true,
  basePrice: '',
  costPrice: '',
  promotionId: '',
  // NOTE: Product has no specs/attributes field on the API (the `attributes`
  // table is a global definition list with no product link; only ProductVariant
  // carries an attributes JSON). Not persisted on save — flagged for the team.
  specs: [{ key: '', value: '' }],
  // SKU-level variants. Sent nested on create only; see variantsSentOnSave.
  variants: [],
})

// VariantEditor reports whether its rows would pass the API's rules. Duplicate
// or malformed variant SKUs come back as a raw 500 rather than a 422, so the
// Create button stays disabled until they're clean.
const variantsValid = ref(true)

// "1,599.00" <-> 1599.00
function formatMoney(value) {
  if (value == null) return ''
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
function parseMoney(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

async function loadCategories() {
  try {
    const response = await apiFetch('/admin/categories?per_page=100', { token: auth.accessToken })
    // The endpoint wraps a paginator, so `data` may be the array itself or {data: [...]}.
    const payload = response?.data
    categories.value = Array.isArray(payload) ? payload : (payload?.data ?? [])
  } catch {
    // A failed category load shouldn't block the form; the dropdown just stays empty.
    categories.value = []
  }
}

async function loadProduct() {
  if (!isEdit.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/admin/products/${productUuid.value}`, {
      token: auth.accessToken,
    })
    const p = response?.data ?? {}
    Object.assign(form, {
      name: p.name ?? '',
      sku: p.sku ?? '',
      categoryId: p.category_id ?? '',
      description: p.description ?? '',
      imageUrl: p.thumbnail ?? '',
      stock: p.stock_quantity ?? 0,
      lowStockThreshold: p.min_stock_alert ?? 5,
      availableForOrder: Boolean(p.is_active),
      basePrice: formatMoney(p.price),
      costPrice: formatMoney(p.cost_price),
      variants: (p.variants ?? []).map(fromApiVariant),
    })
  } catch (err) {
    error.value = err.message || 'Unable to load this product.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadProduct()])
})

const pageTitle = computed(() => {
  if (isView.value) return `Product Details: ${form.name || 'Product'}`
  return isEdit.value ? `Edit Product: ${form.name || 'Product'}` : 'Add New Product'
})

const selectedPromotion = computed(
  () => promotions.find((p) => p.id === form.promotionId) || null,
)

const fileInput = ref(null)
function pickImage() {
  fileInput.value?.click()
}
function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) form.imageUrl = URL.createObjectURL(file)
}

function addSpec() {
  form.specs.push({ key: '', value: '' })
}
function removeSpec(index) {
  form.specs.splice(index, 1)
}

async function save() {
  saving.value = true
  error.value = ''

  const body = {
    name: form.name,
    sku: form.sku,
    description: form.description || null,
    price: parseMoney(form.basePrice),
    cost_price: parseMoney(form.costPrice),
    stock_quantity: Number(form.stock) || 0,
    min_stock_alert: Number(form.lowStockThreshold) || 0,
    in_stock: Number(form.stock) > 0,
    is_active: form.availableForOrder,
  }

  if (form.categoryId) body.category_id = Number(form.categoryId)
  // Only send a real stored path — `blob:` previews from the file picker are
  // local object URLs and would not resolve for anyone else.
  if (form.imageUrl && !form.imageUrl.startsWith('blob:')) body.thumbnail = form.imageUrl

  // Variants go out on create only. The update path soft-deletes variants and
  // recreates them, which collides with the soft-delete-ignoring unique index
  // on `sku`/`slug` and 500s — so PUT never carries `variants`.
  if (!isEdit.value && form.variants.length) {
    body.variants = toApiVariants(form.variants)
  }

  try {
    if (isEdit.value) {
      await apiFetch(`/admin/products/${productUuid.value}`, {
        method: 'PUT',
        body,
        token: auth.accessToken,
      })
    } else {
      await apiFetch('/admin/products', { method: 'POST', body, token: auth.accessToken })
    }
    router.push('/products')
  } catch (err) {
    // Surface the first field error from a 422 when there is one.
    const fieldError = Object.values(err.errors ?? {})[0]
    error.value = (Array.isArray(fieldError) ? fieldError[0] : fieldError) || err.message || 'Unable to save this product.'
  } finally {
    saving.value = false
  }
}
function cancel() {
  router.push('/products')
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/products" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Back to Products</span>
          </span>
        </RouterLink>
      </div>

      <p v-if="error" class="alert">{{ error }}</p>
      <p v-if="loading" class="loading-note">Loading product…</p>

      <fieldset v-else class="grid" :disabled="isView">
        <!-- Left column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Product Image</h3>
            <!-- View mode: static preview, no upload affordance -->
            <div v-if="isView" class="image image--view">
              <img v-if="form.imageUrl" :src="form.imageUrl" alt="Product image" />
              <span v-else class="image__placeholder">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>No image</span>
              </span>
            </div>

            <!-- Edit/create mode: clickable upload -->
            <template v-else>
              <button type="button" class="image" @click="pickImage">
                <img v-if="form.imageUrl" :src="form.imageUrl" alt="Product preview" />
                <span v-else class="image__placeholder">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="9.5" r="1.5" />
                    <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span>Click to upload</span>
                </span>
              </button>
              <input
                ref="fileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                @change="onFileChange"
              />
              <p class="card__hint">Recommended: 1000x1000px. PNG, JPG or WebP.</p>
            </template>
          </section>

          <section class="card">
            <h3 class="card__title">Stock &amp; Availability</h3>
            <div class="field">
              <label for="stock">Current Stock Quantity</label>
              <input id="stock" v-model.number="form.stock" type="number" min="0" />
            </div>
            <div class="field">
              <label for="threshold">Low Stock Threshold</label>
              <input id="threshold" v-model.number="form.lowStockThreshold" type="number" min="0" />
            </div>
            <div class="availability" :class="{ 'availability--on': form.availableForOrder }">
              <span class="availability__dot"></span>
              <ToggleSwitch v-if="!isView" v-model="form.availableForOrder" label="Available for Order" />
              <span v-else class="availability__status">
                {{ form.availableForOrder ? 'Available for Order' : 'Not Available for Order' }}
              </span>
            </div>
          </section>
        </div>

        <!-- Right column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">General Information</h3>
            <div class="field">
              <label for="name">Product Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. NVIDIA GeForce RTX 4090" />
            </div>
            <div class="row">
              <div class="field">
                <label for="sku">SKU Number</label>
                <input id="sku" v-model="form.sku" type="text" placeholder="e.g. NV-RTX4090-FE" />
              </div>
              <div class="field">
                <label for="category">Category</label>
                <div class="select-wrap">
                  <select id="category" v-model="form.categoryId">
                    <option value="">Select a category</option>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div class="field field--description">
              <label for="description">Description</label>
              <textarea id="description" v-model="form.description" rows="4" placeholder="Describe the product..."></textarea>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Pricing &amp; Technical Specs</h3>
            <div class="row">
              <div class="field">
                <label for="basePrice">Base Price</label>
                <div class="money">
                  <span>$</span>
                  <input id="basePrice" v-model="form.basePrice" type="text" placeholder="0.00" />
                </div>
              </div>
              <div class="field">
                <label for="costPrice">Cost Price</label>
                <div class="money">
                  <span>$</span>
                  <input id="costPrice" v-model="form.costPrice" type="text" placeholder="0.00" />
                </div>
              </div>
            </div>

            <div class="specs">
              <div class="specs__head">
                <h4>Technical Specifications</h4>
                <button v-if="!isView" type="button" class="specs__add" @click="addSpec">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
                  Add Attribute
                </button>
              </div>
              <div v-for="(spec, i) in form.specs" :key="i" class="specs__row">
                <input v-model="spec.key" type="text" class="specs__key" placeholder="Attribute" />
                <input v-model="spec.value" type="text" class="specs__value" placeholder="Value" />
                <button
                  v-if="!isView"
                  type="button"
                  class="specs__remove"
                  aria-label="Remove attribute"
                  @click="removeSpec(i)"
                >
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
                </button>
              </div>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Variants</h3>
            <VariantEditor
              v-model="form.variants"
              v-model:valid="variantsValid"
              :base-sku="form.sku"
              :base-price="form.basePrice"
              :readonly="isEdit"
            />
          </section>

          <section class="card">
            <h3 class="card__title">Promotion</h3>
            <div v-if="!isView" class="field">
              <label for="promotion">Applied Promotion</label>
              <div class="select-wrap">
                <select id="promotion" v-model="form.promotionId">
                  <option value="">No promotion</option>
                  <option v-for="promo in promotions" :key="promo.id" :value="promo.id">
                    {{ promo.name }} — {{ promo.benefit }}
                  </option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </div>
            </div>

            <p v-if="isView && !selectedPromotion" class="card__hint">No promotion applied.</p>

            <div v-if="selectedPromotion" class="promo-preview">
              <span class="promo-preview__badge">{{ selectedPromotion.benefit }}</span>
              <div class="promo-preview__meta">
                <p class="promo-preview__name">{{ selectedPromotion.name }}</p>
                <p class="promo-preview__period">{{ selectedPromotion.period }}</p>
              </div>
            </div>
          </section>
        </div>
      </fieldset>

      <!-- Form actions -->
      <div v-if="!isView && !loading" class="form-footer">
        <p v-if="!variantsValid" class="form-footer__blocked">
          Fix the highlighted variant before saving.
        </p>
        <BaseButton variant="ghost" :disabled="saving" @click="cancel">Cancel</BaseButton>
        <BaseButton variant="primary" :disabled="saving || !variantsValid" @click="save">
          <template v-if="saving">Saving…</template>
          <template v-else>{{ isEdit ? 'Update Product' : 'Create Product' }}</template>
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
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }
}

.alert {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
}

.loading-note {
  margin: 0;
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.88rem;
  color: var(--text-subtle);
}

.grid {
  // Rendered as a <fieldset> so view mode can disable every control at once —
  // reset the element's default border/padding/margin.
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;

  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

// Main info on the left, image/stock on the right.
.col--main { order: 1; }
.col--side { order: 2; }

@media (max-width: 900px) {
  .col--side { order: 1; }
  .col--main { order: 2; }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;

  &__blocked {
    margin: 0 auto 0 0;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--danger);
  }
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
    color: var(--text-subtle);
    text-align: center;
  }
}

.image {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--switch-track);
  border-radius: 12px;
  background: var(--surface-sunken);
  overflow: hidden;
  cursor: pointer;
  padding: 0;

  &:hover { border-color: rgb(var(--accent-rgb)); }

  // View mode: solid border, no pointer/hover affordance.
  &--view {
    border-style: solid;
    cursor: default;
    &:hover { border-color: var(--switch-track); }
  }

  img { width: 100%; height: 100%; object-fit: cover; }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-subtle);
    font-size: 0.8rem;

    svg { width: 34px; height: 34px; stroke: currentColor; stroke-width: 1.5; }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--description { gap: 0.7rem; }

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

  &--3 { grid-template-columns: repeat(3, 1fr); }

  .field + .field { margin-top: 0; }

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
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

.money {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding-left: 0.8rem;

  &:focus-within {
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
  }

  span { color: var(--text-subtle); font-size: 0.9rem; }

  input {
    border: none;
    box-shadow: none;
    &:focus { box-shadow: none; }
  }
}

.availability {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background: var(--bg);
  transition: background-color 0.15s ease;

  &--on { background: var(--success-bg); }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
    order: -1;
  }
  &--on &__dot { background: var(--success); }

  &__status {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }
  &--on &__status { color: var(--success-ink); }
}

.promo-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgb(var(--accent-rgb) / 0.4);
  background: rgb(var(--accent-rgb) / 0.1);
  border-radius: 10px;

  &__badge {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.28);
    border-radius: 999px;
    white-space: nowrap;
  }

  &__meta { min-width: 0; }
  &__name { margin: 0; font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  &__period { margin: 0.15rem 0 0; font-size: 0.76rem; color: var(--text-subtle); }
}

.specs {
  margin-top: 1.5rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;

    h4 {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-body);
    }
  }

  &__add {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--accent-ink);
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover { color: var(--accent-ink); border-color: transparent; }

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; }
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr 1.4fr auto;
    gap: 0.5rem;
    align-items: center;

    & + & { margin-top: 0.5rem; }
  }

  &__key,
  &__value {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);

    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  &__key { background: var(--surface-sunken); }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-subtle);
    cursor: pointer;

    &:hover { background: var(--danger-bg); color: var(--danger); border-color: transparent; }

    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.9; }
  }
}
</style>
