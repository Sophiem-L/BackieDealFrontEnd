<script setup>
// Three-format export for a report tab, matching the menu OrdersView gained.
//
// One component rather than six copies: the menu, the outside-click close, the
// empty guard and the failure alert are identical for every tab — only the rows
// and the column config differ, and those are props.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import { exportReport, reportFileName } from '@/services/reportExport'
import { downloadCsv, downloadJson } from '@/services/tableExport'

const props = defineProps({
  // Worksheet name, e.g. 'Sold Products'.
  sheet: { type: String, required: true },
  // Filename slug, e.g. 'sold-products'.
  tab: { type: String, required: true },
  // Active granularity or filter, appended to the filename. Omitted by the tabs
  // that have no period control.
  suffix: { type: String, default: '' },
  rows: { type: Array, required: true },
  // The reportExport column config — label, width, optional align/format/total,
  // and a `value` accessor — plus a `key` for the plain-text writers.
  columns: { type: Array, required: true },
})

const FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
]

const open = ref(false)
const exporting = ref(false)

function close() {
  open.value = false
}

// Any click that isn't stopped by the wrapper closes the menu. Registered on the
// document rather than a backdrop element so the toolbar stays interactive.
onMounted(() => document.addEventListener('click', close))
onBeforeUnmount(() => document.removeEventListener('click', close))

/**
 * toCsv reads row[column.key] while reportExport calls column.value(row), so the
 * plain-text formats get a flattened copy. Built here rather than by widening
 * tableExport's contract, which OrdersView also depends on.
 */
function toPlainRows() {
  return props.rows.map((row) =>
    Object.fromEntries(props.columns.map((column) => [column.key, column.value(row)])),
  )
}

async function run(format) {
  if (exporting.value) return
  close()

  // Guarded before a writer is picked, so CSV and JSON refuse an empty export the
  // way the xlsx writer already does instead of emitting a header-only file.
  if (props.rows.length === 0) {
    window.alert('There is nothing to export for the current filters.')
    return
  }

  exporting.value = true
  try {
    if (format === 'xlsx') {
      await exportReport({
        sheet: props.sheet,
        columns: props.columns,
        rows: props.rows,
        filename: reportFileName(props.tab, props.suffix),
      })
    } else {
      // Strip the .xlsx the shared namer appends so all three formats agree.
      const base = reportFileName(props.tab, props.suffix).replace(/\.xlsx$/, '')

      if (format === 'csv') {
        downloadCsv(toPlainRows(), props.columns, `${base}.csv`)
      } else {
        downloadJson(toPlainRows(), `${base}.json`)
      }
    }
  } catch (err) {
    console.error(`${props.sheet} export failed`, err)
    window.alert('Sorry, the export could not be generated. Please try again.')
  } finally {
    exporting.value = false
  }
}

defineExpose({ close })
</script>

<template>
  <div class="export" @click.stop @keydown.esc="close">
    <BaseButton
      variant="ghost"
      size="sm"
      :disabled="exporting"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </template>
      {{ exporting ? 'Exporting…' : 'Export' }}
      <svg class="export__caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </BaseButton>

    <div v-if="open" class="export__popup" role="menu">
      <button
        v-for="format in FORMATS"
        :key="format.value"
        type="button"
        class="export__item"
        role="menuitem"
        @click="run(format.value)"
      >
        {{ format.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">

.export {
  position: relative;

  &__caret {
    width: 13px;
    height: 13px;
    margin-left: 0.1rem;
    stroke: currentColor;
    stroke-width: 1.8;
    opacity: 0.7;
  }

  &__popup {
    position: absolute;
    top: calc(100% + 6px);
    /* Right-aligned: the trigger sits at the end of the panel toolbar, so a
       left-anchored popup would hang off the card edge on narrow screens. */
    right: 0;
    z-index: 20;
    min-width: 168px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(20, 23, 28, 0.12);
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
  }

  &__item {
    width: 100%;
    padding: 0.55rem 0.6rem;
    font-size: 0.84rem;
    font-weight: 500;
    font-family: inherit;
    text-align: left;
    color: var(--text-body);
    background: transparent;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background: var(--surface-alt);
    }
  }
}
</style>
