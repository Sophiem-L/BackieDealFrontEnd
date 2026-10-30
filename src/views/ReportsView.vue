<script setup>
import { computed, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import ReportTabs from '@/components/reports/ReportTabs.vue'
import SalesReportDashboard from '@/components/reports/SalesReportDashboard.vue'
import StockReport from '@/components/reports/StockReport.vue'
import CustomerOrdersReport from '@/components/reports/CustomerOrdersReport.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// Display order; `sales` is the default. /reports is gated on `logs.view`, but the
// stock report reads /admin/stock, which needs `stock.view` — so that tab is only
// offered to users who can actually load it instead of opening onto a 403.
const REPORTS = [
  { key: 'sales', label: 'Sales Report', component: SalesReportDashboard },
  { key: 'stock', label: 'Stock Report', component: StockReport, permission: 'stock.view' },
  { key: 'customer-orders', label: 'Customer Order Report', component: CustomerOrdersReport },
]

const tabs = computed(() =>
  REPORTS.filter((report) => !report.permission || auth.hasPermission(report.permission)).map(
    ({ key, label }) => ({ key, label }),
  ),
)

const activeReport = ref('sales')
const activeComponent = computed(
  () => REPORTS.find((report) => report.key === activeReport.value)?.component,
)
</script>

<template>
  <div class="page">
    <AppHeader title="Reports" />

    <div class="page__body">
      <ReportTabs v-model="activeReport" :tabs="tabs" />

      <!-- Each report owns its own filter state (period, status, category, search).
           Without keep-alive, switching tabs and back would reset all of it. -->
      <keep-alive>
        <component :is="activeComponent" />
      </keep-alive>
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

@media (max-width: 768px) {
  .page__body {
    padding: 1rem;
  }
}
</style>
