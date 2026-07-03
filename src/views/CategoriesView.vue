<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'

const router = useRouter()
const search = ref('')

function openCategory(cat) {
  router.push({ name: 'category-detail', params: { id: cat.key }, query: { name: cat.name } })
}

function editCategory(cat) {
  router.push({
    name: 'category-detail',
    params: { id: cat.key },
    query: { name: cat.name, edit: '1' },
  })
}

function deleteCategory(cat) {
  if (!window.confirm(`Delete category "${cat.name}"? This action cannot be undone.`)) return
  categories.value = categories.value.filter((c) => c.key !== cat.key)
}

// Catalogue categories. `tone` selects the cover gradient; drop an `image`
// field (URL) on any entry to use a real photo as the cover instead.
const categories = ref([
  { key: 'graphics-cards', name: 'Graphics Cards', icon: 'gpu', tone: 'slate', products: 42, updated: '2h ago' },
  { key: 'processors', name: 'Processors', icon: 'cpu', tone: 'blue', products: 28, updated: '2h ago' },
  { key: 'motherboards', name: 'Motherboards', icon: 'mobo', tone: 'green', products: 35, updated: '2h ago' },
  { key: 'memory', name: 'Memory & RAM', icon: 'ram', tone: 'violet', products: 112, updated: '2h ago' },
  { key: 'storage', name: 'Storage (SSD/HDD)', icon: 'storage', tone: 'cyan', products: 85, updated: '2h ago' },
  { key: 'power-supplies', name: 'Power Supplies', icon: 'psu', tone: 'amber', products: 18, updated: '2h ago' },
  { key: 'cases', name: 'PC Cases', icon: 'case', tone: 'neutral', products: 22, updated: '2h ago' },
  { key: 'cooling', name: 'Cooling Systems', icon: 'cooling', tone: 'teal', products: 45, updated: '2h ago' },
  { key: 'peripherals', name: 'Peripherals', icon: 'peripherals', tone: 'warm', products: 156, updated: '2h ago' },
])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter((c) => c.name.toLowerCase().includes(q))
})
</script>

<template>
  <div class="page">
    <AppHeader title="Manage Categories" />

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
          <input v-model="search" type="search" placeholder="Search categories..." />
        </label>

        <div class="toolbar__spacer"></div>

        <BaseButton variant="primary" :to="{ name: 'category-create' }">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          </template>
          New Category
        </BaseButton>
      </section>

      <!-- Category grid -->
      <section class="grid">
        <article
          v-for="cat in filtered"
          :key="cat.key"
          class="cat"
          tabindex="0"
          @click="openCategory(cat)"
          @keyup.enter="openCategory(cat)"
        >
          <div
            class="cat__media"
            :class="`cat__media--${cat.tone}`"
            :style="cat.image ? { backgroundImage: `url(${cat.image})` } : null"
          >
            <!-- Faded watermark glyph stands in for a product photo -->
            <span class="cat__glyph" aria-hidden="true">
              <CategoryIcon :name="cat.icon" />
            </span>

            <div class="cat__label">
              <span class="cat__icon" aria-hidden="true">
                <CategoryIcon :name="cat.icon" />
              </span>
              <h3 class="cat__name">{{ cat.name }}</h3>
            </div>
          </div>

          <div class="cat__body">
            <div class="cat__info">
              <p class="cat__count">{{ cat.products }} Products</p>
              <p class="cat__updated">Updated {{ cat.updated }}</p>
            </div>
            <div class="cat__actions">
              <button
                type="button"
                class="icon-btn"
                title="Edit category"
                aria-label="Edit category"
                @click.stop="editCategory(cat)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                  <path d="M13.5 6.5l3 3" stroke-linecap="round" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn--danger"
                title="Delete category"
                aria-label="Delete category"
                @click.stop="deleteCategory(cat)"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </article>

        <p v-if="filtered.length === 0" class="empty">No categories match "{{ search }}".</p>
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
  }
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: #f4f5f7;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within { background: #fff; border-color: #e6e8ec; }
  }

  &__search-icon {
    display: inline-flex;
    color: $muted;
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
    color: $color-text;
    &:focus { outline: none; }
  }
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;

  @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

/* Category card */
.cat {
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;

  &:hover, &:focus-visible {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px rgba(20, 23, 28, 0.1);
    border-color: #e2e5ea;
    outline: none;
  }

  &__media {
    position: relative;
    height: 150px;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: flex-end;
    overflow: hidden;

    // Dark scrim so the white label stays readable over any cover.
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(15, 17, 21, 0.82) 0%, rgba(15, 17, 21, 0.15) 55%, rgba(15, 17, 21, 0.05) 100%);
    }

    // Tone gradients (used when no cover image is set).
    &--slate { background-image: linear-gradient(135deg, #2b2f3a, #15171d); }
    &--blue { background-image: linear-gradient(135deg, #28333f, #141a21); }
    &--green { background-image: linear-gradient(135deg, #2c382a, #161d15); }
    &--violet { background-image: linear-gradient(135deg, #352b3a, #1d1722); }
    &--cyan { background-image: linear-gradient(135deg, #273841, #131e24); }
    &--amber { background-image: linear-gradient(135deg, #3a3325, #211c12); }
    &--neutral { background-image: linear-gradient(135deg, #2e2e33, #18181c); }
    &--teal { background-image: linear-gradient(135deg, #27393a, #132122); }
    &--warm { background-image: linear-gradient(135deg, #382f29, #201913); }
  }

  &__glyph {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    color: #fff;
    opacity: 0.12;

    svg { width: 76px; height: 76px; stroke: currentColor; stroke-width: 1.4; }
  }

  &__label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 1rem;
  }

  &__icon {
    display: inline-flex;
    color: $accent;
    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }

  &__body {
    padding: 1rem 1.1rem 1.1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &__info { min-width: 0; }

  &__actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  &__count {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: $color-text;
  }

  &__updated {
    margin: 0.3rem 0 0;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $muted;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;

  &:hover { background: #f6f7f9; color: $color-text; border-color: #dfe2e7; }

  &--danger:hover { background: #fdf2f2; color: #d14343; border-color: #f0c9c9; }

  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
}

.empty {
  grid-column: 1 / -1;
  margin: 0;
  padding: 3rem 1rem;
  text-align: center;
  color: $muted;
  font-size: 0.9rem;
}
</style>
