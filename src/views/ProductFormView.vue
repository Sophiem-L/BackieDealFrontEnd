<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

const route = useRoute()
const router = useRouter()

// Edit mode when the route carries a product id; otherwise we're creating.
const isEdit = computed(() => Boolean(route.params.id))

const categories = [
  'Graphics Cards',
  'Processors',
  'Motherboards',
  'Memory',
  'Storage',
  'Peripherals',
]

const form = reactive({
  name: '',
  sku: '',
  category: 'Graphics Cards',
  description: '',
  imageUrl: '',
  stock: 0,
  lowStockThreshold: 5,
  availableForOrder: true,
  basePrice: '',
  salePrice: '',
  costPrice: '',
  specs: [{ key: '', value: '' }],
})

// Prefill with the sample product when editing (stands in for an API fetch).
if (isEdit.value) {
  Object.assign(form, {
    name: 'NVIDIA GeForce RTX 4090 Founders Edition',
    sku: 'NV-RTX4090-FE',
    category: 'Graphics Cards',
    description:
      'The NVIDIA GeForce RTX 4090 is the ultimate GeForce GPU. It brings an enormous leap in performance, efficiency, and AI-powered graphics. Experience ultra-high performance gaming, incredibly detailed virtual worlds with ray tracing, unprecedented productivity, and new ways to create.',
    stock: 8,
    lowStockThreshold: 5,
    availableForOrder: true,
    basePrice: '1,599.00',
    salePrice: '',
    costPrice: '1,350.00',
    specs: [
      { key: 'Cuda Cores', value: '16384' },
      { key: 'Memory Size', value: '24GB GDDR6X' },
    ],
  })
}

const pageTitle = computed(() =>
  isEdit.value ? `Edit Product: ${form.name || 'Product'}` : 'Add New Product',
)

const fileInput = ref(null)
function pickImage() {
  fileInput.value?.click()
}
function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) form.imageUrl = URL.createObjectURL(file)
}

function addSpec() {
  form.specs.push({ key: '', value: '' })
}
function removeSpec(index) {
  form.specs.splice(index, 1)
}

function save() {
  // TODO: POST/PUT to the products API.
  router.push('/products')
}
function remove() {
  // TODO: DELETE via the products API.
  router.push('/products')
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink to="/products" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Back to Products</span>
            <span class="subhead__title">Product Details</span>
          </span>
        </RouterLink>

        <div class="subhead__actions">
          <BaseButton v-if="isEdit" variant="danger" @click="remove">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
            Delete
          </BaseButton>
          <BaseButton variant="primary" @click="save">
            {{ isEdit ? 'Save Changes' : 'Create Product' }}
          </BaseButton>
        </div>
      </div>

      <div class="grid">
        <!-- Left column -->
        <div class="col col--side">
          <section class="card">
            <h3 class="card__title">Product Image</h3>
            <button type="button" class="image" @click="pickImage">
              <img v-if="form.imageUrl" :src="form.imageUrl" alt="Product preview" />
              <span v-else class="image__placeholder">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="m4 18 5-4 4 3 3-2 4 3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>Click to upload</span>
              </span>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              @change="onFileChange"
            />
            <p class="card__hint">Recommended: 1000x1000px. PNG, JPG or WebP.</p>
          </section>

          <section class="card">
            <h3 class="card__title">Stock &amp; Availability</h3>
            <div class="field">
              <label for="stock">Current Stock Quantity</label>
              <input id="stock" v-model.number="form.stock" type="number" min="0" />
            </div>
            <div class="field">
              <label for="threshold">Low Stock Threshold</label>
              <input id="threshold" v-model.number="form.lowStockThreshold" type="number" min="0" />
            </div>
            <div class="availability" :class="{ 'availability--on': form.availableForOrder }">
              <span class="availability__dot"></span>
              <ToggleSwitch v-model="form.availableForOrder" label="Available for Order" />
            </div>
          </section>
        </div>

        <!-- Right column -->
        <div class="col col--main">
          <section class="card">
            <h3 class="card__title">General Information</h3>
            <div class="field">
              <label for="name">Product Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. NVIDIA GeForce RTX 4090" />
            </div>
            <div class="row">
              <div class="field">
                <label for="sku">SKU Number</label>
                <input id="sku" v-model="form.sku" type="text" placeholder="e.g. NV-RTX4090-FE" />
              </div>
              <div class="field">
                <label for="category">Category</label>
                <div class="select-wrap">
                  <select id="category" v-model="form.category">
                    <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </div>
              </div>
            </div>
            <div class="field">
              <label for="description">Description</label>
              <textarea id="description" v-model="form.description" rows="4" placeholder="Describe the product..."></textarea>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Pricing &amp; Technical Specs</h3>
            <div class="row row--3">
              <div class="field">
                <label for="basePrice">Base Price</label>
                <div class="money">
                  <span>$</span>
                  <input id="basePrice" v-model="form.basePrice" type="text" placeholder="0.00" />
                </div>
              </div>
              <div class="field">
                <label for="salePrice">Sale Price (Optional)</label>
                <div class="money">
                  <span>$</span>
                  <input id="salePrice" v-model="form.salePrice" type="text" placeholder="-" />
                </div>
              </div>
              <div class="field">
                <label for="costPrice">Cost Price</label>
                <div class="money">
                  <span>$</span>
                  <input id="costPrice" v-model="form.costPrice" type="text" placeholder="0.00" />
                </div>
              </div>
            </div>

            <div class="specs">
              <div class="specs__head">
                <h4>Technical Specifications</h4>
                <button type="button" class="specs__add" @click="addSpec">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
                  Add Attribute
                </button>
              </div>
              <div v-for="(spec, i) in form.specs" :key="i" class="specs__row">
                <input v-model="spec.key" type="text" class="specs__key" placeholder="Attribute" />
                <input v-model="spec.value" type="text" class="specs__value" placeholder="Value" />
                <button
                  type="button"
                  class="specs__remove"
                  aria-label="Remove attribute"
                  @click="removeSpec(i)"
                >
                  <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" /></svg>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$accent: #f4c10f;
$muted: #8a909c;
$divider: #eef0f3;

.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

.subhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__back {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: inherit;

    &:hover { text-decoration: none; }

    svg { width: 22px; height: 22px; stroke: #6b7280; stroke-width: 1.8; }

    span { display: flex; flex-direction: column; line-height: 1.2; }
  }

  &__crumb {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: $muted;
  }

  &__title {
    font-size: 1.1rem;
    font-weight: 700;
    color: $color-text;
  }

  &__actions { display: flex; gap: 0.6rem; }
}

.grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }

  &__hint {
    margin: 0.75rem 0 0;
    font-size: 0.72rem;
    color: $muted;
    text-align: center;
  }
}

.image {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #d3d7dd;
  border-radius: 12px;
  background: #fafbfc;
  overflow: hidden;
  cursor: pointer;
  padding: 0;

  &:hover { border-color: $accent; }

  img { width: 100%; height: 100%; object-fit: cover; }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: $muted;
    font-size: 0.8rem;

    svg { width: 34px; height: 34px; stroke: currentColor; stroke-width: 1.5; }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & + .field { margin-top: 1rem; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4a5160;
  }

  input,
  textarea,
  select {
    width: 100%;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: $color-text;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: #b4b9c2; }

    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }
  }

  textarea { resize: vertical; }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  &--3 { grid-template-columns: repeat(3, 1fr); }

  .field + .field { margin-top: 0; }

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
}

.select-wrap {
  position: relative;

  select { appearance: none; padding-right: 2.2rem; cursor: pointer; }

  svg {
    position: absolute;
    top: 50%;
    right: 0.8rem;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    stroke: $muted;
    stroke-width: 1.8;
    pointer-events: none;
  }
}

.money {
  display: flex;
  align-items: center;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  padding-left: 0.8rem;

  &:focus-within {
    border-color: $accent;
    box-shadow: 0 0 0 3px rgba($accent, 0.18);
  }

  span { color: $muted; font-size: 0.9rem; }

  input {
    border: none;
    box-shadow: none;
    &:focus { box-shadow: none; }
  }
}

.availability {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  background: #f4f5f7;
  transition: background-color 0.15s ease;

  &--on { background: #e9f7ef; }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c2c7ce;
    order: -1;
  }
  &--on &__dot { background: #2f9d57; }
}

.specs {
  margin-top: 1.5rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;

    h4 {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #4a5160;
    }
  }

  &__add {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #a8850a;
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover { color: #8a6c08; border-color: transparent; }

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; }
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr 1.4fr auto;
    gap: 0.5rem;
    align-items: center;

    & + & { margin-top: 0.5rem; }
  }

  &__key,
  &__value {
    border: 1px solid #e6e8ec;
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: $color-text;

    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }
  }

  &__key { background: #fafbfc; }

  &__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: $muted;
    cursor: pointer;

    &:hover { background: #fdf2f2; color: #d14343; border-color: transparent; }

    svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.9; }
  }
}
</style>
