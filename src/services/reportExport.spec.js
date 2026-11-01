import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportReport, reportFileName } from '@/services/reportExport'
import writeXlsxFile from 'write-excel-file/browser'

// The workbook writer is the library's job; what matters here is the call this
// module makes to it — how many sheets, named what, holding which rows.
const toFile = vi.fn().mockResolvedValue(undefined)
vi.mock('write-excel-file/browser', () => ({ default: vi.fn(() => ({ toFile })) }))

const COLUMNS = [
  { label: 'Period', width: 20, value: (r) => r.period },
  { label: 'Revenue', width: 14, align: 'right', format: '$#,##0.00', total: true, value: (r) => r.revenue },
]
const ROWS = [
  { period: 'Oct', revenue: 100 },
  { period: 'Nov', revenue: 50.5 },
]

describe('exportReport', () => {
  beforeEach(() => {
    writeXlsxFile.mockClear()
    toFile.mockClear()
  })

  it('writes a single sheet with a header, the rows and a totals row', async () => {
    await exportReport({ sheet: 'Sales', columns: COLUMNS, rows: ROWS, filename: 'sales.xlsx' })

    const [data, options] = writeXlsxFile.mock.calls[0]
    expect(options.sheet).toBe('Sales')
    // header + 2 rows + totals
    expect(data).toHaveLength(4)
    expect(data[3][1].value).toBe(150.5)
    expect(toFile).toHaveBeenCalledWith('sales.xlsx')
  })

  it('adds each extra table as its own sheet, after the main one', async () => {
    await exportReport({
      sheet: 'Sales',
      columns: COLUMNS,
      rows: ROWS,
      filename: 'sales.xlsx',
      extraSheets: [
        {
          sheet: 'Top Products',
          columns: [{ label: 'Product', width: 30, value: (r) => r.name }],
          rows: [{ name: 'Laptop' }],
        },
      ],
    })

    const [sheets] = writeXlsxFile.mock.calls[0]
    expect(sheets.map((entry) => entry.sheet)).toEqual(['Sales', 'Top Products'])
    expect(sheets[0].data).toHaveLength(4)
    expect(sheets[1].data).toHaveLength(2)
    expect(sheets[1].data[1][0].value).toBe('Laptop')
    expect(toFile).toHaveBeenCalledWith('sales.xlsx')
  })

  it('leaves out an extra sheet that has no rows', async () => {
    await exportReport({
      sheet: 'Sales',
      columns: COLUMNS,
      rows: ROWS,
      filename: 'sales.xlsx',
      extraSheets: [{ sheet: 'Top Products', columns: COLUMNS, rows: [] }],
    })

    const [data, options] = writeXlsxFile.mock.calls[0]
    expect(Array.isArray(data[0])).toBe(true)
    expect(options.sheet).toBe('Sales')
  })
})

describe('reportFileName', () => {
  it('joins the tab and the suffix', () => {
    expect(reportFileName('sales', 'weekly')).toBe('reports-sales-weekly.xlsx')
    expect(reportFileName('stock', '')).toBe('reports-stock.xlsx')
  })
})
