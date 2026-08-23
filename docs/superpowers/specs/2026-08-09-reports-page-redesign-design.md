# Reports page redesign — six-report tabbed view

**Date:** 2026-08-09
**Status:** Approved, ready for implementation

## Requirement

The Reports page must present exactly these six reports:

1. Filter sold products (daily, weekly, monthly, yearly)
2. Customer orders (daily, weekly, monthly, yearly)
3. Track visitor/customer (IP)
4. Customer purchase history
5. Tracking user action
6. Tracking user posted product

## Starting state

A previous session built most of the foundation and committed it in `b0d2610`, but
never connected it to the page:

- `src/data/reports.js` — mock datasets for all six reports, with daily/weekly/
  monthly/yearly buckets and derived filter option lists
- `src/components/reports/` — `ReportPanel`, `ReportTable`, `GranularityTabs`,
  `TrendChart`, plus two finished tabs: `SoldProductsReport`, `CustomerOrdersReport`
- `src/services/reportExport.js` — styled .xlsx writer driven by a column config

`src/views/ReportsView.vue` is still the older "Order & Sales Volume" dashboard
with its own hardcoded data. It imports none of the above, so both finished tab
components are unreferenced dead code today.

Two other facts that shape the design:

- The app adopted shadcn-vue `Select` in `bc5e8ec`, with shared presets in
  `src/lib/selectPresets.js`. The two existing tabs still use raw `<select>`.
- Orders gained a three-format export menu (xlsx / CSV / JSON) in the same commit,
  via `src/services/tableExport.js`. Reports is xlsx-only.

## Decisions

| Question | Decision |
| --- | --- |
| Existing KPI/trend dashboard | **Replaced entirely.** The page becomes the six reports and nothing else. |
| Data source | **Mock only** (`src/data/reports.js`). No backend request document. |
| Report navigation | **Horizontal tab bar** below the page header. |
| Nested data (visitor hits, customer orders) | **Expandable rows**, multiple open at once. |
| Export | **Three-format menu (xlsx / CSV / JSON) on all six tabs.** |

Deliberately out of scope: active tab in the URL (`?report=…`), pagination on the
report tables (largest mock set is 14 rows), and consolidating the
`UserActionsReport` / `LogsView` overlap described under Known issues.

## Architecture

`ReportsView.vue` becomes a thin shell; each report is its own component. This
continues the pattern the two existing tabs established and keeps every file small
enough to reason about.

Rejected alternatives:

- **Everything inline in `ReportsView.vue`** — would exceed 2,000 lines with six
  independent filter states in one scope, and would mean deleting working components.
- **A config-driven generic report renderer** — the six reports differ materially
  (summary strip and inline bar cells; trend chart; expandable rows). The config
  would need an escape hatch for each and end up harder to follow than six explicit
  components.

```
ReportsView.vue
  AppHeader title="Reports"
  page__body
    ReportTabs  v-model="activeReport"
    <keep-alive>
      <component :is="activeComponent" />
```

`keep-alive` is required, not cosmetic: each tab owns its filter state (period,
category, staff, search). Without it, switching to Visitors and back resets Sold
Products to Monthly / All Categories.

The six report components are statically imported. The mock data is already in the
bundle, so lazy-loading would add chunks without removing weight.

Tab keys, labels and components, in display order. `sold-products` is the default.

| Key | Label | Component |
| --- | --- | --- |
| `sold-products` | Sold Products | `SoldProductsReport` |
| `customer-orders` | Customer Orders | `CustomerOrdersReport` |
| `visitors` | Visitors | `VisitorsReport` |
| `purchase-history` | Purchase History | `PurchaseHistoryReport` |
| `user-actions` | User Actions | `UserActionsReport` |
| `posted-products` | Posted Products | `PostedProductsReport` |

## Components

### New shared

**`ReportTabs.vue`** — props `modelValue` (string) and `tabs`
(`[{ key, label }]`, same shape as the `granularities` list `GranularityTabs`
consumes); emits `update:modelValue`.
Mirrors `GranularityTabs`'s `role="group"` / `aria-pressed` markup but at page
scale: larger hit targets and a bottom-border active state rather than the inset
pill, so the two levels of navigation do not read as one control at two sizes.
`overflow-x: auto` so six labels never wrap.

**`ReportExportMenu.vue`** — props:

| Prop | Type | Notes |
| --- | --- | --- |
| `sheet` | String | Worksheet name, e.g. `'Sold Products'` |
| `tab` | String | Filename slug, e.g. `'sold-products'` |
| `suffix` | String (optional) | Active granularity or filter. Omitted by the four tabs that have no period control; `reportFileName` already handles a missing suffix. |
| `rows` | Array | The filtered rows currently on screen |
| `columns` | Array | Column config, below |

It owns the menu open state, the `exporting` flag, document-click and Esc close (the
same `onMounted` / `onBeforeUnmount` listener pair `OrdersView` uses), the
empty-rows guard and the failure alert. Exists so the three-format menu is written
once instead of six times.

A column entry is the existing `reportExport` shape — `label`, `width`, and optional
`align`, `format`, `total`, `value` — plus a new `key`. Carrying **both** `key` and
`value` is what lets one config drive all three writers: `reportExport` calls
`column.value(row)` while `toCsv` reads `row[column.key]`.

```js
// xlsx — column config passes straight through, keeping width/format/total
exportReport({ sheet, columns, rows, filename: reportFileName(tab, suffix) })

// csv + json — flatten to plain objects keyed the way toCsv expects
const plain = rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.value(r)])))
downloadCsv(plain, columns, `${base}.csv`)
downloadJson(plain, `${base}.json`)
```

Neither `reportExport.js` nor `tableExport.js` changes — both are shared with the
Orders page. Filenames keep the existing `reports-<tab>-<suffix>.{xlsx,csv,json}`
convention, so the extension is the only difference between formats.

### Expandable rows

The tab renders two `<tr>`s per item into `ReportTable`'s existing `tbody` slot:

- a summary row whose first cell holds a chevron disclosure `<button>` with
  `aria-expanded` and `aria-controls`
- a detail row — `<tr class="detailrow"><td :colspan="columns.length">` — holding a
  nested sub-table

Expansion state is a `Set` of ids, so several rows can be open at once for
comparison.

`ReportTable` needs two CSS fixes, both consequences of rules written when every row
was flat:

- `:deep(tbody tr:hover)` highlights the detail row too — scope it to
  `:not(.detailrow)`
- `:deep(td) { white-space: nowrap }` would stop the nested table's cells wrapping —
  exempt the detail cell

### The six reports

**`SoldProductsReport.vue`** (exists) — two changes only, logic untouched: raw
`<select>` → shadcn `Select` with `TOOLBAR_SELECT`; Export button →
`ReportExportMenu`.

**`CustomerOrdersReport.vue`** (exists) — same two changes. Keeps its two-panel
shape: trend chart above, new-vs-returning breakdown below.

**`VisitorsReport.vue`** (new) — source `visitorLogs`.
Columns: IP · Visits · First Seen · Last Seen · Last Page. Expands to the hit list
(Time · Action · Target URL · Session). Toolbar: IP/URL search, export. Summary
strip: unique IPs, total visits, total hits, busiest IP. Sorted by visits
descending. Action values render as chips with distinct tones per action
(`page_view`, `search`, `product_view`, `add_to_cart`, `checkout`) so a session
reads as a funnel.

**`PurchaseHistoryReport.vue`** (new) — source `purchaseHistory`.
Columns: Customer (name + email) · Orders · Lifetime Total · Last Order. Expands to
that customer's orders (Order # · Date · Items · Status · Total), newest first.
Toolbar: name/email search, export. Summary strip: customers, orders, combined
lifetime total, average order value. Order status reuses the Orders page badge
vocabulary. A customer with no orders renders as a plain, non-expandable row.

**`UserActionsReport.vue`** (new) — source `userActions`.
Columns: Time · Staff (name + role) · Event · Description · IP. Toolbar: staff
`Select`, event-type `Select`, search, export — options come from the already-derived
`actionStaff` and `actionEventTypes`. Event type as a chip; IP in a monospace cell so
it aligns down the column the way the Visitors tab does.

**`PostedProductsReport.vue`** (new) — source `postedProducts`.
Columns: Product (name + SKU) · Category · Posted By (name + role) · Posted ·
Status · Units Sold. Toolbar: poster `Select`, status `Select`, export — options from
`posterStaff` and `postedStatuses`. Summary strip: products posted, active/draft/
archived counts, top poster. Status badge reuses the Products page styling.

## Data layer

`src/data/reports.js` already exports everything the six tabs need. Three cleanups:

1. The header comment cites `docs/superpowers/specs/2026-08-04-reports-page-design.md`,
   which was never committed. Repoint it at this spec.
2. **Delete `monthlyOrders`.** Its stated purpose is keeping the overview chart and
   the Customer Orders monthly bucket in sync, but `CustomerOrdersReport` reads
   `customerOrders` and nothing imports `monthlyOrders`. Removing the overview makes
   it definitively dead. Also drop the `customerOrders.monthly` comment that
   references it.
3. Keep the API-gap notes. With no backend document being written, they are the only
   record of those gaps.

No new datasets. The four new tabs' summary strips are derived **in their
components**, not in the data file, because they must follow the active filters the
way `SoldProductsReport`'s summary already does. `soldProductsSummary` stays in the
data file because `SOLD_ORDER_COUNTS` is not derivable from the rows.

One extraction: the `Intl.NumberFormat` currency formatter currently local to
`SoldProductsReport` is also needed by `PurchaseHistoryReport`, so it moves to a new
`src/lib/format.js` exporting a single `currency` instance, instead of being
instantiated twice.

## Edge cases

- Filter combination yielding zero rows → `ReportTable`'s existing empty state
- Export with zero rows → guarded in `ReportExportMenu` before a writer is chosen,
  so CSV and JSON behave like xlsx does today rather than emitting a header-only file
- Customer with no orders → plain row, no chevron (`purchaseHistory` already falls
  back to `[]`)
- `TrendChart` already guards a single-point and all-zero series; `unitsPeak` already
  guards divide-by-zero
- No search debouncing — the largest mock set is 14 rows

## Verification

Unit tests (vitest + `@vue/test-utils`, both already installed; note the repo has no
component tests yet, only `src/stores/*.spec.js`):

- export flattening — the `Object.fromEntries` mapping produces the keys `toCsv`
  expects, and a `null` value stays blank rather than becoming `"null"`
- derived summaries and the filter/sort chain per tab
- the expand/collapse `Set` toggle
- `ReportExportMenu` closes on document click and on Esc

Manual checks that do not reduce to assertions:

- all six tabs in light and dark theme
- tab bar scrolling at mobile width
- `keep-alive` preserving filter state across tab switches
- one real .xlsx, .csv and .json download opened from each tab

Commands before claiming completion: `npm run test:run`, `npm run lint`,
`npm run build`.

## Known issues

**`UserActionsReport` overlaps `src/views/LogsView.vue`.** LogsView already lists
activity logs with staff and action filters plus a CSV export, reading from
`src/data/activityLogs.js` while this tab reads `userActions` from `reports.js`. The
two will show different rows for what a user would reasonably expect to be the same
data. The tab is built as specified because it is an explicit requirement;
consolidating the two sources is a follow-up.

**No live data.** Per the decision above, all six tabs render mock data. The
comments in `reports.js` record what the backend would need: report endpoints for
five of the six reports, a `products.created_by` column to back `postedBy`, and
`visitor_logs` / `team_activity_logs` actually being written to. None of that is
requested of the backend team as part of this work.
