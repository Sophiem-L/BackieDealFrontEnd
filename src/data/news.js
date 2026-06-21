import { reactive } from 'vue'

// News / blog articles for the "Content: News" screen.
// Reactive, mock data (session-only — no backend news endpoint yet).
// `status` is one of published | scheduled | draft and drives the badge colour.
export const newsArticles = reactive([
  {
    id: 1,
    title: 'RTX 50-Series Pre-Orders Are Now Open',
    excerpt: 'Reserve the next generation of NVIDIA graphics cards before launch day stock runs out.',
    category: 'Product News',
    author: 'Editor Sarah',
    date: '18 Jun 2026',
    status: 'published',
    views: 2840,
  },
  {
    id: 2,
    title: 'How to Build Your First Gaming PC in 2026',
    excerpt: 'A step-by-step guide to picking parts, assembling, and cable-managing your dream rig.',
    category: 'Guides',
    author: 'Lead Tech Sarah',
    date: '12 Jun 2026',
    status: 'published',
    views: 1592,
  },
  {
    id: 3,
    title: 'Summer Cooling Tips for High-End Workstations',
    excerpt: 'Keep your workstation stable through the heat with these airflow and cooling upgrades.',
    category: 'Guides',
    author: 'Manager John',
    date: '25 Jun 2026',
    status: 'scheduled',
    views: 0,
  },
  {
    id: 4,
    title: 'Behind the Scenes: Our New Assembly Workshop',
    excerpt: 'A look inside the upgraded workshop where every custom build comes together.',
    category: 'Company',
    author: 'Super Admin',
    date: '—',
    status: 'draft',
    views: 0,
  },
])

export function findArticle(id) {
  return newsArticles.find((a) => a.id === Number(id)) || null
}

export function nextArticleId() {
  return newsArticles.reduce((max, a) => Math.max(max, a.id), 0) + 1
}
