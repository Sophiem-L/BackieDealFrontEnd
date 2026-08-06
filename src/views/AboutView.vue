<script setup>
// Lazy-loaded route — see router/index.js
</script>

<template>
  <section class="about">
    <h1>About</h1>
    <p>This page is lazy-loaded as a separate chunk by vue-router.</p>
  </section>
</template>

<style scoped lang="scss">
.about {
  @include flex-center;
  flex-direction: column;
  gap: $spacing;
  text-align: center;
}

h1 {
  color: var(--primary);
}
</style>
