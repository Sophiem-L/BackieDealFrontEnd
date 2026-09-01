<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const activeTab = ref('all')

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'orders', label: 'Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'customers', label: 'Customers' },
]

const filteredItems = computed(() => {
  if (activeTab.value === 'all') return notifications.items
  if (activeTab.value === 'inventory') {
    return notifications.items.filter((item) => ['low_stock', 'out_of_stock'].includes(item.category))
  }
  return notifications.items.filter((item) => item.category === activeTab.value)
})

function timeLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function iconFor(category) {
  return {
    orders: '↗',
    customers: '+',
    low_stock: '!',
    out_of_stock: '×',
  }[category] || '•'
}

async function openNotification(item) {
  await notifications.markRead(item, auth.accessToken)
  const data = item.data || {}
  if (item.category === 'orders' && data.order_id) router.push({ name: 'order-detail', params: { id: data.order_id } })
  if (item.category.includes('stock') && data.product_id) router.push({ name: 'stock-detail', params: { id: data.product_id } })
  if (item.category === 'customers' && data.customer_id) router.push({ name: 'customer-detail', params: { id: data.customer_id } })
}

onMounted(() => notifications.initialize(auth.accessToken, auth.user?.id))
</script>

<template>
  <div class="page notifications-page">
    <AppHeader title="Notifications" />

    <main class="page__body">
      <section class="notifications-head">
        <div>
          <p class="eyebrow">Activity centre</p>
          <h2>Keep the shop close</h2>
          <p class="notifications-head__copy">Orders, customers, and stock changes that need your attention.</p>
        </div>
        <button class="notifications-head__clear" type="button" :disabled="!notifications.unreadCount" @click="notifications.markAllRead(auth.accessToken)">
          Mark all as read
        </button>
      </section>

      <nav class="notification-tabs" aria-label="Notification categories">
        <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
          <span v-if="tab.id === 'all' && notifications.unreadCount" class="notification-tabs__count">{{ notifications.unreadCount }}</span>
        </button>
      </nav>

      <p v-if="notifications.error" class="notifications-state notifications-state--error">{{ notifications.error }}</p>
      <p v-else-if="notifications.loading" class="notifications-state">Loading notifications...</p>
      <p v-else-if="!filteredItems.length" class="notifications-state">You are all caught up here.</p>

      <div v-else class="notification-list">
        <button v-for="item in filteredItems" :key="item.id" type="button" class="notification-row" :class="{ 'notification-row--unread': !item.read_at }" @click="openNotification(item)">
          <span class="notification-row__icon" :data-category="item.category">{{ iconFor(item.category) }}</span>
          <span class="notification-row__body">
            <strong>{{ item.title }}</strong>
            <span>{{ item.message }}</span>
            <small>{{ timeLabel(item.created_at) }}</small>
          </span>
          <span v-if="!item.read_at" class="notification-row__dot" aria-label="Unread"></span>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.notifications-page {
  min-height: 100vh;
}

.notifications-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 0 1.25rem;

  h2 { margin: 0.2rem 0 0; color: var(--text-strong); font-size: 1.55rem; }
  &__copy { margin: 0.4rem 0 0; color: var(--text-muted); }
  &__clear { border: 0; background: transparent; color: var(--info); cursor: pointer; font: inherit; font-weight: 700; }
  &__clear:disabled { color: var(--text-faint); cursor: default; }
}

.eyebrow { margin: 0; color: var(--accent-ink); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.notification-tabs { display: flex; gap: 0.35rem; border-bottom: 1px solid var(--border); }
.notification-tabs button { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1rem; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-weight: 700; }
.notification-tabs button.active { border-color: var(--accent-ink); color: var(--text-strong); }
.notification-tabs__count { min-width: 1.25rem; padding: 0.12rem 0.35rem; border-radius: 999px; background: var(--danger); color: white; font-size: 0.7rem; }
.notification-list { display: grid; gap: 0.5rem; padding-top: 0.75rem; }
.notification-row { display: flex; align-items: center; gap: 0.85rem; width: 100%; padding: 1rem; border: 1px solid var(--border-subtle); background: var(--surface); color: inherit; cursor: pointer; text-align: left; }
.notification-row--unread { border-left: 3px solid var(--accent-ink); background: var(--surface-sunken); }
.notification-row__icon { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; flex: 0 0 auto; border-radius: 50%; background: var(--info-bg); color: var(--info); font-size: 1.25rem; font-weight: 800; }
.notification-row__icon[data-category='out_of_stock'] { background: var(--danger-bg); color: var(--danger); }
.notification-row__icon[data-category='low_stock'] { background: rgb(var(--accent-rgb) / 0.18); color: var(--accent-ink); }
.notification-row__icon[data-category='customers'] { background: var(--success-bg); color: var(--success-ink); }
.notification-row__body { display: grid; gap: 0.18rem; min-width: 0; }
.notification-row__body strong { color: var(--text-strong); }
.notification-row__body span { color: var(--text-body); }
.notification-row__body small { color: var(--text-subtle); }
.notification-row__dot { width: 0.5rem; height: 0.5rem; margin-left: auto; flex: 0 0 auto; border-radius: 50%; background: var(--danger); }
.notifications-state { padding: 3rem 1rem; color: var(--text-muted); text-align: center; }
.notifications-state--error { color: var(--danger); }
@media (max-width: 640px) { .notifications-head { align-items: flex-start; flex-direction: column; } .notification-tabs { overflow-x: auto; } }
</style>