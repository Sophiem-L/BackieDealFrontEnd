<script setup>
/**
 * Shipping method choice for the create-order form. Presentational only: the
 * view loads the methods and their fees from the API and owns the selection.
 *
 * `methods` are the API's shipping options — { id, name, fee, available,
 * estimated_delivery } — and `priced` says whether those fees are for the
 * order's current lines (from the preview) or only each method's base price.
 * `null` is "no shipping method": the order is saved without one.
 */
const props = defineProps({
  modelValue: { type: Number, default: null },
  methods: { type: Array, default: () => [] },
  priced: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  fieldError: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'retry'])

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`
}

function select(method) {
  if (method && !method.available) return
  emit('update:modelValue', method ? method.id : null)
}

// A selection the list no longer offers — deactivated or deleted since the
// form loaded. It stays selected so the admin sees it, and the API rejects it.
const missingSelection = () =>
  props.modelValue != null && !props.methods.some((m) => m.id === props.modelValue)
</script>

<template>
  <div class="shipping" role="radiogroup" aria-label="Shipping method">
    <p v-if="loading" class="shipping__state">Loading shipping methods…</p>

    <p v-else-if="error" class="shipping__state shipping__state--error" role="alert">
      {{ error }}
      <button type="button" class="shipping__retry" @click="emit('retry')">Retry</button>
    </p>

    <template v-else>
      <label class="shipping__option" :class="{ 'shipping__option--selected': modelValue == null }">
        <input type="radio" name="shipping-method" :checked="modelValue == null" @change="select(null)" />
        <span class="shipping__copy">
          <strong>No shipping</strong>
          <small>Pickup or delivered without a shipping fee.</small>
        </span>
        <span class="shipping__fee">{{ money(0) }}</span>
      </label>

      <label
        v-for="method in methods"
        :key="method.id"
        class="shipping__option"
        :class="{
          'shipping__option--selected': modelValue === method.id,
          'shipping__option--disabled': !method.available,
        }"
      >
        <input
          type="radio"
          name="shipping-method"
          :value="method.id"
          :checked="modelValue === method.id"
          :disabled="!method.available && modelValue !== method.id"
          @change="select(method)"
        />
        <span class="shipping__copy">
          <strong>{{ method.name }}</strong>
          <small v-if="!method.available" class="shipping__warn">Can't carry this order's weight</small>
          <small v-else-if="method.estimated_delivery && method.estimated_delivery !== 'N/A'">
            {{ method.estimated_delivery }}
          </small>
        </span>
        <span class="shipping__fee">
          <small v-if="!priced">from</small>
          {{ money(method.fee) }}
        </span>
      </label>

      <p v-if="!methods.length" class="shipping__state">No shipping methods are set up.</p>
      <p v-if="missingSelection()" class="shipping__warn">
        The selected method is no longer offered. Pick another one.
      </p>
    </template>

    <span v-if="fieldError" class="shipping__warn">{{ fieldError }}</span>
  </div>
</template>

<style scoped lang="scss">
.shipping {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;

  &__option {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.7rem;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    cursor: pointer;

    &:hover { background: var(--surface-sunken); }

    > input { accent-color: rgb(var(--accent-rgb)); margin: 0; }

    &--selected {
      background: rgb(var(--accent-rgb) / 0.08);
      border-color: rgb(var(--accent-rgb) / 0.45);
    }

    &--disabled {
      cursor: not-allowed;
      opacity: 0.65;
      &:hover { background: var(--surface); }
    }
  }

  &__copy {
    display: grid;
    gap: 0.12rem;
    min-width: 0;

    strong { color: var(--text-strong); font-size: 0.84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { color: var(--text-muted); font-size: 12px; }
  }

  &__fee {
    color: var(--text-strong);
    font-size: 0.84rem;
    font-weight: 600;
    white-space: nowrap;

    small { color: var(--text-subtle); font-weight: 400; font-size: 11px; }
  }

  &__state {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-subtle);

    &--error { color: var(--danger); }
  }

  &__retry {
    margin-left: 0.4rem;
    padding: 0.2rem 0.55rem;
    font: inherit;
    font-size: 12px;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
  }

  &__warn {
    margin: 0;
    font-size: 12px;
    color: var(--danger) !important;
  }
}
</style>
