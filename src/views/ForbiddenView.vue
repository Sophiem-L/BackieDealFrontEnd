<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="forbidden">
    <p class="forbidden__code">403</p>
    <h1 class="forbidden__title">You don't have access to this page</h1>
    <p class="forbidden__body">
      Your role doesn't include this section. If you need it, ask an administrator to update your
      permissions.
    </p>
    <RouterLink to="/" class="forbidden__link">Back to Overview</RouterLink>
  </div>
</template>

<style scoped lang="scss">
.forbidden {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  max-width: 32rem;
  padding: 64px 32px;

  &__code {
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  &__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
  }

  &__body {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.6;
  }

  &__link {
    margin-top: 8px;
    font-weight: 600;
    color: var(--brand);
  }
}
</style>
