/**
 * Pure helpers behind the product form's variant editor.
 *
 * Deliberately free of Vue: the SKU and slug rules live here because the API
 * punishes breaking them with a raw 500 rather than a 422, so they need to be
 * unit-testable on their own. See
 * docs/superpowers/specs/2026-08-06-product-variant-editor-design.md.
 */

// Mirrors the API's `variants.*.sku` regex.
const SKU_PATTERN = /^[A-Za-z0-9._-]+$/
const SKU_MAX = 64
const NAME_MAX = 191

/** "Space Grey!" -> "space-grey" */
export function slugifyPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "Space Grey!" -> "SPACE-GREY" */
export function skuPart(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Drop axes that can't contribute a combination, and clean what's left.
 * An axis needs a name and at least one non-blank value.
 */
function usableAxes(axes) {
  return (axes ?? [])
    .map((axis) => ({
      name: String(axis?.name ?? '').trim(),
      values: (axis?.values ?? []).map((v) => String(v ?? '').trim()).filter(Boolean),
    }))
    .filter((axis) => axis.name && axis.values.length)
}

/**
 * Cartesian product of the axes. Each combination is an ordered list of
 * `{ name, value }`, and the LAST axis varies fastest — so Color × Size reads
 * Red/S, Red/M, Blue/S, Blue/M, which is the order admins expect in the table.
 */
export function cartesian(axes) {
  const usable = usableAxes(axes)
  if (!usable.length) return []

  return usable.reduce(
    (combos, axis) => combos.flatMap((combo) => axis.values.map((value) => [...combo, { name: axis.name, value }])),
    [[]],
  )
}

/** [{name:'Color',value:'Red'},{name:'Size',value:'S'}] -> "Red / S" */
export function makeVariantName(combo) {
  return (combo ?? []).map((part) => part.value).join(' / ')
}

/** Base SKU + axis values, e.g. "NV-RTX4090-RED-S". */
export function makeVariantSku(baseSku, combo) {
  return [skuPart(baseSku), ...(combo ?? []).map((part) => skuPart(part.value))].filter(Boolean).join('-')
}

/**
 * Base SKU + axis values, e.g. "nv-rtx4090-red-s".
 *
 * Seeding the slug with the base SKU is not cosmetic: `product_variants.slug`
 * carries a GLOBAL unique index, and the API derives the slug from the variant
 * name when we omit it. Two products each having a "Red / S" variant would both
 * want slug "red-s" and the second insert would 500. Always send this.
 */
export function makeVariantSlug(baseSku, combo) {
  return [slugifyPart(baseSku), ...(combo ?? []).map((part) => slugifyPart(part.value))].filter(Boolean).join('-')
}

// Unit separator: safe inside a tuple key because axis values are trimmed text.
const TUPLE_SEP = ''

/**
 * A row's identity for carry-over purposes: its ordered axis VALUES.
 *
 * Keyed on values rather than `axis=value` pairs on purpose. Rows are rebuilt on
 * every keystroke, so renaming an axis from "Color" to "Colour" must not look
 * like a different row and discard the prices already entered.
 */
export function valueTuple(values) {
  return (values ?? []).join(TUPLE_SEP)
}

function blankRow() {
  return {
    name: '',
    sku: '',
    price: '',
    salePrice: '',
    costPrice: '',
    stock: 0,
    minStockAlert: 5,
    // Public URL of an uploaded image, or '' for none.
    image: '',
    attributes: {},
    isDefault: false,
    isActive: true,
    // Set once the admin edits the SKU by hand, which stops it tracking the
    // product's base SKU. Never sent to the API.
    skuTouched: false,
  }
}

/**
 * Exactly one row must be the default. Keeps the first row already flagged,
 * and falls back to the first row when nothing is flagged.
 */
export function normalizeDefault(rows) {
  if (!rows.length) return rows
  const firstFlagged = rows.findIndex((row) => row.isDefault)
  const winner = firstFlagged === -1 ? 0 : firstFlagged
  rows.forEach((row, i) => {
    row.isDefault = i === winner
  })
  return rows
}

/**
 * Rebuild the row list from the axes, carrying over anything the admin already
 * typed.
 *
 * Called on every axis edit, so carry-over has to be generous. A prior row is
 * matched by its ordered axis values, and failing that by the longest prefix —
 * so adding a whole new option turns the "Red" row into "Red / S" and keeps its
 * price, rather than starting over.
 */
export function buildVariants(axes, baseSku, existingRows = []) {
  const previous = new Map()
  for (const row of existingRows) {
    previous.set(valueTuple(Object.values(row.attributes ?? {})), row)
  }

  function findPrior(combo) {
    const values = combo.map((part) => part.value)
    // Longest match first: exact tuple, then progressively shorter prefixes.
    for (let length = values.length; length > 0; length -= 1) {
      const prior = previous.get(valueTuple(values.slice(0, length)))
      if (prior) return prior
    }
    return undefined
  }

  const rows = cartesian(axes).map((combo) => {
    const attributes = Object.fromEntries(combo.map((part) => [part.name, part.value]))
    const prior = findPrior(combo)

    return {
      ...blankRow(),
      ...prior,
      // Name, attributes and slug always follow the axes; they are derived.
      name: makeVariantName(combo),
      attributes,
      slug: makeVariantSlug(baseSku, combo),
      // Keep tracking the base SKU until the admin edits this field by hand.
      sku: prior?.skuTouched ? prior.sku : makeVariantSku(baseSku, combo),
    }
  })

  return normalizeDefault(rows)
}

/**
 * Everything that must hold before we're willing to POST. Returns errors keyed
 * by row index so the editor can render them inline.
 */
export function validateVariants(rows) {
  const errors = {}
  const seen = new Map()

  rows.forEach((row, index) => {
    const name = String(row.name ?? '').trim()
    const sku = String(row.sku ?? '').trim()

    if (!name) {
      errors[index] = 'Name is required.'
      return
    }
    if (name.length > NAME_MAX) {
      errors[index] = `Name must be ${NAME_MAX} characters or fewer.`
      return
    }
    if (!sku) {
      errors[index] = 'SKU is required.'
      return
    }
    if (sku.length > SKU_MAX) {
      errors[index] = `SKU must be ${SKU_MAX} characters or fewer.`
      return
    }
    if (!SKU_PATTERN.test(sku)) {
      errors[index] = 'SKU may only contain letters, digits, dot, underscore, and dash.'
      return
    }

    // Case-insensitive: the DB unique index would reject these as duplicates
    // too, but as a 500 rather than a readable error.
    const key = sku.toLowerCase()
    if (seen.has(key)) {
      errors[index] = `Duplicate SKU — already used by variant ${seen.get(key) + 1}.`
      return
    }
    seen.set(key, index)
  })

  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Axis-level conflicts, surfaced above the table rather than per row.
 *
 * Only genuine conflicts belong here. An option with no values yet is merely
 * unfinished — `cartesian` ignores it, and the editor nudges the admin toward
 * the next step instead of colouring normal typing as an error.
 */
export function validateAxes(axes) {
  const problems = []
  const named = (axes ?? []).filter((axis) => String(axis?.name ?? '').trim())

  const names = named.map((axis) => String(axis.name).trim().toLowerCase())
  if (new Set(names).size !== names.length) {
    problems.push('Each option name must be unique.')
  }

  for (const axis of named) {
    const values = (axis.values ?? []).map((v) => String(v ?? '').trim()).filter(Boolean)
    const lowered = values.map((v) => v.toLowerCase())
    if (new Set(lowered).size !== lowered.length) {
      problems.push(`"${String(axis.name).trim()}" has duplicate values.`)
    }
  }

  return problems
}

/** "1,599.00" -> 1599, "" -> null */
function toNumberOrNull(value) {
  const raw = String(value ?? '').replace(/,/g, '').trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function toIntOrNull(value) {
  const n = toNumberOrNull(value)
  return n === null ? null : Math.trunc(n)
}

/**
 * Map editor rows onto the nested `variants[]` contract.
 *
 * `in_stock` is intentionally absent — the controller recomputes it from
 * `stock_quantity`, so sending it would just be a second source of truth.
 */
export function toApiVariants(rows) {
  return rows.map((row, index) => ({
    name: String(row.name ?? '').trim(),
    slug: row.slug || slugifyPart(row.name),
    sku: String(row.sku ?? '').trim(),
    price: toNumberOrNull(row.price),
    sale_price: toNumberOrNull(row.salePrice),
    cost_price: toNumberOrNull(row.costPrice),
    stock_quantity: toIntOrNull(row.stock) ?? 0,
    min_stock_alert: toIntOrNull(row.minStockAlert) ?? 0,
    // Only a stored URL is worth sending; a blob: preview would not resolve for
    // anyone else, and the column caps at 255 characters.
    image: row.image && !row.image.startsWith('blob:') ? row.image.slice(0, 255) : null,
    attributes: row.attributes ?? {},
    is_default: Boolean(row.isDefault),
    is_active: Boolean(row.isActive),
    sort_order: index,
  }))
}

/**
 * Option names in the order the rows carry them.
 *
 * Read off the rows rather than the axis builder so the grouped table works on
 * the edit page too, where variants are loaded from the API and there is no
 * builder to consult.
 */
export function deriveAxisNames(rows = []) {
  const names = []
  for (const row of rows) {
    for (const key of Object.keys(row.attributes ?? {})) {
      if (!names.includes(key)) names.push(key)
    }
  }
  return names
}

/**
 * Nest the flat row list under one option's values, the way Shopify's variant
 * table groups by Color.
 *
 * Rows stay flat in form state — that is the shape the API wants — so a group
 * carries each row's index alongside it, letting the editor patch the original
 * array without rebuilding it.
 */
export function groupVariants(rows = [], axisName = '') {
  if (!axisName) return []

  const groups = new Map()
  rows.forEach((row, index) => {
    const value = row.attributes?.[axisName] ?? ''
    if (!groups.has(value)) groups.set(value, { value, items: [] })
    groups.get(value).items.push({ row, index })
  })

  return [...groups.values()]
}

/**
 * What a nested row is called once its group already shows the shared value:
 * "Red / S" under group "Red" reads simply as "S".
 */
export function childLabel(row, axisName = '') {
  const rest = Object.entries(row.attributes ?? {})
    .filter(([key]) => key !== axisName)
    .map(([, value]) => value)

  return rest.length ? rest.join(' / ') : row.name || ''
}

/** Total stock across a group, shown on its summary row. */
export function sumStock(items = []) {
  return items.reduce((total, { row }) => {
    const n = Number(String(row.stock ?? '').trim())
    return total + (Number.isFinite(n) ? n : 0)
  }, 0)
}

/**
 * The value a group's rows agree on for `field`, or `null` when they differ.
 *
 * Null and '' are deliberately distinct: rows that are all blank DO agree, and
 * must not be labelled "Mixed" — only genuinely differing rows get that.
 */
export function sharedFieldValue(items = [], field) {
  if (!items.length) return ''
  const first = String(items[0].row?.[field] ?? '')
  return items.every(({ row }) => String(row?.[field] ?? '') === first) ? first : null
}

/**
 * Distinct images available to reuse across rows, newest-seeded first.
 *
 * The API has no reachable product media collection, so the "library" a row can
 * pick from is just whatever URLs this form already knows about: the product
 * thumbnail plus anything uploaded for another row. Assigning one photo to every
 * size of a colour is then a matter of reusing the same string.
 */
export function collectImagePool(rows = [], seeds = []) {
  const pool = []
  const seen = new Set()

  for (const url of [...seeds, ...rows.map((row) => row.image)]) {
    if (!url || url.startsWith('blob:') || seen.has(url)) continue
    seen.add(url)
    pool.push(url)
  }

  return pool
}

/**
 * Map a variant off `GET /admin/products/{uuid}` into an editor row.
 *
 * Every field `toApiVariants` sends back must be read here. `min_stock_alert`
 * and `stock_quantity` especially: those are sent as `?? 0` rather than null,
 * so the server's null-stripping filter would NOT protect them — a field missed
 * here is silently zeroed on the next save.
 */
export function fromApiVariant(variant) {
  return {
    name: variant?.name ?? '',
    sku: variant?.sku ?? '',
    slug: variant?.slug ?? '',
    price: variant?.price ?? '',
    salePrice: variant?.sale_price ?? '',
    costPrice: variant?.cost_price ?? '',
    stock: variant?.stock_quantity ?? 0,
    minStockAlert: variant?.min_stock_alert ?? 0,
    image: variant?.image ?? '',
    // An existing variant's SKU is authoritative — never re-derive it.
    skuTouched: true,
    attributes: variant?.attributes && !Array.isArray(variant.attributes) ? variant.attributes : {},
    isDefault: Boolean(variant?.is_default),
    isActive: Boolean(variant?.is_active),
  }
}
