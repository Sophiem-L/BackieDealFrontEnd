<script setup>
// The detail row of an expanded summary row: the full-width cell plus the nested
// table's chrome. Shared by the two reports that expand, so the inset treatment
// is defined once.
//
// Renders the <tr class="detailrow"> itself, which is what lets ReportTable's
// :not(.detailrow) hover and border rules find it.
defineProps({
  // Column count of the OUTER table, for the colspan.
  span: { type: Number, required: true },
  // [{ key, label, align? }] for the nested table.
  columns: { type: Array, required: true },
  // Matches the ExpandToggle's aria-controls.
  id: { type: String, required: true },
  caption: { type: String, default: '' },
})
</script>

<template>
  <tr class="detailrow">
    <td :id="id" :colspan="span" class="detailcell">
      <div class="detail">
        <p v-if="caption" class="detail__caption">{{ caption }}</p>

        <table class="sub">
          <thead>
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                :class="column.align === 'right' ? 'sub__right' : null"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <slot />
          </tbody>
        </table>
      </div>
    </td>
  </tr>
</template>

<style scoped lang="scss">

/* Inset and sunken so the detail reads as contained by the row above rather than
   as more rows in the outer table. */
.detail {
  padding: 0.9rem 0.75rem 1rem 3rem;
  background: var(--surface-sunken);
  border-left: 2px solid rgb(var(--accent-rgb));

  @media (max-width: 720px) {
    padding-left: 1rem;
  }

  &__caption {
    margin: 0 0 0.6rem;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }
}

.sub {
  width: 100%;
  border-collapse: collapse;

  th,
  :deep(td) {
    text-align: left;
    padding: 0.45rem 0.7rem;
    white-space: nowrap;
  }

  th {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border);
  }

  :deep(td) {
    font-size: 0.8rem;
    color: var(--text-body);
    border-bottom: 1px solid var(--border-subtle);
  }

  :deep(tbody tr:last-child td) {
    border-bottom: none;
  }

  &__right,
  :deep(.sub__right) {
    text-align: right;
  }
}
</style>
