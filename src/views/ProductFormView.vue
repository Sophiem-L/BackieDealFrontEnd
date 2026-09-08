<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import VariantEditor from '@/components/products/VariantEditor.vue'
import { apiFetch } from '@/services/api'
import { fetchPromotions } from '@/services/promotions'
import {
  deriveProductPrice,
  fromApiVariant,
  sumVariantStock,
  toApiVariants,
} from '@/services/variants'
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
  categoryId: '',
  description: '',
  images: [],
  // Multiple promotions can apply to one product; ids of the checked rows.
  // Edited from the variant screen — promotions apply across every variant.
  promotionIds: [],
  // Variants carry all pricing / stock / SKU now. Sent nested under `variants[]`
  // on both create and update.
  variants: [],
  // Kept for the API's still-required product columns, not shown in the form.
  // `sku` is generated on create and preserved from the loaded product on edit;
  // `price` / `stock` are derived from the variants at save time.
  sku: '',
  isActive: true,
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
    const response = await apiFetch(`/admin/products/${productUuid.value}`, {
      token: auth.accessToken,
    })
    const p = response?.data ?? {}
    Object.assign(form, {
      name: p.name ?? '',
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      categoryId: p.category_id ?? '',
      description: p.description ?? '',
      images: toGalleryEntries(p),
      isActive: p.is_active == null ? true : Boolean(p.is_active),
      variants: (p.variants ?? []).map(fromApiVariant),
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

async function save() {
  saving.value = true
  error.value = ''

  // Pricing and stock live on the variants now; the product columns the API
  // still requires are derived from them.
  const productStock = sumVariantStock(form.variants)

  if (!form.sku) form.sku = makeProductSku(form.name)

  const body = {
    name: form.name,
    sku: form.sku,
    barcode: form.barcode,
    description: form.description || null,
    price: deriveProductPrice(form.variants),
    stock_quantity: productStock,
    min_stock_alert: 0,
    in_stock: productStock > 0,
    is_active: form.isActive,
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
              <textarea id="description" v-model="form.description" rows="4" placeholder="Describe the product..."></textarea>
            </div>
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
            <p v-if="promotionsError" class="card__hint card__hint--error">{{ promotionsError }}</p>
            <VariantEditor
              v-model="form.variants"
              v-model:valid="variantsValid"
              :base-sku="form.sku"
              :seed-images="seedImages"
              :mode="variantMode"
              :promotions="promotions"
              :promotion-ids="form.promotionIds"
              :product-name="form.name || 'New product'"
              :product-image="primaryImageUrl"
              :product-active="form.isActive"
              @toggle-promotion="togglePromotion"
            />
          </section>
        </div>
      </fieldset>

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
