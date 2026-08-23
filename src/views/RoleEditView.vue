<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { roles as initialRoles } from '@/data/roles'

const router = useRouter()
const route = useRoute()
const roleId = route.params.id

const form = ref({
  name: '',
  description: '',
  status: 1, // 1 for Active, 2 for Inactive
})

const loading = ref(false)
const errors = ref({})

// Fetch or mock existing role data on mount based on the ID from the URL
onMounted(() => {
  const existingRole = initialRoles.find(r => r.id == roleId)
  if (existingRole) {
    form.value.name = existingRole.name
    form.value.description = existingRole.description || ''
    form.value.status = existingRole.status || 1
  }
})

function goBack() {
  router.push('/roles')
}

function handleUpdate() {
  loading.value = true
  errors.value = {}

  // Simulate update submission (ready for backend PUT/PATCH API integration later)
  setTimeout(() => {
    loading.value = false
    console.log(`Role ${roleId} updated:`, form.value)
    router.push('/roles')
  }, 600)
}
</script>

<template>
  <div class="page">
    <AppHeader title="Edit Custom Role" />

    <div class="page__body">
      <!-- Header -->
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">Update Role Information</h2>
          <p class="head__subtitle">Modify the name, description, or status for this administrative role.</p>
        </div>
      </section>

      <!-- Form Card -->
      <section class="form-card">
        <form @submit.prevent="handleUpdate" class="form">
          <div class="form__group">
            <label class="form__label" for="role-name">
              Role Name <span class="required">*</span>
            </label>
            <input
              id="role-name"
              v-model="form.name"
              type="text"
              class="form__input"
              placeholder="e.g. Content Manager"
              required
            />
          </div>

          <div class="form__group">
            <label class="form__label" for="role-description">Description</label>
            <textarea
              id="role-description"
              v-model="form.description"
              class="form__textarea"
              placeholder="Briefly describe what this role is responsible for..."
              rows="3"
            ></textarea>
          </div>

          <div class="form__group">
            <label class="form__label" for="role-status">Status</label>
            <select id="role-status" v-model="form.status" class="form__select">
              <option :value="1">Active</option>
              <option :value="2">Inactive</option>
            </select>
          </div>

          <div class="form__actions">
            <BaseButton variant="secondary" type="button" @click="goBack">
              Cancel
            </BaseButton>
            <BaseButton variant="primary" type="submit" :disabled="loading">
              {{ loading ? 'Updating...' : 'Update Role' }}
            </BaseButton>
          </div>
        </form>
      </section>
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
  width: 100%;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    box-sizing: border-box;
  }
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #111827;
  }

  &__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: $muted;
  }
}

.form-card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.5rem;
  width: 100%;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;

  &__group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #4a5160;

    .required {
      color: #e53e3e;
    }
  }

  &__input,
  &__textarea,
  &__select {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    font-family: inherit;
    border: 1px solid $divider;
    border-radius: 8px;
    outline: none;
    background: #fff;
    color: #111827;
    width: 100%;

    &:focus {
      border-color: #2563eb;
    }
  }

  &__textarea {
    resize: vertical;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
    border-top: 1px solid $divider;
    padding-top: 1.25rem;
  }
}
</style>