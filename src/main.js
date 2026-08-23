import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Tailwind first: it puts its rules in @layers, and the unlayered SCSS that
// follows must win the cascade over them.
import './styles/tailwind.css'
import './styles/main.scss'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
