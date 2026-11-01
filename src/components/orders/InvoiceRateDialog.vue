<script setup>
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  loadInvoiceExchangeRate,
  parseExchangeRate,
  saveInvoiceExchangeRate,
} from '@/services/printInvoice'

// Asks for the day's exchange rate before a tax invoice is printed. The invoice
// shows the total in riel as well as dollars, and there is no stored rate — it
// changes daily — so it is typed in, starting from the last one used.
//
// Closes itself on confirm and emits the rate as a number; the page prints.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const rate = ref('')
const parsedRate = computed(() => parseExchangeRate(rate.value))

watch(
  () => props.modelValue,
  (open) => {
    if (open) rate.value = loadInvoiceExchangeRate()
  },
  { immediate: true },
)

function confirm() {
  const exchangeRate = parsedRate.value
  if (exchangeRate === null) return

  saveInvoiceExchangeRate(exchangeRate)
  emit('update:modelValue', false)
  emit('confirm', exchangeRate)
}
</script>

<template>
  <ConfirmDialog
    :model-value="modelValue"
    title="Print tax invoice"
    description="The invoice shows the total in riel as well as dollars. Enter today’s exchange rate."
    confirm-label="Print invoice"
    :confirm-disabled="parsedRate === null"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="confirm"
  >
    <template #body>
      <div class="invoice-rate">
        <label for="invoice-rate">Exchange rate (KHR per US$1)</label>
        <input
          id="invoice-rate"
          v-model="rate"
          type="text"
          inputmode="decimal"
          placeholder="4,011"
          autocomplete="off"
          @keydown.enter="confirm"
        />
      </div>
    </template>
  </ConfirmDialog>
</template>

<style scoped lang="scss">
.invoice-rate {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.85rem;

  label {
    font-size: 0.84rem;
    color: var(--text-subtle);
  }

  input {
    width: 100%;
    padding: 0.65rem 0.75rem;
    font: inherit;
    font-size: 0.85rem;
    color: var(--text-strong);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 10px;

    &:focus {
      outline: none;
      border-color: var(--border-strong);
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.1);
    }
  }
}
</style>
