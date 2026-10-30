import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProductFormView from '@/views/ProductFormView.vue'
import { apiFetch } from '@/services/api'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))
vi.mock('@/services/promotions', async () => {
  const actual = await vi.importActual('@/services/promotions')
  return { ...actual, fetchPromotions: vi.fn(async () => []) }
})
vi.mock('@/services/serials', () => ({ receiveSerials: vi.fn() }))
vi.mock('@/services/media', async () => {
  const actual = await vi.importActual('@/services/media')
  return { ...actual, uploadImage: vi.fn() }
})

const route = { params: {}, query: {} }
const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  RichTextEditor: { template: '<div />' },
  ProductImageGallery: { template: '<div />' },
  RouterLink: { template: '<a><slot /></a>' },
}

// A variant as GET /admin/products/{id} returns it.
function apiVariant(overrides = {}) {
  return {
    id: 5,
    name: 'Standard',
    slug: 'lap-1-default',
    sku: 'LAP-1-DEFAULT',
    barcode: null,
    price: 120,
    sale_price: 90,
    cost_price: 60,
    stock_quantity: 4,
    min_stock_alert: 2,
    image: null,
    attributes: {},
    is_default: true,
    is_active: true,
    ...overrides,
  }
}

function stubApi(product = null) {
  apiFetch.mockImplementation(async (url, options = {}) => {
    if (url.startsWith('/admin/categories')) return { data: [] }
    if (options.method === 'POST' || options.method === 'PUT') {
      return { data: { id: 'p-1', default_variant_id: 9, variants: [{ ...apiVariant(), id: 9 }] } }
    }
    return { data: product }
  })
}

function saveCall() {
  return apiFetch.mock.calls.find(([, options]) => options?.method === 'POST' || options?.method === 'PUT')
}

function saveButton(wrapper) {
  return wrapper.findAll('button').find((b) => /Create Product|Update Product/.test(b.text()))
}

function variantsSwitch(wrapper) {
  return wrapper.find('.variants-toggle input[type="checkbox"]')
}

async function mountForm() {
  const wrapper = mount(ProductFormView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('ProductFormView default variant', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiFetch.mockReset()
    push.mockReset()
    route.params = {}
    route.query = {}
  })

  it('creates a product without variants by sending its price and stock and no variants', async () => {
    stubApi()
    const wrapper = await mountForm()

    expect(variantsSwitch(wrapper).element.checked).toBe(false)
    expect(wrapper.text()).toContain('"Standard" is created when you save')

    await wrapper.find('#name').setValue('Gaming Laptop')
    await wrapper.find('#simple-price').setValue('90')
    await wrapper.find('#simple-compare').setValue('120')
    await wrapper.find('#simple-stock').setValue('4')
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    const [url, { method, body }] = saveCall()
    expect(url).toBe('/admin/products')
    expect(method).toBe('POST')
    expect(body).not.toHaveProperty('variants')
    expect(body).toMatchObject({ price: 120, sale_price: 90, stock_quantity: 4, in_stock: true })
    expect(push).toHaveBeenCalledWith('/products')
  })

  it('will not save a product without variants until it has a price', async () => {
    stubApi()
    const wrapper = await mountForm()

    expect(wrapper.text()).toContain('Enter a price.')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('asks for at least one variant once variants are switched on', async () => {
    stubApi()
    const wrapper = await mountForm()

    await variantsSwitch(wrapper).setValue(true)

    expect(wrapper.text()).toContain('Add at least one variant')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('edits the generated default variant in place when the product has no options', async () => {
    route.params = { id: 'p-1' }
    stubApi({ id: 'p-1', name: 'Laptop', sku: 'LAP-1', price: 120, variants: [apiVariant()] })
    const wrapper = await mountForm()

    expect(variantsSwitch(wrapper).element.checked).toBe(false)
    expect(wrapper.find('#simple-price').element.value).toBe('90')
    expect(wrapper.text()).toContain('LAP-1-DEFAULT')

    await wrapper.find('#simple-stock').setValue('9')
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    const [url, { method, body }] = saveCall()
    expect(url).toBe('/admin/products/p-1')
    expect(method).toBe('PUT')
    expect(body.replace_variants).toBe(false)
    expect(body.variants).toHaveLength(1)
    expect(body.variants[0]).toMatchObject({ id: 5, sku: 'LAP-1-DEFAULT', is_default: true, stock_quantity: 9 })
  })

  it('opens a product with option variants in the variant editor and keeps the switch on', async () => {
    route.params = { id: 'p-1' }
    stubApi({
      id: 'p-1',
      name: 'Laptop',
      sku: 'LAP-1',
      variants: [
        apiVariant({ id: 5, name: '16GB', sku: 'LAP-16', attributes: { RAM: '16GB' }, is_default: false }),
        apiVariant({ id: 6, name: '32GB', sku: 'LAP-32', attributes: { RAM: '32GB' }, is_default: true }),
      ],
    })
    const wrapper = await mountForm()

    expect(variantsSwitch(wrapper).element.checked).toBe(true)
    // Two saved variants can't fall back to a single price.
    expect(variantsSwitch(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('.editor__default').text()).toContain('32GB')

    const radios = wrapper.findAll('input[name="default-variant"]')
    await radios[0].setValue(true)
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    const { body } = saveCall()[1]
    expect(body.variants.map((v) => [v.id, v.is_default])).toEqual([
      [5, true],
      [6, false],
    ])
  })
})
