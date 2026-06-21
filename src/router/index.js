import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('@/views/ReportsView.vue'),
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/views/OrdersView.vue'),
    },
    {
      path: '/orders/new',
      name: 'order-create',
      component: () => import('@/views/OrderCreateView.vue'),
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('@/views/OrderDetailView.vue'),
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('@/views/ProductsView.vue'),
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue'),
    },
    {
      path: '/categories/new',
      name: 'category-create',
      component: () => import('@/views/CategoryFormView.vue'),
    },
    {
      path: '/categories/:id',
      name: 'category-detail',
      component: () => import('@/views/CategoryDetailView.vue'),
    },
    {
      path: '/products/new',
      name: 'product-create',
      component: () => import('@/views/ProductFormView.vue'),
    },
    {
      path: '/products/:id/edit',
      name: 'product-edit',
      component: () => import('@/views/ProductFormView.vue'),
    },
    {
      path: '/customers',
      name: 'customers',
      component: () => import('@/views/CustomersView.vue'),
    },
    {
      path: '/customers/new',
      name: 'customer-create',
      component: () => import('@/views/CustomerFormView.vue'),
    },
    {
      path: '/customers/:id/edit',
      name: 'customer-edit',
      component: () => import('@/views/CustomerFormView.vue'),
    },
    {
      path: '/promotions',
      name: 'promotions',
      component: () => import('@/views/PromotionsView.vue'),
    },
    {
      path: '/promotions/new',
      name: 'promotion-create',
      component: () => import('@/views/PromotionFormView.vue'),
    },
    {
      path: '/promotions/:id/edit',
      name: 'promotion-edit',
      component: () => import('@/views/PromotionFormView.vue'),
    },
    {
      path: '/slides',
      name: 'slides',
      component: () => import('@/views/SlidesView.vue'),
    },
    {
      path: '/news',
      name: 'news',
      component: () => import('@/views/NewsView.vue'),
    },
    {
      path: '/news/new',
      name: 'news-create',
      component: () => import('@/views/NewsFormView.vue'),
    },
    {
      path: '/news/:id/edit',
      name: 'news-edit',
      component: () => import('@/views/NewsFormView.vue'),
    },
    {
      path: '/administrators',
      name: 'administrators',
      component: () => import('@/views/AdministratorsView.vue'),
    },
    {
      path: '/roles',
      name: 'roles',
      component: () => import('@/views/RolesView.vue'),
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      // Auth screens render without the admin sidebar (meta.layout = 'blank').
      meta: { layout: 'blank', public: true },
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      // Lazy-loaded: split into a separate chunk fetched on demand.
      component: () => import('@/views/AboutView.vue'),
    },
  ],
})

// Guard every non-public route behind admin authentication.
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }
})

export default router
