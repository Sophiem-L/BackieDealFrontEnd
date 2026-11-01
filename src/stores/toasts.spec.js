import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toasts'

describe('toasts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a success toast with a title and message', () => {
    const store = useToastStore()
    store.success('Category created', 'Phones is now live.')

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]).toMatchObject({
      type: 'success',
      title: 'Category created',
      message: 'Phones is now live.',
    })
  })

  it('gives updates and deletes their own type so the colour can tell them apart', () => {
    const store = useToastStore()
    store.updated('Category updated', '"Phones" was saved.')
    store.deleted('Category deleted', '"Phones" was removed.')

    expect(store.toasts.map((toast) => toast.type)).toEqual(['update', 'delete'])
    expect(store.toasts[1]).toMatchObject({ title: 'Category deleted', message: '"Phones" was removed.' })
  })

  it('removes update and delete toasts by themselves after a few seconds', () => {
    const store = useToastStore()
    store.updated('Saved')
    store.deleted('Removed')

    vi.advanceTimersByTime(5100)
    expect(store.toasts).toHaveLength(0)
  })

  it('adds an error toast', () => {
    const store = useToastStore()
    store.error('Delete failed', 'Please try again.')

    expect(store.toasts[0]).toMatchObject({ type: 'error', title: 'Delete failed' })
  })

  it('gives every toast its own id so two identical messages do not collide', () => {
    const store = useToastStore()
    store.success('Saved')
    store.success('Saved')

    expect(store.toasts).toHaveLength(2)
    expect(store.toasts[0].id).not.toBe(store.toasts[1].id)
  })

  it('dismisses a toast by id', () => {
    const store = useToastStore()
    store.success('One')
    store.success('Two')
    store.dismiss(store.toasts[0].id)

    expect(store.toasts.map((toast) => toast.title)).toEqual(['Two'])
  })

  it('removes a success toast by itself after a few seconds', () => {
    const store = useToastStore()
    store.success('Saved')

    vi.advanceTimersByTime(4900)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(200)
    expect(store.toasts).toHaveLength(0)
  })

  it('keeps an error toast on screen longer than a success toast', () => {
    const store = useToastStore()
    store.error('Failed')

    vi.advanceTimersByTime(5200)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(store.toasts).toHaveLength(0)
  })

  it('keeps a persistent toast until it is dismissed', () => {
    const store = useToastStore()
    store.push({ type: 'info', title: 'Stay', persist: true })

    vi.advanceTimersByTime(60000)
    expect(store.toasts).toHaveLength(1)
  })

  it('caps the stack so a burst of bulk results cannot cover the screen', () => {
    const store = useToastStore()
    for (let i = 0; i < 8; i += 1) store.success(`Toast ${i}`)

    expect(store.toasts).toHaveLength(4)
    expect(store.toasts.at(-1).title).toBe('Toast 7')
  })

  it('runs a toast action once and then dismisses the toast', () => {
    const store = useToastStore()
    const onAction = vi.fn()
    store.push({ type: 'info', title: 'Undo?', actionLabel: 'Undo', onAction })

    store.runAction(store.toasts[0])

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('ignores a dismissed toast timer firing late', () => {
    const store = useToastStore()
    store.success('Saved')
    store.dismiss(store.toasts[0].id)
    store.success('Next')

    vi.advanceTimersByTime(4900)
    expect(store.toasts.map((toast) => toast.title)).toEqual(['Next'])
  })
})
