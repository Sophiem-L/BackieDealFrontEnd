# Orders Export Formats — Design

**Date:** 2026-08-09
**Status:** Approved
**Scope:** Replace the Orders page "Export Excel" button with an "Export" dropdown offering Excel, CSV and JSON. Orders page only.

## Problem

The Orders toolbar exports one format. `exportOrders()` in `src/views/OrdersView.vue`
fetches every order matching the active filters and writes a styled `.xlsx` workbook.
Admins who want to load the same rows into another tool have to open the workbook and
re-save it, losing the filter context in the process.

## Approach

The expensive part — refetching every filtered order — is already isolated in
`fetchAllMatchingOrders()`. Only the writing step varies by format, so the change is a
format argument on the export entry point plus two new serializers. The existing xlsx
path is not modified.

## UI

The single `BaseButton` in the toolbar becomes a menu, following the dropdown pattern
already used by the stock filter in `src/views/StockManagementView.vue`:

```
[ ⭳ Export ⌄ ]        ┌──────────────────┐
                      │  Excel (.xlsx)   │
                      │  CSV (.csv)      │
                      │  JSON (.json)    │
                      └──────────────────┘
```

- Trigger: `BaseButton variant="ghost"`, label `Export`, existing download icon plus a
  caret. Carries `aria-haspopup="menu"` and `aria-expanded`.
- Popup: `.export__popup` with three `role="menuitem"` buttons.
- Dismissal: click-away via a document listener registered in `onMounted` and removed in
  `onBeforeUnmount` (the wrapper stops propagation), and Escape. Arrow-key navigation is
  out of scope — click and Escape only.
- Disabled condition is unchanged: `total === 0 || loading || exporting`.
- While a download is in flight the trigger label reads `Exporting…`. Choosing a format
  closes the menu immediately.

## Data shape

All three formats export the same eight columns already declared in `EXPORT_COLUMNS`:
Order ID, Placed At, Customer, Item, Specification, Payment, Amount, Status.

CSV and JSON carry machine-friendly values rather than the display strings the table
shows, because a formatted amount and a localised date do not survive being parsed by
another tool:

| Column | Excel | CSV / JSON |
| --- | --- | --- |
| Placed At | Date cell, `mmm d, yyyy h:mm AM/PM` | ISO 8601 local, e.g. `2026-08-04T10:30:00` |
| Amount | Number cell, `$#,##0.00` | bare number, e.g. `4299` |
| Status | coloured label, e.g. `Completed` | label text, e.g. `Completed` |
| Totals row | present, bold | **absent** |

A missing amount stays empty in every format — never `0`, which would read as a real
zero. A single `toPlainRow(order)` maps an order to that shape, reusing the existing
`amountValue()` and `statusLabel()` helpers; CSV and JSON both consume it, so the two
formats cannot drift apart.

JSON is an array of objects keyed by the `EXPORT_COLUMNS` keys. Raw API records are
deliberately not exported — they would leak internal field names.

## New module: `src/services/tableExport.js`

Kept separate from `reportExport.js`, which is xlsx-specific.

- `downloadCsv(rows, columns, filename)` — RFC 4180 quoting: a field containing a comma,
  a double quote or a newline is wrapped in quotes with inner quotes doubled. Prepends a
  UTF-8 BOM so Excel opens Khmer and accented customer names correctly instead of mojibake.
- `downloadJson(value, filename)` — `JSON.stringify(value, null, 2)`.
- Both build a `Blob`, trigger the download through a temporary anchor, and revoke the
  object URL afterwards.

The module is reusable by the Reports page, but Reports is not changed here.

## Filenames and errors

`exportFileName(ext)` returns `orders-<tab>-<period>-<from>.<ext>`, e.g.
`orders-pending-daily-2026-08-04.csv`. The range stays in the name so two exports of the
same period taken on different days do not overwrite each other.

The existing failure handling covers all three formats: a caught error logs and alerts
`Sorry, the export could not be generated. Please try again.`, and hitting
`EXPORT_MAX_PAGES` still raises the row-cap warning.

## Testing

`src/services/tableExport.spec.js` (vitest) covers the CSV serializer:

- header row matches the column order
- a value containing a comma, a double quote, and a newline is quoted and escaped
- `null` and `undefined` emit an empty field, not the string `null`
- the output starts with a UTF-8 BOM

The dropdown interaction is verified by running the app.

## Out of scope

- The Reports page export.
- Arrow-key menu navigation.
- Per-column selection or any export configuration UI.
