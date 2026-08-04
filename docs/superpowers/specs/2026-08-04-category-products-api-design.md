# Categories — Real Product Data & Add-to-Category Picker (Design)

**Repo:** `BackieDealFrontEnd`
**Target:** `src/views/CategoriesView.vue`, `src/views/CategoryDetailView.vue`
**Date:** 2026-08-04
**Status:** approved design, ready for an implementation plan

---

## 1. Goal

The category detail page must show the real products in a category, and its
"Add Product to Category" picker must list real products from the API —
excluding any product already in that category.

Both pages are 100% mock today:

- `CategoriesView.vue` — a hardcoded array of 9 categories.
- `CategoryDetailView.vue` — a hardcoded array of 5 products, with the picker
  reading from the local `@/data/products` fixture.

The grid is in scope because the detail page cannot fetch anything without a
real category id, and the mock grid's slug keys (`graphics-cards`, …) have no
guaranteed relationship to real category rows.

---

## 2. Backend contract (audited, not assumed)

### A product belongs to exactly one category

`products.category_id` is a single nullable FK
(`database/migrations/2026_05_12_144625_create_products_table.php:23`,
`nullable()->constrained()->nullOnDelete()`). There is **no** product↔category
pivot table.

Three consequences drive the whole design:

1. **"Add product to category" is a move, not a link.** It is
   `PUT /admin/products/{uuid}` with `{ category_id }`. The product leaves
   whatever category it was in.
2. **The exclusion rule is free.** A product is in this category if and only if
   `product.category.id === currentCategoryId`. No SKU bookkeeping, no need to
   load the category's full product list before opening the picker.
3. **A product can have no category at all** (`category_id` is nullable), so the
   picker must render an "Uncategorized" state.

### Endpoints in play

| Endpoint | Notes |
|---|---|
| `GET /admin/categories` | `CategoryController@index`. Hard-codes `paginate(20)` and **ignores `per_page`** — must walk pages. Supports `search` and `root_only`. |
| `GET /admin/categories/{id}` | `@show`. Loads `children` + `products`, but `CategoryResource` serializes neither. |
| `DELETE /admin/categories/{id}` | Returns **409** `Cannot delete category with associated products.` |
| `GET /admin/products?category_id=` | `ProductController@index:58`. Also supports `q`, `sort`, `direction`, `per_page` (capped at 200 by `IndexProductsRequest`). |
| `PUT /admin/products/{uuid}` | `UpdateProductRequest` marks every field `sometimes`, and `@update:158` only touches variants when `variants` is present. A `category_id`-only payload is safe. |

### What CategoryResource does NOT return

```php
['id', 'name', 'slug', 'parent', 'is_active', 'created_at', 'updated_at']
```

No product count, no `image`, no `icon` — even though the `Category` model is
fillable for `image`, `icon`, `description`, `is_featured` and `sort_order`.
Handled in §3; recorded as a gap in §7.

---

## 3. Categories grid — `CategoriesView.vue`

### Loading

Walk `GET /admin/categories?page=N` until `meta.last_page`, guarded at 10 pages
(= 200 categories), mirroring the existing loop in
`ProductsView.vue:163-187`. The endpoint wraps a paginator, so the rows may
arrive as `data` or `data.data` — handle both, as that loop already does.

### Mapping

Each row maps to `{ id, name, slug, updatedAt }`, plus two derived display fields:

**Icon** — keyword match against the slug, falling back to `CategoryIcon`'s
generic glyph (it already has a `v-else` branch, so an unmatched name renders
cleanly):

| Slug contains | Icon |
|---|---|
| `graphic`, `gpu`, `vga` | `gpu` |
| `processor`, `cpu` | `cpu` |
| `motherboard`, `mainboard`, `mobo` | `mobo` |
| `memory`, `ram` | `ram` |
| `storage`, `ssd`, `hdd`, `disk` | `storage` |
| `power`, `psu`, `supply` | `psu` |
| `case`, `chassis` | `case` |
| `cool`, `fan`, `thermal` | `cooling` |
| anything else | fallback |

**Tone** — `TONES[id % TONES.length]` over the existing 9 gradients
(`slate, blue, green, violet, cyan, amber, neutral, teal, warm`). Keyed on `id`
so a category keeps the same cover across reloads and across pages.

### Card body

The `{{ cat.products }} Products` line is **removed** — the API has no count and
a fabricated number is worse than no number. The card keeps a single line,
`Updated {relative}`, computed from real `updated_at` (`2h ago`, `3 days ago`,
`Jun 14` beyond ~30 days).

### Behaviour

- **Search** stays client-side over the loaded set — every category is already
  in memory, so a round trip buys nothing.
- **Open / edit** navigate with `params: { id: category.id }` (numeric) and
  `query: { name }`. `?edit=1` remains unhandled by the detail page, exactly as
  today; this design does not add edit support.
- **Delete** calls `DELETE /admin/categories/{id}` after the existing
  `window.confirm`. On success the card is removed from the list. On **409** the
  server's message is surfaced in the page-level error slot and the card stays.
- **States**: loading (skeleton or centered message), error with a Retry action,
  and empty ("No categories yet") distinct from "no search matches".

---

## 4. Category detail — `CategoryDetailView.vue`

`route.params.id` is now a numeric category id.

### On mount, two requests

1. `GET /admin/categories/{id}` → real `name` for the heading and the modal
   title. `route.query.name` is used as the placeholder while in flight, so the
   heading never flashes a slug. A 404 renders a "Category not found" state with
   a link back to the grid, and the Add button is hidden.
2. `GET /admin/products?category_id={id}&per_page=200&sort=name&direction=asc`
   → the products table.

### Row mapping

Same shape as `ProductsView.vue:74-86`, kept local to this file (no shared
util — `ProductsView` keeps its own copy and is not touched by this work):

```js
{ id, uuid, name, sku, price: currency.format(price), stock: stock_quantity,
  status: deriveStatus(item), thumbnail: usableImage(item.thumbnail) }
```

`deriveStatus` reproduces the backend's own rule: `stock <= 0` → out-of-stock,
`stock <= min_stock_alert` → low-stock, else in-stock. The table's existing
two-state badge (`in-stock` / `out-of-stock`) gains a third **Low Stock** state
so it matches the products page.

The `Product` column renders the real `thumbnail` when `usableImage()` accepts
it (absolute/rooted URLs only — Cloudinary `secure_url`), and falls back to the
existing initials tile on a missing or broken image.

### Truncation

A single 200-row fetch, no pager. If `pagination.total > 200`, a note under the
table reads `Showing the first 200 of N products.` — the list is never silently
truncated.

The `@/data/products` import is removed from this file.
`StockAdjustmentFormView.vue` still uses that fixture; it is out of scope.

---

## 5. The picker

### Data

On open, and on every debounced search change (300ms):

```
GET /admin/products?per_page=50&sort=name&direction=asc[&q=<search>]
```

Results are filtered client-side to drop rows where
`item.category?.id === currentCategoryId`. That is the complete
"not already in this category" rule (§2).

Because filtering happens after the fetch, a page of 50 can yield fewer than 50
choices. That is accepted: the alternative (an `exclude_category_id` param)
requires a backend change.

### Row

```
☑ [NV] NVIDIA RTX 4090 FE              $1,599
       NV-RTX4090-FE · Uncategorized
☐ [AS] ASUS ROG Strix RTX 4080         $1,199
       AS-RTX4080-ST · Processors
```

The sub-line shows the product's **current category name**, or `Uncategorized`
when `category` is null. This is the move warning — a product listed under
`Processors` will leave `Processors` when added. No extra confirm dialog.

### Selection

Held in a `Map` keyed by product `uuid`, storing the mapped row, **not** an
array of SKUs as today. The search re-fetches and replaces the visible list, so
an id-only selection would lose the labels needed for the footer count and any
error message. Tick two → search → tick two more → the footer reads
`Add 4 Products`.

### Submitting

`Promise.allSettled` over one `PUT /admin/products/{uuid}` per selected product,
body `{ category_id: currentCategoryId }`.

- **All succeed** → close the modal, reload the category's product table.
- **Some fail** → modal stays open, an inline error names the failed products
  (`Couldn't add: ASUS ROG Strix RTX 4080`), successes are dropped from the
  selection, and the table reloads behind the modal so the partial result is
  visible.
- The confirm button is disabled with a spinner label while in flight.

### Empty / error states

| Condition | Message |
|---|---|
| Loading | `Loading products…` |
| Request failed | error text + Retry |
| `search` set, 0 results | `No matching products found.` |
| no search, 0 results | `All products are already in this category.` |

---

## 6. Out of scope

- **No pager** on the detail table (200-row fetch + truncation note instead).
- **No "remove from category"** action — not requested, and ambiguous under a
  single-category model (unset to null? move where?).
- **`?edit=1`** from the grid's pencil button still does nothing.
- **`CategoryFormView.vue`** (create) stays mock.
- **`ProductsView.vue`** is not modified; its local copies of `mapProduct` /
  `deriveStatus` / `usableImage` stay where they are.
- **`src/data/products.js`** stays in the repo for `StockAdjustmentFormView`.

---

## 7. Backend gaps to record

Appended to `docs/products-api-gaps.md` — not requested of the backend team
directly, per the usual flow:

1. **`CategoryResource` has no `products_count`.** The grid cannot show a product
   count without one request per category. A `withCount('products')` on
   `CategoryController@index` would fix it in one line.
2. **`CategoryResource` drops `image` and `icon`** even though `Category` is
   fillable for both, so category covers can only ever be generated gradients.
3. **`GET /admin/products` has no `exclude_category_id`.** The picker over-fetches
   and filters client-side as a result.
4. **`CategoryController@index` ignores `per_page`** (hard-coded `paginate(20)`),
   forcing every consumer to walk pages.

---

## 8. Verification

Manual, against a running backend:

1. Grid loads real categories; names and relative timestamps match the DB.
2. Deleting a category that has products shows the 409 message and keeps the card.
3. Opening a category shows only that category's products, with real thumbnails,
   prices and stock; the Low Stock badge appears where `stock <= min_stock_alert`.
4. The picker never lists a product already shown in the table behind it.
5. Ticking across two different searches keeps the running count.
6. After adding, the product appears in the table and disappears from the picker
   on reopen; its old category no longer lists it.
7. A product with no category is listed as `Uncategorized` and adds successfully.
8. `npm run lint` and `npm run build` pass.
