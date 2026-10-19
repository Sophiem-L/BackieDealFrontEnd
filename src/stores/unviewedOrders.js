import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchUnviewedOrders, markOrderViewed } from '@/services/unviewedOrders'

// Orders the signed-in admin has not opened yet. Per admin and kept on the
// server, so it survives a reload and differs between admins. It drives the
// Orders badge in the sidebar and the "New" marker on rows in the Orders table.
export const useUnviewedOrdersStore = defineStore('unviewedOrders', () => {
  const orderIds = ref([])

  const count = computed(() => orderIds.value.length)
  const idSet = computed(() => new Set(orderIds.value))

  function isUnviewed(id) {
    return idSet.value.has(String(id))
  }

  function adopt(ids) {
    // null means the reply was not the expected shape: keep the current list.
    if (ids) orderIds.value = ids
  }

  async function refresh(token) {
    if (!token) return

    try {
      adopt(await fetchUnviewedOrders(token))
    } catch {
      // A badge that cannot refresh keeps its last known value; it is not worth
      // an error banner, and the next refresh corrects it.
    }
  }

  // Called when an admin opens an order. The row drops out at once, then the
  // server's list replaces ours — it is the authority, and it also covers a
  // numeric id (from a notification link) that we cannot match to a uuid here.
  async function markViewed(id, token) {
    if (!token || !id) return

    orderIds.value = orderIds.value.filter((entry) => entry !== String(id))

    try {
      adopt(await markOrderViewed(id, token))
    } catch {
      // The optimistic removal stands; the next refresh restores the truth.
    }
  }

  function clear() {
    orderIds.value = []
  }

  return { orderIds, count, isUnviewed, refresh, markViewed, clear }
})
