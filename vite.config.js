import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind serves only the shadcn-vue components in src/components/ui; the
  // rest of the app is SCSS. See src/styles/tailwind.css.
  plugins: [vue(), tailwindcss()],
  server: {
    // Proxy API calls to the Laravel backend so the browser stays same-origin
    // (no CORS config needed in dev). Override via VITE_API_BASE_URL in prod.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Variables/mixins auto-injected into every component's <style lang="scss">
        additionalData: `@use "@/styles/_variables.scss" as *;`,
      },
    },
  },
})
