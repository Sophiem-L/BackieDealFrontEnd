<script setup>
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
</script>

<template>
  <section class="home">
    <h1>Vue 3 + Pinia + Sass + Router</h1>
    <div class="card">
      <button type="button" @click="counter.increment">count is {{ counter.count }}</button>
      <p>double is {{ counter.doubleCount }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// $color-primary, @mixin flex-center, etc. come from the auto-injected variables
.home {
  @include flex-center;
  flex-direction: column;
  gap: $spacing;
  text-align: center;
}

h1 {
  color: $color-primary;
}

.card {
  @include flex-center;
  flex-direction: column;
  gap: $spacing;
  padding: $spacing * 2;
  border: 1px solid $color-secondary;
  border-radius: $radius;
}
</style>
