// PDF export for the Reports page.
//
// Takes the same column config the .xlsx writer in reportExport.js reads (label,
// align, format, total, value), so a tab describes its table once and gets every
// export format from it. jsPDF and its table plugin are loaded on demand so they
// stay out of the main bundle, like the sheet writer.

import { currency } from '@/lib/format'
import { downloadBlob } from '@/services/tableExport'

// Same palette as the workbook, so the two exports of one report look related.
const HEADER_FILL = [244, 193, 15]
const HEADER_TEXT = [31, 36, 45]
const TOTAL_FILL = [244, 245, 247]
const ZEBRA_FILL = [250, 251, 252]
const MUTED_TEXT = [110, 118, 129]

const MISSING = '—'

// jsPDF's built-in fonts only carry WinAnsi: Latin letters plus a handful of
// punctuation marks. Anything else — Khmer product names, say — would come out as
// garbage glyphs, so it is replaced with a visible "?" instead.
// Spelled as code points, not a regex of literal characters: a no-break space or a
// curly quote is invisible or easily rewritten by an editor, and lint rejects it.
const DRAWABLE_PUNCTUATION = new Set([
  0x2013, // en dash
  0x2014, // em dash
  0x2018, // left single quote
  0x2019, // right single quote
  0x201c, // left double quote
  0x201d, // right double quote
  0x2022, // bullet
  0x2026, // ellipsis
  0x20ac, // euro
])

function isDrawable(codePoint) {
  return (
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    (codePoint >= 0xa0 && codePoint <= 0xff) ||
    DRAWABLE_PUNCTUATION.has(codePoint)
  )
}

/** Text the PDF's built-in fonts can draw. */
export function toPdfText(value) {
  return Array.from(String(value ?? '').replace(/[\r\n\t]+/g, ' '), (char) =>
    isDrawable(char.codePointAt(0)) ? char : '?',
  ).join('')
}

/**
 * A cell as it reads on screen. The Excel number format on the column decides how
 * a number is written: `$…` is money, `"%"` a percentage, and the zeros after the
 * point set the decimals. A missing figure is a dash, never a misleading 0.
 */
export function formatPdfCell(column, raw) {
  if (raw === null || raw === undefined || raw === '') return MISSING

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const format = column.format ?? ''

    if (format.startsWith('$')) return currency.format(raw)

    const decimals = (format.split('.')[1] ?? '').replace(/[^0]/g, '').length
    const text = raw.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

    return format.endsWith('"%"') ? `${text}%` : text
  }

  return toPdfText(raw)
}

/**
 * Header, body and (when a column asks for one) totals row as plain strings,
 * ready for the table plugin.
 */
export function buildPdfTable({ columns, rows }) {
  const head = [columns.map((column) => toPdfText(column.label))]
  const body = rows.map((row) => columns.map((column) => formatPdfCell(column, column.value(row))))
  const alignments = columns.map((column) => column.align ?? 'left')

  if (!columns.some((column) => column.total)) return { head, body, foot: undefined, alignments }

  const foot = [
    columns.map((column, index) => {
      if (!column.total) return index === 0 ? 'Total' : ''

      const sum = rows.reduce((acc, row) => {
        const raw = column.value(row)
        return acc + (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0)
      }, 0)

      // Rounded so float drift doesn't print 6071.469999999999.
      return formatPdfCell(column, Math.round(sum * 100) / 100)
    }),
  ]

  return { head, body, foot, alignments }
}

/**
 * Write a report to a PDF and trigger the browser download.
 *
 * @param {Object} options
 * @param {string} options.title     Heading, e.g. 'Sales Report'.
 * @param {string} [options.subtitle] The filters in force, e.g. a date range.
 * @param {{label: string, value: string}[]} [options.summary] Key figures shown above the table.
 * @param {import('./reportExport').ReportColumn[]} options.columns
 * @param {any[]}  options.rows
 * @param {{title: string, columns: import('./reportExport').ReportColumn[], rows: any[]}[]} [options.sections]
 *   Further tables printed under their own heading after the main one — a ranking
 *   beside the period table, say. One with no rows is left out.
 * @param {string} options.filename  Including the .pdf extension.
 */
export async function exportReportPdf({
  title,
  subtitle = '',
  summary = [],
  columns,
  rows,
  sections = [],
  filename,
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const { head, body, foot, alignments } = buildPdfTable({ columns, rows })

  // Seven or more columns don't fit a portrait page without crushing the numbers.
  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  })
  const margin = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...HEADER_TEXT)
  doc.text(toPdfText(title), margin, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED_TEXT)
  if (subtitle) doc.text(toPdfText(subtitle), margin, 64)
  doc.text(`Generated ${new Date().toLocaleString('en-US')}`, pageWidth - margin, 48, { align: 'right' })

  let top = 82

  if (summary.length > 0) {
    autoTable(doc, {
      startY: top,
      margin: { left: margin, right: margin },
      theme: 'plain',
      head: [summary.map((item) => toPdfText(item.label))],
      body: [summary.map((item) => toPdfText(item.value))],
      styles: { fontSize: 10, cellPadding: 4, textColor: HEADER_TEXT },
      headStyles: { fontSize: 8, fontStyle: 'normal', textColor: MUTED_TEXT },
      bodyStyles: { fontStyle: 'bold', fontSize: 12 },
    })
    top = doc.lastAutoTable.finalY + 16
  }

  // One look for the main table and every section, so they read as a set.
  function drawTable(startY, built) {
    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin, bottom: 36 },
      head: built.head,
      body: built.body,
      foot: built.foot,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 5, lineColor: [230, 232, 236], lineWidth: 0.5, textColor: HEADER_TEXT },
      headStyles: { fillColor: HEADER_FILL, textColor: HEADER_TEXT, fontStyle: 'bold' },
      footStyles: { fillColor: TOTAL_FILL, textColor: HEADER_TEXT, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ZEBRA_FILL },
      // columnStyles only reaches body cells, which left the headings and totals of a
      // right-aligned column hanging on the left of their own numbers.
      didParseCell: (data) => {
        data.cell.styles.halign = built.alignments[data.column.index] ?? 'left'
      },
      // Repeat the header on every page, but print the totals once, at the end.
      showFoot: 'lastPage',
    })
  }

  drawTable(top, { head, body, foot, alignments })

  for (const section of sections.filter((entry) => entry.rows?.length > 0)) {
    let headingY = doc.lastAutoTable.finalY + 28

    // A heading stranded at the foot of a page, its table on the next, reads as a mistake.
    if (headingY > pageHeight - 110) {
      doc.addPage()
      headingY = margin + 8
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...HEADER_TEXT)
    doc.text(toPdfText(section.title), margin, headingY)

    drawTable(headingY + 8, buildPdfTable({ columns: section.columns, rows: section.rows }))
  }

  const pages = doc.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(...MUTED_TEXT)
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 20, { align: 'right' })
  }

  downloadBlob(doc.output('blob'), filename)
}
