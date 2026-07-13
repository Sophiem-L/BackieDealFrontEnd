<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  customerAccounts,
  findCustomerAccount,
  nextCustomerId,
  randomTone,
} from '@/data/customerAccounts'

const route = useRoute()
const router = useRouter()

// Edit when the route carries a customer id; otherwise we're creating.
const isEdit = computed(() => Boolean(route.params.id))
const existing = computed(() => (isEdit.value ? findCustomerAccount(route.params.id) : null))

const statuses = [
  { key: 'active', label: 'Active' },
  { key: 'vip', label: 'VIP' },
  { key: 'inactive', label: 'Inactive' },
]

const form = reactive({
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
  // New customers get a random colour; an uploaded photo overrides it.
  tone: randomTone(),
  avatar: '',
})

// Prefill from the selected customer in edit mode.
if (existing.value) {
  Object.assign(form, {
    name: existing.value.name,
    email: existing.value.email,
    phone: existing.value.phone || '',
    address: existing.value.address || '',
    status: existing.value.status,
    tone: existing.value.tone || 'blue',
    avatar: existing.value.avatar || '',
  })
}

const fileInput = ref(null)
function pickPhoto() {
  fileInput.value?.click()
}
function onPhotoChange(event) {
  const file = event.target.files?.[0]
  if (file) form.avatar = URL.createObjectURL(file)
}
function removePhoto() {
  form.avatar = ''
}

const pageTitle = computed(() => (isEdit.value ? 'Edit Customer' : 'New Customer'))

const initials = computed(() => {
  const source = form.name.trim() || '?'
  return source
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

function save() {
  if (isEdit.value && existing.value) {
    // Mutate the shared record so the list reflects the change.
    Object.assign(existing.value, {
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      status: form.status,
      tone: form.tone,
      avatar: form.avatar,
    })
  } else {
    customerAccounts.push({
      id: nextCustomerId(),
      name: form.name || 'Unnamed Customer',
      email: form.email,
      phone: form.phone,
      address: form.address,
      spent: '$0.00',
      orders: 0,
      status: form.status,
      tone: form.tone,
      avatar: form.avatar,
    })
  }
  router.push({ name: 'customers' })
}
</script>

<template>
  <div class="page">
    <AppHeader :title="pageTitle" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <RouterLink :to="{ name: 'customers' }" class="subhead__back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>
            <span class="subhead__crumb">Back to Customers</span>
          </span>
        </RouterLink>
      </div>

      <form class="grid" @submit.prevent="save">
        <!-- Left column -->
        <div class="col col--side">
          <section class="card card--avatar">
            <span class="avatar" :class="form.avatar ? 'avatar--photo' : `avatar--${form.tone}`">
              <img v-if="form.avatar" :src="form.avatar" alt="Customer photo" />
              <span v-else aria-hidden="true">{{ initials }}</span>
            </span>
            <p class="avatar__name">{{ form.name || 'New Customer' }}</p>
            <p class="avatar__email">{{ form.email || 'email@example.com' }}</p>

            <div class="avatar__actions">
              <button type="button" class="photo-btn" @click="pickPhoto">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15V3m0 0L8 7m4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
                </svg>
                {{ form.avatar ? 'Change Photo' : 'Upload Photo' }}
              </button>
              <button v-if="form.avatar" type="button" class="photo-btn photo-btn--ghost" @click="removePhoto">
                Remove
              </button>
            </div>
            <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onPhotoChange" />
          </section>

          <section v-if="isEdit && existing" class="card">
            <h3 class="card__title">Account Summary</h3>
            <div class="summary">
              <span class="summary__label">Total Spent</span>
              <span class="summary__value">{{ existing.spent }}</span>
            </div>
            <div class="summary">
              <span class="summary__label">Completed Orders</span>
              <span class="summary__value">{{ existing.orders }}</span>
            </div>
          </section>
        </div>

        <!-- Right column -->
        <div class="col col--main">
          <section class="card">
            <div class="field">
              <label for="name">Full Name</label>
              <input id="name" v-model="form.name" type="text" placeholder="e.g. John Doe" />
            </div>
            <div class="row">
              <div class="field">
                <label for="email">Email Address</label>
                <input id="email" v-model="form.email" type="email" placeholder="you@example.com" />
              </div>
              <div class="field">
                <label for="phone">Phone</label>
                <input id="phone" v-model="form.phone" type="tel" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div class="field">
              <label for="address">Address</label>
              <textarea id="address" v-model="form.address" rows="2" placeholder="Street, city, state, ZIP"></textarea>
            </div>
          </section>

          <section class="card">
            <h3 class="card__title">Account Status</h3>
            <div class="segmented" role="radiogroup" aria-label="Account status">
              <button
                v-for="s in statuses"
                :key="s.key"
                type="button"
                class="segmented__btn"
                :class="[`segmented__btn--${s.key}`, { 'is-active': form.status === s.key }]"
                role="radio"
                :aria-checked="form.status === s.key"
                @click="form.status = s.key"
              >
                {{ s.label }}
              </button>
            </div>
            <p class="card__hint card__hint--left">
              {{ form.status === 'vip'
                ? 'VIP customers are highlighted and may qualify for special offers.'
                : form.status === 'inactive'
                  ? 'Inactive accounts are hidden from default lists and cannot place orders.'
                  : 'Active customers can place orders and receive notifications.' }}
            </p>
          </section>
        </div>

        <!-- Form actions -->
        <div class="actions">
          <BaseButton variant="ghost" :to="{ name: 'customers' }">Cancel</BaseButton>
          <BaseButton variant="primary" type="submit">
            {{ isEdit ? 'Edit' : 'Create Customer' }}
          </BaseButton>
        </div>
      </form>
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

  &__title { font-size: 1.1rem; font-weight: 700; color: $color-text; }

  &__actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

/* Details on the left, avatar/summary on the right. */
.col--main { order: 1; }
.col--side { order: 2; }

@media (max-width: 900px) {
  .col--side { order: 1; }
  .col--main { order: 2; }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

/* Bottom action bar spanning both columns */
.actions {
  grid-column: 1 / -1;
  order: 3;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
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
    font-size: 0.74rem;
    color: $muted;
    text-align: center;

    &--left { text-align: left; }
  }

  &--avatar { text-align: center; }
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
  overflow: hidden;

  img { width: 100%; height: 100%; object-fit: cover; }

  &--photo { background: #eef0f3; }
  &--blue { background: #4f73c4; }
  &--green { background: #2f9d6b; }
  &--violet { background: #8b5cf6; }
  &--amber { background: #d99a2b; }
  &--rose { background: #d4567a; }
  &--slate { background: #5b6472; }

  &__name { margin: 0.75rem 0 0; font-size: 1rem; font-weight: 700; color: $color-text; }
  &__email { margin: 0.2rem 0 0; font-size: 0.8rem; color: $muted; }

  &__actions {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }
}

.photo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  color: #4a5160;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 9px;
  cursor: pointer;

  &:hover { background: #f6f7f9; }

  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

  &--ghost {
    color: #d14343;
    border-color: transparent;
    &:hover { background: #fdf2f2; }
  }
}

.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;

  & + & { border-top: 1px solid $divider; }

  &__label { font-size: 0.82rem; color: $muted; }
  &__value { font-size: 0.95rem; font-weight: 700; color: $color-text; }
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
  textarea {
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

  .field + .field { margin-top: 0; }

  @media (max-width: 620px) { grid-template-columns: 1fr; }
}

.segmented {
  display: inline-flex;
  gap: 0.4rem;
  flex-wrap: wrap;

  &__btn {
    padding: 0.5rem 1rem;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    color: #4a5160;
    background: #fff;
    border: 1px solid #e6e8ec;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover { background: #f6f7f9; }

    &.is-active { color: #1f242d; }
    &--active.is-active { background: #e6f7ee; border-color: #aee3c4; color: #1f9d57; }
    &--vip.is-active { background: #f1e9fe; border-color: #d6c2f7; color: #7c3aed; }
    &--inactive.is-active { background: #f1f3f5; border-color: #d8dce1; color: #4a5160; }
  }
}
</style>
