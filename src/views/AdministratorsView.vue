<script setup>
import { computed, reactive, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { administrators, nextAdministratorId } from '@/data/administrators'
import { roles } from '@/data/roles'

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return administrators
  return administrators.filter(
    (a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q),
  )
})

function initials(name) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function manageAdmin(admin) {
  // TODO: open settings flow for `admin`
  void admin
}

/* Create-user modal */
const showCreate = ref(false)
const form = reactive({ name: '', role: '' })

const canSubmit = computed(() => form.name.trim() && form.role)

function addAdmin() {
  form.name = ''
  form.role = roles[0]?.name || ''
  showCreate.value = true
}

function closeCreate() {
  showCreate.value = false
}

function submitCreate() {
  if (!canSubmit.value) return
  administrators.push({
    id: nextAdministratorId(),
    name: form.name.trim(),
    role: form.role,
    lastSeen: 'Just added',
    online: false,
    avatar: '',
  })
  closeCreate()
}
</script>

<template>
  <div class="page">
    <AppHeader title="Manage Administrators" />

    <div class="page__body">
      <!-- Toolbar: search + invite -->
      <section class="toolbar">
        <label class="search">
          <span class="search__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input v-model="search" type="search" placeholder="Search administrators..." />
        </label>

        <BaseButton variant="primary" @click="addAdmin">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke-linecap="round" />
              <circle cx="9.5" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" stroke-linecap="round" />
            </svg>
          </template>
          Add User
        </BaseButton>
      </section>

      <!-- Administrator cards -->
      <section class="grid">
        <article v-for="admin in filtered" :key="admin.id" class="card">
          <span class="card__avatar">
            <img v-if="admin.avatar" :src="admin.avatar" :alt="admin.name" />
            <span v-else>{{ initials(admin.name) }}</span>
          </span>

          <div class="card__body">
            <h3 class="card__name">{{ admin.name }}</h3>
            <div class="card__meta">
              <span class="badge">{{ admin.role }}</span>
              <span class="card__seen">
                <span
                  class="card__dot"
                  :class="{ 'card__dot--online': admin.online }"
                  aria-hidden="true"
                ></span>
                Last seen {{ admin.lastSeen }}
              </span>
            </div>
          </div>

          <div class="card__actions">
            <button
              type="button"
              class="icon-btn"
              :aria-label="`Settings for ${admin.name}`"
              @click="manageAdmin(admin)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </article>

        <p v-if="filtered.length === 0" class="grid__empty">
          No administrators match your search.
        </p>
      </section>
    </div>

    <!-- Create user modal -->
    <Teleport to="body">
      <div v-if="showCreate" class="modal" @click.self="closeCreate">
        <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
          <header class="modal__head">
            <h2 id="create-user-title" class="modal__title">Add User</h2>
            <button type="button" class="modal__close" aria-label="Close" @click="closeCreate">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <form class="modal__body" @submit.prevent="submitCreate">
            <label class="field">
              <span class="field__label">Full name</span>
              <input
                v-model="form.name"
                type="text"
                class="field__input"
                placeholder="e.g. Jane Doe"
                autofocus
              />
            </label>

            <label class="field">
              <span class="field__label">Role</span>
              <select v-model="form.role" class="field__input">
                <option v-for="role in roles" :key="role.id" :value="role.name">
                  {{ role.name }}
                </option>
              </select>
            </label>

            <footer class="modal__foot">
              <BaseButton variant="ghost" type="button" @click="closeCreate">Cancel</BaseButton>
              <BaseButton variant="primary" type="submit" :disabled="!canSubmit">Create User</BaseButton>
            </footer>
          </form>
        </div>
      </div>
    </Teleport>
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

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;
}

.search {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 220px;
  max-width: 420px;
  background: #f4f5f7;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0 0.85rem;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:focus-within {
    background: #fff;
    border-color: #e6e8ec;
  }

  &__icon {
    display: inline-flex;
    color: $muted;
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.5rem 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: $color-text;
    &:focus { outline: none; }
  }
}

/* Cards grid */
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;

  &__empty {
    grid-column: 1 / -1;
    margin: 0;
    text-align: center;
    color: $muted;
    font-size: 0.88rem;
    padding: 2.5rem 1rem;
    background: #fff;
    border: 1px solid $divider;
    border-radius: 14px;
  }
}

@media (max-width: 1200px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
}

.card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: #e1e4e9;
    box-shadow: 0 2px 10px rgba(20, 23, 28, 0.05);
  }

  &__avatar {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    background: #eef0f3;
    color: #6b7280;
    font-size: 0.85rem;
    font-weight: 700;

    img { width: 100%; height: 100%; object-fit: cover; }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin: 0 0 0.35rem;
    font-size: 0.98rem;
    font-weight: 700;
    color: $color-text;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  &__seen {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: $muted;
  }

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #c4c9d1;

    &--online { background: #34c759; }
  }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #2563c9;
  background: #eaf1fd;
  border-radius: 6px;
  white-space: nowrap;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  color: #4a5160;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { background: #f6f7f9; }

  svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.7; }

  &--danger {
    color: #d14343;
    &:hover { background: #fff5f5; border-color: #f0c9c9; }
  }
}

/* Create user modal */
.modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(20, 23, 28, 0.45);

  &__dialog {
    width: 100%;
    max-width: 420px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(20, 23, 28, 0.25);
    overflow: hidden;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    border-bottom: 1px solid $divider;
  }

  &__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: $color-text;
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: $muted;
    cursor: pointer;

    &:hover { background: #f4f5f7; color: $color-text; }

    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.25rem;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &__label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #4a5160;
  }

  &__input {
    width: 100%;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    padding: 0.6rem 0.75rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: $color-text;
    background: #fff;

    &:focus { outline: none; border-color: $accent; }
  }
}
</style>
