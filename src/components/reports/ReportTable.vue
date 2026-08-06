<script setup>
// Renders the <thead> from a column config and hands <tbody> to the caller, so
// each tab keeps full control of its cell markup (bars, chips, rank badges)
// without needing a per-cell slot for every column.
//
// columns: [{ key, label, align?: 'left' | 'right' | 'center' }]
defineProps({
  columns: { type: Array, required: true },
  empty: { type: String, default: 'Nothing to show for the current filters.' },
  rowCount: { type: Number, required: true },
})
</script>

<template>
  <div class="tablewrap">
    <table class="table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            :class="`table__${column.align ?? 'left'}`"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody v-if="rowCount > 0">
        <slot />
      </tbody>
      <tbody v-else>
        <tr>
          <td :colspan="columns.length" class="table__empty">{{ empty }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">

/* Wide report tables scroll inside the card rather than stretching the page. */
.tablewrap {
  width: 100%;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;

  :deep(th),
  :deep(td) {
    text-align: left;
    padding: 0.85rem 0.75rem;
    vertical-align: middle;
    white-space: nowrap;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  :deep(tbody tr + tr td) {
    border-top: 1px solid var(--border-subtle);
  }

  :deep(tbody tr:hover) {
    background: var(--surface-sunken);
  }

  &__right,
  :deep(.table__right) {
    text-align: right;
  }

  &__center,
  :deep(.table__center) {
    text-align: center;
  }

  &__empty {
    padding: 2.5rem 0.75rem;
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-subtle);
  }
}
</style>
