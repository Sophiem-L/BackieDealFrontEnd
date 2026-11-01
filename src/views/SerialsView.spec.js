import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SerialsView from '@/views/SerialsView.vue'
import { apiFetch } from '@/services/api'
import {
  bulkUpdateStatus,
  fetchSerialHistory,
  fetchSerials,
  fetchSerialSummary,
  lookupSerial,
  receiveSerials,
  updateSerial,
} from '@/services/serials'
import { useToastStore } from '@/stores/toasts'

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }))
vi.mock('@/services/serials', () => ({
  bulkUpdateStatus: vi.fn(),
  exportSerials: vi.fn(),
  fetchSerial: vi.fn(),
  fetchSerialHistory: vi.fn(),
  fetchSerials: vi.fn(),
  fetchSerialSummary: vi.fn(),
  lookupSerial: vi.fn(),
  receiveSerials: vi.fn(),
  updateSerial: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ accessToken: 'token' }) }))

const stubs = {
  AppHeader: { template: '<div />' },
  BaseButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
}

const ROWS = [
  { id: 1, serial_number: 'SN-1', status: 'available', product: { name: 'Laptop', sku: 'LP-1' } },
  { id: 2, serial_number: 'SN-2', status: 'available', product: { name: 'Laptop', sku: 'LP-1' } },
]

async function mountView(rows = ROWS) {
  fetchSerials.mockResolvedValue({ items: rows, pagination: { total: rows.length, last_page: 1, current_page: 1 } })
  fetchSerialSummary.mockResolvedValue({ by_status: {}, total: 2, available: 2 })
  fetchSerialHistory.mockResolvedValue([])
  apiFetch.mockResolvedValue({ data: { items: [{ id: 7, name: 'Laptop', sku: 'LP-1' }] } })
  const wrapper = mount(SerialsView, { global: { stubs } })
  await flushPromises()
  return wrapper
}

const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text() === label)

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})

describe('SerialsView feedback', () => {
  it('toasts a received batch with an Undo that cancels exactly those serials', async () => {
    receiveSerials.mockResolvedValue({ items: [{ id: 11 }, { id: 12 }] })
    bulkUpdateStatus.mockResolvedValue({ updated_count: 2 })
    lookupSerial.mockResolvedValue(null)
    const wrapper = await mountView()

    await wrapper.find('input[list="serial-products"]').setValue('Laptop · LP-1')
    await wrapper.find('textarea').setValue('SN-10\nSN-11')
    // The existing-serial check is debounced.
    await new Promise((resolve) => setTimeout(resolve, 650))
    await flushPromises()
    await wrapper.find('form.receive-form').trigger('submit')
    await flushPromises()

    const toast = useToastStore()
    expect(toast.toasts).toEqual([
      expect.objectContaining({ type: 'success', title: '2 serials received', message: 'Added to "Laptop".', actionLabel: 'Undo' }),
    ])

    toast.runAction(toast.toasts[0])
    await flushPromises()

    expect(bulkUpdateStatus).toHaveBeenCalledWith([11, 12], 'cancelled', 'token')
    expect(toast.toasts).toEqual([expect.objectContaining({ type: 'delete', title: '2 serials cancelled' })])

    wrapper.unmount()
  })

  it('toasts a failed receive and keeps the inline error', async () => {
    receiveSerials.mockRejectedValue(new Error('Serial already exists.'))
    lookupSerial.mockResolvedValue(null)
    const wrapper = await mountView()

    await wrapper.find('input[list="serial-products"]').setValue('Laptop · LP-1')
    await wrapper.find('textarea').setValue('SN-10')
    await new Promise((resolve) => setTimeout(resolve, 650))
    await flushPromises()
    await wrapper.find('form.receive-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Serial already exists.')
    expect(useToastStore().toasts).toEqual([
      expect.objectContaining({ type: 'error', title: 'Could not receive serials', message: 'Serial already exists.' }),
    ])

    wrapper.unmount()
  })

  it('toasts Mark damaged on success and on failure', async () => {
    updateSerial.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Network down'))
    const wrapper = await mountView()
    const toast = useToastStore()

    await button(wrapper, 'Mark damaged').trigger('click')
    await flushPromises()
    expect(toast.toasts).toEqual([
      expect.objectContaining({ type: 'update', title: 'Serial marked as damaged', message: 'SN-1 was marked as damaged.' }),
    ])

    await wrapper.findAll('button').filter((b) => b.text() === 'Mark damaged')[1].trigger('click')
    await flushPromises()
    expect(toast.toasts[1]).toEqual(
      expect.objectContaining({ type: 'error', title: 'Could not update serial status', message: 'Network down' }),
    )

    wrapper.unmount()
  })

  it('reports one toast for a bulk status change, and how many were skipped', async () => {
    bulkUpdateStatus.mockResolvedValueOnce({ updated_count: 2 }).mockResolvedValueOnce({ updated_count: 1 })
    const wrapper = await mountView()
    const toast = useToastStore()

    const change = async () => {
      await wrapper.find('thead input[type="checkbox"]').setValue(true)
      await wrapper.find('select[aria-label="Change selected status"]').setValue('damaged')
      await flushPromises()
    }

    await change()
    expect(bulkUpdateStatus).toHaveBeenLastCalledWith([1, 2], 'damaged', 'token')
    expect(toast.toasts).toEqual([
      expect.objectContaining({ type: 'update', title: '2 serials updated', message: 'Status set to Damaged.' }),
    ])

    await change()
    expect(toast.toasts).toHaveLength(2)
    expect(toast.toasts[1]).toEqual(
      expect.objectContaining({ type: 'error', title: 'Could not update 1 of 2 serials' }),
    )

    wrapper.unmount()
  })

  it('reports a partly failed warehouse move as one error toast', async () => {
    updateSerial.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Locked'))
    // The warehouse picker lists the warehouses already on the page.
    const wrapper = await mountView([{ ...ROWS[0], warehouse: 'Main' }, { ...ROWS[1], warehouse: 'Annex' }])

    await wrapper.find('thead input[type="checkbox"]').setValue(true)
    await wrapper.find('select[aria-label="Move selected to warehouse"]').setValue('Annex')
    await flushPromises()

    expect(useToastStore().toasts).toEqual([
      expect.objectContaining({ type: 'error', title: 'Could not move 1 of 2 serials', message: 'Locked' }),
    ])

    wrapper.unmount()
  })
})
