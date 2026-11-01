import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PagesView from '@/views/PagesView.vue'
import PageActionsMenu from '@/components/PageActionsMenu.vue'
import BulkActionBar from '@/components/BulkActionBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { apiFetch } from '@/services/api'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(() => Promise.resolve()) }),
}))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { template: '<button><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
}

function row(id, overrides = {}) {
  return { id, title: `Page ${id}`, slug: `page-${id}`, status: 'draft', ...overrides }
}

function respondWith(rows) {
  apiFetch.mockImplementation((path, options = {}) => {
    if (!options.method) return Promise.resolve({ data: { items: rows } })
    return Promise.resolve({ data: {} })
  })
}

async function mountList(rows) {
  respondWith(rows)
  const wrapper = mount(PagesView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

function mutations() {
  return apiFetch.mock.calls.filter(([, options]) => options?.method)
}

describe('PagesView - feedback', () => {
  let toast

  beforeEach(() => {
    setActivePinia(createPinia())
    toast = useToastStore()
    vi.clearAllMocks()
  })

  it('toasts success only once the API has answered, then undo sends the old status back', async () => {
    const wrapper = await mountList([row(1)])

    let finish
    apiFetch.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    wrapper.findComponent(PageActionsMenu).vm.$emit('publish')
    await flushPromises()
    expect(toast.toasts).toHaveLength(0)

    finish({ data: {} })
    await flushPromises()
    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({ type: 'update', title: 'Page published', actionLabel: 'Undo' })

    toast.runAction(toast.toasts[0])
    await flushPromises()
    const [path, options] = mutations().at(-1)
    expect(path).toBe('/admin/content/1')
    expect(options).toMatchObject({ method: 'PATCH', body: { status: 'draft' } })
    expect(toast.toasts.at(-1)).toMatchObject({ type: 'update', title: 'Page moved to draft', actionLabel: '' })
  })

  it('toasts an error and rolls the row back when a status change fails', async () => {
    const wrapper = await mountList([row(1)])

    apiFetch.mockRejectedValueOnce(new Error('Server said no'))
    wrapper.findComponent(PageActionsMenu).vm.$emit('publish')
    await flushPromises()

    expect(toast.toasts).toHaveLength(1)
    expect(toast.toasts[0]).toMatchObject({
      type: 'error',
      title: 'Could not publish page',
      message: 'Server said no',
    })
    expect(wrapper.findComponent(PageActionsMenu).props('item').status).toBe('draft')
  })

  it('reports a failed delete and keeps the dialog open', async () => {
    const wrapper = await mountList([row(1)])

    wrapper.findComponent(PageActionsMenu).vm.$emit('delete')
    await flushPromises()
    apiFetch.mockRejectedValueOnce(new Error('Locked'))
    wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
    await flushPromises()

    expect(toast.toasts.at(-1)).toMatchObject({ type: 'error', title: 'Could not delete page', message: 'Locked' })
    expect(wrapper.findComponent(ConfirmDialog).props('modelValue')).toBe(true)
  })

  it('reports a successful delete', async () => {
    const wrapper = await mountList([row(1)])

    wrapper.findComponent(PageActionsMenu).vm.$emit('delete')
    await flushPromises()
    wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
    await flushPromises()

    expect(toast.toasts.at(-1)).toMatchObject({
      type: 'delete',
      title: 'Page deleted',
      message: '"Page 1" was removed.',
    })
  })

  it('sums a bulk action into one success toast and one error toast for the failures', async () => {
    const wrapper = await mountList([row(1), row(2), row(3)])
    wrapper.vm.selectedIds = [1, 2, 3]
    await flushPromises()

    apiFetch.mockImplementationOnce(() => Promise.resolve({ data: {} }))
    apiFetch.mockImplementationOnce(() => Promise.reject(new Error('Page 2 is locked')))
    wrapper.findComponent(BulkActionBar).vm.$emit('delete')
    await flushPromises()

    const titles = toast.toasts.map((item) => item.title)
    expect(titles).toEqual(['2 pages deleted', 'Could not delete 1 page'])
    expect(toast.toasts[1].message).toBe('Page 2 is locked')
    expect(titles).not.toContain('Delete 3 pages')
  })
})
