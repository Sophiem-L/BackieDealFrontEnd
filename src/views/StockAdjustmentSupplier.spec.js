import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StockAdjustmentFormView from '@/views/StockAdjustmentFormView.vue'
import { createBulkStockMovement, fetchStockCatalog } from '@/services/stock'
import { fetchSupplierOptions } from '@/services/suppliers'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
  setUnauthenticatedHandler: vi.fn(),
  resetUnauthenticatedHandler: vi.fn(),
}))

vi.mock('@/services/stock', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStockCatalog: vi.fn(),
  createBulkStockMovement: vi.fn(),
}))

// Keep suggestedSupplierId real: which supplier is pre-selected is the point.
vi.mock('@/services/suppliers', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchSupplierOptions: vi.fn(),
}))

vi.mock('@/services/serials', () => ({ fetchSerials: vi.fn(), lookupSerial: vi.fn() }))

const { routerStub, routeStub, authStub } = vi.hoisted(() => ({
  routerStub: { push: vi.fn(), back: vi.fn(), beforeEach: vi.fn(() => () => {}) },
  routeStub: { params: {}, query: {} },
  authStub: { accessToken: 'token', hasPermission: vi.fn(() => true) },
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerStub,
  useRoute: () => routeStub,
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStub }))

// Same native-select stand-in as StockPages.spec.js: the shadcn Select portals
// its options behind pointer events jsdom lacks.
const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
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

const SUPPLIERS = [
  { id: 4, name: 'Store Default Co', code: '', isDefault: true },
  { id: 9, name: 'Keyboard Parts Ltd', code: 'KPL', isDefault: false },
]

function catalogItem(overrides = {}) {
  return {
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
    defaultSupplierId: null,
    variants: [],
    ...overrides,
  }
}

async function mountForm(item) {
  routeStub.query = { product_id: '1' }
  fetchStockCatalog.mockResolvedValue([item])
  const wrapper = mount(StockAdjustmentFormView, { attachTo: document.body, global: { stubs } })
  await flushPromises()
  return wrapper
}

async function chooseType(wrapper, type) {
  wrapper.vm.onAdjustmentTypeChange(type)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  fetchSupplierOptions.mockResolvedValue(SUPPLIERS)
  createBulkStockMovement.mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('StockAdjustmentFormView supplier', () => {
  it('only offers a supplier for a supplier delivery', async () => {
    // The id sits on SelectTrigger, which the stub drops, so look for the label.
    const supplierField = (w) => w.find('label[for="supplierSelect"]')
    const wrapper = await mountForm(catalogItem())
    expect(supplierField(wrapper).exists()).toBe(false)

    await chooseType(wrapper, 'Supplier Delivery')
    expect(supplierField(wrapper).exists()).toBe(true)
    expect(wrapper.find('.col-cost').exists()).toBe(true)

    wrapper.unmount()
  })

  it("pre-selects the product's default supplier, else the store default", async () => {
    const own = await mountForm(catalogItem({ defaultSupplierId: 9 }))
    await chooseType(own, 'Supplier Delivery')
    expect(own.vm.form.supplierId).toBe('9')
    own.unmount()

    const fallback = await mountForm(catalogItem())
    await chooseType(fallback, 'Supplier Delivery')
    expect(fallback.vm.form.supplierId).toBe('4')
    fallback.unmount()
  })

  it('sends the supplier and unit cost with a supplier delivery', async () => {
    const wrapper = await mountForm(catalogItem({ defaultSupplierId: 9 }))
    await chooseType(wrapper, 'Supplier Delivery')
    await wrapper.find('.col-cost input').setValue('12.5')

    await wrapper.vm.complete()
    await flushPromises()

    const [body] = createBulkStockMovement.mock.calls[0]
    expect(body.supplier_id).toBe(9)
    expect(body.items[0]).toMatchObject({ movement_type: 'stock_in', unit_cost: 12.5 })

    wrapper.unmount()
  })

  it('leaves the supplier off a customer return even though it is a stock in', async () => {
    const wrapper = await mountForm(catalogItem({ defaultSupplierId: 9 }))
    await chooseType(wrapper, 'Customer Return')

    await wrapper.vm.complete()
    await flushPromises()

    const [body] = createBulkStockMovement.mock.calls[0]
    expect(body.items[0].movement_type).toBe('stock_in')
    expect(body).not.toHaveProperty('supplier_id')
    expect(body.items[0]).not.toHaveProperty('unit_cost')

    wrapper.unmount()
  })

  it('saves a delivery with no supplier when none is chosen', async () => {
    const wrapper = await mountForm(catalogItem({ defaultSupplierId: 9 }))
    await chooseType(wrapper, 'Supplier Delivery')
    wrapper.vm.onSupplierChange('none')

    await wrapper.vm.complete()
    await flushPromises()

    const [body] = createBulkStockMovement.mock.calls[0]
    expect(body).not.toHaveProperty('supplier_id')

    wrapper.unmount()
  })
})
