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
  build: {
    rollupOptions: {
      output: {
        // Sin esto, el bundler bautiza el chunk compartido con el nombre
        // del primer módulo propio (branding.ts) aunque el 99% del peso
        // sea @supabase/supabase-js — nombre honesto para las auditorías.
        // (Forma función: rolldown no acepta el objeto de Rollup.)
        manualChunks(id: string) {
          if (id.includes('@supabase')) return 'supabase'
        },
      },
    },
  },
})
