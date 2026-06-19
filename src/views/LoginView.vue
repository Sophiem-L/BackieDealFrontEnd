<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('admin@computershop.com')
const password = ref('')
const showPassword = ref(false)
const remember = ref(true)

function handleSubmit() {
  // TODO: wire up real authentication.
  router.push('/')
}
</script>

<template>
  <div class="login">
    <div class="login__inner">
      <!-- Brand -->
      <div class="login__brand">
        <img src="/image/logo-text.png" alt="Beckie Deal" class="login__logo" />
      </div>

      <header class="login__heading">
        <h1>Computer Shop Admin</h1>
        <p>Control Center Access</p>
      </header>

      <!-- Card -->
      <form class="card" @submit.prevent="handleSubmit">
        <div class="card__intro">
          <h2>Welcome back</h2>
          <p>Please enter your credentials to continue</p>
        </div>

        <div class="field">
          <label for="email">Email Address</label>
          <div class="field__control">
            <span class="field__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div class="field">
          <div class="field__label-row">
            <label for="password">Password</label>
            <a href="#" class="field__link">Forgot password?</a>
          </div>
          <div class="field__control">
            <span class="field__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-linecap="round" />
              </svg>
            </span>
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Enter your password"
            />
            <button
              type="button"
              class="field__toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" viewBox="0 0 24 24" fill="none">
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

        <label class="remember">
          <input v-model="remember" type="checkbox" />
          <span>Remember this device for 30 days</span>
        </label>

        <button type="submit" class="card__submit">Sign In to Dashboard</button>
      </form>

      <!-- Footer -->
      <footer class="login__footer">
        <a href="#">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.25-.9.6-.9 1.2v.5" stroke-linecap="round" />
            <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          Support
        </a>
        <a href="#">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" stroke-linejoin="round" />
          </svg>
          Security Policy
        </a>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
$accent: #f6d916;
$muted: #8a909c;

.login {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing * 2;
  background: #f4f5f7;

  &__inner {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__brand {
    margin-bottom: 1.25rem;
  }

  &__logo {
    height: 56px;
    width: auto;
    display: block;
  }

  &__heading {
    text-align: center;
    margin-bottom: 1.75rem;

    h1 {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 700;
      color: $color-text;
    }

    p {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
      color: $muted;
    }
  }

  &__footer {
    margin-top: 1.5rem;
    display: flex;
    gap: 1.5rem;

    a {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      color: $muted;

      &:hover {
        color: $color-text;
        text-decoration: none;
      }

      svg {
        width: 15px;
        height: 15px;
        stroke: currentColor;
        stroke-width: 1.6;
      }
    }
  }
}

.card {
  width: 100%;
  background: #ffffff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 1.75rem;
  box-shadow: 0 12px 30px rgba(20, 23, 28, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;

  &__intro {
    h2 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: $color-text;
    }

    p {
      margin: 0.3rem 0 0;
      font-size: 0.82rem;
      color: $muted;
    }
  }

  &__submit {
    margin-top: 0.4rem;
    width: 100%;
    padding: 0.85rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: #1f242d;
    background: $accent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: filter 0.15s ease;

    &:hover {
      filter: brightness(0.96);
      border-color: transparent;
    }
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4a5160;
  }

  &__label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__link {
    font-size: 0.75rem;
    font-weight: 600;
    color: #c9a800;
    text-transform: none;
    letter-spacing: 0;

    &:hover {
      text-decoration: none;
    }
  }

  &__control {
    position: relative;
    display: flex;
    align-items: center;
    background: #f7f8fa;
    border: 1px solid #e6e8ec;
    border-radius: 10px;
    transition: border-color 0.15s ease, background-color 0.15s ease;

    &:focus-within {
      border-color: $accent;
      background: #fffefa;
    }
  }

  &__icon {
    display: inline-flex;
    padding-left: 0.85rem;
    color: $muted;

    svg {
      width: 17px;
      height: 17px;
      stroke: currentColor;
      stroke-width: 1.7;
    }
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.7rem 0.75rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: $color-text;

    &:focus {
      outline: none;
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    padding: 0 0.85rem;
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

.remember {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.82rem;
  color: #4a5160;
  cursor: pointer;

  input {
    width: 15px;
    height: 15px;
    accent-color: $accent;
    cursor: pointer;
  }
}
</style>
