import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StockManagementView from '@/views/StockManagementView.vue'
import StockDetailView from '@/views/StockDetailView.vue'
import StockAdjustmentFormView from '@/views/StockAdjustmentFormView.vue'
import { apiFetch } from '@/services/api'
import { createBulkStockMovement, fetchStockCatalog, fetchStockDetail } from '@/services/stock'
import { fetchSerials, lookupSerial } from '@/services/serials'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
}))

// Keep the real helpers (deriveStockStatus, fetchStockSummary, ...) so the list
// is exercised end to end; only the calls the detail and form pages make
// directly are replaced.
vi.mock('@/services/stock', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStockDetail: vi.fn(),
  fetchStockCatalog: vi.fn(),
  createBulkStockMovement: vi.fn(),
}))

vi.mock('@/services/serials', () => ({ fetchSerials: vi.fn(), lookupSerial: vi.fn() }))

const { routerStub, routeStub, authStub } = vi.hoisted(() => ({
  routerStub: { push: vi.fn(), back: vi.fn(), beforeEach: vi.fn(() => () => {}) },
  routeStub: { params: { id: '1' }, query: {} },
  authStub: { accessToken: 'token', hasPermission: vi.fn(() => true) },
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerStub,
  useRoute: () => routeStub,
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStub }))

// The vendored shadcn Select renders its options into a portal behind pointer
// interactions jsdom does not implement. Flow tests stub the family down to a
// native select so they stay on what these views own; the one test that cares
// how the real trigger renders mounts without it.
const selectStubs = {
  Select: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`,
  },
  SelectTrigger: { render: () => null },
  SelectValue: { render: () => null },
  SelectContent: { inheritAttrs: false, template: '<slot />' },
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
}

const baseStubs = {
  AppHeader: { template: '<div />' },
  BaseButton: {
    props: ['disabled'],
    template: '<button :disabled="disabled"><slot /></button>',
  },
  RouterLink: { template: '<a><slot /></a>' },
}

const stubs = { ...baseStubs, ...selectStubs }

beforeEach(() => {
  vi.clearAllMocks()
  routeStub.params = { id: '1' }
  routeStub.query = {}
  authStub.hasPermission.mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* -------------------------------------------------------------------------- */
/* Stock list                                                                  */
/* -------------------------------------------------------------------------- */

const STOCK_ROWS = [
  { id: 1, name: 'Alpha Keyboard', sku: 'KB-1', stock_quantity: 40, min_stock_alert: 5, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-05T00:00:00Z' },
  { id: 2, name: 'Beta Mouse', sku: 'MS-2', stock_quantity: 3, min_stock_alert: 5, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-05T00:00:00Z' },
  { id: 3, name: 'Gamma Cable', sku: 'CB-3', stock_quantity: 0, min_stock_alert: 5, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-05T00:00:00Z' },
]

function mockStockApi(rows = STOCK_ROWS) {
  apiFetch.mockImplementation((path) => {
    if (path.startsWith('/admin/stock/alerts')) {
      return Promise.resolve({ data: rows.filter((row) => row.stock_quantity <= row.min_stock_alert) })
    }
    return Promise.resolve({
      data: { items: rows, pagination: { total: rows.length, last_page: 1 } },
    })
  })
}

async function mountList() {
  const wrapper = mount(StockManagementView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

function stockListCalls() {
  return apiFetch.mock.calls.map(([path]) => path).filter((path) => path.startsWith('/admin/stock?'))
}

describe('StockManagementView', () => {
  it('renders a row per product with its status badge and stock meter', async () => {
    mockStockApi()
    const wrapper = await mountList()

    const rows = wrapper.findAll('tbody tr.table__row')
    expect(rows).toHaveLength(3)

    expect(rows[0].text()).toContain('Alpha Keyboard')
    expect(rows[0].text()).toContain('SKU: KB-1')

    const badges = rows.map((row) => row.find('.badge'))
    expect(badges.map((badge) => badge.text())).toEqual(['In stock', 'Low stock', 'Out of stock'])
    expect(badges[0].classes()).toContain('badge--in-stock')
    expect(badges[1].classes()).toContain('badge--low-stock')
    expect(badges[2].classes()).toContain('badge--out-of-stock')

    // Full at twice the alert level, proportional below it, empty at zero.
    const widths = rows.map((row) => row.find('.meter__fill').attributes('style'))
    expect(widths[0]).toContain('width: 100%')
    expect(widths[1]).toContain('width: 30%')
    expect(widths[2]).toContain('width: 0%')
  })

  it('fills the summary cards from the totals and the alerts feed', async () => {
    mockStockApi()
    const wrapper = await mountList()

    const values = wrapper.findAll('.stat__value').map((node) => node.text())
    // total, low, out, in stock
    expect(values).toEqual(['3', '1', '1', '1'])
  })

  it('opens the detail page from a row, and only once from its view button', async () => {
    mockStockApi()
    const wrapper = await mountList()

    await wrapper.find('tbody tr.table__row').trigger('click')
    expect(routerStub.push).toHaveBeenLastCalledWith({ name: 'stock-detail', params: { id: 1 } })

    routerStub.push.mockClear()
    await wrapper.find('button[aria-label="View details for Alpha Keyboard"]').trigger('click')
    expect(routerStub.push).toHaveBeenCalledTimes(1)
  })

  it('offers adjustment actions only to users who can update stock', async () => {
    authStub.hasPermission.mockImplementation((permission) => permission !== 'stock.update')
    mockStockApi()
    const wrapper = await mountList()

    expect(wrapper.text()).not.toContain('Add Stock Adjustment')
    expect(wrapper.find('button[aria-label^="Adjust stock for"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label^="View details for"]').exists()).toBe(true)
  })

  it('re-requests the list in the opposite order when a sorted header is clicked', async () => {
    mockStockApi()
    const wrapper = await mountList()

    const updatedHeader = wrapper.findAll('thead th').find((th) => th.text().includes('Last updated'))
    expect(updatedHeader.attributes('aria-sort')).toBe('descending')

    await updatedHeader.find('button').trigger('click')
    await flushPromises()

    expect(updatedHeader.attributes('aria-sort')).toBe('ascending')
    expect(stockListCalls().at(-1)).toContain('direction=asc')
  })

  it('sorts by every field the API offers from the column headers', async () => {
    mockStockApi()
    const wrapper = await mountList()

    const headerButton = (label) =>
      wrapper.findAll('thead th button').find((button) => button.text() === label)

    // There is no separate sort control, so each field must be reachable here.
    for (const [label, field, direction] of [
      ['Added on', 'created_at', 'desc'],
      ['Product', 'name', 'asc'],
      ['On hand', 'stock_quantity', 'desc'],
    ]) {
      await headerButton(label).trigger('click')
      await flushPromises()
      expect(stockListCalls().at(-1)).toContain(`sort=${field}`)
      expect(stockListCalls().at(-1)).toContain(`direction=${direction}`)
    }
  })

  it('tells an empty catalogue apart from an empty filter result', async () => {
    mockStockApi([])
    const wrapper = await mountList()
    expect(wrapper.find('.table__state').text()).toBe('No stock records yet.')

    // Any filter in play flips the wording; "low stock" matches nothing here.
    await wrapper.findAll('select')[0].setValue('low-stock')
    await flushPromises()
    expect(wrapper.find('.table__state').text()).toBe('No inventory matches your filters.')
  })

  it('shows the load error with a working Retry', async () => {
    let failNext = true
    apiFetch.mockImplementation((path) => {
      if (path.startsWith('/admin/stock/alerts')) return Promise.resolve({ data: [] })
      if (failNext) {
        failNext = false
        return Promise.reject(new Error('Boom'))
      }
      return Promise.resolve({ data: { items: STOCK_ROWS, pagination: { total: 3, last_page: 1 } } })
    })
    const wrapper = await mountList()

    expect(wrapper.find('.table__state--error').text()).toContain('Boom')

    await wrapper.find('.table__retry').trigger('click')
    await flushPromises()

    expect(wrapper.find('.table__state--error').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr.table__row')).toHaveLength(3)
  })
})

/* -------------------------------------------------------------------------- */
/* Stock detail                                                                */
/* -------------------------------------------------------------------------- */

const DETAIL = {
  item: {
    id: 1,
    name: 'Alpha Keyboard',
    sku: 'KB-1',
    category: 'Peripherals',
    location: 'Main Warehouse',
    startDate: '02/jan/26',
    lastUpdated: '05/jan/26',
    onHand: 8,
    threshold: 5,
    availability: 'healthy',
    thumbnail: '',
  },
  movements: [
    { id: 'm1', date: '03/jan/26', type: 'Supplier Delivery', displayType: 'Supplier Delivery', change: 10, balance: 18, by: 'Sok Dara', reference: 'PO-9', timestamp: '2026-01-03T10:00:00Z' },
    { id: 'm2', date: '04/jan/26', type: 'Damaged Goods', displayType: 'Damaged Goods', change: -2, balance: 16, by: 'Sok Dara', reference: null, timestamp: '2026-01-04T10:00:00Z' },
    { id: 'm3', date: '05/jan/26', type: 'Location Transfer', displayType: 'Location Transfer', change: -8, balance: 8, by: 'Chea Vann', reference: null, timestamp: '2026-01-05T10:00:00Z' },
  ],
  movementsPagination: {},
}

async function mountDetail() {
  const wrapper = mount(StockDetailView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('StockDetailView', () => {
  it('shows the product, its status and the stock summary', async () => {
    fetchStockDetail.mockResolvedValue(DETAIL)
    const wrapper = await mountDetail()

    expect(wrapper.find('.subhead__title').text()).toBe('Alpha Keyboard')
    // The detail endpoint says "healthy"; it reads as the list's "In Stock".
    expect(wrapper.find('.subhead .badge').text()).toBe('In Stock')

    const summary = wrapper.findAll('.summary__value').map((node) => node.text())
    expect(summary).toEqual(['8', '5'])
    expect(wrapper.text()).toContain('Main Warehouse')
  })

  it('lists movements newest first, signed, with a tone per type', async () => {
    fetchStockDetail.mockResolvedValue(DETAIL)
    const wrapper = await mountDetail()

    const rows = wrapper.findAll('tbody tr')
    expect(rows.map((row) => row.find('.change').text())).toEqual(['-8', '-2', '+10'])

    const tones = rows.map((row) => row.find('.type-badge').classes())
    expect(tones[0]).toContain('type-badge--neutral') // unrecognised type
    expect(tones[1]).toContain('type-badge--danger')
    expect(tones[2]).toContain('type-badge--success')

    expect(rows[0].find('.change').classes()).toContain('change--down')
    expect(rows[2].find('.change').classes()).toContain('change--up')
  })

  it('filters by type and offers a way back from an empty result', async () => {
    fetchStockDetail.mockResolvedValue(DETAIL)
    const wrapper = await mountDetail()

    await wrapper.find('select').setValue('Damaged Goods')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('tbody tr').text()).toContain('Damaged Goods')

    // A date range that excludes every movement leaves nothing to show.
    const [from] = wrapper.findAll('input[type="date"]')
    await from.setValue('2026-02-01')
    expect(wrapper.find('tbody').exists()).toBe(false)
    expect(wrapper.find('.state__text').text()).toBe('No adjustments match the selected filters.')

    const clear = wrapper.findAll('button').find((button) => button.text() === 'Clear all filters')
    await clear.trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })

  it('shows a load failure with a retry', async () => {
    fetchStockDetail.mockRejectedValueOnce(new Error('Not found'))
    const wrapper = await mountDetail()

    expect(wrapper.find('[role="alert"]').text()).toBe('Not found')

    fetchStockDetail.mockResolvedValue(DETAIL)
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again')
    await retry.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.subhead__title').text()).toBe('Alpha Keyboard')
  })

  it('confirms a just-saved adjustment', async () => {
    routeStub.query = { refresh: '1' }
    fetchStockDetail.mockResolvedValue(DETAIL)
    const wrapper = await mountDetail()

    expect(wrapper.find('.notice--success').text()).toContain('Stock adjustment added successfully!')
  })
})

/* -------------------------------------------------------------------------- */
/* Stock adjustment form                                                       */
/* -------------------------------------------------------------------------- */

const CATALOG = [
  {
    id: 1,
    uuid: 1,
    name: 'Mech Keyboard',
    sku: 'KB-1',
    category: 'Peripherals',
    location: 'Main Warehouse',
    currentStock: 0,
    unitPrice: 20,
    threshold: 2,
    thumbnail: '',
    isSerialized: false,
    variants: [],
  },
]

async function mountForm({ real = false, catalog = CATALOG } = {}) {
  routeStub.query = { product_id: '1' }
  fetchStockCatalog.mockResolvedValue(catalog)
  const wrapper = mount(StockAdjustmentFormView, {
    attachTo: document.body,
    global: { stubs: real ? baseStubs : stubs },
  })
  await flushPromises()
  return wrapper
}

describe('StockAdjustmentFormView', () => {
  it('shows the locked product and one quantity row for it', async () => {
    const wrapper = await mountForm()

    // Arriving from a list row fixes the product, so there is nothing to pick.
    expect(wrapper.find('#productSelect').exists()).toBe(false)
    expect(wrapper.find('.product-header__name').text()).toBe('Mech Keyboard')
    expect(wrapper.find('.product-header__stock strong').text()).toBe('0')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('.serial-trigger__count').text()).toBe('0 / 1')

    wrapper.unmount()
  })

  it('shows only the type name in the trigger, not its description', async () => {
    const wrapper = await mountForm({ real: true })

    const trigger = wrapper.find('#adjustmentType')
    expect(trigger.text()).toContain('Inventory Recount')
    expect(trigger.text()).not.toContain('Regular count and verification')

    wrapper.unmount()
  })

  it('leaves the trigger on the current type when a change is declined', async () => {
    // Which transitions ask for confirmation is the form's business. What this
    // view owns is that a refusal must not leave the Select showing the new
    // value, so try a decrease and an increase and check whichever one asks.
    const prompted = []
    for (const target of ['Damaged Goods', 'Supplier Delivery']) {
      const wrapper = await mountForm({ real: true })
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

      wrapper.vm.onAdjustmentTypeChange(target)
      await flushPromises()

      if (confirm.mock.calls.length) {
        prompted.push(target)
        expect(wrapper.vm.form.adjustmentType).toBe('Inventory Recount')
        expect(wrapper.find('#adjustmentType').text()).toContain('Inventory Recount')
      }

      confirm.mockRestore()
      wrapper.unmount()
    }
    expect(prompted.length).toBeGreaterThan(0)
  })

  it('adds and clears serials in the entry modal', async () => {
    lookupSerial.mockResolvedValue(null)
    const wrapper = await mountForm()

    await wrapper.find('.serial-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('.serial-modal__panel').exists()).toBe(true)
    expect(wrapper.find('#serial-modal-title').text()).toBe('Add 1 serial number')
    expect(wrapper.find('.serial-modal__empty-state').exists()).toBe(true)

    await wrapper.find('#serial-modal-input').setValue('sn-001')
    await wrapper.find('#serial-modal-input').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.find('.serial-modal__chip-value').text()).toBe('SN-001')
    expect(wrapper.find('.serial-modal__empty-state').exists()).toBe(false)

    const footerButton = (label) =>
      wrapper.findAll('.serial-modal__footer button').find((button) => button.text() === label)

    await footerButton('Clear all').trigger('click')
    expect(wrapper.find('.serial-modal__chip').exists()).toBe(false)
    expect(wrapper.find('.serial-modal__empty-state').exists()).toBe(true)

    await footerButton('Cancel').trigger('click')
    expect(wrapper.find('.serial-modal__panel').exists()).toBe(false)

    wrapper.unmount()
  })

  it('saves the movement and opens the detail page once Create is enabled', async () => {
    createBulkStockMovement.mockResolvedValue({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = await mountForm()

    const create = () =>
      wrapper.findAll('.actions button').find((button) => button.text() === 'Create Adjustment')

    // Nothing is chosen yet for a stock-in, so Create is held back.
    expect(create().attributes('disabled')).toBeDefined()

    // A write-off needs no serials entered, so it can be saved straight away.
    wrapper.vm.onAdjustmentTypeChange('Damaged Goods')
    await flushPromises()
    expect(create().attributes('disabled')).toBeUndefined()

    await wrapper.find('#reason').setValue('Dropped in transit')
    await create().trigger('click')
    await flushPromises()

    expect(createBulkStockMovement).toHaveBeenCalledTimes(1)
    const [payload] = createBulkStockMovement.mock.calls[0]
    expect(payload.items).toEqual([
      expect.objectContaining({
        stockable_type: 'product',
        stockable_id: '1',
        movement_type: 'stock_out',
        quantity: 1,
        reason: 'Damaged Goods',
        reference: 'Dropped in transit',
        serial_numbers: [],
      }),
    ])
    expect(routerStub.push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'stock-detail', params: { id: 1 } }),
    )

    wrapper.unmount()
  })

  it('flags a negative resulting quantity', async () => {
    const wrapper = await mountForm()

    // Switch to a decrease against a product with nothing in stock.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    wrapper.vm.onAdjustmentTypeChange('Damaged Goods')
    await flushPromises()

    expect(wrapper.find('td.col-after').text()).toBe('-1')
    expect(wrapper.find('td.col-after').classes()).toContain('col-after--negative')

    wrapper.unmount()
  })
})

/* -------------------------------------------------------------------------- */
/* One serial number per variant                                               */
/* -------------------------------------------------------------------------- */

function variantCatalog({ serialsCount = 0, stock = 5 } = {}) {
  return [
    {
      ...CATALOG[0],
      name: 'Laptop',
      isSerialized: true,
      currentStock: stock,
      variants: [
        { id: 11, name: '13 / Citrus', sku: '13-CITRUS', currentStock: stock, isSerialized: true, serialsCount },
      ],
    },
  ]
}

describe('StockAdjustmentFormView variant serials', () => {
  it('asks for one serial, not one per unit in stock, on a variant that has none', async () => {
    fetchSerials.mockResolvedValue({ items: [] })
    const wrapper = await mountForm({ catalog: variantCatalog({ stock: 5 }) })

    // Five units already in stock plus one coming in used to want six serials.
    expect(wrapper.find('.serial-trigger__count').text()).toBe('0 / 1')
    expect(wrapper.find('.serial-trigger__label').text()).toBe('Add serial')

    await wrapper.find('.serial-trigger').trigger('click')
    await flushPromises()

    expect(wrapper.find('#serial-modal-title').text()).toBe('Add 1 serial number')
    const stats = wrapper.findAll('.serial-modal__stat strong').map((stat) => stat.text())
    expect(stats).toEqual(['0', '1', '0'])
    expect(wrapper.find('#serial-modal-input').attributes('disabled')).toBeUndefined()

    wrapper.unmount()
  })

  it('still asks for one serial when several units come in', async () => {
    fetchSerials.mockResolvedValue({ items: [] })
    const wrapper = await mountForm({ catalog: variantCatalog() })

    await wrapper.find('input[type="number"]').setValue(4)
    await flushPromises()

    expect(wrapper.find('.serial-trigger__count').text()).toBe('0 / 1')

    wrapper.unmount()
  })

  it('lists the serial a variant already has and takes no more', async () => {
    fetchSerials.mockResolvedValue({ items: [{ serial_number: 'sn-held', status: 'available' }] })
    const wrapper = await mountForm({ catalog: variantCatalog({ serialsCount: 1 }) })

    expect(wrapper.find('.serial-trigger__count').text()).toBe('0 / 0')
    expect(wrapper.find('.serial-trigger__label').text()).toBe('View serial')

    await wrapper.find('.serial-trigger').trigger('click')
    await flushPromises()

    expect(fetchSerials).toHaveBeenCalledWith(
      expect.objectContaining({ product_variant_id: 11 }),
      'token',
    )
    expect(wrapper.find('#serial-modal-title').text()).toBe('This variant already has a serial number')
    expect(wrapper.find('#serial-modal-input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.serial-modal__existing-toggle').text()).toContain('Existing serials (1)')

    // The list opens by itself so the serial is in view.
    expect(wrapper.find('.serial-modal__existing-item').text()).toBe('SN-HELD')
    const stats = wrapper.findAll('.serial-modal__stat strong').map((stat) => stat.text())
    expect(stats).toEqual(['1', '0', '0'])

    wrapper.unmount()
  })

  it('does not count a cancelled serial as one the variant holds', async () => {
    fetchSerials.mockResolvedValue({
      items: [
        { serial_number: 'SN-UNDONE', status: 'cancelled' },
        { serial_number: 'SN-SOLD', status: 'sold' },
      ],
    })
    const wrapper = await mountForm({ catalog: variantCatalog({ serialsCount: 1 }) })

    await wrapper.find('.serial-trigger').trigger('click')
    await flushPromises()

    const items = wrapper.findAll('.serial-modal__existing-item').map((item) => item.text())
    expect(items).toHaveLength(1)
    expect(items[0]).toContain('SN-SOLD')
    expect(items[0]).toContain('sold')

    wrapper.unmount()
  })

  it('sends the one new serial with a stock-in on a variant that has none', async () => {
    createBulkStockMovement.mockResolvedValue({})
    fetchSerials.mockResolvedValue({ items: [] })
    lookupSerial.mockResolvedValue(null)
    const wrapper = await mountForm({ catalog: variantCatalog() })

    await wrapper.find('.serial-trigger').trigger('click')
    await flushPromises()
    await wrapper.find('#serial-modal-input').setValue('sn-new')
    await wrapper.find('#serial-modal-input').trigger('keydown.enter')
    await flushPromises()
    await wrapper.findAll('.serial-modal__footer button').find((b) => b.text() === 'Save serials').trigger('click')

    await wrapper.findAll('.actions button').find((b) => b.text() === 'Create Adjustment').trigger('click')
    await flushPromises()

    const [payload] = createBulkStockMovement.mock.calls[0]
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        stockable_type: 'variant',
        stockable_id: '11',
        movement_type: 'stock_in',
        serial_numbers: ['SN-NEW'],
      }),
    )

    wrapper.unmount()
  })

  it('shows the field message the API rejects the save with, not the generic one', async () => {
    const rejection = Object.assign(new Error('The given data was invalid.'), {
      status: 422,
      errors: {
        'items.0.serial_numbers': ['Serial number count must match the required quantity for this adjustment.'],
      },
    })
    createBulkStockMovement.mockRejectedValue(rejection)
    fetchSerials.mockResolvedValue({ items: [{ serial_number: 'SN-HELD', status: 'available' }] })
    const wrapper = await mountForm({ catalog: variantCatalog({ serialsCount: 1 }) })

    await wrapper.findAll('.actions button').find((b) => b.text() === 'Create Adjustment').trigger('click')
    await flushPromises()

    expect(wrapper.find('.alert--error').text()).toBe(
      'Serial number count must match the required quantity for this adjustment.',
    )

    wrapper.unmount()
  })

  it('lets a stock-in through without a serial when the variant already has one', async () => {
    createBulkStockMovement.mockResolvedValue({})
    fetchSerials.mockResolvedValue({ items: [{ serial_number: 'SN-HELD', status: 'available' }] })
    const wrapper = await mountForm({ catalog: variantCatalog({ serialsCount: 1 }) })

    await wrapper.findAll('.actions button').find((b) => b.text() === 'Create Adjustment').trigger('click')
    await flushPromises()

    const [payload] = createBulkStockMovement.mock.calls[0]
    expect(payload.items[0].serial_numbers).toEqual([])

    wrapper.unmount()
  })
})
