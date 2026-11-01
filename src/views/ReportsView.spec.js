import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReportsView from '@/views/ReportsView.vue'
import { apiFetch } from '@/services/api'
import { exportReport } from '@/services/reportExport'
import { exportReportPdf } from '@/services/reportPdf'
import { downloadCsv, downloadJson } from '@/services/tableExport'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
}))

// The three download formats are checked by what they are handed, not by the
// files they would write — jsdom can't save a file, and the writers have their
// own specs.
vi.mock('@/services/reportPdf', () => ({ exportReportPdf: vi.fn() }))
vi.mock('@/services/tableExport', () => ({ downloadCsv: vi.fn(), downloadJson: vi.fn() }))
vi.mock('@/services/reportExport', async (importOriginal) => ({
  ...(await importOriginal()),
  exportReport: vi.fn(),
}))

// The filters are the vendored shadcn Select, which portals its options behind
// pointer interactions jsdom does not implement. Stubbing the family down to a
// native select keeps these tests on what the report owns — the options it offers
// and how it filters — rather than on reka-ui's popup behaviour.
const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button :disabled="disabled"><slot /></button>', props: ['disabled'] },
  Select: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`,
  },
  SelectTrigger: { render: () => null },
  SelectValue: { render: () => null },
  SelectContent: { template: '<slot />' },
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
}

const STOCK_ITEMS = [
  { id: 1, name: 'Keyboard', sku: 'KB-01', price: 80, cost_price: 50, stock_quantity: 12, min_stock_alert: 5, category: { name: 'Peripherals' }, brand: { name: 'Logi' } },
  { id: 2, name: 'Mouse', sku: 'MS-01', price: 25, cost_price: 10, stock_quantity: 3, min_stock_alert: 5, category: { name: 'Peripherals' }, brand: null },
  { id: 3, name: 'Monitor', sku: 'MN-01', price: 220, cost_price: 100, stock_quantity: 0, min_stock_alert: 2, category: { name: 'Displays' }, brand: null },
]

function mockApi() {
  apiFetch.mockImplementation((path) => {
    if (path.startsWith('/admin/reports/sales')) {
      return Promise.resolve({
        data: {
          summary: {
            revenue: 1000,
            cogs: 600,
            profit: 400,
            margin: 40,
            orders: 5,
            revenue_change: 12.5,
            cogs_change: null,
            profit_change: -3,
            margin_change: 1.5,
          },
          chart: [
            { label: 'W42', title: 'Oct 12 – Oct 18', revenue: 400, profit: 150, orders: 2 },
            { label: 'W43', title: 'Oct 19 – Oct 25', revenue: 600, profit: 250, orders: 3 },
          ],
          daily_breakdown: [
            { label: 'Mon', revenue: 100, profit: 40, orders: 1 },
            { label: 'Tue', revenue: 0, profit: 0, orders: 0 },
          ],
          top_products: [
            { rank: 1, name: 'Laptop', units: 2, revenue: 600, share: 60 },
            { rank: 2, name: 'Mouse', units: 8, revenue: 400, share: 40 },
          ],
          table: [
            { period: 'Oct 12 – Oct 18', date_range: '2026-10-12 - 2026-10-18', orders: 2, revenue: 400, cogs: 250, profit: 150, margin: 37.5, revenue_change: null },
            { period: 'Oct 19 – Oct 25', date_range: '2026-10-19 - 2026-10-25', orders: 3, revenue: 600, cogs: 350, profit: 250, margin: 41.7, revenue_change: 50 },
          ],
          meta: { unit: 'week', date_from: '2026-10-01', date_to: '2026-10-29' },
        },
      })
    }
    if (path.startsWith('/admin/stock')) {
      return Promise.resolve({ data: { items: STOCK_ITEMS, pagination: { last_page: 1 } } })
    }
    if (path.startsWith('/admin/reports/customer-orders')) {
      return Promise.resolve({
        data: {
          table: [
            { period: 'Jan', orders: 10, uniqueCustomers: 8, newCustomers: 3, returningCustomers: 5, avgItems: 2.5, revenue: 1250 },
          ],
          totals: { orders: 10, unique_customers: 8, new_customers: 3, returning_customers: 5, revenue: 1250 },
        },
      })
    }
    return Promise.resolve({ data: {} })
  })
}

function callsTo(prefix) {
  return apiFetch.mock.calls.filter(([path]) => path.startsWith(prefix))
}

async function mountPage({ permissions = ['logs.view', 'stock.view'] } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { permissions }

  const wrapper = mount(ReportsView, { global: { plugins: [pinia], stubs } })
  await flushPromises()
  return wrapper
}

const tabButton = (wrapper, label) =>
  wrapper.findAll('.tabs__btn').find((button) => button.text() === label)

async function openStock(wrapper) {
  await tabButton(wrapper, 'Stock Report').trigger('click')
  await flushPromises()
}

describe('ReportsView', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    mockApi()
  })

  it('offers the sales, stock and customer order reports, opening on sales', async () => {
    const wrapper = await mountPage()

    expect(wrapper.findAll('.tabs__btn').map((button) => button.text())).toEqual([
      'Sales Report',
      'Stock Report',
      'Customer Order Report',
    ])
    expect(tabButton(wrapper, 'Sales Report').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('Sales & Profit Report')
    expect(callsTo('/admin/reports/sales')).toHaveLength(1)
    // Only the open tab loads; the other two wait for a click.
    expect(callsTo('/admin/stock')).toHaveLength(0)
    expect(callsTo('/admin/reports/customer-orders')).toHaveLength(0)
  })

  it('hides the stock report from users who cannot view stock', async () => {
    const wrapper = await mountPage({ permissions: ['logs.view'] })

    expect(wrapper.findAll('.tabs__btn').map((button) => button.text())).toEqual([
      'Sales Report',
      'Customer Order Report',
    ])
  })

  it('loads the customer order report on demand', async () => {
    const wrapper = await mountPage()

    await tabButton(wrapper, 'Customer Order Report').trigger('click')
    await flushPromises()

    expect(callsTo('/admin/reports/customer-orders')).toHaveLength(1)
    expect(wrapper.text()).toContain('Customer orders')
    expect(wrapper.text()).toContain('Jan')
  })
})

describe('Stock report tab', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    mockApi()
  })

  const rowNames = (wrapper) =>
    wrapper.findAll('tbody tr').map((row) => row.find('.cell-name').text().split('\n')[0].trim())

  it('lists products with the ones needing a restock first', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)

    expect(rowNames(wrapper)[0]).toContain('Monitor')
    expect(rowNames(wrapper)[1]).toContain('Mouse')
    expect(rowNames(wrapper)[2]).toContain('Keyboard')
  })

  it('totals products, units, cost value and the low and out counts', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)

    const strip = Object.fromEntries(
      wrapper.findAll('.strip li').map((tile) => [
        tile.find('.strip__label').text(),
        tile.find('.strip__value').text(),
      ]),
    )

    expect(strip).toEqual({
      Products: '3',
      'Units on hand': '15',
      // 12 × $50 + 3 × $10 + 0 × $100
      'Stock value (at cost)': '$630.00',
      'Low stock': '1',
      'Out of stock': '1',
    })
  })

  it('filters by availability and re-scopes the summary to match', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)

    await wrapper.findAll('select')[0].setValue('low-stock')

    expect(rowNames(wrapper)).toHaveLength(1)
    expect(rowNames(wrapper)[0]).toContain('Mouse')
    expect(wrapper.find('.strip li .strip__value').text()).toBe('1')
  })

  it('filters by category and by product name or SKU', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)

    await wrapper.findAll('select')[1].setValue('Displays')
    expect(rowNames(wrapper)).toHaveLength(1)
    expect(rowNames(wrapper)[0]).toContain('Monitor')

    await wrapper.findAll('select')[1].setValue('All Categories')
    await wrapper.find('input[type="search"]').setValue('kb-01')
    expect(rowNames(wrapper)).toHaveLength(1)
    expect(rowNames(wrapper)[0]).toContain('Keyboard')
  })

  it('says so when no product matches the filters', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)

    await wrapper.find('input[type="search"]').setValue('nothing-like-this')

    expect(wrapper.text()).toContain('No products match your filters.')
  })

  it('keeps its filters when switching to another report and back', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)
    await wrapper.find('input[type="search"]').setValue('mouse')

    await tabButton(wrapper, 'Customer Order Report').trigger('click')
    await flushPromises()
    await openStock(wrapper)

    expect(wrapper.find('input[type="search"]').element.value).toBe('mouse')
    expect(rowNames(wrapper)).toHaveLength(1)
    // Restored from keep-alive, not reloaded.
    expect(callsTo('/admin/stock')).toHaveLength(1)
  })

  it('shows the error and a retry when the stock request fails', async () => {
    apiFetch.mockImplementation((path) =>
      path.startsWith('/admin/stock')
        ? Promise.reject(new Error('Forbidden'))
        : Promise.resolve({ data: { summary: {}, meta: {} } }),
    )
    const wrapper = await mountPage()
    await openStock(wrapper)

    expect(wrapper.text()).toContain('Forbidden')

    apiFetch.mockImplementation(() =>
      Promise.resolve({ data: { items: STOCK_ITEMS, pagination: { last_page: 1 } } }),
    )
    await wrapper.find('.retry').trigger('click')
    await flushPromises()

    expect(rowNames(wrapper)).toHaveLength(3)
  })

  it('ranks products by the order chosen', async () => {
    const wrapper = await mountPage()
    await openStock(wrapper)
    const sort = wrapper.findAll('select')[2]

    await sort.setValue('value')
    expect(rowNames(wrapper).map((name) => name.split(' ')[0])).toEqual(['Keyboard', 'Mouse', 'Monitor'])

    await sort.setValue('name')
    expect(rowNames(wrapper).map((name) => name.split(' ')[0])).toEqual(['Keyboard', 'Monitor', 'Mouse'])

    await sort.setValue('restock')
    expect(rowNames(wrapper).map((name) => name.split(' ')[0])).toEqual(['Monitor', 'Mouse', 'Keyboard'])
  })

  it('exports exactly the filtered rows as a PDF, with the summary on top', async () => {
    exportReportPdf.mockClear()
    const wrapper = await mountPage()
    await openStock(wrapper)
    await wrapper.findAll('select')[0].setValue('low-stock')

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'PDF').trigger('click')
    await flushPromises()

    const [options] = exportReportPdf.mock.calls[0]
    expect(options.title).toBe('Stock Report')
    expect(options.filename).toBe('reports-stock-low-stock.pdf')
    expect(options.rows.map((row) => row.name)).toEqual(['Mouse'])
    expect(options.summary).toEqual(
      expect.arrayContaining([
        { label: 'Products', value: '1' },
        { label: 'Stock value (at cost)', value: '$30.00' },
      ]),
    )
  })
})

// ---------------------------------------------------------------------------
// Downloads and filters shared by the report tabs
// ---------------------------------------------------------------------------

const dateInputs = (wrapper) => wrapper.findAll('input[type="date"]')

async function pickRange(wrapper, from, to) {
  const [fromInput, toInput] = dateInputs(wrapper)
  await fromInput.setValue(from)
  await toInput.setValue(to)
  await flushPromises()
}

async function openExportMenu(wrapper) {
  await wrapper.find('.export > button').trigger('click')
}

const exportItem = (wrapper, label) =>
  wrapper.findAll('.export__item').find((item) => item.text().startsWith(label))

const lastCall = (prefix) => callsTo(prefix).at(-1)[0]

describe('Sales report tab', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    mockApi()
    exportReportPdf.mockClear()
    downloadCsv.mockClear()
    downloadJson.mockClear()
  })

  it('ranks the top products best seller first, for any period', async () => {
    const wrapper = await mountPage()

    const rows = wrapper.findAll('.rank-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('1')
    expect(rows[0].text()).toContain('Laptop')
    expect(rows[0].text()).toContain('$600.00')
    expect(rows[0].text()).toContain('60.0%')
    expect(rows[1].text()).toContain('Mouse')
  })

  it('shows each comparison, and a dash where there is nothing to compare with', async () => {
    const wrapper = await mountPage()

    const cards = wrapper.findAll('.metric-card')
    expect(cards[0].text()).toContain('+12.5%')
    // COGS had no earlier period to compare with.
    expect(cards[1].text()).toContain('—')
    expect(cards[2].text()).toContain('-3.0%')

    const lastCells = wrapper
      .findAll('.summary-panel tbody tr')
      .map((row) => row.findAll('td').at(-1).text())
    expect(lastCells).toEqual(['—', '+50.0%'])
  })

  it('reloads for the period tab chosen, including yearly', async () => {
    const wrapper = await mountPage()

    await wrapper.findAll('.segmented button').find((button) => button.text() === 'Yearly').trigger('click')
    await flushPromises()

    expect(lastCall('/admin/reports/sales')).toContain('preset=yearly')
  })

  it('sends the chosen dates, and only once both ends are set', async () => {
    const wrapper = await mountPage()
    const [from, to] = dateInputs(wrapper)

    await from.setValue('2026-10-01')
    await flushPromises()
    expect(callsTo('/admin/reports/sales')).toHaveLength(1)

    await to.setValue('2026-10-15')
    await flushPromises()
    expect(callsTo('/admin/reports/sales')).toHaveLength(2)
    expect(lastCall('/admin/reports/sales')).toContain('preset=weekly')
    expect(lastCall('/admin/reports/sales')).toContain('date_from=2026-10-01')
    expect(lastCall('/admin/reports/sales')).toContain('date_to=2026-10-15')
  })

  it('does not ask for a range that ends before it starts', async () => {
    const wrapper = await mountPage()

    await pickRange(wrapper, '2026-10-15', '2026-10-01')

    expect(callsTo('/admin/reports/sales')).toHaveLength(1)
    expect(wrapper.text()).toContain('End date must be on or after the start date')
  })

  it('clears the range and goes back to the period default', async () => {
    const wrapper = await mountPage()
    await pickRange(wrapper, '2026-10-01', '2026-10-15')

    await wrapper.findAll('button').find((button) => button.text() === 'Clear dates').trigger('click')
    await flushPromises()

    expect(lastCall('/admin/reports/sales')).not.toContain('date_from')
    expect(dateInputs(wrapper)[0].element.value).toBe('')
  })

  it('offers Excel, PDF, CSV and JSON', async () => {
    const wrapper = await mountPage()

    await openExportMenu(wrapper)

    expect(wrapper.findAll('.export__item').map((item) => item.text())).toEqual([
      'Excel (.xlsx)',
      'PDF (.pdf)',
      'CSV (.csv)',
      'JSON (.json)',
    ])
  })

  it('exports a PDF of the period table with the key figures and the range', async () => {
    const wrapper = await mountPage()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'PDF').trigger('click')
    await flushPromises()

    const [options] = exportReportPdf.mock.calls[0]
    expect(options.title).toBe('Sales Report')
    expect(options.subtitle).toContain('2026-10-01')
    expect(options.subtitle).toContain('2026-10-29')
    expect(options.filename).toBe('reports-sales-weekly.pdf')
    expect(options.rows).toHaveLength(2)
    expect(options.columns.map((column) => column.label)).toContain('Gross Profit')
    expect(options.summary).toEqual(
      expect.arrayContaining([
        { label: 'Revenue', value: '$1,000.00' },
        { label: 'Profit', value: '$400.00' },
      ]),
    )
  })

  it('adds the product ranking to the PDF as its own section', async () => {
    const wrapper = await mountPage()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'PDF').trigger('click')
    await flushPromises()

    const [options] = exportReportPdf.mock.calls[0]
    expect(options.sections).toHaveLength(1)
    expect(options.sections[0].title).toBe('Top Products')
    expect(options.sections[0].columns.map((column) => column.label)).toEqual([
      'Rank',
      'Product',
      'Units Sold',
      'Sales',
      'Share %',
    ])
    expect(options.sections[0].rows.map((row) => row.name)).toEqual(['Laptop', 'Mouse'])
  })

  it('adds the product ranking to the Excel file as a second sheet', async () => {
    exportReport.mockClear()
    const wrapper = await mountPage()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'Excel').trigger('click')
    await flushPromises()

    const [options] = exportReport.mock.calls[0]
    expect(options.sheet).toBe('Sales')
    expect(options.extraSheets).toHaveLength(1)
    expect(options.extraSheets[0].sheet).toBe('Top Products')
    expect(options.extraSheets[0].rows).toHaveLength(2)
  })

  it('puts the chosen range in the file name so exports do not overwrite each other', async () => {
    const wrapper = await mountPage()
    await pickRange(wrapper, '2026-10-01', '2026-10-15')

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'PDF').trigger('click')
    await flushPromises()

    expect(exportReportPdf.mock.calls[0][0].filename).toBe(
      'reports-sales-weekly-2026-10-01-to-2026-10-15.pdf',
    )
  })

  it('exports JSON with the summary and ranking alongside the rows', async () => {
    const wrapper = await mountPage()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'JSON').trigger('click')
    await flushPromises()

    const [document, filename] = downloadJson.mock.calls[0]
    expect(filename).toBe('reports-sales-weekly.json')
    expect(document.report).toBe('Sales')
    expect(document.summary.revenue).toBe(1000)
    expect(document.top_products.map((product) => product.name)).toEqual(['Laptop', 'Mouse'])
    expect(document.rows).toHaveLength(2)
    expect(document.rows[1]).toMatchObject({ period: 'Oct 19 – Oct 25', revenue: 600 })
  })

  it('exports CSV rows with the table headings', async () => {
    const wrapper = await mountPage()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'CSV').trigger('click')
    await flushPromises()

    const [rows, columns, filename] = downloadCsv.mock.calls[0]
    expect(filename).toBe('reports-sales-weekly.csv')
    expect(rows).toHaveLength(2)
    expect(columns.map((column) => column.label)).toContain('Total Sales')
  })
})

describe('Customer order report tab', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    mockApi()
    exportReportPdf.mockClear()
    downloadJson.mockClear()
  })

  async function openCustomerOrders() {
    const wrapper = await mountPage()
    await tabButton(wrapper, 'Customer Order Report').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('sends the chosen dates with the period', async () => {
    const wrapper = await openCustomerOrders()

    await pickRange(wrapper, '2026-10-01', '2026-10-15')

    expect(lastCall('/admin/reports/customer-orders')).toContain('preset=monthly')
    expect(lastCall('/admin/reports/customer-orders')).toContain('date_from=2026-10-01')
    expect(lastCall('/admin/reports/customer-orders')).toContain('date_to=2026-10-15')
  })

  it('shows revenue per period and counts each customer once in the totals', async () => {
    const wrapper = await openCustomerOrders()

    expect(wrapper.text()).toContain('Revenue')
    expect(wrapper.text()).toContain('$1,250.00')
    expect(wrapper.text()).toContain('10 orders')
    expect(wrapper.text()).toContain('8 customers')
  })

  it('exports a PDF with the table and the whole-range totals', async () => {
    const wrapper = await openCustomerOrders()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'PDF').trigger('click')
    await flushPromises()

    const [options] = exportReportPdf.mock.calls[0]
    expect(options.title).toBe('Customer Order Report')
    expect(options.filename).toBe('reports-customer-orders-monthly.pdf')
    expect(options.rows).toHaveLength(1)
    expect(options.summary).toEqual(
      expect.arrayContaining([
        { label: 'Orders', value: '10' },
        { label: 'Unique customers', value: '8' },
      ]),
    )
  })

  it('exports JSON with the totals alongside the rows', async () => {
    const wrapper = await openCustomerOrders()

    await openExportMenu(wrapper)
    await exportItem(wrapper, 'JSON').trigger('click')
    await flushPromises()

    const [document, filename] = downloadJson.mock.calls[0]
    expect(filename).toBe('reports-customer-orders-monthly.json')
    expect(document.report).toBe('Customer Orders')
    expect(document.totals.unique_customers).toBe(8)
    expect(document.rows).toHaveLength(1)
  })
})
