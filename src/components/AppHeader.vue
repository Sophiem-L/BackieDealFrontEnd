<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

// Reusable top bar. Any page renders <AppHeader title="..." /> to get the
// search field, notifications and the profile chip that links to /profile.
const props = defineProps({
  title: { type: String, required: true },
  userName: { type: String, default: 'Admin User' },
  userRole: { type: String, default: 'Administrator' },
  avatar: { type: String, default: '' },
  notifications: { type: Boolean, default: true },
})

const initials = computed(() =>
  props.userName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)
</script>

<template>
  <header class="header">
    <div class="header__lead">
      <button
        type="button"
        class="header__toggle"
        aria-label="Toggle sidebar"
        @click="ui.toggleSidebar()"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
        </svg>
      </button>
      <h1 class="header__title">{{ title }}</h1>
    </div>

    <div class="header__actions">
      <label class="search">
        <span class="search__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" stroke-linecap="round" />
          </svg>
        </span>
        <input type="search" placeholder="Search everything..." />
      </label>

      <button type="button" class="bell" aria-label="Notifications">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke-linejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" stroke-linecap="round" />
        </svg>
        <span v-if="notifications" class="bell__dot" aria-hidden="true"></span>
      </button>

      <RouterLink to="/profile" class="profile" title="Account settings">
        <span class="profile__meta">
          <span class="profile__name">{{ userName }}</span>
          <span class="profile__role">{{ userRole }}</span>
        </span>
        <span class="profile__avatar">
          <img v-if="avatar" :src="avatar" :alt="userName" />
          <span v-else>{{ initials }}</span>
        </span>
      </RouterLink>
    </div>
  </header>
</template>

<style scoped lang="scss">
$muted: #8a909c;
$divider: #eef0f3;

.header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.5rem;
  background: #ffffff;
  border-bottom: 1px solid $divider;

  &__lead {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    flex-shrink: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #4a5160;
    cursor: pointer;

    &:hover {
      background: #f4f5f7;
      border-color: transparent;
    }

    svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
  }

  &__title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: $color-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .search {
    display: none;
  }
  .profile__meta {
    display: none !important;
  }
}

.search {
  display: flex;
  align-items: center;
  width: 280px;
  max-width: 32vw;
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

    svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 1.8;
    }
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

    &:focus {
      outline: none;
    }
  }
}

.bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  background: #f4f5f7;
  border: none;
  border-radius: 50%;
  color: #4a5160;
  cursor: pointer;

  &:hover {
    background: #eceef1;
    border-color: transparent;
  }

  svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 1.7;
  }

  &__dot {
    position: absolute;
    top: 9px;
    right: 10px;
    width: 7px;
    height: 7px;
    background: #f4c10f;
    border: 1.5px solid #fff;
    border-radius: 50%;
  }
}

.profile {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.4rem 0.3rem 0.6rem;
  border-radius: 999px;

  &:hover {
    background: #f4f5f7;
    text-decoration: none;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.2;
  }

  &__name {
    font-size: 0.82rem;
    font-weight: 700;
    color: $color-text;
  }

  &__role {
    font-size: 0.72rem;
    color: $muted;
  }

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: #35495e;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
