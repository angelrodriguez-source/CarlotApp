<script setup lang="ts">
/**
 * HojaPanal.vue — Hoja de registro de pañal (pis/caca/mixto): hora
 * editable precargada con "ahora" y, en caca/mixto, la cantidad como
 * botones que guardan directamente. El guardado real (validación,
 * servicio y deshacer) queda en HoyView: esta hoja recoge los datos y
 * los emite.
 */
import { ref, watch } from 'vue'
import HojaInferior from './HojaInferior.vue'
import { aInputLocal } from '../models/CarlotaModel'
import { ICONOS_REGISTRO } from '../assets/branding'
import { useBebeStore } from '../stores/bebeStore'
import { ETIQUETAS_CANTIDAD_PANAL, type CantidadPanal, type TipoPanal } from '../types'

const props = defineProps<{
  /** null = hoja cerrada */
  tipo: TipoPanal | null
  /** Alta en vuelo: deshabilita los botones (evita el doble toque) */
  registrando: boolean
}>()

const emit = defineEmits<{
  cerrar: []
  /** hora en formato datetime-local; cantidad null = pis o sin especificar */
  guardar: [cantidad: CantidadPanal | null, hora: string]
}>()

const bebeStore = useBebeStore()
const hora = ref('')

// Al abrir, la hora se precarga con "ahora"
watch(
  () => props.tipo,
  (tipo) => {
    if (tipo) hora.value = aInputLocal(new Date())
  },
)

const TITULOS: Record<TipoPanal, { texto: string; icono?: string }> = {
  pis: { texto: 'Pis', icono: ICONOS_REGISTRO.pis },
  caca: { texto: 'Caca', icono: ICONOS_REGISTRO.caca },
  mixto: { texto: 'Pis + caca', icono: ICONOS_REGISTRO.caca },
}

/** Tope: ahora mismo (el futuro solo puede ser un error de tecleo) */
function topeHora(): string {
  return aInputLocal(new Date())
}

/** Suelo: el día del nacimiento */
function sueloHora(): string {
  const nacimiento = bebeStore.bebe?.fecha_nacimiento
  return nacimiento ? nacimiento + 'T00:00' : ''
}
</script>

<template>
  <HojaInferior
    :abierta="tipo !== null"
    :titulo="tipo ? TITULOS[tipo].texto : ''"
    :icono="tipo ? TITULOS[tipo].icono : undefined"
    @cerrar="emit('cerrar')"
  >
    <template v-if="tipo">
      <div class="campo">
        <label for="panal-hora">Hora (por si no es ahora mismo)</label>
        <input
          id="panal-hora"
          v-model="hora"
          type="datetime-local"
          :min="sueloHora()"
          :max="topeHora()"
          required
        />
      </div>
      <template v-if="tipo !== 'pis'">
        <span class="etiqueta-seccion">¿Cuánta?</span>
        <div class="cantidades">
          <button
            v-for="(etiqueta, valor) in ETIQUETAS_CANTIDAD_PANAL"
            :key="valor"
            class="acceso"
            :disabled="registrando"
            @click="emit('guardar', valor, hora)"
          >
            {{ etiqueta }}
          </button>
        </div>
      </template>
      <button v-else class="boton" :disabled="registrando" @click="emit('guardar', null, hora)">
        Guardar
      </button>
    </template>
  </HojaInferior>
</template>

<style scoped>
.cantidades {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

/* Mismo aspecto que los accesos directos de Hoy */
.acceso {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.85rem 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  background: var(--color-fondo);
  color: var(--color-texto);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  transition:
    background 0.15s,
    color 0.15s;
}

.acceso:hover {
  background: var(--color-borde);
}
</style>
