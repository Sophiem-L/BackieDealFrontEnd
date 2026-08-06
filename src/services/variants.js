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

/** Order-independent identity for a row's attributes, used to match on regenerate. */
export function attributeSignature(attributes) {
  return Object.keys(attributes ?? {})
    .sort()
    .map((key) => `${key}=${attributes[key]}`)
    .join('|')
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
    attributes: {},
    isDefault: false,
    isActive: true,
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
 * typed. Rows are matched by attribute signature, so adding a new size doesn't
 * wipe the prices entered for the existing ones — including a SKU that was
 * hand-overridden away from the generated default.
 */
export function buildVariants(axes, baseSku, existingRows = []) {
  const previous = new Map()
  for (const row of existingRows) {
    previous.set(attributeSignature(row.attributes), row)
  }

  const rows = cartesian(axes).map((combo) => {
    const attributes = Object.fromEntries(combo.map((part) => [part.name, part.value]))
    const prior = previous.get(attributeSignature(attributes))

    return {
      ...blankRow(),
      ...prior,
      // Name and attributes always follow the axes; they are derived, not typed.
      name: makeVariantName(combo),
      attributes,
      // An empty SKU means "never touched", so regenerate it.
      sku: prior?.sku ? prior.sku : makeVariantSku(baseSku, combo),
      slug: makeVariantSlug(baseSku, combo),
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

/** Axis-level problems, surfaced above the table rather than per row. */
export function validateAxes(axes) {
  const problems = []
  const named = (axes ?? []).filter((axis) => String(axis?.name ?? '').trim())

  const names = named.map((axis) => String(axis.name).trim().toLowerCase())
  if (new Set(names).size !== names.length) {
    problems.push('Each option name must be unique.')
  }

  for (const axis of named) {
    const values = (axis.values ?? []).map((v) => String(v ?? '').trim()).filter(Boolean)
    if (!values.length) {
      problems.push(`"${String(axis.name).trim()}" needs at least one value.`)
      continue
    }
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
    attributes: row.attributes ?? {},
    is_default: Boolean(row.isDefault),
    is_active: Boolean(row.isActive),
    sort_order: index,
  }))
}

/** Map a variant off `GET /admin/products/{uuid}` into a read-only display row. */
export function fromApiVariant(variant) {
  return {
    name: variant?.name ?? '',
    sku: variant?.sku ?? '',
    price: variant?.price ?? null,
    stock: variant?.stock_quantity ?? 0,
    attributes: variant?.attributes && !Array.isArray(variant.attributes) ? variant.attributes : {},
    isDefault: Boolean(variant?.is_default),
    isActive: Boolean(variant?.is_active),
  }
}
