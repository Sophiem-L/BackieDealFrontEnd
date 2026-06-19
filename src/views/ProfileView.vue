<script setup>
import { reactive, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'

const profile = reactive({
  fullName: 'Super Admin',
  email: 'system-admin@computershop.com',
  phone: '+1 (555) 000-0000',
  position: '',
})

const passwords = reactive({
  current: 'placeholder12',
  next: '',
  confirm: '',
})

const showCurrent = ref(false)

function saveProfile() {
  // TODO: persist profile changes via API.
}

function updatePassword() {
  // TODO: submit password change via API.
}

function logout() {
  // TODO: clear session and redirect to /login.
}
</script>

<template>
  <div class="page">
    <AppHeader title="My Account Settings" />

    <div class="page__body">
      <!-- Identity strip -->
      <section class="identity">
        <span class="identity__avatar">SA</span>
        <div class="identity__meta">
          <h2>{{ profile.fullName }}</h2>
          <p>{{ profile.email }}</p>
        </div>
        <div class="identity__actions">
          <button type="button" class="btn btn--ghost" @click="logout">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M10 8l-4 4 4 4M6 12h11" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Logout
          </button>
          <button type="button" class="btn btn--primary" @click="saveProfile">Save Profile</button>
        </div>
      </section>

      <!-- Personal information -->
      <section class="card">
        <h3 class="card__title">Personal Information</h3>
        <div class="grid">
          <div class="field">
            <label for="fullName">Full Name</label>
            <input id="fullName" v-model="profile.fullName" type="text" />
          </div>
          <div class="field">
            <label for="email">Email Address</label>
            <input id="email" v-model="profile.email" type="email" />
          </div>
          <div class="field">
            <label for="phone">Phone Number</label>
            <input id="phone" v-model="profile.phone" type="tel" />
          </div>
          <div class="field">
            <label for="position">Position / Title</label>
            <input id="position" v-model="profile.position" type="text" placeholder="System Administrator" />
          </div>
        </div>
      </section>

      <!-- Security -->
      <section class="card">
        <h3 class="card__title card__title--lock">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-linecap="round" />
          </svg>
          Security &amp; Password
        </h3>

        <div class="field field--narrow">
          <label for="current">Current Password</label>
          <div class="field__control">
            <input
              id="current"
              v-model="passwords.current"
              :type="showCurrent ? 'text' : 'password'"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="field__toggle"
              :aria-label="showCurrent ? 'Hide password' : 'Show password'"
              @click="showCurrent = !showCurrent"
            >
              <svg v-if="showCurrent" viewBox="0 0 24 24" fill="none">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <path d="M3 3l18 18" stroke-linecap="round" />
                <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4-.85" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div class="field field--narrow">
          <label for="newPassword">New Password</label>
          <input id="newPassword" v-model="passwords.next" type="password" autocomplete="new-password" />
        </div>

        <div class="field field--narrow">
          <label for="confirmPassword">Confirm New Password</label>
          <input id="confirmPassword" v-model="passwords.confirm" type="password" autocomplete="new-password" />
        </div>

        <button type="button" class="btn btn--outline" @click="updatePassword">Update Password</button>
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

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
  }
}

.identity {
  display: flex;
  align-items: center;
  gap: 1rem;

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: $radius;
    background: #35495e;
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__meta {
    flex: 1;
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: $color-text;
    }

    p {
      margin: 0.2rem 0 0;
      font-size: 0.85rem;
      color: $muted;
    }
  }

  &__actions {
    display: flex;
    gap: 0.6rem;
  }
}

.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.5rem;

  &__title {
    margin: 0 0 1.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;

    &--lock {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      svg {
        width: 16px;
        height: 16px;
        stroke: $accent;
        stroke-width: 1.8;
      }
    }
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.1rem 1.5rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & + .field {
    margin-top: 1.1rem;
  }

  &--narrow {
    max-width: 360px;
  }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4a5160;
  }

  input {
    width: 100%;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: $color-text;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder {
      color: #b4b9c2;
    }

    &:focus {
      outline: none;
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }
  }

  &__control {
    position: relative;
    display: flex;
    align-items: center;
    background: #f4f5f7;
    border: 1px solid #e6e8ec;
    border-radius: 10px;

    &:focus-within {
      border-color: $accent;
      box-shadow: 0 0 0 3px rgba($accent, 0.18);
    }

    input {
      border: none;
      background: transparent;
      box-shadow: none;

      &:focus {
        box-shadow: none;
      }
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    padding: 0 0.8rem;
    background: transparent;
    border: none;
    color: $muted;
    cursor: pointer;

    &:hover {
      color: $color-text;
      border-color: transparent;
    }

    svg {
      width: 17px;
      height: 17px;
      stroke: currentColor;
      stroke-width: 1.7;
    }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter 0.15s ease, background-color 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.8;
  }

  &--primary {
    background: $accent;
    color: #1f242d;

    &:hover {
      filter: brightness(0.96);
      border-color: transparent;
    }
  }

  &--ghost {
    background: #fff;
    border-color: #e6e8ec;
    color: #d14343;

    &:hover {
      background: #fff5f5;
      border-color: #f0c9c9;
    }
  }

  &--outline {
    background: #fff;
    border-color: $accent;
    color: #a8850a;

    &:hover {
      background: rgba($accent, 0.12);
      border-color: $accent;
    }
  }
}
</style>
