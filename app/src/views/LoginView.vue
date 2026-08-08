<script setup lang="ts">
/**
 * LoginView.vue — Pantalla de entrada. Solo login con Google.
 * La autorización real (2 usuarios) la impone RLS con usuarios_autorizados.
 */
import { ref } from 'vue'
import { useUserStore } from '../stores/userStore'
import { logoUrl } from '../assets/branding'

const userStore = useUserStore()
const error = ref('')
// Evita doble pulsación mientras arranca la redirección OAuth
const entrando = ref(false)

async function entrar() {
  if (entrando.value) return
  error.value = ''
  entrando.value = true
  const fallo = await userStore.loginConGoogle()
  if (fallo) {
    error.value = fallo.message
    entrando.value = false
  }
}
</script>

<template>
  <main class="pantalla login">
    <img :src="logoUrl" alt="" class="logo" />
    <h1>CarlotApp</h1>
    <p class="suave">Tomas, sueño, medidas y citas de Carlota</p>

    <button class="boton google" :disabled="entrando" @click="entrar">
      {{ entrando ? 'Entrando…' : 'Entrar con Google' }}
    </button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p class="suave nota">App privada: solo los dos usuarios autorizados pueden ver los datos.</p>
  </main>
</template>

<style scoped>
.login {
  text-align: center;
  padding-top: 15vh;
}

.logo {
  width: 96px;
  height: 96px;
}

.google {
  margin-top: 1.5rem;
  font-size: 1.1rem;
  padding: 0.8rem 1.6rem;
}

.nota {
  margin-top: 2rem;
}
</style>
