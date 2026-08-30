// A single clock shared by every countdown on the page.
//
// One interval for the whole page rather than one per card: twenty flash sale
// cards each holding their own setInterval drift apart from one another, so the
// row of countdowns visibly ticks out of step. Subscribers are counted so the
// interval only runs while something is watching it.
import { getCurrentScope, onScopeDispose, readonly, ref } from 'vue'

const SECOND_MS = 1000

const now = ref(Date.now())
let timer = null
let subscribers = 0

export function useNow() {
  // A card mounted well into the session must not render the instant the module
  // happened to be imported.
  now.value = Date.now()
  subscribers += 1

  if (timer === null) {
    timer = setInterval(() => {
      now.value = Date.now()
    }, SECOND_MS)
  }

  // No scope outside a component — the caller owns the teardown in that case.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      subscribers -= 1
      if (subscribers === 0 && timer !== null) {
        clearInterval(timer)
        timer = null
      }
    })
  }

  return readonly(now)
}

// "2h 41m 03s" for a live window, empty for one that has closed. Minutes and
// seconds are padded so the text keeps its width instead of jittering every
// tick. Part-seconds round up, so a promotion with 400ms left still reads 1s
// rather than a confusing 0s.
export function formatCountdown(ms) {
  if (ms <= 0) return ''

  const total = Math.ceil(ms / SECOND_MS)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (part) => String(part).padStart(2, '0')

  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`
  return `${seconds}s`
}
