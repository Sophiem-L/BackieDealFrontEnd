<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import VariantEditor from '@/components/products/VariantEditor.vue'
import { apiFetch } from '@/services/api'
import { TARGET_PRODUCTS, fetchPromotions } from '@/services/promotions'
import { receiveSerials } from '@/services/serials'
import {
  blankRow,
  deriveProductPrice,
  fromApiPricing,
  fromApiVariant,
  isStandaloneProduct,
  pendingSerialReceipts,
  sumVariantStock,
  toApiPricing,
  toApiVariants,
  toStockQuantity,
  validateSimplePricing,
} from '@/services/variants'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Edit mode when the route carries a product key; otherwise we're creating.
// The param holds the product `id` (UUID) — the API's route key.
const isEdit = computed(() => Boolean(route.params.id))
const productId = computed(() => route.params.id)
// Set once a create has gone through. Serial numbers are received in a second
// request, so if that one fails the product already exists and the next save has
// to update it rather than create a duplicate.
const createdProductId = ref('')
const savedProductId = computed(() => productId.value || createdProductId.value)
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
// Only product-targeted promotions can take a product; the API rejects the
// rest. One already attached stays listed so it can still be removed.
const attachablePromotions = computed(() =>
  promotions.value.filter((p) => p.target_type === TARGET_PRODUCTS || form.promotionIds.includes(p.id)),
)

const form = reactive({
  name: '',
  categoryId: '',
  description: '',
  images: [],
  // Multiple promotions can apply to one product; ids of the checked rows.
  // Edited from the variant screen — promotions apply across every variant.
  promotionIds: [],
  // Off: the product is sold as a single item. Its price and stock are entered
  // in `simple`, and on create the API generates the one default variant
  // ("Standard") from them. On: variants carry all pricing / stock / SKU and are
  // sent nested under `variants[]` on both create and update.
  hasVariants: false,
  variants: [],
  // Price / stock for a product without variants. On edit it is the product's
  // single default variant (with its `id`), or - for a product saved before
  // every product had a variant - the product's own figures.
  simple: { ...blankRow(), isDefault: true },
  barcode: '',
  // Kept for the API's still-required product columns, not shown in the form.
  // `sku` is generated on create and preserved from the loaded product on edit;
  // `price` / `stock` are derived from the variants at save time.
  sku: '',
  isActive: true,
  isSerialized: false,
})

/**
 * The API still requires a unique product `sku` even though the admin no longer
 * types one. Derive a readable-ish value from the name plus a short time suffix.
 */
function makeProductSku(name) {
  const base = String(name || 'PROD')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'PROD'}-${Date.now().toString(36).toUpperCase()}`.slice(0, 64)
}

// VariantEditor reports whether its rows would pass the API's rules. Duplicate
// or malformed variant SKUs come back as a raw 500 rather than a 422, so the
// Create button stays disabled until they're clean.
const variantsValid = ref(true)

const simpleError = computed(() => (form.hasVariants ? '' : validateSimplePricing(form.simple)))

// Why the form can't be saved yet, shown beside the save button.
const blockedReason = computed(() => {
  if (form.hasVariants) {
    if (!variantsValid.value) return 'Fix the highlighted variant before saving.'
    if (!form.variants.length) return 'Add at least one variant, or turn off "This product has variants".'
    return ''
  }
  return simpleError.value
})

// A saved product with more than one variant can't drop back to a single price:
// its other variants would have to be removed first.
const canTurnOffVariants = computed(() => !isEdit.value || form.variants.length <= 1)

function setHasVariants(on) {
  if (on === form.hasVariants) return
  if (on) {
    // A saved product's default variant becomes the first row, so switching on
    // adds variants beside it instead of replacing it.
    if (!form.variants.length && form.simple.id != null) {
      form.variants = [{ ...form.simple, isDefault: true }]
    }
  } else {
    if (!canTurnOffVariants.value) return
    if (isEdit.value && form.variants.length === 1) {
      form.simple = { ...form.variants[0], isDefault: true }
    }
  }
  form.hasVariants = on
}

async function loadCategories() {
  try {
    const response = await apiFetch('/admin/categories?per_page=100', { token: auth.accessToken })
    const payload = response?.data
    categories.value = Array.isArray(payload) ? payload : (payload?.data ?? [])
  } catch {
    categories.value = []
  }
}

async function loadPromotions() {
  promotionsError.value = ''
  try {
    promotions.value = await fetchPromotions(auth.accessToken)
  } catch (err) {
    promotions.value = []
    promotionsError.value = err.message || 'Could not load promotions.'
  }
}

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
    const response = await apiFetch(`/admin/products/${productId.value}`, {
      token: auth.accessToken,
    })
    const p = response?.data ?? {}
    const variants = p.variants ?? []
    const standalone = isStandaloneProduct(variants)
    Object.assign(form, {
      name: p.name ?? '',
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      categoryId: p.category_id ?? '',
      description: p.description ?? '',
      images: toGalleryEntries(p),
      isActive: p.is_active == null ? true : Boolean(p.is_active),
      isSerialized: Boolean(p.is_serialized),
      hasVariants: !standalone,
      variants: standalone ? [] : variants.map(fromApiVariant),
      simple:
        variants.length === 1 && standalone
          ? { ...fromApiVariant(variants[0]), isDefault: true }
          : {
              ...blankRow(),
              ...fromApiPricing(p),
              stock: p.stock_quantity ?? 0,
              minStockAlert: p.min_stock_alert ?? 0,
              isDefault: true,
            },
      promotionIds: (p.promotion_ids ?? []).map(Number),
    })
  } catch (err) {
    error.value = err.message || 'Unable to load this product.'
  } finally {
    loading.value = false
  }
}

// Generate the hidden product SKU up front on create: the variant editor seeds
// each variant's SKU and (globally-unique) slug from it, so it must exist before
// the first combination is generated.
if (!isEdit.value) form.sku = makeProductSku(form.name)

onMounted(async () => {
  await Promise.all([loadCategories(), loadPromotions(), loadProduct()])
})

const pageTitle = computed(() => {
  if (isView.value) return `Product Details: ${form.name || 'Product'}`
  return isEdit.value ? `Edit Product: ${form.name || 'Product'}` : 'Add New Product'
})

const variantMode = computed(() => {
  if (isView.value) return 'view'
  return isEdit.value ? 'edit' : 'create'
})

// Toggled from the variant screen — promotions apply across the whole product.
function togglePromotion(id) {
  const index = form.promotionIds.indexOf(id)
  if (index === -1) form.promotionIds.push(id)
  else form.promotionIds.splice(index, 1)
}

// The gallery's primary image, which doubles as the product `thumbnail`.
const primaryImageUrl = computed(
  () => (form.images.find((image) => image.isPrimary) ?? form.images[0])?.url ?? '',
)

const seedImages = computed(() => {
  const urls = form.images.map((image) => image.url).filter(Boolean)
  const primary = primaryImageUrl.value
  return primary ? [primary, ...urls.filter((url) => url !== primary)] : urls
})

function messageFrom(err, fallback) {
  const fieldError = Object.values(err.errors ?? {})[0]
  return (Array.isArray(fieldError) ? fieldError[0] : fieldError) || err.message || fallback
}

// Serial numbers can't ride along with the variants: the API receives them
// against a saved variant id. Each batch is dropped from its row once received,
// so a retry after a failure never sends the same serials twice.
async function receivePendingSerials(product) {
  for (const receipt of pendingSerialReceipts(form.variants, product.variants ?? [])) {
    if (receipt.variantId == null) {
      throw new Error(`Variant ${receipt.sku} was not found on the saved product.`)
    }
    await receiveSerials(
      {
        product_id: product.id,
        product_variant_id: receipt.variantId,
        serial_numbers: receipt.serials,
      },
      auth.accessToken,
    )
    form.variants = form.variants.map((row) =>
      row.sku === receipt.sku
        ? { ...row, serials: [], receivedSerials: (row.receivedSerials ?? 0) + receipt.serials.length }
        : row,
    )
  }
}

async function save() {
  error.value = ''

  if (blockedReason.value) {
    error.value = blockedReason.value
    return
  }

  if (form.hasVariants && !form.isSerialized && form.variants.some((row) => row.serials?.length)) {
    error.value =
      'Serial numbers are entered, but "Track individual serial numbers" is off. Turn it on, or remove the serial numbers.'
    return
  }

  saving.value = true
  const updating = Boolean(savedProductId.value)

  if (!form.sku) form.sku = makeProductSku(form.name)

  const body = {
    name: form.name,
    sku: form.sku,
    barcode: form.barcode || null,
    description: form.description || null,
    is_active: form.isActive,
    is_serialized: form.isSerialized,
  }

  if (form.hasVariants) {
    // Pricing and stock live on the variants; the product columns the API still
    // requires are derived from them.
    const productStock = sumVariantStock(form.variants)
    Object.assign(body, {
      price: deriveProductPrice(form.variants),
      stock_quantity: productStock,
      min_stock_alert: 0,
      in_stock: productStock > 0,
    })
  } else {
    // The API copies these onto the default variant it generates on create.
    const pricing = toApiPricing(form.simple)
    const stock = toStockQuantity(form.simple.stock)
    Object.assign(body, {
      price: pricing.price ?? 0,
      sale_price: pricing.sale_price,
      cost_price: pricing.cost_price,
      stock_quantity: stock,
      min_stock_alert: toStockQuantity(form.simple.minStockAlert),
      in_stock: stock > 0,
    })
  }

  if (form.categoryId) body.category_id = Number(form.categoryId)
  body.promotion_ids = form.promotionIds.map(Number)

  const galleryImages = form.images.filter(
    (image) => image.url && !image.url.startsWith('blob:'),
  )

  body.images = galleryImages.map((image, index) => ({
    image: image.url,
    is_primary: image.isPrimary,
    sort_order: index,
  }))
  body.thumbnail = primaryImageUrl.value || null

  // Without variants on create, `variants` is left out and the API generates the
  // default one. On edit, the product's single default variant is kept in step
  // with the price and stock entered above.
  const rows = form.hasVariants ? form.variants : form.simple.id != null ? [form.simple] : []

  if (rows.length) {
    body.variants = toApiVariants(rows)
    if (updating) {
      // Sync in place so each variant keeps its id (serials, stock history and
      // orders point at it). Rows carry the id of the variant they edit, and a
      // variant the form no longer has is removed.
      body.replace_variants = false
      body.remove_missing_variants = true
    }
  }

  let product
  try {
    const response = updating
      ? await apiFetch(`/admin/products/${savedProductId.value}`, {
          method: 'PUT',
          body,
          token: auth.accessToken,
        })
      : await apiFetch('/admin/products', { method: 'POST', body, token: auth.accessToken })
    product = response?.data ?? {}
    if (!updating) createdProductId.value = product.id ?? ''
    // New variants now exist: remember their ids so that saving again (after a
    // serial-number failure, say) edits them rather than adding them twice.
    form.variants = form.variants.map((row) => ({
      ...row,
      id: row.id ?? product.variants?.find((saved) => saved.sku === row.sku)?.id ?? null,
    }))
    // Likewise the default variant the API generated for a product without any.
    if (!form.hasVariants && form.simple.id == null && product.default_variant_id != null) {
      const generated = product.variants?.find((saved) => saved.id === product.default_variant_id)
      if (generated) form.simple = { ...fromApiVariant(generated), isDefault: true }
    }
  } catch (err) {
    error.value = messageFrom(err, 'Unable to save this product.')
    saving.value = false
    return
  }

  try {
    if (form.hasVariants) await receivePendingSerials(product)
  } catch (err) {
    error.value = `The product was saved, but its serial numbers were not all received: ${messageFrom(err, 'unknown error')}`
    saving.value = false
    return
  }

  saving.value = false
  router.push('/products')
}
function cancel() {
  router.push('/products')
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
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
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Product Images</h3>
            <ProductImageGallery
              :images="form.images"
              :readonly="isView"
              @update:images="form.images = $event"
            />
          </section>
        </div>

        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">General Information</h3>
            <div class="field">
              <label for="name">Product Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. NVIDIA GeForce RTX 4090" />
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
              <div class="field">
                <label for="meta-title">Meta Title</label>
                <input id="meta-title" v-model="form.metaTitle" type="text" placeholder="SEO Title" />
              </div>
            </div>
            <div class="field field--description">
              <label for="description">Description</label>
              <RichTextEditor
                id="description"
                v-model="form.description"
                label="Product description"
                placeholder="Describe the product..."
                :readonly="isView"
              />
            </div>
            <label class="serialized-toggle">
              <input v-model="form.isSerialized" type="checkbox" />
              <span>
                <strong>Track individual serial numbers</strong>
                <small>Require a physical serial for receiving and checkout.</small>
              </span>
            </label>
            <div class="field">
              <label for="meta-description">Meta Description</label>
              <textarea id="meta-description" v-model="form.metaDescription" rows="2" placeholder="SEO Description"></textarea>
            </div>
          </section>

          <!--
            Media, pricing, SKU/barcode and the product promotions are all set
            per variant on the full-screen variant screen — see VariantEditor.
          -->
          <section class="card">
            <h3 class="card__title">Variants</h3>
            <label v-if="!isView" class="serialized-toggle variants-toggle">
              <input
                type="checkbox"
                :checked="form.hasVariants"
                :disabled="form.hasVariants && !canTurnOffVariants"
                @change="setHasVariants($event.target.checked)"
              />
              <span>
                <strong>This product has variants</strong>
                <small v-if="form.hasVariants && !canTurnOffVariants">
                  Remove variants until one is left to sell this product as a single item.
                </small>
                <small v-else-if="form.hasVariants">
                  Options such as size or color, each with its own price, stock and SKU.
                </small>
                <small v-else>
                  Off: sold as a single item. A default variant is created automatically from the
                  price and stock below.
                </small>
              </span>
            </label>
            <p v-if="promotionsError" class="card__hint card__hint--error">{{ promotionsError }}</p>

            <!-- A single item: one price and stock, kept on its default variant. -->
            <div v-if="!form.hasVariants" class="simple">
              <div class="simple__grid">
                <div class="field">
                  <label for="simple-price">Price</label>
                  <input
                    id="simple-price"
                    v-model="form.simple.price"
                    type="text"
                    inputmode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div class="field">
                  <label for="simple-compare">Compare-at price</label>
                  <input
                    id="simple-compare"
                    v-model="form.simple.compareAt"
                    type="text"
                    inputmode="decimal"
                    placeholder="Optional"
                  />
                </div>
                <div class="field">
                  <label for="simple-cost">Cost per item</label>
                  <input
                    id="simple-cost"
                    v-model="form.simple.costPrice"
                    type="text"
                    inputmode="decimal"
                    placeholder="Optional"
                  />
                </div>
                <div class="field">
                  <label for="simple-stock">Stock</label>
                  <input id="simple-stock" v-model="form.simple.stock" type="number" min="0" step="1" />
                </div>
                <div class="field">
                  <label for="simple-alert">Low stock alert</label>
                  <input id="simple-alert" v-model="form.simple.minStockAlert" type="number" min="0" step="1" />
                </div>
                <div class="field">
                  <label for="simple-barcode">Barcode</label>
                  <input id="simple-barcode" v-model="form.barcode" type="text" maxlength="64" placeholder="Optional" />
                </div>
              </div>
              <p v-if="simpleError && !isView" class="simple__error">{{ simpleError }}</p>
              <p class="simple__default">
                <span class="simple__badge">Default variant</span>
                <template v-if="form.simple.id != null">
                  {{ form.simple.name || 'Standard' }} · <code>{{ form.simple.sku }}</code>
                </template>
                <template v-else-if="!isEdit">
                  "Standard" is created when you save, with SKU <code>{{ form.sku }}-DEFAULT</code>.
                </template>
                <template v-else>
                  None yet. Turn on variants to add one; this product is sold at product level until then.
                </template>
              </p>
              <p v-if="form.isSerialized && !isView" class="card__hint simple__hint">
                Serial numbers are received from Stock once the product is saved.
              </p>
            </div>

            <VariantEditor
              v-show="form.hasVariants"
              v-model="form.variants"
              v-model:valid="variantsValid"
              :base-sku="form.sku"
              :seed-images="seedImages"
              :mode="variantMode"
              :promotions="attachablePromotions"
              :promotion-ids="form.promotionIds"
              :product-name="form.name || 'New product'"
              :product-image="primaryImageUrl"
              :product-active="form.isActive"
              v-model:serialized="form.isSerialized"
              @toggle-promotion="togglePromotion"
            />
          </section>
        </div>
      </fieldset>

      <div v-if="!isView && !loading" class="form-footer">
        <p v-if="blockedReason" class="form-footer__blocked">
          {{ blockedReason }}
        </p>
        <BaseButton variant="ghost" :disabled="saving" @click="cancel">Cancel</BaseButton>
        <BaseButton variant="primary" :disabled="saving || Boolean(blockedReason)" @click="save">
          <template v-if="saving">Saving…</template>
          <template v-else>{{ savedProductId ? 'Update Product' : 'Create Product' }}</template>
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

.serialized-toggle {
  display: flex;
  align-items: flex-start;
  gap: .7rem;
  margin-top: 1rem;
  color: var(--text-strong);
  cursor: pointer;

  input { margin-top: .2rem; }
  strong, small { display: block; }
  small { margin-top: .2rem; color: var(--text-muted); font-size: .78rem; }
}

.variants-toggle { margin: 0 0 1rem; }

.simple {
  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;

    // The grid owns the spacing between fields.
    .field + .field { margin-top: 0; }

    @media (max-width: 720px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @media (max-width: 480px) { grid-template-columns: 1fr; }
  }

  &__error {
    margin: 0.75rem 0 0;
    font-size: 0.78rem;
    color: var(--danger);
  }

  &__default {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    margin: 1rem 0 0;
    font-size: 0.8rem;
    color: var(--text-body);

    code { font-size: 0.75rem; color: var(--text-subtle); }
  }

  &__badge {
    padding: 0.1rem 0.5rem;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: rgb(var(--accent-rgb));
    background: rgb(var(--accent-rgb) / 0.12);
    border-radius: 999px;
  }

  &__hint { text-align: left; }
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

// Main info on the left, images on the right.
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

    &--error {
      margin-top: 0;
      margin-bottom: 0.75rem;
      color: var(--danger);
      text-align: left;
    }
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

</style>
