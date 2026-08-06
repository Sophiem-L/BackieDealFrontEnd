<script setup>
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// Detail/form pages (e.g. /orders/:id, /slides/:id/edit) are declared as sibling
// routes rather than children, so Vue Router's active-class won't highlight the
// parent nav item. Match by path prefix so a section stays active on its subpages.
function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

// Nav model — grouped to match the Admin Portal layout.
// `icon` keys map to the inline <svg> set in the template below.
const sections = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Overview', icon: 'overview', to: '/' },
    ],
  },
  {
    title: 'E-Commerce',
    items: [
      { label: 'Orders', icon: 'orders', to: '/orders', badge: 12 },
      { label: 'Products', icon: 'products', to: '/products' },
      { label: 'Categories', icon: 'categories', to: '/categories' },
      { label: 'Promotions', icon: 'promotions', to: '/promotions' },
      { label: 'Stock Management', icon: 'stock', to: '/stock' },
      { label: 'Reports', icon: 'reports', to: '/reports' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Slides', icon: 'slides', to: '/slides' },
      { label: 'News', icon: 'news', to: '/news' },
    ],
  },
  {
    title: 'Users',
    items: [
      { label: 'Customers', icon: 'customers', to: '/customers' },
      { label: 'Administrators', icon: 'administrators', to: '/administrators' },
      { label: 'Roles & Permissions', icon: 'roles', to: '/roles' },
      { label: 'Logs', icon: 'logs', to: '/logs' },
    ],
  },
]
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': ui.sidebarCollapsed }">
    <!-- Brand -->
    <RouterLink to="/" class="brand">
      <img src="/image/logo.png" alt="Admin Portal logo" class="brand__logo" />
      <span class="brand__name">Admin Portal</span>
    </RouterLink>

    <!-- Navigation -->
    <nav class="nav">
      <div v-for="section in sections" :key="section.title" class="nav__section">
        <p class="nav__heading">{{ section.title }}</p>
        <ul class="nav__list">
          <li v-for="item in section.items" :key="item.label">
            <RouterLink
              :to="item.to"
              class="nav__link"
              :class="{ 'is-active': isActive(item.to) }"
              :title="ui.sidebarCollapsed ? item.label : null"
            >
              <span class="nav__icon" aria-hidden="true">
                <!-- Overview -->
                <svg v-if="item.icon === 'overview'" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <!-- Reports -->
                <svg v-else-if="item.icon === 'reports'" viewBox="0 0 24 24" fill="none">
                  <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" stroke-linecap="round" />
                </svg>
                <!-- Orders (cart) -->
                <svg v-else-if="item.icon === 'orders'" viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="20" r="1.4" />
                  <circle cx="18" cy="20" r="1.4" />
                  <path d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L21 8H6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <!-- Products (box) -->
                <svg v-else-if="item.icon === 'products'" viewBox="0 0 24 24" fill="none">
                  <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" stroke-linejoin="round" />
                  <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke-linejoin="round" />
                </svg>
                <!-- Categories (tag) -->
                <svg v-else-if="item.icon === 'categories'" viewBox="0 0 24 24" fill="none">
                  <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1-.6-1.4V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.4Z" stroke-linejoin="round" />
                  <circle cx="8" cy="8" r="1.3" />
                </svg>
                <!-- Promotions (percent) -->
                <svg v-else-if="item.icon === 'promotions'" viewBox="0 0 24 24" fill="none">
                  <path d="M5 19 19 5" stroke-linecap="round" />
                  <circle cx="7.5" cy="7.5" r="2.5" />
                  <circle cx="16.5" cy="16.5" r="2.5" />
                </svg>
                <!-- Stock Management -->
                <svg v-else-if="item.icon === 'stock'" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" stroke-linejoin="round" />
                  <path d="M3 7.5 12 12m0 0 9-4.5M12 12v9M7.5 5.2v5" stroke-linecap="round" />
                </svg>
                <!-- Slides (image) -->
                <svg v-else-if="item.icon === 'slides'" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="9" r="1.5" />
                  <path d="m4 16 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <!-- News (document) -->
                <svg v-else-if="item.icon === 'news'" viewBox="0 0 24 24" fill="none">
                  <path d="M6 3h9l4 4v14H6Z" stroke-linejoin="round" />
                  <path d="M9 9h7M9 13h7M9 17h4" stroke-linecap="round" />
                </svg>
                <!-- Pages (layers) -->
                <svg v-else-if="item.icon === 'pages'" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" stroke-linejoin="round" />
                  <path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <!-- Customers (people) -->
                <svg v-else-if="item.icon === 'customers'" viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="8" r="3" />
                  <path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M17 20a6 6 0 0 0-2-4.5" stroke-linecap="round" />
                </svg>
                <!-- Administrators (shield) -->
                <svg v-else-if="item.icon === 'administrators'" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" stroke-linejoin="round" />
                  <path d="m9.5 12 1.8 1.8L15 10" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <!-- Roles & Permissions (key) -->
                <svg v-else-if="item.icon === 'roles'" viewBox="0 0 24 24" fill="none">
                  <circle cx="8" cy="8" r="4" />
                  <path d="m11 11 8 8M16 16l2-2M18 18l2-2" stroke-linecap="round" />
                </svg>
                <!-- Logs (history) -->
                <svg v-else-if="item.icon === 'logs'" viewBox="0 0 24 24" fill="none">
                  <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M4 4v4h4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M12 8v4l3 2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="nav__label">{{ item.label }}</span>
              <span v-if="item.badge" class="nav__badge">{{ item.badge }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Footer -->
    <div class="sidebar__footer">
      <button type="button" class="nav__link nav__link--logout" @click="handleLogout">
        <span class="nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M10 8l-4 4 4 4M6 12h11" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="nav__label">Logout</span>
      </button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
$sidebar-width: 252px;
$sidebar-rail: 74px;

.sidebar {
  width: $sidebar-width;
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border-subtle);
  transition: width 0.2s ease, transform 0.2s ease;

  /* ---- Collapsed (icon rail) on desktop ---- */
  &--collapsed {
    width: $sidebar-rail;

    .brand {
      justify-content: center;
      padding-inline: 0;
    }
    .brand__name,
    .nav__heading,
    .nav__label,
    .nav__badge {
      display: none;
    }
    .nav__link {
      justify-content: center;
      padding-inline: 0;
    }
    .sidebar__footer .nav__link {
      justify-content: center;
    }
  }
}

/* ---- Mobile: sidebar becomes an off-canvas overlay ---- */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 50;
    box-shadow: var(--shadow-md);

    /* On mobile, "collapsed" hides it off-screen instead of showing a rail */
    &--collapsed {
      width: $sidebar-width;
      transform: translateX(-100%);
      box-shadow: none;

      .brand,
      .nav__link {
        justify-content: flex-start;
        padding-inline: 1.25rem;
      }
      .nav__link {
        padding-inline: 0.6rem;
      }
      .brand__name,
      .nav__heading,
      .nav__label,
      .nav__badge {
        display: revert;
      }
    }
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1.15rem 1.25rem;
  border-bottom: 1px solid var(--border-subtle);

  &:hover {
    text-decoration: none;
  }

  &__logo {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
  }

  &__name {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-strong);
  }
}

.nav {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;

  &__section + &__section {
    margin-top: 1.1rem;
  }

  &__heading {
    margin: 0.4rem 0.6rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__link {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.55rem 0.6rem;
    border-radius: $radius;
    font-size: 0.9rem;
    font-weight: 500;
    text-align: left;
    color: var(--text-body);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: var(--surface-alt);
      text-decoration: none;
      color: var(--text-strong);
    }

    &.is-active {
      background: rgb(var(--accent-rgb) / 0.16);
      color: var(--nav-active-ink);
      font-weight: 600;
    }
  }

  &__icon {
    display: inline-flex;
    flex-shrink: 0;

    svg {
      width: 19px;
      height: 19px;
      stroke: currentColor;
      stroke-width: 1.7;
    }
  }

  &__label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    // The badge sits on the accent, which stays yellow in both themes.
    color: var(--ink-on-accent);
    background: rgb(var(--accent-rgb));
    border-radius: 999px;
  }

  &__link--logout {
    color: var(--danger);

    &:hover {
      background: var(--danger-bg);
      color: var(--danger);
    }
  }
}

.sidebar__footer {
  padding: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}
</style>
