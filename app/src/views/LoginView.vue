<script setup lang="ts">
/**
 * LoginView.vue — Pantalla de entrada. Solo login con Google.
 * La autorización real (2 usuarios) la impone RLS con usuarios_autorizados.
 */
import { ref } from 'vue'
import { useUserStore } from '../stores/userStore'

const userStore = useUserStore()
const error = ref('')

async function entrar() {
  error.value = ''
  const fallo = await userStore.loginConGoogle()
  if (fallo) error.value = fallo.message
}
</script>

<template>
  <main class="pantalla login">
    <img src="/icon.svg" alt="" class="logo" />
    <h1>CarlotApp</h1>
    <p class="suave">Tomas, sueño, medidas y citas de Carlota</p>

    <button class="boton google" @click="entrar">Entrar con Google</button>
    <p v-if="error" class="error">{{ error }}</p>

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
