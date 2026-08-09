<script setup>
// Shell for the six reports. Holds no report logic of its own — each tab owns its
// filters, its table and its export — so this file stays a router between them.
import { computed, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import ReportTabs from '@/components/reports/ReportTabs.vue'
import SoldProductsReport from '@/components/reports/SoldProductsReport.vue'
import CustomerOrdersReport from '@/components/reports/CustomerOrdersReport.vue'
import VisitorsReport from '@/components/reports/VisitorsReport.vue'
import PurchaseHistoryReport from '@/components/reports/PurchaseHistoryReport.vue'
import UserActionsReport from '@/components/reports/UserActionsReport.vue'
import PostedProductsReport from '@/components/reports/PostedProductsReport.vue'

// Statically imported: the mock datasets are already in the bundle, so splitting
// these out would add chunks without removing weight.
const REPORTS = [
  { key: 'sold-products', label: 'Sold Products', component: SoldProductsReport },
  { key: 'customer-orders', label: 'Customer Orders', component: CustomerOrdersReport },
  { key: 'visitors', label: 'Visitors', component: VisitorsReport },
  { key: 'purchase-history', label: 'Purchase History', component: PurchaseHistoryReport },
  { key: 'user-actions', label: 'User Actions', component: UserActionsReport },
  { key: 'posted-products', label: 'Posted Products', component: PostedProductsReport },
]

const active = ref(REPORTS[0].key)

const tabs = REPORTS.map(({ key, label }) => ({ key, label }))

const activeComponent = computed(
  () => REPORTS.find((report) => report.key === active.value).component,
)
</script>

<template>
  <div class="page">
    <AppHeader title="Reports" />

    <div class="page__body">
      <ReportTabs v-model="active" :tabs="tabs" />

      <!-- keep-alive is load-bearing: every tab owns its own filter state, and
           without it switching away and back resets each one to its defaults. -->
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
</style>
