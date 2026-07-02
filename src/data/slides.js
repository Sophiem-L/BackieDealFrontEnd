import { reactive } from 'vue'

// Homepage carousel slides for the "Content: Homepage Slides" screen.
// Reactive, mock data (session-only — no backend slides endpoint yet).
// `status` is one of active | scheduled | draft and drives the badge colour.
// `cta` is the call-to-action button label. `image` is an optional thumbnail
// URL; when empty the card falls back to the `gradient` placeholder.
export const slides = reactive([
  {
    id: 1,
    title: 'Ultimate Gaming Setup 2024',
    subtitle: 'Build your dream PC with RTX 40-series',
    status: 'active',
    cta: 'Shop Now',
    image: '',
    gradient: 'linear-gradient(135deg, #1b2a4a 0%, #6d28d9 100%)',
  },
  {
    id: 2,
    title: 'Student Laptop Deals',
    subtitle: 'Up to 20% off on MacBooks and ThinkPads',
    status: 'active',
    cta: 'View Deals',
    image: '',
    gradient: 'linear-gradient(135deg, #d9c7a8 0%, #8a6f4d 100%)',
  },
  {
    id: 3,
    title: 'Custom Water Cooling Kits',
    subtitle: 'Take your thermal performance to the next level',
    status: 'scheduled',
    cta: 'Learn More',
    image: '',
    gradient: 'linear-gradient(135deg, #7c1f9e 0%, #e0218a 100%)',
  },
  {
    id: 4,
    title: 'Old Season Clearance',
    subtitle: 'Everything must go - 50% off last gen parts',
    status: 'draft',
    cta: 'Clearance',
    image: '',
    gradient: 'linear-gradient(135deg, #b08968 0%, #7f5539 100%)',
  },
])

export function findSlide(id) {
  return slides.find((s) => s.id === Number(id)) || null
}

export function nextSlideId() {
  return slides.reduce((max, s) => Math.max(max, s.id), 0) + 1
}

// Append a new slide and return it. `data` provides the editable fields.
export function createSlide(data) {
  const slide = {
    id: nextSlideId(),
    title: '',
    subtitle: '',
    status: 'draft',
    cta: '',
    image: '',
    gradient: 'linear-gradient(135deg, #1b2a4a 0%, #6d28d9 100%)',
    ...data,
  }
  slides.push(slide)
  return slide
}

// Remove a slide by id. Returns true when a slide was removed.
export function removeSlide(id) {
  const index = slides.findIndex((s) => s.id === Number(id))
  if (index === -1) return false
  slides.splice(index, 1)
  return true
}
