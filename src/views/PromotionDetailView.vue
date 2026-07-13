<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { findPromotion } from '@/data/promotions'

const route = useRoute()
const router = useRouter()

const promo = computed(() => findPromotion(route.params.id))

const statusLabels = { active: 'Active', paused: 'Paused', expired: 'Expired' }

const usageText = computed(() => {
  if (!promo.value) return ''
  return `${promo.value.used} / ${promo.value.limit ?? '∞'}`
})

const usagePercent = computed(() => {
  if (!promo.value || !promo.value.limit) return 0
  return Math.min(100, Math.round((promo.value.used / promo.value.limit) * 100))
})

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'promotions' })
}
</script>

<template>
  <div class="page">
    <AppHeader title="Promotion Detail" />

    <div class="page__body">
      <!-- Sub header -->
      <div class="subhead">
        <button type="button" class="back-btn" aria-label="Back to promotions" @click="goBack">
          <svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <h2 class="subhead__title">Promotion Detail</h2>
      </div>

      <!-- Not found -->
      <section v-if="!promo" class="empty">
        <p>This promotion could not be found.</p>
        <BaseButton variant="ghost" :to="{ name: 'promotions' }">Back to Promotions</BaseButton>
      </section>

      <div v-else class="grid">
        <!-- Main column -->
        <div class="col col--main">
          <!-- Banner hero -->
          <section class="hero" :style="{ background: promo.banner }">
            <span class="hero__status" :class="`hero__status--${promo.status}`">{{ statusLabels[promo.status] }}</span>
            <h3 class="hero__name">{{ promo.name }}</h3>
            <div class="hero__tags">
              <span class="chip">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 4 12V5a1 1 0 0 1 1-1h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" stroke-linejoin="round" />
                </svg>
                {{ promo.benefitType }}
              </span>
              <span class="chip">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 9h18M8 3v4M16 3v4" stroke-linecap="round" />
                </svg>
                {{ promo.period }}
              </span>
            </div>
          </section>

          <!-- Details -->
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">Details</h3>
            </header>
            <dl class="kv">
              <div class="kv__row"><dt>Promo Code</dt><dd class="kv__mono">{{ promo.code }}</dd></div>
              <div class="kv__row"><dt>Promotion Type</dt><dd>{{ promo.benefitType }}</dd></div>
              <div class="kv__row"><dt>Benefit</dt><dd class="kv__benefit">{{ promo.benefit }}</dd></div>
              <div class="kv__row"><dt>Active Period</dt><dd>{{ promo.period }}</dd></div>
              <div class="kv__row"><dt>Status</dt><dd>{{ statusLabels[promo.status] }}</dd></div>
            </dl>

            <template v-if="promo.description">
              <p class="card__subtitle">Description</p>
              <p class="description">{{ promo.description }}</p>
            </template>
          </section>
        </div>

        <!-- Side column -->
        <div class="col col--side">
          <section class="card">
            <header class="card__head">
              <h3 class="card__title">Usage</h3>
            </header>
            <div class="usage">
              <div class="usage__head">
                <span>Redemptions</span>
                <span class="usage__value">{{ usageText }}</span>
              </div>
              <div class="usage__bar">
                <div class="usage__fill" :style="{ width: usagePercent + '%' }"></div>
              </div>
              <p class="usage__note">
                {{ promo.limit ? `${usagePercent}% of the ${promo.limit} limit used` : 'No usage limit' }}
              </p>
            </div>
          </section>

          <section class="card">
            <header class="card__head">
              <h3 class="card__title">Benefit</h3>
            </header>
            <p class="big-benefit">{{ promo.benefit }}</p>
            <p class="card__hint">{{ promo.benefitType }}</p>
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

/* Sub header */
.subhead {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  &__title { margin: 0; font-size: 1.2rem; font-weight: 700; color: $color-text; }
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  flex-shrink: 0;
  background: #f4f5f7;
  border: none;
  border-radius: 9px;
  color: #4a5160;
  cursor: pointer;
  &:hover { background: #eceef1; }
  svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.9; }
}

/* Layout */
.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 980px) { grid-template-columns: 1fr; }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

/* Banner hero */
.hero {
  position: relative;
  border-radius: 14px;
  padding: 1.75rem 1.5rem;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;

  &__status {
    position: absolute;
    top: 1rem;
    right: 1rem;
    padding: 0.22rem 0.6rem;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 999px;
    color: #fff;

    &--active { background: #1f9d57; }
    &--paused { background: #d99413; }
    &--expired { background: #6b7280; }
  }

  &__name {
    margin: 0 0 0.6rem;
    font-size: 1.5rem;
    font-weight: 800;
    color: #fff;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  }

  &__tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 7px;
  padding: 0.28rem 0.6rem;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  backdrop-filter: blur(2px);

  svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 1.8; }
}

/* Cards */
.card {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;

  &__head { margin-bottom: 0.9rem; }

  &__title {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
  }

  &__subtitle {
    margin: 1.1rem 0 0.4rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b7280;
  }

  &__hint { margin: 0.35rem 0 0; font-size: 0.78rem; color: $muted; }
}

.kv {
  margin: 0;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    font-size: 0.86rem;

    & + & { border-top: 1px solid $divider; }

    dt { margin: 0; color: $muted; }
    dd { margin: 0; font-weight: 600; color: $color-text; text-align: right; }
  }

  &__mono { font-family: ui-monospace, monospace; }
  &__benefit { color: #a8850a !important; font-weight: 700 !important; }
}

.description {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.55;
  color: #4a5160;
}

/* Usage */
.usage {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #4a5160;
    margin-bottom: 0.5rem;
  }

  &__value { color: #a8850a; }

  &__bar {
    height: 8px;
    border-radius: 999px;
    background: #eceef1;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    background: $accent;
    transition: width 0.2s ease;
  }

  &__note { margin: 0.6rem 0 0; font-size: 0.76rem; color: $muted; }
}

.big-benefit {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: #a8850a;
}

/* Empty state */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 1.5rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  color: $muted;
  font-size: 0.9rem;
}
</style>
