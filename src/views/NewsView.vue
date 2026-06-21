<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import { newsArticles } from '@/data/news'

const router = useRouter()

const statusLabels = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
}

const statusFilter = ref('all')
const statusFilters = [
  { value: 'all', label: 'All Articles' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
]

const filtered = computed(() =>
  statusFilter.value === 'all'
    ? newsArticles
    : newsArticles.filter((a) => a.status === statusFilter.value),
)

function addArticle() {
  router.push('/news/new')
}

function editArticle(article) {
  router.push(`/news/${article.id}/edit`)
}

function deleteArticle(article) {
  // TODO: confirm + delete `article` via the news API.
  void article
}
</script>

<template>
  <div class="page">
    <AppHeader title="Content: News" />

    <div class="page__body">
      <!-- Section heading + primary action -->
      <section class="head">
        <div class="head__text">
          <h2 class="head__title">News & Articles</h2>
          <p class="head__subtitle">Publish updates, guides and announcements for your storefront.</p>
        </div>

        <BaseButton variant="primary" @click="addArticle">
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
          </template>
          Add New Article
        </BaseButton>
      </section>

      <!-- Status filter -->
      <section class="filters">
        <button
          v-for="opt in statusFilters"
          :key="opt.value"
          type="button"
          class="filter"
          :class="{ 'filter--active': statusFilter === opt.value }"
          @click="statusFilter = opt.value"
        >
          {{ opt.label }}
        </button>
      </section>

      <!-- Articles list -->
      <section class="articles">
        <article v-for="item in filtered" :key="item.id" class="news">
          <div class="news__body">
            <div class="news__meta">
              <span class="badge" :class="`badge--${item.status}`">
                {{ statusLabels[item.status] }}
              </span>
              <span class="news__category">{{ item.category }}</span>
            </div>
            <h3 class="news__title">{{ item.title }}</h3>
            <p class="news__excerpt">{{ item.excerpt }}</p>
            <div class="news__footer">
              <span class="news__byline">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20a7 7 0 0 1 14 0" stroke-linecap="round" />
                </svg>
                {{ item.author }}
              </span>
              <span class="news__dot" aria-hidden="true">·</span>
              <span class="news__date">{{ item.date }}</span>
              <span v-if="item.status === 'published'" class="news__dot" aria-hidden="true">·</span>
              <span v-if="item.status === 'published'" class="news__views">
                {{ item.views.toLocaleString() }} views
              </span>
            </div>
          </div>

          <div class="news__actions">
            <button
              type="button"
              class="icon-btn"
              :aria-label="`Edit ${item.title}`"
              @click="editArticle(item)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke-linejoin="round" />
                <path d="m13.5 6.5 4 4" stroke-linecap="round" />
              </svg>
            </button>

            <button
              type="button"
              class="icon-btn icon-btn--danger"
              :aria-label="`Delete ${item.title}`"
              @click="deleteArticle(item)"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M10 11v6M14 11v6" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </article>

        <p v-if="filtered.length === 0" class="articles__empty">No articles match this filter.</p>
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

/* Section heading */
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
    color: $color-text;
  }

  &__subtitle {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
    color: $muted;
  }
}

/* Status filter pills */
.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter {
  padding: 0.45rem 0.9rem;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: #4a5160;
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { background: #f6f7f9; }

  &--active {
    background: rgba($accent, 0.16);
    border-color: transparent;
    color: #1f242d;
  }
}

/* Articles list */
.articles {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__empty {
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

.news {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: #fff;
  border: 1px solid $divider;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: #e1e4e9;
    box-shadow: 0 2px 10px rgba(20, 23, 28, 0.05);
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  &__category {
    font-size: 0.74rem;
    font-weight: 600;
    color: $muted;
  }

  &__title {
    margin: 0.5rem 0 0.3rem;
    font-size: 1.02rem;
    font-weight: 700;
    color: $color-text;
  }

  &__excerpt {
    margin: 0;
    font-size: 0.85rem;
    color: #4a5160;
    line-height: 1.45;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.7rem;
    font-size: 0.78rem;
    color: $muted;
  }

  &__byline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
    color: #4a5160;

    svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__dot { color: #c4c9d1; }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
}

/* Status badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 6px;
  white-space: nowrap;

  &--published { color: #1c8c4a; background: #e7f6ed; }
  &--scheduled { color: #2563c9; background: #eaf1fd; }
  &--draft { color: #6b7280; background: #f1f3f5; }
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
</style>
