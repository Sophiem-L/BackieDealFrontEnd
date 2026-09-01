<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import VariantEditor from '@/components/products/VariantEditor.vue'
import { apiFetch } from '@/services/api'
import { fetchPromotions } from '@/services/promotions'
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

// Loaded from GET /admin/promotions. The selection persists through the
// `coupon_product` pivot, sent as `promotion_ids[]` on save.
const promotions = ref([])
const promotionsError = ref('')

const form = reactive({
  name: '',
  sku: '',
  categoryId: '',
  description: '',
  // Gallery entries: `{ url, isPrimary }`. Sent as `images[]`; the primary
  // entry's URL also goes out as `thumbnail`, which is what the product list
  // and the storefront read.
  images: [],
  stock: 0,
  lowStockThreshold: 5,
  availableForOrder: true,
  basePrice: '',
  costPrice: '',
  // Multiple promotions can apply to one product; ids of the checked rows.
  promotionIds: [],
  // SKU-level variants, sent nested under `variants[]` on both create and update.
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

async function loadPromotions() {
  promotionsError.value = ''
  try {
    promotions.value = await fetchPromotions(auth.accessToken)
  } catch (err) {
    // Non-fatal: the rest of the form still saves. Surfaced rather than
    // swallowed, because an empty picker would otherwise read as "there are no
    // promotions" when the request simply failed.
    promotions.value = []
    promotionsError.value = err.message || 'Could not load promotions.'
  }
}

/**
 * Build the gallery from an API product.
 *
 * Products created before the gallery existed have a `thumbnail` and no
 * `images` rows, so fall back to it — otherwise opening one of them would show
 * an empty gallery and silently wipe the thumbnail on the next save.
 */
function toGalleryEntries(product) {
  const images = Array.isArray(product?.images) ? product.images : []

  if (images.length) {
    return images.map((image) => ({
      url: image.url || image.image,
      isPrimary: Boolean(image.is_primary),
    }))
  }

  return product?.thumbnail ? [{ url: product.thumbnail, isPrimary: true }] : []
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
      images: toGalleryEntries(p),
      stock: p.stock_quantity ?? 0,
      lowStockThreshold: p.min_stock_alert ?? 5,
      availableForOrder: Boolean(p.is_active),
      basePrice: formatMoney(p.price),
      costPrice: formatMoney(p.cost_price),
      variants: (p.variants ?? []).map(fromApiVariant),
      promotionIds: (p.promotion_ids ?? []).map(Number),
    })
  } catch (err) {
    error.value = err.message || 'Unable to load this product.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadPromotions(), loadProduct()])
})

const pageTitle = computed(() => {
  if (isView.value) return `Product Details: ${form.name || 'Product'}`
  return isEdit.value ? `Edit Product: ${form.name || 'Product'}` : 'Add New Product'
})

// Create gets the axis builder; edit gets API-loaded rows with locked SKUs.
const variantMode = computed(() => {
  if (isView.value) return 'view'
  return isEdit.value ? 'edit' : 'create'
})

const selectedPromotions = computed(() =>
  promotions.value.filter((p) => form.promotionIds.includes(p.id)),
)

function isPromotionSelected(id) {
  return form.promotionIds.includes(id)
}

function togglePromotion(id) {
  const index = form.promotionIds.indexOf(id)
  if (index === -1) form.promotionIds.push(id)
  else form.promotionIds.splice(index, 1)
}

// Dropdown state. The panel stays open across clicks so several promotions can
// be checked in one go — it closes on an outside click, on Escape, or on the
// trigger itself.
const promoOpen = ref(false)
const promoRoot = ref(null)
const promoTrigger = ref(null)
// The Promotions card sits at the end of a long form, so the panel would
// usually open past the bottom of the viewport. Flip it above the trigger when
// there isn't room below but there is above.
const promoFlipUp = ref(false)

// Keep in sync with `.promo-select__panel`'s max-height.
const PROMO_PANEL_MAX_HEIGHT = 272

function togglePromotionPanel() {
  if (promoOpen.value) {
    promoOpen.value = false
    return
  }

  const rect = promoTrigger.value?.getBoundingClientRect()
  if (rect) {
    const below = window.innerHeight - rect.bottom
    promoFlipUp.value = below < PROMO_PANEL_MAX_HEIGHT && rect.top > below
  }
  promoOpen.value = true
}

const promoSummary = computed(() => {
  const names = selectedPromotions.value.map((p) => p.name)
  if (names.length === 0) return 'No promotions selected'
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
})

function closePromotions({ focusTrigger = false } = {}) {
  promoOpen.value = false
  if (focusTrigger) promoTrigger.value?.focus()
}

function onPromoDocumentPointerDown(event) {
  if (promoOpen.value && !promoRoot.value?.contains(event.target)) closePromotions()
}

function onPromoDocumentKeydown(event) {
  if (event.key === 'Escape') closePromotions({ focusTrigger: true })
}

onMounted(() => {
  // pointerdown, not click: a click listener would fire after the trigger's own
  // handler had already toggled the panel back open.
  document.addEventListener('pointerdown', onPromoDocumentPointerDown)
  document.addEventListener('keydown', onPromoDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPromoDocumentPointerDown)
  document.removeEventListener('keydown', onPromoDocumentKeydown)
})

// The gallery's primary image, which doubles as the product `thumbnail`.
const primaryImageUrl = computed(
  () => (form.images.find((image) => image.isPrimary) ?? form.images[0])?.url ?? '',
)

// Every gallery image is offered for reuse on variant rows, primary first.
const seedImages = computed(() => {
  const urls = form.images.map((image) => image.url).filter(Boolean)
  const primary = primaryImageUrl.value
  return primary ? [primary, ...urls.filter((url) => url !== primary)] : urls
})

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

  // Always sent, so unchecking every promotion in the UI actually detaches
  // them server side — the API leaves them alone when the key is absent.
  body.promotion_ids = form.promotionIds.map(Number)

  // The gallery uploads before adding an entry, so these are stored URLs. The
  // `blob:` guard stays as a backstop — such a URL resolves for nobody else.
  const galleryImages = form.images.filter(
    (image) => image.url && !image.url.startsWith('blob:'),
  )

  // Always sent, so clearing the gallery in the UI actually clears it server
  // side. `thumbnail` goes along explicitly: the API would derive it from the
  // primary row anyway, but sending it keeps a product whose gallery was
  // emptied from holding on to a thumbnail that is no longer in the list.
  body.images = galleryImages.map((image, index) => ({
    image: image.url,
    is_primary: image.isPrimary,
    sort_order: index,
  }))
  body.thumbnail = primaryImageUrl.value || null

  // Both paths send the nested `variants[]` array; POST /admin/products creates
  // the product and its variants in one transaction.
  //
  // On update, `replace_variants: false` is load-bearing. The default update
  // path soft-deletes every variant then recreates it, which collides with the
  // soft-delete-ignoring unique index on `sku`/`slug` and 500s. Opting out
  // matches existing variants by SKU and updates them in place instead. Create
  // has no such flag — there is nothing to replace yet.
  if (form.variants.length) {
    body.variants = toApiVariants(form.variants)
    if (isEdit.value) body.replace_variants = false
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
            <h3 class="card__title">Product Images</h3>
            <ProductImageGallery
              :images="form.images"
              :readonly="isView"
              @update:images="form.images = $event"
            />
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
            <h3 class="card__title">Pricing</h3>
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

          </section>

          <!--
            On create the editor offers its axis builder and generates a row per
            combination; on edit the rows come from the API and the builder is
            withheld, since regenerating would invent variants the product never
            had. See VariantEditor for what each mode allows.
          -->
          <section class="card">
            <h3 class="card__title">Variants</h3>
            <VariantEditor
              v-model="form.variants"
              v-model:valid="variantsValid"
              :base-sku="form.sku"
              :base-price="form.basePrice"
              :seed-images="seedImages"
              :mode="variantMode"
            />
          </section>

          <section class="card">
            <h3 class="card__title">Promotions</h3>
            <fieldset v-if="!isView" ref="promoRoot" class="promo-picker">
              <legend class="promo-picker__legend">Applied Promotions</legend>
              <p v-if="promotionsError" class="promo-picker__error">{{ promotionsError }}</p>
              <p v-else-if="promotions.length === 0" class="promo-picker__hint">
                No promotions have been created yet.
              </p>

              <div v-else class="promo-select">
                <button
                  ref="promoTrigger"
                  type="button"
                  class="promo-select__trigger"
                  :class="{ 'is-open': promoOpen }"
                  aria-haspopup="true"
                  :aria-expanded="promoOpen"
                  @click="togglePromotionPanel"
                >
                  <span
                    class="promo-select__summary"
                    :class="{ 'is-placeholder': form.promotionIds.length === 0 }"
                  >
                    {{ promoSummary }}
                  </span>
                  <span v-if="form.promotionIds.length" class="promo-select__count">
                    {{ form.promotionIds.length }}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>

                <div
                  v-if="promoOpen"
                  class="promo-select__panel"
                  :class="{ 'is-above': promoFlipUp }"
                >
                  <ul class="promo-picker__list">
                    <li v-for="promo in promotions" :key="promo.id">
                      <label
                        class="promo-option"
                        :class="{ 'is-selected': isPromotionSelected(promo.id) }"
                      >
                        <input
                          type="checkbox"
                          :checked="isPromotionSelected(promo.id)"
                          @change="togglePromotion(promo.id)"
                        />
                        <span class="promo-option__meta">
                          <span class="promo-option__name">{{ promo.name }}</span>
                          <span class="promo-option__period">{{ promo.period }}</span>
                        </span>
                        <span class="promo-option__benefit">{{ promo.benefit }}</span>
                      </label>
                    </li>
                  </ul>
                </div>
              </div>
            </fieldset>

            <!-- The checkbox rows already carry benefit and period, so the
                 preview cards are for view mode only. -->
            <template v-if="isView">
              <p v-if="selectedPromotions.length === 0" class="card__hint">
                No promotions applied.
              </p>
              <div v-for="promo in selectedPromotions" :key="promo.id" class="promo-preview">
                <span class="promo-preview__badge">{{ promo.benefit }}</span>
                <div class="promo-preview__meta">
                  <p class="promo-preview__name">{{ promo.name }}</p>
                  <p class="promo-preview__period">{{ promo.period }}</p>
                </div>
              </div>
            </template>
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

.promo-picker {
  // Block, not the .field flex box: a <legend> inside a flex container renders
  // inconsistently across browsers.
  display: block;
  border: none;
  margin: 0;
  padding: 0;

  // Matches the <label> styling the sibling fields use.
  &__legend {
    padding: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  &__hint {
    margin: 0.35rem 0 0;
    font-size: 0.72rem;
    color: var(--text-subtle);
  }

  &__error {
    margin: 0.35rem 0 0;
    font-size: 0.72rem;
    color: var(--danger);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
}

.promo-select {
  position: relative;
  margin-top: 0.5rem;

  &__trigger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    font-family: inherit;
    font-size: 0.9rem;
    color: var(--text-strong);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover { border-color: rgb(var(--accent-rgb) / 0.6); }

    &:focus-visible,
    &.is-open {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }

    svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      stroke: var(--text-muted);
      stroke-width: 2;
      transition: transform 0.15s ease;
    }

    &.is-open svg { transform: rotate(180deg); }
  }

  // Truncated rather than wrapped, so a long selection can't grow the control
  // and shove the panel down the page.
  &__summary {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-placeholder { color: var(--text-faint); }
  }

  &__count {
    flex-shrink: 0;
    padding: 0.1rem 0.45rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.28);
    border-radius: 999px;
  }

  &__panel {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;

    &.is-above {
      top: auto;
      bottom: calc(100% + 0.35rem);
    }
    max-height: 17rem;
    overflow-y: auto;
    // Room for the rows' focus rings, which the overflow would otherwise clip.
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 12px 28px rgb(0 0 0 / 0.18);
  }
}

.promo-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.7rem;
  background: var(--surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover { border-color: var(--border); background: var(--surface-sunken); }

  &.is-selected {
    border-color: rgb(var(--accent-rgb));
    background: rgb(var(--accent-rgb) / 0.1);
  }

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    margin: 0;
    padding: 0;
    flex-shrink: 0;
    accent-color: rgb(var(--accent-rgb));
    cursor: pointer;
  }

  &__meta { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex: 1; }
  &__name { font-size: 0.86rem; font-weight: 600; color: var(--text-strong); }
  &__period { font-size: 0.74rem; color: var(--text-subtle); }

  &__benefit {
    padding: 0.28rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-ink);
    background: rgb(var(--accent-rgb) / 0.28);
    border-radius: 999px;
    white-space: nowrap;
  }
}

.promo-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.6rem;
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

</style>
