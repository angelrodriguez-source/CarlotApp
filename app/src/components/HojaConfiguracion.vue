<script setup lang="ts">
/**
 * HojaConfiguracion.vue — Hoja de configuración por usuario de Hoy:
 * qué "Últimos hitos" se ven sin desplegar y qué accesos directos
 * muestra la card. Las listas persisten via usarListaPersistida
 * (localStorage por usuario); aquí solo se marcan/desmarcan.
 */
import HojaInferior from './HojaInferior.vue'

export interface OpcionConfig {
  id: string
  etiqueta: string
  /** Icono propio (public/icono-*.png); si falta se usa el emoji */
  img?: string
  /** Emoji de reserva */
  icono?: string
}

defineProps<{
  abierta: boolean
  hitos: readonly OpcionConfig[]
  acciones: readonly OpcionConfig[]
}>()

const emit = defineEmits<{ cerrar: [] }>()

/** Ids de hitos visibles y de accesos directos (persisten en el padre) */
const hitosVisibles = defineModel<string[]>('hitosVisibles', { required: true })
const accesos = defineModel<string[]>('accesos', { required: true })
</script>

<template>
  <HojaInferior :abierta="abierta" titulo="⚙ Configuración" @cerrar="emit('cerrar')">
    <p class="suave">
      Se guarda para tu usuario en este dispositivo — cada uno puede tener la suya.
    </p>
    <span class="etiqueta-seccion">Últimos hitos visibles sin desplegar</span>
    <label v-for="entrada in hitos" :key="entrada.id" class="opcion-hito">
      <input v-model="hitosVisibles" type="checkbox" :value="entrada.id" />
      <span class="opcion-texto">
        <img v-if="entrada.img" :src="entrada.img" alt="" class="icono-opcion" />
        {{ entrada.etiqueta }}
      </span>
    </label>
    <span class="etiqueta-seccion seccion-config">Accesos directos de la card</span>
    <label v-for="accion in acciones" :key="accion.id" class="opcion-hito">
      <input v-model="accesos" type="checkbox" :value="accion.id" />
      <span class="opcion-texto">
        <img v-if="accion.img" :src="accion.img" alt="" class="icono-opcion" />
        <template v-else>{{ accion.icono }}</template>
        {{ accion.etiqueta }}
      </span>
    </label>
    <button class="boton" @click="emit('cerrar')">Listo</button>
  </HojaInferior>
</template>

<style scoped>
.opcion-hito {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--color-borde);
}

.opcion-hito input {
  width: auto;
}

.opcion-hito:last-of-type {
  border-bottom: none;
  margin-bottom: 0.75rem;
}

.opcion-texto {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.icono-opcion {
  width: 18px;
  height: 18px;
}

.seccion-config {
  margin-top: 1rem;
}
</style>
