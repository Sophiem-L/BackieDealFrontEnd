<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { deletePromotion as removePromotion, fetchPromotions } from '@/services/promotions'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()

const auth = useAuthStore()
const promotions = ref([])
const loading = ref(false)
const error = ref('')
const deletingId = ref(null)
const search = ref('')

const filteredPromotions = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return promotions.value
  return promotions.value.filter((promotion) =>
    [promotion.name, promotion.code].some((value) => value?.toLowerCase().includes(term)),
  )
})

const statusLabels = { active: 'Active', paused: 'Paused', expired: 'Expired' }

function usageText(promo) {
  return `${promo.used}/${promo.limit ?? '∞'}`
}

function viewPromotion(promo) {
  router.push({ name: 'promotion-detail', params: { id: promo.id } })
}

function editPromotion(promo) {
  router.push({ name: 'promotion-edit', params: { id: promo.id } })
}

async function loadPromotions() {
  loading.value = true
  error.value = ''
  try {
    promotions.value = await fetchPromotions(auth.accessToken)
  } catch (err) {
    error.value = err.message || 'Could not load promotions.'
  } finally {
    loading.value = false
  }
}

async function deletePromotion(promo) {
  if (!window.confirm(`Delete ${promo.name}?`)) return

  deletingId.value = promo.id
  error.value = ''
  try {
    await removePromotion(promo.id, auth.accessToken)
    promotions.value = promotions.value.filter((item) => item.id !== promo.id)
  } catch (err) {
    error.value = err.message || 'Could not delete the promotion.'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadPromotions)
</script>

<template>
  <div class="page">
    <AppHeader title="Promotions & Campaigns" />

    <div class="page__body">
      <!-- Toolbar -->
      <section class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" stroke-linecap="round" />
            </svg>
          </span>
          <input v-model="search" type="search" placeholder="Search promotion name or code..." />
        </label>

        <div class="select">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" stroke-linejoin="round" />
          </svg>
          Active Only
          <svg class="select__caret" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="primary" :to="{ name: 'promotion-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          New Promotion
        </BaseButton>
      </section>

      <!-- Cards grid -->
      <p v-if="error" class="load-error">{{ error }} <button type="button" class="retry-btn" @click="loadPromotions">Retry</button></p>
      <p v-else-if="loading" class="load-error">Loading promotions…</p>

      <section v-else class="grid">
        <article
          v-for="promo in filteredPromotions"
          :key="promo.id"
          class="promo"
          role="button"
          tabindex="0"
          @click="viewPromotion(promo)"
          @keydown.enter="viewPromotion(promo)"
        >
          <div class="promo__banner" :style="{ background: promo.banner }">
            <span class="promo__status" :class="`promo__status--${promo.status}`">
              {{ statusLabels[promo.status] }}
            </span>
            <div class="promo__overlay">
              <h3 class="promo__name">{{ promo.name }}</h3>
              <div class="promo__tags">
                <span class="chip chip--dark">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 4 12V5a1 1 0 0 1 1-1h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" stroke-linejoin="round" />
                  </svg>
                  {{ promo.benefitType }}
                </span>
                <span class="chip chip--dark">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke-linecap="round" />
                  </svg>
                  {{ promo.period }}
                </span>
              </div>
            </div>
          </div>

          <div class="promo__body">
            <div class="promo__metrics">
              <div>
                <p class="promo__label">Benefit</p>
                <p class="promo__benefit">{{ promo.benefit }}</p>
              </div>
              <div class="promo__usage">
                <p class="promo__label">Usage</p>
                <p class="promo__usage-value">{{ usageText(promo) }}</p>
              </div>
            </div>

            <div class="promo__footer">
              <div class="promo__actions">
                <BaseButton variant="ghost" size="sm" @click.stop="editPromotion(promo)">
                  <template #icon>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                      <path d="M13.5 6.5l3 3" stroke-linecap="round" />
                    </svg>
                  </template>
                  Edit
                </BaseButton>
                <button
                  type="button"
                  class="icon-btn icon-btn--danger"
                  aria-label="Delete promotion"
                  :disabled="deletingId === promo.id"
                  @click.stop="deletePromotion(promo)"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">

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
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 220px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within { background: var(--surface); border-color: var(--border); }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__spacer { flex: 1; }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--text-strong);
    &:focus { outline: none; }
  }
}

.select {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-body);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;

  svg { width: 14px; height: 14px; stroke: var(--text-subtle); stroke-width: 1.8; }
  &__caret { margin-left: 0.1rem; }
}

/* Cards */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;

  @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

.promo {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: var(--border);
    box-shadow: 0 8px 24px rgba(20, 23, 28, 0.1);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: none;
    border-color: rgb(var(--accent-rgb));
    box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.3);
  }

  &__banner {
    position: relative;
    height: 140px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  &__status {
    position: absolute;
    top: 0.85rem;
    right: 0.85rem;
    padding: 0.2rem 0.6rem;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 999px;
    color: var(--ink-on-solid);

    &--active { background: var(--success-solid); }
    &--paused { background: var(--accent-ink); }
    &--expired { background: var(--neutral-solid); }
  }

  &__name {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--ink-on-solid);
    text-shadow: 0 1px 4px var(--backdrop);
  }

  &__tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }

  &__body {
    padding: 1rem 1.1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
  }

  &__metrics {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  &__usage { text-align: right; }

  &__label {
    margin: 0 0 0.25rem;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-subtle);
  }

  &__benefit {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--accent-ink);
  }

  &__usage-value {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-strong);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--border-subtle);
  }

  &__actions { display: flex; align-items: center; gap: 0.4rem; }
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 6px;
  padding: 0.22rem 0.5rem;

  svg { width: 12px; height: 12px; stroke: currentColor; stroke-width: 1.8; }

  &--dark {
    background: var(--backdrop);
    color: var(--ink-on-solid);
    backdrop-filter: blur(2px);
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;

  svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; }

  &--danger:hover {
    background: var(--danger-bg);
    color: var(--danger);
    border-color: var(--danger-border);
  }
}
</style>
