<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
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

const emptyMessage = computed(() => {
  if (activeTab.value === 'all') return 'No notifications yet.'
  const tab = tabs.find((entry) => entry.id === activeTab.value)
  return `Nothing in ${tab?.label ?? 'this tab'} yet.`
})

function timeLabel(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

// Stroke paths on a 24x24 grid, drawn like the header icons. Unknown
// categories fall back to the bell so a new notification type still renders.
const ICON_PATHS = {
  orders: ['M6 8h12l-1 12H7L6 8Z', 'M9 8a3 3 0 0 1 6 0'],
  customers: ['M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M3.5 20a6.5 6.5 0 0 1 13 0', 'M19 8v6M16 11h6'],
  low_stock: ['M12 4 3 20h18L12 4Z', 'M12 10v4M12 17h.01'],
  out_of_stock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'm9 9 6 6M15 9l-6 6'],
}
const FALLBACK_ICON = ['M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z', 'M10 19a2 2 0 0 0 4 0']

function iconPaths(category) {
  return ICON_PATHS[category] || FALLBACK_ICON
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
  <div class="page">
    <AppHeader title="Notifications" />

    <div class="page__body">
      <section class="feed-card">
        <header class="tabs">
          <nav class="tabs__list" aria-label="Notification categories">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="tabs__tab"
              :class="{ 'is-active': activeTab === tab.id }"
              :aria-pressed="activeTab === tab.id"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <span v-if="tab.id === 'all' && notifications.unreadCount" class="tabs__count">{{ notifications.unreadCount }}</span>
            </button>
          </nav>

          <div class="tabs__meta">
            <BaseButton
              variant="ghost"
              size="sm"
              :disabled="!notifications.unreadCount"
              @click="notifications.markAllRead(auth.accessToken)"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="m5 12 4.5 4.5L19 7" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </template>
              Mark all as read
            </BaseButton>
          </div>
        </header>

        <p v-if="notifications.error" class="feed__state feed__state--error" role="alert">{{ notifications.error }}</p>
        <p v-else-if="notifications.loading" class="feed__state">Loading notifications…</p>
        <p v-else-if="!filteredItems.length" class="feed__state">{{ emptyMessage }}</p>

        <ul v-else class="feed">
          <li v-for="item in filteredItems" :key="item.id" class="feed__item">
            <button
              type="button"
              class="feed__row"
              :class="{ 'feed__row--unread': !item.read_at }"
              @click="openNotification(item)"
            >
              <span class="feed__icon" :data-category="item.category" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path v-for="path in iconPaths(item.category)" :key="path" :d="path" />
                </svg>
              </span>

              <span class="feed__body">
                <strong class="feed__title">{{ item.title }}</strong>
                <span class="feed__message">{{ item.message }}</span>
              </span>

              <span class="feed__meta">
                <time class="feed__time" :datetime="item.created_at">{{ timeLabel(item.created_at) }}</time>
                <span
                  class="feed__dot"
                  :class="{ 'feed__dot--on': !item.read_at }"
                  :role="item.read_at ? undefined : 'img'"
                  :aria-label="item.read_at ? undefined : 'Unread'"
                  :aria-hidden="item.read_at ? 'true' : undefined"
                ></span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

.feed-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  /* Clips the row hover/unread tint to the card's rounded corners. */
  overflow: hidden;
}

/* Category tabs — same underline treatment as the Orders status tabs. */
.tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.5rem 1rem 0;
  border-bottom: 1px solid var(--border-subtle);

  /* Four labels fit a phone only just; scroll the strip rather than clip it.
     The negative margin lets the list sit on the container's 1px rule so the
     active underline covers it; the tabs stay inside the list's own box, so
     the overflow clipping doesn't cut the underline. */
  &__list {
    display: flex;
    gap: 0.25rem;
    min-width: 0;
    max-width: 100%;
    margin-bottom: -1px;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__meta {
    padding-bottom: 0.5rem;
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
    padding: 0.7rem 0.85rem;
    white-space: nowrap;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--text-subtle);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;

    /* The global button:hover rule paints a --secondary border; keep the
       underline reserved for the active tab. */
    &:hover {
      background: transparent;
      border-bottom-color: transparent;
      color: var(--text-strong);
    }

    &:focus-visible {
      outline: 2px solid rgb(var(--accent-rgb));
      outline-offset: -2px;
      border-radius: 6px 6px 0 0;
    }

    &.is-active {
      color: var(--text-strong);
      border-bottom-color: rgb(var(--accent-rgb));
    }
  }

  &__count {
    min-width: 1.25rem;
    padding: 0.08rem 0.4rem;
    border-radius: 999px;
    background: var(--danger-solid);
    color: var(--ink-on-solid);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
  }
}

.feed {
  margin: 0;
  padding: 0;
  list-style: none;

  &__item:last-child &__row {
    border-bottom: none;
  }

  &__row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    padding: 0.9rem 1.1rem;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background: var(--surface-alt);
      border-bottom-color: var(--border-subtle);
    }

    &:focus-visible {
      outline: 2px solid rgb(var(--accent-rgb));
      outline-offset: -2px;
    }

    &--unread {
      background: rgb(var(--accent-rgb) / 0.07);
    }

    &--unread:hover {
      background: rgb(var(--accent-rgb) / 0.12);
    }
  }

  &__icon {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--info-bg);
    color: var(--info);

    svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    &[data-category='low_stock'] {
      background: rgb(var(--accent-rgb) / 0.18);
      color: var(--accent-ink);
    }

    &[data-category='out_of_stock'] {
      background: var(--danger-bg);
      color: var(--danger);
    }

    &[data-category='customers'] {
      background: var(--success-bg);
      color: var(--success-ink);
    }
  }

  &__body {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  &__title {
    color: var(--text-strong);
    font-size: 0.9rem;
    font-weight: 600;
  }

  &__row--unread &__title {
    font-weight: 700;
  }

  &__message {
    color: var(--text-body);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text-subtle);
    font-size: 0.76rem;
    white-space: nowrap;
  }

  /* Always rendered, so read and unread rows keep their timestamps aligned. */
  &__dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: transparent;

    &--on {
      background: rgb(var(--accent-rgb));
    }
  }

  &__state {
    margin: 0;
    padding: 2.5rem 1rem;
    color: var(--text-subtle);
    font-size: 0.88rem;
    text-align: center;

    &--error {
      color: var(--danger);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .tabs__tab,
  .feed__row {
    transition: none;
  }
}

@media (max-width: 768px) {
  .page__body {
    padding: 1rem;
  }
}

@media (max-width: 640px) {
  .feed__row {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  /* Timestamp drops under the message; the unread dot leads it. The empty dot
     on read rows is kept so every timestamp starts at the same x. */
  .feed__meta {
    grid-column: 2;
    flex-direction: row-reverse;
    justify-content: flex-end;
  }

  .tabs {
    padding-inline: 0.5rem;
  }

  .tabs__tab {
    padding-inline: 0.6rem;
  }
}
</style>
