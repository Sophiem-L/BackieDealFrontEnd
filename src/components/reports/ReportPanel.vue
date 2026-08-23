<script setup>
// The white card every report tab sits in. Owns the panel chrome so six tabs
// don't each carry their own copy of it.
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <article class="panel">
    <header class="panel__head">
      <div>
        <h3 class="panel__title">{{ title }}</h3>
        <p v-if="subtitle" class="panel__sub">{{ subtitle }}</p>
      </div>
      <div class="panel__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </article>
</template>

<style scoped lang="scss">

.panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.1rem;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__sub {
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
    color: var(--text-subtle);
  }

  /* Toolbar controls are styled here rather than in each of the six tabs.
     Slot content carries the consumer's scope id, so :deep() is what lets these
     rules reach it.

     Selects and the export button are NOT here: the tabs use the shared
     shadcn Select (styled by TOOLBAR_SELECT) and ReportExportMenu, both of
     which bring their own styling. */
  &__actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;

    :deep(.searchbox) {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;

      svg {
        width: 14px;
        height: 14px;
        stroke: var(--text-subtle);
        stroke-width: 1.8;
        flex-shrink: 0;
      }

      input {
        border: none;
        background: transparent;
        padding: 0.5rem 0;
        font-family: inherit;
        font-size: 0.8rem;
        color: var(--text-strong);
        min-width: 170px;

        &:focus {
          outline: none;
        }
      }
    }

  }
}
</style>
