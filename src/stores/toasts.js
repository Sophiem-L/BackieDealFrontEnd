import { ref } from 'vue'
import { defineStore } from 'pinia'

// Errors stay up longer: the admin has to read what went wrong, whereas a
// success message only has to be noticed.
//
// success = created / added, update = edited / saved, delete = removed. They are
// separate types (not one "success") so the colour tells the admin which kind of
// change just happened.
const DURATIONS = { success: 5000, update: 5000, delete: 5000, info: 5000, error: 8000 }

// A bulk action can report many results in a row; beyond this the oldest
// toasts are dropped so the stack never covers the page.
const MAX_VISIBLE = 4

// App-wide feedback for create / update / delete. It lives in a store rather
// than in each page so a message survives the redirect that follows a save
// (form -> list), and so every page looks and behaves the same.
export const useToastStore = defineStore('toasts', () => {
  const toasts = ref([])
  const timers = new Map()
  let nextId = 1

  function clearTimer(id) {
    const timer = timers.get(id)
    if (timer === undefined) return
    clearTimeout(timer)
    timers.delete(id)
  }

  function dismiss(id) {
    clearTimer(id)
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push({ type = 'info', title, message = '', actionLabel = '', onAction = null, persist = false }) {
    const toast = { id: nextId++, type, title, message, actionLabel, onAction }
    toasts.value = [...toasts.value, toast]

    if (!persist) {
      timers.set(toast.id, setTimeout(() => dismiss(toast.id), DURATIONS[type] ?? DURATIONS.info))
    }

    while (toasts.value.length > MAX_VISIBLE) dismiss(toasts.value[0].id)
    return toast.id
  }

  function success(title, message = '') {
    return push({ type: 'success', title, message })
  }

  function updated(title, message = '') {
    return push({ type: 'update', title, message })
  }

  function deleted(title, message = '') {
    return push({ type: 'delete', title, message })
  }

  function error(title, message = '') {
    return push({ type: 'error', title, message })
  }

  function info(title, message = '') {
    return push({ type: 'info', title, message })
  }

  function runAction(toast) {
    toast.onAction?.()
    dismiss(toast.id)
  }

  return { toasts, push, success, updated, deleted, error, info, dismiss, runAction }
})
