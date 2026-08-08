/**
 * userStore.ts — Estado global de autenticación (Pinia)
 *
 * Login solo con Google (los dos usuarios autorizados). La autorización
 * real la impone RLS en la base de datos (usuarios_autorizados): un
 * Google login ajeno entra en la sesión pero no ve ningún dato.
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../services/supabase'
import type { User } from '@supabase/supabase-js'

export const useUserStore = defineStore('user', () => {
  // --- STATE ---
  const user = ref<User | null>(null)
  const loading = ref(true)

  // Promesa que se resuelve cuando init() termina. El router guard la
  // espera antes de decidir, para no dejar pasar a rutas protegidas
  // mientras la sesión inicial aún se está comprobando.
  let resolveReady: () => void
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  // --- COMPUTED ---
  const isLoggedIn = computed(() => !!user.value)
  const nombre = computed(
    () => (user.value?.user_metadata?.name as string | undefined) ?? user.value?.email ?? '',
  )

  // --- ACTIONS ---

  function waitUntilReady() {
    return ready
  }

  /**
   * Comprueba la sesión guardada (localStorage) y escucha cambios.
   * Se llama UNA VEZ al arrancar la app (main.ts).
   */
  async function init() {
    loading.value = true
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      user.value = session?.user ?? null

      // OJO: el callback de onAuthStateChange corre con el lock interno
      // de auth cogido — no hacer llamadas a Supabase dentro (deadlock
      // del refresh de token). Solo actualizar estado local.
      supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
        user.value = nuevaSesion?.user ?? null
      })
    } finally {
      loading.value = false
      resolveReady!()
    }
  }

  /** Login con Google (redirige y vuelve a la app) */
  async function loginConGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Volver a la raíz de la app (funciona en GitHub Pages y en dev)
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    return error
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  return { user, isLoggedIn, nombre, waitUntilReady, init, loginConGoogle, logout }
})
