# Product Variant Editor — Design

**Date:** 2026-08-06
**Status:** Approved
**Scope:** Add a variant editor to the admin product form (create path), and a read-only variant list on the edit path.

## Problem

The admin product form has no way to create product variants, even though
`POST /admin/products` has accepted a nested `variants[]` array since the V1 admin
controller landed. Products that need SKU-level axes (color, size, capacity) cannot be
entered through the UI at all.

## Backend contract (verified 2026-08-06, not assumed)

`StoreProductRequest` accepts `variants` as a nullable array. Per row:

| Field | Rule |
| --- | --- |
| `name` | required_with:variants, string, max 191 |
| `slug` | nullable, string, max 191 |
| `sku` | required_with:variants, string, max 64, `^[A-Za-z0-9._-]+$` |
| `barcode` | nullable, max 64 |
| `price`, `sale_price`, `cost_price` | nullable, numeric, 0 … 99999999.99 |
| `stock_quantity`, `min_stock_alert` | nullable, integer, 0 … 1000000000 |
| `track_inventory`, `in_stock` | nullable, boolean |
| `weight`, `length`, `width`, `height` | nullable, numeric |
| `image` | nullable, max 255 |
| `attributes` | nullable, array (normalised server-side to a string map) |
| `is_default`, `is_active` | nullable, boolean |
| `sort_order` | nullable, integer |

`ProductController::createVariant()` derives the slug from `name` when `slug` is absent,
and recomputes `in_stock` from `stock_quantity`.

## Known backend defects this design works around

All three were confirmed still present in `bekie-service` on 2026-08-06. They are
tracked for the backend team; the frontend must not trip them.

1. **Variant slug is globally unique.** The migration declares `$table->string('slug')->unique()`
   with no product scope. Because the controller derives the slug from the variant name, a
   second product with a variant named `Red / S` produces slug `red-s`, which is already
   taken, and the insert raises a raw 500. **This affects the create path.**
   *Workaround:* always send an explicit slug seeded with the base SKU
   (`nv-rtx4090-red-s`). No backend change needed — the request already accepts `slug`.

2. **Duplicate SKUs in one request reach the database.** There is no `distinct` rule on
   `variants.*.sku`, so two identical SKUs in one payload hit the unique index and 500.
   *Workaround:* block save client-side on duplicate SKUs.

3. **Update re-save collides with the soft-delete-ignoring unique index.** `product_variants`
   has `softDeletes()`, and the default update path runs `$product->variants()->delete()`
   (a soft delete, so the row keeps its unique `sku`/`slug`) then recreates the same SKUs.
   Every variant re-save on `PUT` therefore 500s.
   *Workaround:* the edit path never sends `variants[]`. See "Edit mode" below.

## Architecture

`ProductFormView.vue` is already 775 lines, so the variant UI is not added inline. Three
new units, each independently understandable:

### `src/services/variants.js` — pure functions, no Vue

Every rule the API punishes with a 500 rather than a 422 lives here, so it can be unit
tested directly.

- `cartesian(axes)` — combination list; the last axis varies fastest.
- `makeVariantName(combo)` — `"Red / S"`.
- `makeVariantSku(baseSku, combo)` — `"NV-RTX4090-RED-S"`.
- `makeVariantSlug(baseSku, combo)` — `"nv-rtx4090-red-s"` (defect 1).
- `buildVariants(axes, baseSku, existingRows)` — regenerate, preserving already-typed
  values by attribute signature.
- `validateVariants(rows)` — `{ valid, errors }` keyed by row index.
- `toApiVariants(rows)` — snake_case payload mapping.

### `src/components/products/VariantAxisBuilder.vue`

Axis names plus value chips, and a "Generate N variants" action. Owns no variant rows —
it emits axes upward only.

### `src/components/products/VariantEditor.vue`

Hosts the axis builder and the generated rows. `v-model` on the variants array.

- Props: `modelValue` (rows), `baseSku` (string), `readonly` (bool)
- Emits: `update:modelValue`, `valid`

`ProductFormView` mounts `VariantEditor` and reads its validity. It does not reach into
row internals.

## Data flow

```
form.variantAxes ──cartesian()──▶ combos ──buildVariants()──▶ form.variants
                                                                    │
                                                    toApiVariants() │
                                                                    ▼
                                                     body.variants (POST only)
```

Regeneration after adding an axis value matches each existing row by its attribute
signature (sorted `key=value` pairs), so entered prices and stock survive. `in_stock` is
never sent — the server computes it.

## Price inheritance

`variants.*.price` is nullable and a blank variant price inherits the product's base
price. The row's price placeholder shows the base price greyed out so a blank field reads
as "inherits" rather than "unfilled".

## Validation (blocks save)

- Every row needs a non-empty name and SKU.
- SKU matches `^[A-Za-z0-9._-]+$` and is ≤ 64 chars.
- SKUs are distinct within the form, compared case-insensitively (defect 2).
- Axis names are non-empty and distinct; each axis has at least one value; values are
  distinct within an axis.
- Exactly one row carries `is_default`; the first row is selected automatically.

Failures render inline on the offending row and disable the Create button. Cross-product
SKU collisions cannot be detected locally and will still surface as a server error.

## Edit mode

`readonly` renders the product's existing variants as a plain list, sourced from the
`variants` array on `GET /admin/products/{uuid}`, with a short note that editing requires
the backend fix. `PUT` never includes `variants[]`, so defect 3 stays unreachable.

## Testing

`src/services/variants.spec.js`, following the existing `src/stores/ui.spec.js` precedent:

- `cartesian` shape and ordering, including the zero-axis and single-axis cases.
- SKU and slug generation, including punctuation and spacing in axis values.
- Duplicate SKU detection, case-insensitive.
- Regeneration preserves entered price/stock and honours a manually overridden SKU.
- `toApiVariants` maps blanks to `null` and omits `in_stock`.

## Styling

Reuses the existing `.card` / `.field` / `.row` patterns in `ProductFormView` and the
`_tokens.scss` custom properties, so the section themes correctly in dark mode without
new colour values.

## Out of scope

- Variant-level barcode, weight, and dimensions (API accepts them; no UI demand yet).
- Variant images.
- Wiring `form.specs` ("Add Attribute"), which remains blocked on the `products.specs`
  column. Product specs stay deliberately separate from `product_variants.attributes`.
