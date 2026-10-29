<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import PromotionProductTargets from '@/components/promotions/PromotionProductTargets.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FORM_SELECT } from '@/lib/selectPresets'
import { uploadImage } from '@/services/media'
import {
  DEFAULT_FLASH_HOURS,
  DISCOUNT_TYPES,
  FLASH_SALE_KIND,
  PROMOTION_KINDS,
  STANDARD_KIND,
  TARGET_CATEGORIES,
  TARGET_CUSTOMER_GROUPS,
  TARGET_PRODUCTS,
  TARGET_TYPES,
  fetchPromotion,
  fetchPromotionCategories,
  fetchPromotionCustomerGroups,
  fetchPromotionTargetProduct,
  promotionToForm,
  savePromotion,
  savedTargetTypeCount,
  toDateTimeLocal,
} from '@/services/promotions'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isEdit = computed(() => Boolean(route.params.id))

// What the campaign is, and separately how its money works out. Keeping them
// apart is what lets a flash sale or a BOGO take a flat amount off.
const promotionKinds = PROMOTION_KINDS.map((kind) => kind.label)
const discountTypes = DISCOUNT_TYPES

const form = reactive({
  name: '',
  code: '',
  kind: STANDARD_KIND,
  type: 'Percentage Discount',
  description: '',
  active: true,
  banner: 'linear-gradient(135deg, #b3091a 0%, #2b0a0a 100%)',
  bannerImage: '',
  discountValue: '',
  minimumSpend: '0.00',
  startDate: '',
  endDate: '',
  // A flash sale is scheduled as an instant plus a length, not as two dates —
  // the whole point is a window measured in hours.
  startDateTime: '',
  flashDurationHours: String(DEFAULT_FLASH_HOURS),
  totalLimit: '',
  perCustomerLimit: '',
  currentUsage: 0,
  maxDiscountAmount: '',
  targetType: TARGET_PRODUCTS,
  productIds: [],
  variantIds: [],
  categoryIds: [],
  customerGroupIds: [],
  includeSubcategories: false,
})

// Products already known to the form (the saved selection on edit); the
// product table fetches its own pages.
const knownProducts = ref([])
const categoryOptions = ref([])
const groupOptions = ref([])
const variantOptions = ref([])
const categorySearch = ref('')
const groupSearch = ref('')
const categoryPage = ref(1)
const categoryLastPage = ref(1)
const targetOptionsLoading = ref(false)
const targetOptionsError = ref('')
const loadedProductIds = new Set()
// Set on edit when the saved promotion predates exclusive targeting.
const legacyTargetNotice = ref('')

const targetTypes = TARGET_TYPES

const discountPreview = computed(() => ({
  type: isPercentage.value ? 'percentage' : 'fixed',
  value: form.discountValue,
  maxDiscount: form.maxDiscountAmount,
}))

const optionById = (options, id) => options.find((option) => Number(option.id) === Number(id))
const selectedCategories = computed(() =>
  form.categoryIds.map((id) => optionById(categoryOptions.value, id) ?? { id, name: `Category ${id}` }),
)
const selectedGroups = computed(() =>
  form.customerGroupIds.map((id) => optionById(groupOptions.value, id) ?? { id, name: `Group ${id}` }),
)
const filteredGroups = computed(() => {
  const term = groupSearch.value.trim().toLowerCase()
  if (!term) return groupOptions.value
  return groupOptions.value.filter((group) =>
    `${group.name} ${group.description ?? ''}`.toLowerCase().includes(term),
  )
})
// Inactive categories are listed for context but cannot be targeted.
const activeCategoryOptions = computed(() => categoryOptions.value.filter((category) => category.is_active !== false))

const TARGET_ERROR_FIELDS = ['target_type', 'product_ids', 'variant_ids', 'category_ids', 'customer_group_ids']

// Only an admin's own click switches the target type — restoring a saved
// promotion assigns it directly. The other types' selections are cleared so a
// switch can never save targets of a type the promotion does not use.
function selectTargetType(type) {
  if (form.targetType === type) return

  form.targetType = type
  if (type !== TARGET_PRODUCTS) {
    form.productIds = []
    form.variantIds = []
  }
  if (type !== TARGET_CATEGORIES) {
    form.categoryIds = []
    form.includeSubcategories = false
  }
  if (type !== TARGET_CUSTOMER_GROUPS) form.customerGroupIds = []

  const errors = { ...fieldErrors.value }
  for (const key of Object.keys(errors)) {
    if (TARGET_ERROR_FIELDS.some((field) => key === field || key.startsWith(`${field}.`))) delete errors[key]
  }
  fieldErrors.value = errors
}

function removeFrom(list, id) {
  form[list] = form[list].filter((selected) => Number(selected) !== Number(id))
}

// Mirrors the API's rule so the admin hears about a missing target before a
// round trip; the API still enforces it.
function targetSelectionError() {
  if (form.targetType === TARGET_PRODUCTS && !form.productIds.length) return { product_ids: ['Select at least one product.'] }
  if (form.targetType === TARGET_CATEGORIES && !form.categoryIds.length) return { category_ids: ['Select at least one category.'] }
  if (form.targetType === TARGET_CUSTOMER_GROUPS && !form.customerGroupIds.length) {
    return { customer_group_ids: ['Select at least one customer group.'] }
  }
  return null
}

const pageTitle = computed(() =>
  isEdit.value ? `Edit Promotion: ${form.name || 'Promotion'}` : 'New Promotion',
)

const isFlash = computed(() => form.kind === FLASH_SALE_KIND)
const isPercentage = computed(() => form.type !== 'Fixed Amount')

// Picking "Flash Sale" on a blank form should not leave the admin staring at an
// empty datetime field — most flash sales start now or shortly after.
watch(
  () => form.kind,
  (kind) => {
    if (kind === FLASH_SALE_KIND && !form.startDateTime) form.startDateTime = toDateTimeLocal(Date.now())
  },
)

// Spells out the moment the window closes, so "3 hours" is never left as
// arithmetic for the admin to do in their head.
const flashEndsAt = computed(() => {
  if (!isFlash.value || !form.startDateTime) return ''

  const start = new Date(form.startDateTime).getTime()
  const hours = Number(form.flashDurationHours)
  if (Number.isNaN(start) || !Number.isFinite(hours) || hours <= 0) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(start + hours * 60 * 60 * 1000))
})

const bannerInput = ref(null)
const bannerFile = ref(null)
const loading = ref(false)
const saving = ref(false)
const submitError = ref('')
const fieldErrors = ref({})

function errorFor(field) {
  const key = Object.keys(fieldErrors.value).find((candidate) => candidate === field || candidate.startsWith(`${field}.`))
  const messages = key ? fieldErrors.value[key] : null
  return Array.isArray(messages) ? messages[0] : messages
}

function mergeOptions(current, incoming, key = 'id') {
  const options = new Map(current.map((item) => [String(item[key]), item]))
  for (const item of incoming) options.set(String(item[key]), item)
  return [...options.values()]
}

async function loadCategories(reset = false) {
  if (reset) categoryPage.value = 1
  targetOptionsLoading.value = true
  targetOptionsError.value = ''
  try {
    const result = await fetchPromotionCategories(auth.accessToken, categorySearch.value, categoryPage.value)
    categoryOptions.value = mergeOptions(categoryOptions.value, result.items)
    categoryPage.value = result.currentPage
    categoryLastPage.value = result.lastPage
  } catch (err) {
    targetOptionsError.value = err.message || 'Could not load categories.'
  } finally {
    targetOptionsLoading.value = false
  }
}

async function loadSelectedProductDetails() {
  const missing = form.productIds.filter((id) => !loadedProductIds.has(String(id)))
  await Promise.all(missing.map(async (id) => {
    loadedProductIds.add(String(id))
    try {
      const product = await fetchPromotionTargetProduct(id, auth.accessToken)
      variantOptions.value = mergeOptions(variantOptions.value, product.variants ?? [])
    } catch (err) {
      targetOptionsError.value = err.message || 'Could not load product variants.'
    }
  }))
}

function onProductSelectionChanged() {
  const selectedProductIds = new Set(form.productIds.map(String))
  form.variantIds = form.variantIds.filter((variantId) => {
    const variant = variantOptions.value.find((option) => Number(option.id) === Number(variantId))
    return variant && selectedProductIds.has(String(variant.product_id))
  })
  loadSelectedProductDetails()
}

// Keeps the optional variant list in step with the product selection, however
// it changed: a row click, a chip removal or "Clear all".
watch(() => form.productIds.join(','), onProductSelectionChanged)

async function loadTargetOptions() {
  targetOptionsLoading.value = true
  targetOptionsError.value = ''
  try {
    const [categories, groups] = await Promise.all([
      fetchPromotionCategories(auth.accessToken),
      fetchPromotionCustomerGroups(auth.accessToken),
    ])
    categoryOptions.value = mergeOptions(categoryOptions.value, categories.items)
    groupOptions.value = mergeOptions(groupOptions.value, groups.items)
    categoryLastPage.value = categories.lastPage
  } catch (err) {
    targetOptionsError.value = err.message || 'Could not load targeting options.'
  } finally {
    targetOptionsLoading.value = false
  }
}

async function loadPromotion() {
  if (!isEdit.value) return

  loading.value = true
  submitError.value = ''
  try {
    const promotion = await fetchPromotion(route.params.id, auth.accessToken)
    Object.assign(form, promotionToForm(promotion))
    knownProducts.value = promotion.products ?? []
    if (savedTargetTypeCount(promotion) > 1) {
      legacyTargetNotice.value =
        'This promotion was saved with more than one kind of target. Saving keeps only the targets of the type selected below.'
    } else if (!promotion.target_type && !savedTargetTypeCount(promotion)) {
      legacyTargetNotice.value =
        'This promotion currently applies to the whole order by coupon code. Saving requires choosing a target.'
    }
    categoryOptions.value = mergeOptions(categoryOptions.value, promotion.categories ?? [])
    groupOptions.value = mergeOptions(groupOptions.value, promotion.customer_groups ?? [])
    variantOptions.value = mergeOptions(variantOptions.value, promotion.variants ?? [])
    await loadSelectedProductDetails()
  } catch (err) {
    submitError.value = err.message || 'Could not load the promotion.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadPromotion(), loadTargetOptions()])
})

function pickBanner() {
  bannerInput.value?.click()
}
function onBannerChange(event) {
  const file = event.target.files?.[0]
  if (file) {
    bannerFile.value = file
    form.bannerImage = URL.createObjectURL(file)
  }
}
function clearBanner(event) {
  event.stopPropagation()
  bannerFile.value = null
  form.bannerImage = ''
  if (bannerInput.value) bannerInput.value.value = ''
}

const usagePercent = computed(() => {
  const limit = Number(form.totalLimit)
  if (!limit) return 0
  return Math.min(100, Math.round((Number(form.currentUsage) / limit) * 100))
})

async function save() {
  if (saving.value || loading.value) return

  submitError.value = ''
  fieldErrors.value = {}
  const targetError = targetSelectionError()
  if (targetError) {
    fieldErrors.value = targetError
    submitError.value = 'Please correct the highlighted fields and try again.'
    return
  }

  saving.value = true
  try {
    if (bannerFile.value) {
      form.bannerImage = (await uploadImage(bannerFile.value, { token: auth.accessToken, folder: 'promotions' })).url
    }
    await savePromotion(isEdit.value ? route.params.id : null, form, auth.accessToken)
    router.push({ name: 'promotions' })
  } catch (err) {
    fieldErrors.value = err.errors ?? {}
    submitError.value = err.status === 422
      ? 'Please correct the highlighted fields and try again.'
      : err.message || 'Could not save the promotion.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <p v-if="submitError" class="submit-error">{{ submitError }}</p>
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
              <input id="name" v-model="form.name" :class="{ 'field--invalid': errorFor('name') }" type="text" placeholder="e.g. Black Friday Sale 2023" />
              <span v-if="errorFor('name')" class="field-error">{{ errorFor('name') }}</span>
            </div>
            <div class="row row--three">
              <div class="field">
                <label for="code">Promo Code</label>
                <input id="code" v-model="form.code" :class="{ 'field--invalid': errorFor('code') }" type="text" placeholder="e.g. BLACKFRIDAY23" />
                <span v-if="errorFor('code')" class="field-error">{{ errorFor('code') }}</span>
              </div>
              <div class="field">
                <label for="kind">Promotion Type</label>
                <Select v-model="form.kind">
                  <SelectTrigger id="kind" :class="FORM_SELECT.trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent :class="FORM_SELECT.content">
                    <SelectItem v-for="k in promotionKinds" :key="k" :value="k" :class="FORM_SELECT.item">
                      {{ k }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="field">
                <label for="type">Discount</label>
                <Select v-model="form.type">
                  <SelectTrigger id="type" :class="FORM_SELECT.trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent :class="FORM_SELECT.content">
                    <SelectItem v-for="t in discountTypes" :key="t" :value="t" :class="FORM_SELECT.item">
                      {{ t }}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                <div class="affix" :class="isPercentage ? 'affix--suffix' : null">
                  <span v-if="!isPercentage">$</span>
                  <input id="discount" v-model="form.discountValue" :class="{ 'field--invalid': errorFor('value') }" type="text" placeholder="0" />
                  <span v-if="isPercentage">%</span>
                </div>
                <span v-if="errorFor('value')" class="field-error">{{ errorFor('value') }}</span>
              </div>
              <div class="field">
                <label for="minSpend">Minimum Spend</label>
                <div class="affix">
                  <span>$</span>
                  <input id="minSpend" v-model="form.minimumSpend" type="text" placeholder="0.00" />
                </div>
              </div>
              <div class="field">
                <label for="maxDiscount">Maximum Discount</label>
                <div class="affix">
                  <span>$</span>
                  <input id="maxDiscount" v-model="form.maxDiscountAmount" :class="{ 'field--invalid': errorFor('max_discount_amount') }" type="number" min="0" step="0.01" placeholder="No cap" />
                </div>
                <span v-if="errorFor('max_discount_amount')" class="field-error">{{ errorFor('max_discount_amount') }}</span>
              </div>
            </div>
            <div class="row">
              <div v-if="isFlash" class="field">
                <label for="flashStart">Starts At</label>
                <input id="flashStart" v-model="form.startDateTime" :class="{ 'field--invalid': errorFor('starts_at') }" type="datetime-local" />
                <span v-if="errorFor('starts_at')" class="field-error">{{ errorFor('starts_at') }}</span>
              </div>
              <div v-else class="field">
                <label for="start">Start Date</label>
                <input id="start" v-model="form.startDate" :class="{ 'field--invalid': errorFor('starts_at') }" type="date" />
                <span v-if="errorFor('starts_at')" class="field-error">{{ errorFor('starts_at') }}</span>
              </div>
              <div v-if="isFlash" class="field">
                <label for="flashDuration">Duration (hours)</label>
                <input id="flashDuration" v-model="form.flashDurationHours" :class="{ 'field--invalid': errorFor('expires_at') }" type="number" min="0.5" step="0.5" placeholder="3" />
                <span v-if="errorFor('expires_at')" class="field-error">{{ errorFor('expires_at') }}</span>
                <span v-else-if="flashEndsAt" class="field-hint">Ends {{ flashEndsAt }}</span>
              </div>
              <div v-else class="field">
                <label for="end">End Date</label>
                <input id="end" v-model="form.endDate" :class="{ 'field--invalid': errorFor('expires_at') }" type="date" />
                <span v-if="errorFor('expires_at')" class="field-error">{{ errorFor('expires_at') }}</span>
              </div>
            </div>
          </section>

          <section class="card targeting">
            <h3 class="card__title">Promotion Targeting</h3>
            <p v-if="legacyTargetNotice" class="targeting__notice" role="status">{{ legacyTargetNotice }}</p>

            <div class="targeting__types" role="radiogroup" aria-label="Promotion target">
              <label
                v-for="target in targetTypes"
                :key="target.value"
                class="targeting__type"
                :class="{ 'targeting__type--active': form.targetType === target.value }"
              >
                <input
                  type="radio"
                  name="targetType"
                  :value="target.value"
                  :checked="form.targetType === target.value"
                  @change="selectTargetType(target.value)"
                />
                <span>
                  <span class="targeting__type-label">{{ target.label }}</span>
                  <span class="targeting__type-hint">{{ target.hint }}</span>
                </span>
              </label>
            </div>
            <span v-if="errorFor('target_type')" class="field-error">{{ errorFor('target_type') }}</span>
            <p v-if="targetOptionsError" class="submit-error" role="alert">{{ targetOptionsError }}</p>

            <!-- Products -->
            <div v-if="form.targetType === TARGET_PRODUCTS" class="targeting__section">
              <PromotionProductTargets
                v-model="form.productIds"
                :known="knownProducts"
                :categories="activeCategoryOptions"
                :discount="discountPreview"
                :token="auth.accessToken"
                :error="errorFor('product_ids')"
              />

              <div v-if="variantOptions.length" class="targeting__section">
                <span class="targeting__label">Optional variants for selected products</span>
                <label v-for="variant in variantOptions" :key="variant.id" class="targeting__option">
                  <input v-model="form.variantIds" type="checkbox" :value="Number(variant.id)" />
                  <span>{{ variant.name }} <small>{{ variant.sku }}</small></span>
                </label>
                <span v-if="errorFor('variant_ids')" class="field-error">{{ errorFor('variant_ids') }}</span>
              </div>
            </div>

            <!-- Categories -->
            <div v-else-if="form.targetType === TARGET_CATEGORIES" class="targeting__section">
              <input id="categorySearch" v-model="categorySearch" type="search" placeholder="Search categories" aria-label="Search categories" @input="loadCategories(true)" />
              <div v-if="targetOptionsLoading && !categoryOptions.length" class="targeting__state">Loading categories…</div>
              <div v-else-if="!categoryOptions.length" class="targeting__state">No categories found.</div>
              <div v-else class="targeting__list">
                <label
                  v-for="category in categoryOptions"
                  :key="category.id"
                  class="targeting__option"
                  :class="{
                    'targeting__option--selected': form.categoryIds.includes(Number(category.id)),
                    'targeting__option--disabled': category.is_active === false,
                  }"
                >
                  <input
                    v-model="form.categoryIds"
                    type="checkbox"
                    :value="Number(category.id)"
                    :disabled="category.is_active === false && !form.categoryIds.includes(Number(category.id))"
                  />
                  <span>
                    {{ category.name }}
                    <small v-if="category.parent?.name">in {{ category.parent.name }}</small>
                    <small v-if="category.is_active === false">Inactive</small>
                  </span>
                </label>
              </div>
              <button v-if="categoryPage < categoryLastPage" type="button" class="targeting__more" @click="categoryPage += 1; loadCategories()">Load more categories</button>
              <label class="targeting__toggle">
                <input v-model="form.includeSubcategories" type="checkbox" />
                Include products in descendant categories
              </label>
              <div class="targeting__selected">
                <strong>{{ form.categoryIds.length }} {{ form.categoryIds.length === 1 ? 'category' : 'categories' }} selected</strong>
                <ul v-if="selectedCategories.length" class="targeting__chips">
                  <li v-for="category in selectedCategories" :key="category.id" class="targeting__chip">
                    <span>{{ category.name }}</span>
                    <button type="button" :aria-label="`Remove ${category.name}`" @click="removeFrom('categoryIds', category.id)">×</button>
                  </li>
                </ul>
              </div>
              <span v-if="errorFor('category_ids')" class="field-error">{{ errorFor('category_ids') }}</span>
            </div>

            <!-- Customer groups -->
            <div v-else class="targeting__section">
              <p class="field-hint">Applies to every product for customers in at least one selected group.</p>
              <input v-if="groupOptions.length > 5" id="groupSearch" v-model="groupSearch" type="search" placeholder="Search customer groups" aria-label="Search customer groups" />
              <div v-if="targetOptionsLoading && !groupOptions.length" class="targeting__state">Loading customer groups…</div>
              <div v-else-if="!groupOptions.length" class="targeting__state">No active customer groups. Create one before targeting groups.</div>
              <div v-else-if="!filteredGroups.length" class="targeting__state">No customer groups match “{{ groupSearch }}”.</div>
              <div v-else class="targeting__list">
                <label
                  v-for="group in filteredGroups"
                  :key="group.id"
                  class="targeting__option"
                  :class="{ 'targeting__option--selected': form.customerGroupIds.includes(Number(group.id)) }"
                >
                  <input v-model="form.customerGroupIds" type="checkbox" :value="Number(group.id)" />
                  <span>
                    {{ group.name }}
                    <small v-if="group.users_count != null">{{ group.users_count }} {{ group.users_count === 1 ? 'member' : 'members' }}</small>
                    <span v-if="group.description" class="targeting__desc">{{ group.description }}</span>
                  </span>
                </label>
              </div>
              <div class="targeting__selected">
                <strong>{{ form.customerGroupIds.length }} {{ form.customerGroupIds.length === 1 ? 'group' : 'groups' }} selected</strong>
                <ul v-if="selectedGroups.length" class="targeting__chips">
                  <li v-for="group in selectedGroups" :key="group.id" class="targeting__chip">
                    <span>{{ group.name }}</span>
                    <button type="button" :aria-label="`Remove ${group.name}`" @click="removeFrom('customerGroupIds', group.id)">×</button>
                  </li>
                </ul>
              </div>
              <span v-if="errorFor('customer_group_ids')" class="field-error">{{ errorFor('customer_group_ids') }}</span>
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
        <BaseButton variant="primary" :disabled="saving || loading" @click="save">
          {{ saving ? 'Saving…' : (isEdit ? 'Update Promotion' : 'Create Promotion') }}
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

.field--invalid { border-color: var(--danger) !important; }
.field-error, .submit-error { font-size: 0.75rem; color: var(--danger); }
.field-hint { font-size: 0.75rem; color: var(--text-subtle); }
.submit-error { margin: 0; }

.targeting {
  &__notice { margin: 0 0 1rem; padding: 0.6rem 0.8rem; border-radius: 10px; background: var(--bg); color: var(--text-body); font-size: 0.8rem; }
  &__section { display: grid; gap: 0.45rem; margin-top: 1.1rem; }
  &__label { color: var(--text-body); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }

  &__section > input[type='search'] {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
    font: inherit;
    font-size: 0.85rem;
    color: var(--text-strong);
    background: var(--surface);

    &:focus { outline: none; border-color: rgb(var(--accent-rgb)); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }
  }

  &__types {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;

    @media (max-width: 700px) { grid-template-columns: 1fr; }
  }

  &__type {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;

    input { margin-top: 0.15rem; accent-color: rgb(var(--accent-rgb)); }
    > span { display: flex; flex-direction: column; gap: 0.15rem; }

    &:hover { border-color: rgb(var(--accent-rgb) / 0.5); }
    &:focus-within { box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18); }

    &--active { border-color: rgb(var(--accent-rgb)); background: rgb(var(--accent-rgb) / 0.06); }
  }

  &__type-label { font-size: 0.85rem; font-weight: 700; color: var(--text-strong); }
  &__type-hint { font-size: 0.74rem; color: var(--text-subtle); }

  &__list { display: grid; max-height: 320px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: 10px; }

  &__option {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.35rem 0;
    color: var(--text-body);
    font-size: 0.82rem;

    .targeting__list & { padding: 0.5rem 0.75rem; border-top: 1px solid var(--border-subtle); cursor: pointer; }
    .targeting__list &:first-child { border-top: 0; }

    &--selected { background: rgb(var(--accent-rgb) / 0.08); }
    &--disabled { opacity: 0.55; cursor: default; }
  }

  &__option input, &__toggle input { accent-color: rgb(var(--accent-rgb)); }
  &__option small { margin-left: 0.35rem; color: var(--text-subtle); }
  &__desc { display: block; font-size: 0.74rem; color: var(--text-subtle); }

  &__selected { padding: 0.75rem; border-radius: 10px; background: var(--bg); font-size: 0.8rem; color: var(--text-strong); }
  &__chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0 0; padding: 0; list-style: none; }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.35rem 0.25rem 0.6rem;
    border: 1px solid rgb(var(--accent-rgb) / 0.35);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.76rem;
    color: var(--text-body);

    button {
      width: 20px;
      height: 20px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-subtle);
      cursor: pointer;
      line-height: 1;

      &:hover { background: var(--danger); color: var(--ink-on-solid); }
    }
  }

  &__state { padding: 0.55rem 0; color: var(--text-subtle); font-size: 0.8rem; }
  &__more { justify-self: start; padding: 0.25rem 0; border: 0; color: rgb(var(--accent-rgb)); background: transparent; cursor: pointer; font: inherit; }
  &__toggle { display: flex; align-items: center; gap: 0.55rem; margin-top: 0.35rem; color: var(--text-body); font-size: 0.8rem; }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  // The code plus the two classification dropdowns, which are narrow enough to
  // share a line and belong side by side.
  &--three { grid-template-columns: 1fr 1fr 1fr; }

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
    &--three { grid-template-columns: 1fr; }
  }

  .field + .field { margin-top: 0; }

  @media (max-width: 560px) { grid-template-columns: 1fr; }
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
