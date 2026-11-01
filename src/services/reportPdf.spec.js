import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPdfTable, exportReportPdf, formatPdfCell, toPdfText } from '@/services/reportPdf'
import { downloadBlob } from '@/services/tableExport'

vi.mock('@/services/tableExport', () => ({ downloadBlob: vi.fn() }))

const COLUMNS = [
  { key: 'name', label: 'Product', value: (r) => r.name },
  { key: 'units', label: 'Units', align: 'right', format: '#,##0', total: true, value: (r) => r.units },
  { key: 'revenue', label: 'Revenue', align: 'right', format: '$#,##0.00', total: true, value: (r) => r.revenue },
  { key: 'margin', label: 'Margin %', align: 'right', format: '0.0"%"', value: (r) => r.margin },
]

const ROWS = [
  { name: 'Laptop', units: 1, revenue: 1299.5, margin: 41.66 },
  { name: 'Mouse', units: 1200, revenue: 24, margin: null },
]

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsBinaryString(blob)
  })
}

describe('formatPdfCell', () => {
  it('renders each Excel number format the way it reads on screen', () => {
    expect(formatPdfCell({ format: '$#,##0.00' }, 1234.5)).toBe('$1,234.50')
    expect(formatPdfCell({ format: '#,##0' }, 1234)).toBe('1,234')
    expect(formatPdfCell({ format: '0.0"%"' }, 41.66)).toBe('41.7%')
    expect(formatPdfCell({ format: '0.0' }, 2.54)).toBe('2.5')
  })

  it('shows a dash for a missing figure and passes text through', () => {
    expect(formatPdfCell({ format: '$#,##0.00' }, null)).toBe('—')
    expect(formatPdfCell({}, undefined)).toBe('—')
    expect(formatPdfCell({}, 'Low stock')).toBe('Low stock')
  })
})

describe('toPdfText', () => {
  it('keeps Latin text and typographic punctuation the PDF fonts can draw', () => {
    expect(toPdfText('Café – Ñandú “quoted” …')).toBe('Café – Ñandú “quoted” …')
  })

  it('swaps characters the built-in fonts cannot draw for a question mark', () => {
    expect(toPdfText('ក្តារចុច')).toMatch(/^\?+$/)
  })
})

describe('buildPdfTable', () => {
  it('builds the header, formatted body rows and a totals row', () => {
    const table = buildPdfTable({ columns: COLUMNS, rows: ROWS })

    expect(table.head).toEqual([['Product', 'Units', 'Revenue', 'Margin %']])
    expect(table.body).toEqual([
      ['Laptop', '1', '$1,299.50', '41.7%'],
      ['Mouse', '1,200', '$24.00', '—'],
    ])
    expect(table.foot).toEqual([['Total', '1,201', '$1,323.50', '']])
    expect(table.alignments).toEqual(['left', 'right', 'right', 'right'])
  })

  it('leaves the totals row out when no column asks for one', () => {
    const table = buildPdfTable({ columns: [COLUMNS[0], COLUMNS[3]], rows: ROWS })

    expect(table.foot).toBeUndefined()
  })
})

describe('exportReportPdf', () => {
  beforeEach(() => {
    downloadBlob.mockReset()
  })

  it('downloads a real PDF named as asked, carrying the title and the table', async () => {
    await exportReportPdf({
      title: 'Sales Report',
      subtitle: '2026-10-01 to 2026-10-15',
      summary: [{ label: 'Revenue', value: '$1,323.50' }],
      columns: COLUMNS,
      rows: ROWS,
      filename: 'reports-sales-weekly.pdf',
    })

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [blob, filename] = downloadBlob.mock.calls[0]
    expect(filename).toBe('reports-sales-weekly.pdf')
    expect(blob.type).toBe('application/pdf')

    const bytes = await readBlob(blob)
    expect(bytes.startsWith('%PDF-')).toBe(true)
    expect(bytes).toContain('Sales Report')
    expect(bytes).toContain('Laptop')
    expect(bytes).toContain('$1,299.50')
    expect(bytes).toContain('Revenue')
  })

  it('prints each extra table under its own heading, after the main one', async () => {
    await exportReportPdf({
      title: 'Sales Report',
      columns: COLUMNS,
      rows: ROWS,
      filename: 'sales.pdf',
      sections: [
        {
          title: 'Top Products',
          columns: [
            { key: 'rank', label: 'Rank', value: (r) => r.rank },
            { key: 'name', label: 'Product', value: (r) => r.name },
          ],
          rows: [{ rank: 1, name: 'Laptop Pro' }],
        },
      ],
    })

    const bytes = await readBlob(downloadBlob.mock.calls[0][0])
    expect(bytes).toContain('Top Products')
    expect(bytes).toContain('Laptop Pro')
    expect(bytes.indexOf('Top Products')).toBeGreaterThan(bytes.indexOf('Mouse'))
  })

  it('skips an extra table with no rows', async () => {
    await exportReportPdf({
      title: 'Sales Report',
      columns: COLUMNS,
      rows: ROWS,
      filename: 'sales.pdf',
      sections: [{ title: 'Top Products', columns: COLUMNS, rows: [] }],
    })

    const bytes = await readBlob(downloadBlob.mock.calls[0][0])
    expect(bytes).not.toContain('Top Products')
  })
})
