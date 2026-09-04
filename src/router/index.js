import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { useAuthStore } from '@/stores/auth'
import { resolveAccess } from '@/router/guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/orders',
      name: 'orders',
      meta: { permission: 'orders.view' },
      component: () => import('@/views/OrdersView.vue'),
    },
    {
      path: '/orders/new',
      name: 'order-create',
      meta: { permission: 'orders.create' },
      component: () => import('@/views/OrderCreateView.vue'),
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      meta: { permission: 'orders.view' },
      component: () => import('@/views/OrderDetailView.vue'),
    },
    {
      path: '/products',
      name: 'products',
      meta: { permission: 'products.view' },
      component: () => import('@/views/ProductsView.vue'),
    },
    {
      path: '/categories',
      name: 'categories',
      meta: { permission: 'categories.view' },
      component: () => import('@/views/CategoriesView.vue'),
    },
    {
      path: '/categories/new',
      name: 'category-create',
      meta: { permission: 'categories.create' },
      component: () => import('@/views/CategoryFormView.vue'),
    },
    {
      path: '/categories/:id',
      name: 'category-detail',
      meta: { permission: 'categories.view' },
      component: () => import('@/views/CategoryDetailView.vue'),
    },
    {
      path: '/products/new',
      name: 'product-create',
      meta: { permission: 'products.create' },
      component: () => import('@/views/ProductFormView.vue'),
    },
    {
      path: '/products/:id/edit',
      name: 'product-edit',
      meta: { permission: 'products.update' },
      component: () => import('@/views/ProductFormView.vue'),
    },
    {
      path: '/customers',
      name: 'customers',
      meta: { permission: 'customers.view' },
      component: () => import('@/views/CustomersView.vue'),
    },
    {
      path: '/customers/new',
      name: 'customer-create',
      meta: { permission: 'users.create' },
      component: () => import('@/views/CustomerFormView.vue'),
    },
    {
      path: '/customers/:id',
      name: 'customer-detail',
      meta: { permission: 'customers.view' },
      component: () => import('@/views/CustomerDetailView.vue'),
    },
    {
      path: '/customers/:id/edit',
      name: 'customer-edit',
      meta: { permission: 'users.update' },
      component: () => import('@/views/CustomerFormView.vue'),
    },
    {
      path: '/promotions',
      name: 'promotions',
      meta: { permission: 'promotions.view' },
      component: () => import('@/views/PromotionsView.vue'),
    },
    {
      path: '/promotions/new',
      name: 'promotion-create',
      meta: { permission: 'promotions.create' },
      component: () => import('@/views/PromotionFormView.vue'),
    },
    {
      path: '/promotions/:id',
      name: 'promotion-detail',
      meta: { permission: 'promotions.view' },
      component: () => import('@/views/PromotionDetailView.vue'),
    },
    {
      path: '/promotions/:id/edit',
      name: 'promotion-edit',
      meta: { permission: 'promotions.update' },
      component: () => import('@/views/PromotionFormView.vue'),
    },
    {
      path: '/stock',
      name: 'stock',
      meta: { permission: 'stock.view' },
      component: () => import('@/views/StockManagementView.vue'),
    },
    {
      path: '/stock/new',
      name: 'stock-adjustment-create',
      meta: { permission: 'stock.update' },
      component: () => import('@/views/StockAdjustmentFormView.vue'),
    },
    {
      path: '/stock/:id',
      name: 'stock-detail',
      meta: { permission: 'stock.view' },
      component: () => import('@/views/StockDetailView.vue'),
    },
    {
      path: '/reports',
      name: 'reports',
      meta: { permission: 'logs.view' },
      component: () => import('@/views/ReportsView.vue'),
    },
    {
      path: '/slides',
      name: 'slides',
      meta: { permission: 'banners.view' },
      component: () => import('@/views/SlidesView.vue'),
    },
    {
      path: '/slides/new',
      name: 'slide-create',
      meta: { permission: 'banners.create' },
      component: () => import('@/views/SlideFormView.vue'),
    },
    {
      path: '/slides/:id',
      name: 'slide-detail',
      meta: { permission: 'banners.view' },
      component: () => import('@/views/SlideDetailView.vue'),
    },
    {
      path: '/slides/:id/edit',
      name: 'slide-edit',
      meta: { permission: 'banners.update' },
      component: () => import('@/views/SlideFormView.vue'),
    },
    {
      path: '/news',
      name: 'news',
      meta: { permission: 'content.view' },
      component: () => import('@/views/NewsView.vue'),
    },
    {
      path: '/news/new',
      name: 'news-create',
      meta: { permission: 'content.create' },
      component: () => import('@/views/NewsFormView.vue'),
    },
    {
      path: '/news/:id/edit',
      name: 'news-edit',
      meta: { permission: 'content.update' },
      component: () => import('@/views/NewsFormView.vue'),
    },
    {
      path: '/pages',
      name: 'pages',
      meta: { permission: 'content.view' },
      component: () => import('@/views/PagesView.vue'),
    },
    {
      path: '/pages/new',
      name: 'page-create',
      meta: { permission: 'content.create' },
      component: () => import('@/views/PageFormView.vue'),
    },
    {
      path: '/pages/:id/edit',
      name: 'page-edit',
      meta: { permission: 'content.update' },
      component: () => import('@/views/PageFormView.vue'),
    },
    {
      path: '/administrators',
      name: 'administrators',
      meta: { permission: 'administrators.view' },
      component: () => import('@/views/AdministratorsView.vue'),
    },
    {
      path: '/roles',
      name: 'roles',
      meta: { permission: 'roles.view' },
      component: () => import('@/views/RolesView.vue'),
    },
    {
      path: '/logs',
      name: 'logs',
      meta: { permission: 'logs.view' },
      component: () => import('@/views/LogsView.vue'),
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/views/NotificationsView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      meta: { permission: 'admin.profile.view' },
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
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },
  ],
})

// Guard every non-public route behind admin authentication, then behind the
// permission the route declares. The decision itself lives in ./guards so it
// can be unit tested without mounting a router.
router.beforeEach((to) => {
  const auth = useAuthStore()

  return (
    resolveAccess(to, {
      isAuthenticated: auth.isAuthenticated,
      hasPermission: (permission) => auth.hasPermission(permission),
    }) ?? true
  )
})

export default router
