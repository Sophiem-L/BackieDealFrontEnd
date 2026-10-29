import { computed, reactive } from 'vue'

// Product and variant targeting for a promotion, shared by create and edit.
//
// The API discounts a product listed in `product_ids` on every one of its
// variants, and a variant listed in `variant_ids` on its own. So each product
// is in exactly one of three modes:
//   'whole'    — in form.productIds; every variant is discounted.
//   'variants' — in form.specificProductIds (form-only, never sent); only its
//                variants in form.variantIds are discounted.
//   'none'     — not targeted.
// Selections are ids, so searching, filtering, paging and collapsing groups
// never change them.

const productKey = (id) => String(id)
const variantKey = (id) => Number(id)

export const isTargetableVariant = (variant) => variant?.is_active !== false

export function variantAttributes(variant) {
  const attributes = variant?.attributes
  if (!attributes || typeof attributes !== 'object') return []
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
    .map(([name, value]) => ({ name, value: String(value) }))
}

export function usePromotionTargets(form, { loadProduct = null, concurrency = 4 } = {}) {
  // Product summaries seen anywhere: list pages, the saved promotion, details.
  const products = reactive(new Map())
  // productId -> { status: 'loading' | 'loaded' | 'error', items, error }
  const variantLists = reactive(new Map())
  // variantId -> productId for every variant seen, so a product's selected
  // variants can be found without its variant list being loaded.
  const owners = reactive(new Map())
  const variantDetails = reactive(new Map())
  const pending = new Map()

  const wholeIds = computed(() => new Set(form.productIds.map(productKey)))
  const specificIds = computed(() => new Set(form.specificProductIds.map(productKey)))
  const selectedVariantIds = computed(() => new Set(form.variantIds.map(variantKey)))

  // Whole and narrowed products together, in the order they were picked.
  const selectedProductIds = computed(() => [
    ...new Set([...form.productIds.map(productKey), ...form.specificProductIds.map(productKey)]),
  ])

  function rememberVariants(variants, productId = null) {
    for (const variant of variants ?? []) {
      if (variant?.id == null) continue
      const id = variantKey(variant.id)
      const owner = productKey(variant.product_id ?? productId)
      owners.set(id, owner)
      variantDetails.set(id, { ...variantDetails.get(id), ...variant, product_id: owner })
    }
  }

  function rememberProducts(list) {
    for (const product of list ?? []) {
      if (product?.id == null) continue
      const id = productKey(product.id)
      const { variants, ...rest } = product
      const next = { ...products.get(id), ...rest, id }
      if (Array.isArray(variants)) {
        next.variants_count = variants.filter(isTargetableVariant).length
        rememberVariants(variants, id)
      } else if (typeof variants === 'number') {
        next.variants_count = variants
      }
      products.set(id, next)
    }
  }

  function productOf(productId) {
    const id = productKey(productId)
    return products.get(id) ?? { id, name: `Product ${id}` }
  }

  function modeOf(productId) {
    const id = productKey(productId)
    if (wholeIds.value.has(id)) return 'whole'
    if (specificIds.value.has(id)) return 'variants'
    return 'none'
  }

  function variantIdsOf(productId) {
    const id = productKey(productId)
    return form.variantIds.map(variantKey).filter((variantId) => owners.get(variantId) === id)
  }

  function variantIdsWithout(productId) {
    const id = productKey(productId)
    return form.variantIds.map(variantKey).filter((variantId) => owners.get(variantId) !== id)
  }

  async function ensureVariants(productId, { force = false } = {}) {
    const id = productKey(productId)
    const current = variantLists.get(id)
    if (!loadProduct) return
    if (pending.has(id)) return pending.get(id)
    if (current && current.status !== 'error' && !force) return

    variantLists.set(id, { status: 'loading', items: current?.items ?? [], error: '' })
    const request = Promise.resolve()
      .then(() => loadProduct(id))
      .then((product) => {
        const items = (product?.variants ?? []).map((variant) => ({ ...variant, product_id: productKey(variant.product_id ?? id) }))
        rememberProducts([{ ...product, id }])
        variantLists.set(id, { status: 'loaded', items, error: '' })
      })
      .catch((err) => {
        variantLists.set(id, { status: 'error', items: [], error: err?.message || 'Could not load variants.' })
      })
      .finally(() => pending.delete(id))
    pending.set(id, request)
    return request
  }

  // Loads several products' variants, a few at a time.
  async function ensureVariantsFor(productIds) {
    const queue = productIds.map(productKey).filter((id) => {
      const status = variantLists.get(id)?.status
      return !status || status === 'error'
    })
    const worker = async () => {
      while (queue.length) await ensureVariants(queue.shift())
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  }

  function setWhole(productId) {
    const id = productKey(productId)
    const wasNarrowed = specificIds.value.has(id)
    if (!wholeIds.value.has(id)) form.productIds = [...form.productIds.map(productKey), id]
    form.specificProductIds = form.specificProductIds.map(productKey).filter((selected) => selected !== id)
    // Its variant picks would only repeat the whole product.
    if (wasNarrowed) form.variantIds = variantIdsWithout(id)
  }

  // Keeps any variants already saved with the product: they become the picks.
  function setSpecific(productId) {
    const id = productKey(productId)
    form.productIds = form.productIds.map(productKey).filter((selected) => selected !== id)
    if (!specificIds.value.has(id)) form.specificProductIds = [...form.specificProductIds.map(productKey), id]
    ensureVariants(id)
  }

  function deselect(productId) {
    const id = productKey(productId)
    form.productIds = form.productIds.map(productKey).filter((selected) => selected !== id)
    form.specificProductIds = form.specificProductIds.map(productKey).filter((selected) => selected !== id)
    form.variantIds = variantIdsWithout(id)
  }

  function toggleProduct(productId) {
    if (modeOf(productId) === 'none') setWhole(productId)
    else deselect(productId)
  }

  // Adds products as whole products; ones already selected keep their mode.
  function selectProducts(productIds) {
    const added = [...new Set(productIds.map(productKey))].filter((id) => modeOf(id) === 'none')
    if (added.length) form.productIds = [...new Set([...form.productIds.map(productKey), ...added])]
    return added.length
  }

  function deselectProducts(productIds) {
    for (const id of productIds) deselect(id)
  }

  function clearProducts() {
    form.productIds = []
    form.specificProductIds = []
    form.variantIds = []
  }

  function isVariantIncluded(variant) {
    return modeOf(variant.product_id) === 'whole' || selectedVariantIds.value.has(variantKey(variant.id))
  }

  // Ticking a variant of a product that is not selected narrows that product to
  // it. A whole product's variants are all included and cannot be ticked.
  function toggleVariant(variant) {
    const productId = productKey(variant.product_id)
    const mode = modeOf(productId)
    if (mode === 'whole') return
    rememberVariants([variant])

    const id = variantKey(variant.id)
    if (selectedVariantIds.value.has(id)) {
      form.variantIds = form.variantIds.map(variantKey).filter((selected) => selected !== id)
      return
    }
    if (!isTargetableVariant(variant)) return
    if (mode === 'none') form.specificProductIds = [...form.specificProductIds.map(productKey), productId]
    form.variantIds = [...form.variantIds.map(variantKey), id]
  }

  // Ticks or unticks variants of narrowed products; whole products are left be.
  function setVariants(variants, selected) {
    rememberVariants(variants)
    const ids = new Set(form.variantIds.map(variantKey))
    for (const variant of variants) {
      if (modeOf(variant.product_id) !== 'variants') continue
      if (selected && isTargetableVariant(variant)) ids.add(variantKey(variant.id))
      if (!selected) ids.delete(variantKey(variant.id))
    }
    form.variantIds = [...ids]
  }

  function clearVariantPicks() {
    const narrowed = specificIds.value
    form.variantIds = form.variantIds.map(variantKey).filter((id) => !narrowed.has(owners.get(id)))
  }

  function groupState(productId) {
    const id = productKey(productId)
    const mode = modeOf(id)
    const list = variantLists.get(id)
    const total = list?.status === 'loaded'
      ? list.items.filter(isTargetableVariant).length
      : products.get(id)?.variants_count ?? null
    const selected = mode === 'whole' ? total : variantIdsOf(id).length
    return {
      mode,
      total,
      selected,
      checked: mode === 'whole' || (mode === 'variants' && total > 0 && selected >= total),
      indeterminate: mode === 'variants' && selected > 0 && (total === null || selected < total),
    }
  }

  const summary = computed(() => {
    const narrowed = form.specificProductIds.map(productKey)
    return {
      products: selectedProductIds.value.length,
      wholeProducts: form.productIds.length,
      specificProducts: narrowed.length,
      specificVariants: narrowed.reduce((count, id) => count + variantIdsOf(id).length, 0),
      emptySpecific: narrowed.filter((id) => variantIdsOf(id).length === 0),
    }
  })

  // Mirrors the API (a product or a variant), plus the form's own rule that a
  // product narrowed to specific variants has at least one.
  function validate() {
    const empty = summary.value.emptySpecific
    if (empty.length) {
      const others = empty.length > 1 ? ` and ${empty.length - 1} more` : ''
      return {
        variant_ids: [`Choose at least one variant for ${productOf(empty[0]).name}${others}, or target the whole product.`],
      }
    }
    if (!form.productIds.length && !form.variantIds.length) {
      return { product_ids: ['Select at least one product or variant.'] }
    }
    return null
  }

  // Edit: names the saved products and variants, and loads the variants of
  // narrowed products, whose groups open with their picks.
  function hydrate(promotion) {
    rememberProducts(promotion?.products ?? [])
    rememberVariants(promotion?.variants ?? [])
    return ensureVariantsFor(form.specificProductIds)
  }

  return {
    products,
    variantLists,
    variantDetails,
    selectedProductIds,
    summary,
    rememberProducts,
    rememberVariants,
    productOf,
    modeOf,
    variantIdsOf,
    ensureVariants,
    ensureVariantsFor,
    setWhole,
    setSpecific,
    deselect,
    toggleProduct,
    selectProducts,
    deselectProducts,
    clearProducts,
    isVariantIncluded,
    toggleVariant,
    setVariants,
    clearVariantPicks,
    groupState,
    validate,
    hydrate,
  }
}
