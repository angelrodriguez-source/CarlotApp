import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // base: ruta donde se sirve la app en producción.
  // GitHub Pages publica en https://angelrodriguez-source.github.io/CarlotApp/
  // ⚠️ Debe coincidir EXACTAMENTE (case-sensitive) con el nombre del repo.
  base: '/CarlotApp/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Escuchar en 0.0.0.0 para poder probar desde el móvil en la misma WiFi
    host: true,
  },
})
