import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Tailwind first: it puts its rules in @layers, and the unlayered SCSS that
// follows must win the cascade over them.
import './styles/tailwind.css'
import './styles/main.scss'
import App from './App.vue'
import router from './router'
import { setUnauthenticatedHandler } from './services/api'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

setUnauthenticatedHandler(async () => {
  const auth = useAuthStore(pinia)
  await auth.logout()

  if (router.currentRoute.value.name !== 'login') {
    await router.replace({ name: 'login' })
  }
})

app.mount('#app')
