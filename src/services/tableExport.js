// Plain-text table exports (CSV, JSON) for admin tables.
//
// Kept apart from reportExport.js, which is xlsx-specific: these formats carry
// machine-readable values, so they deliberately drop the styling, the number
// formats and the totals row that make a workbook readable on screen.

// Excel guesses the encoding of a .csv from its first bytes and defaults to the
// system codepage, which turns Khmer and accented customer names into mojibake.
// A BOM forces UTF-8.
// Written as an escape, not a literal: a bare U+FEFF is invisible in an editor
// and easily dropped by a reformat.
const UTF8_BOM = '\uFEFF'

/**
 * @typedef {Object} PlainColumn
 * @property {string} key   Property to read off each row.
 * @property {string} label Header text.
 */

// RFC 4180: a field is quoted only when it has to be — a comma, a double quote,
// a CR or an LF — and inner quotes are doubled.
function escapeCsvField(raw) {
  // A blank cell, never the string "null": a missing figure and a real value
  // must not look alike to whatever parses this next.
  if (raw === null || raw === undefined) return ''

  const text = String(raw)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/** Serialise rows to an RFC 4180 CSV string (without the BOM). */
export function toCsv(rows, columns) {
  const lines = [columns.map((column) => escapeCsvField(column.label)).join(',')]

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvField(row[column.key])).join(','))
  }

  // CRLF is what RFC 4180 specifies and what Excel expects on Windows.
  return lines.join('\r\n')
}

// Hands the blob to the browser as a download, then releases the object URL —
// without the revoke the blob is held for the lifetime of the document.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Write rows to a .csv file and trigger the browser download.
 *
 * @param {any[]} rows
 * @param {PlainColumn[]} columns
 * @param {string} filename Including the .csv extension.
 */
export function downloadCsv(rows, columns, filename) {
  const blob = new Blob([UTF8_BOM + toCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, filename)
}

/**
 * Write a value to a pretty-printed .json file and trigger the download.
 *
 * @param {any} value
 * @param {string} filename Including the .json extension.
 */
export function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  downloadBlob(blob, filename)
}
