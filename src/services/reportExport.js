// Shared .xlsx export for the Reports page.
//
// Generalises the styled export proven in OrdersView.vue: the column config gains
// a `value` accessor, which is what lets one helper serve six differently-shaped
// tables instead of six copy-pasted sheet builders.

// Palette lifted from OrdersView so every workbook the admin produces matches.
const XL_HEADER_FILL = '#F4C10F'
const XL_HEADER_TEXT = '#1F242D'
const XL_ZEBRA_FILL = '#FAFBFC'
const XL_TOTAL_FILL = '#F4F5F7'
const XL_GRID = '#E6E8EC'
const XL_RULE = '#C9CDD4'

/**
 * @typedef {Object} ReportColumn
 * @property {string}   label   Header text.
 * @property {number}   width   Column width in characters.
 * @property {'left'|'right'|'center'} [align]
 * @property {string}   [format] Excel number format, e.g. '#,##0' or '$#,##0.00'.
 * @property {boolean}  [total]  Sum this column into a bold totals row.
 * @property {(row: any) => string|number|null|undefined} value
 */

// Shared by every body cell: thin grid, centred vertically, roomy row height.
function bodyCellBase(zebra) {
  return {
    alignVertical: 'center',
    height: 22,
    backgroundColor: zebra,
    borderColor: XL_GRID,
    borderStyle: 'thin',
  }
}

// Numbers are written as numbers so Excel can sum and sort them; everything else
// becomes a string. A null/undefined value emits a blank cell rather than "null",
// and never a numeric 0 — a missing figure and a real zero must not look alike.
function toCell(column, raw, base) {
  const cell = { ...base, align: column.align ?? 'left' }

  if (raw === null || raw === undefined || raw === '') {
    return { ...cell, type: String, value: '' }
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { ...cell, type: Number, format: column.format, value: raw }
  }

  return { ...cell, type: String, value: String(raw) }
}

/**
 * Write the given rows to a styled .xlsx file and trigger the browser download.
 *
 * @param {Object} options
 * @param {string} options.sheet    Worksheet name.
 * @param {ReportColumn[]} options.columns
 * @param {any[]}  options.rows
 * @param {string} options.filename Including the .xlsx extension.
 */
export async function exportReport({ sheet, columns, rows, filename }) {
  if (!rows || rows.length === 0) {
    window.alert('There is nothing to export for the current filters.')
    return
  }

  // Loaded on demand so the sheet writer stays out of the main bundle.
  const { default: writeXlsxFile } = await import('write-excel-file/browser')

  const header = columns.map((column) => ({
    value: column.label,
    type: String,
    fontWeight: 'bold',
    fontSize: 11,
    backgroundColor: XL_HEADER_FILL,
    textColor: XL_HEADER_TEXT,
    align: column.align ?? 'left',
    alignVertical: 'center',
    height: 30,
    borderColor: XL_RULE,
    borderStyle: 'thin',
  }))

  const body = rows.map((row, index) => {
    // Stripe every other row so wide tables stay easy to track across.
    const base = bodyCellBase(index % 2 === 1 ? XL_ZEBRA_FILL : undefined)
    return columns.map((column) => toCell(column, column.value(row), base))
  })

  const data = [header, ...body]

  // Only add a totals row if a column asked for one.
  if (columns.some((column) => column.total)) {
    data.push(
      columns.map((column, index) => {
        const cell = {
          fontWeight: 'bold',
          backgroundColor: XL_TOTAL_FILL,
          borderColor: XL_GRID,
          borderStyle: 'thin',
          topBorderColor: XL_RULE,
          alignVertical: 'center',
          height: 24,
          align: column.align ?? 'left',
        }

        if (column.total) {
          const sum = rows.reduce((acc, row) => {
            const raw = column.value(row)
            return acc + (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0)
          }, 0)

          // Rounded so float drift doesn't store 6071.469999999999 in the cell.
          return { ...cell, type: Number, format: column.format, value: Math.round(sum * 100) / 100 }
        }

        // Label the row in the first column, leave the rest blank.
        return { ...cell, type: String, value: index === 0 ? 'Total' : '' }
      }),
    )
  }

  await writeXlsxFile(
    data,
    {
      sheet,
      columns: columns.map((column) => ({ width: column.width })),
      // Keep the header band visible while scrolling long exports.
      stickyRowsCount: 1,
    },
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toFile(filename)
}

/**
 * Consistent workbook names, e.g. reports-sold-products-monthly.xlsx.
 * The suffix is the active granularity or filter so two exports of the same tab
 * taken under different filters don't overwrite each other in the downloads folder.
 */
export function reportFileName(tab, suffix) {
  return suffix ? `reports-${tab}-${suffix}.xlsx` : `reports-${tab}.xlsx`
}
