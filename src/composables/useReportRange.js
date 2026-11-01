import { computed, ref, watch } from 'vue'

/**
 * The from/to dates a report can be narrowed to.
 *
 * The range is only *applied* once both ends are set and in order. A half-picked
 * or reversed range therefore never triggers a request, and an edit that
 * momentarily breaks the range does not reload the report back to its default
 * while someone is still typing. Clearing both ends removes the range.
 */
export function useReportRange() {
  const from = ref('')
  const to = ref('')
  // { date_from, date_to } once valid, otherwise null.
  const applied = ref(null)

  // ISO dates compare correctly as plain strings.
  const error = computed(() =>
    from.value && to.value && to.value < from.value
      ? 'End date must be on or after the start date'
      : '',
  )

  watch([from, to], ([start, end]) => {
    if (!start && !end) {
      applied.value = null
    } else if (start && end && end >= start) {
      applied.value = { date_from: start, date_to: end }
    }
  })

  // A primitive to watch, so a report reloads when the range changes and not
  // every time the object is rebuilt.
  const key = computed(() =>
    applied.value ? `${applied.value.date_from}|${applied.value.date_to}` : '',
  )

  // Goes into export file names so two exports of one report under different
  // ranges don't overwrite each other in the downloads folder.
  const suffix = computed(() =>
    applied.value ? `${applied.value.date_from}-to-${applied.value.date_to}` : '',
  )

  function clear() {
    from.value = ''
    to.value = ''
  }

  return { from, to, applied, error, key, suffix, clear }
}
