import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// Example Pinia store using the setup syntax.
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)

  function increment() {
    count.value++
  }

  return { count, doubleCount, increment }
})
