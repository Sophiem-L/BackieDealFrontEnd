import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReportsView from '@/views/ReportsView.vue'
import { apiFetch } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
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
          summary: { revenue: 1000, cogs: 600, profit: 400, margin: 40 },
          meta: { date_from: '2026-10-01', date_to: '2026-10-29' },
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
            { period: 'Jan', orders: 10, uniqueCustomers: 8, newCustomers: 3, returningCustomers: 5, avgItems: 2.5 },
          ],
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
})
