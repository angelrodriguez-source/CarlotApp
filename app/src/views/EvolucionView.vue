<script setup lang="ts">
/**
 * EvolucionView.vue — Medidas (peso/altura/perímetro craneal):
 * alta de una medición, gráficas de evolución y tabla histórica.
 */
import { computed, onMounted, ref } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import { hoyLocal, serieGrafica } from '../models/CarlotaModel'
import type { Medida } from '../types'
import GraficaLinea from '../components/GraficaLinea.vue'

const bebeStore = useBebeStore()

const cargando = ref(true)
const error = ref('')
const medidas = ref<Medida[]>([])
const mostrarFormulario = ref(false)

const nuevaMedida = ref({
  fecha: hoyLocal(),
  pesoGramos: null as number | null,
  alturaCm: null as number | null,
  perimetroCm: null as number | null,
  notas: '',
})

async function cargar() {
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  medidas.value = await servicio.listarMedidas(bebe.id)
}

onMounted(async () => {
  try {
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    cargando.value = false
  }
})

async function guardarMedida() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  error.value = ''
  try {
    await servicio.registrarMedida({
      bebe_id: bebe.id,
      fecha: nuevaMedida.value.fecha,
      peso_gramos: nuevaMedida.value.pesoGramos,
      altura_cm: nuevaMedida.value.alturaCm,
      perimetro_craneal_cm: nuevaMedida.value.perimetroCm,
      notas: nuevaMedida.value.notas || null,
    })
    mostrarFormulario.value = false
    nuevaMedida.value = {
      fecha: hoyLocal(),
      pesoGramos: null,
      alturaCm: null,
      perimetroCm: null,
      notas: '',
    }
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function borrarMedida(id: string) {
  error.value = ''
  try {
    await servicio.eliminarMedida(id)
    await cargar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const seriePeso = computed(() =>
  serieGrafica(medidas.value, (m) => m.fecha, (m) => m.peso_gramos),
)
const serieAltura = computed(() =>
  serieGrafica(medidas.value, (m) => m.fecha, (m) => m.altura_cm),
)
const seriePerimetro = computed(() =>
  serieGrafica(medidas.value, (m) => m.fecha, (m) => m.perimetro_craneal_cm),
)

const medidasRecientes = computed(() => [...medidas.value].reverse())
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-evolucion">
      <h2>Evolución</h2>
      <button class="boton" @click="mostrarFormulario = !mostrarFormulario">+ Medida</button>
    </div>

    <p v-if="cargando" class="suave">Cargando…</p>
    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="mostrarFormulario" class="tarjeta" @submit.prevent="guardarMedida">
      <h3>Nueva medida</h3>
      <div class="campo">
        <label for="medida-fecha">Fecha</label>
        <input id="medida-fecha" v-model="nuevaMedida.fecha" type="date" required />
      </div>
      <div class="campo">
        <label for="medida-peso">Peso (gramos)</label>
        <input id="medida-peso" v-model.number="nuevaMedida.pesoGramos" type="number" min="1" />
      </div>
      <div class="campo">
        <label for="medida-altura">Altura (cm)</label>
        <input
          id="medida-altura"
          v-model.number="nuevaMedida.alturaCm"
          type="number"
          min="1"
          step="0.1"
        />
      </div>
      <div class="campo">
        <label for="medida-pc">Perímetro craneal (cm)</label>
        <input
          id="medida-pc"
          v-model.number="nuevaMedida.perimetroCm"
          type="number"
          min="1"
          step="0.1"
        />
      </div>
      <div class="campo">
        <label for="medida-notas">Notas (ej. "revisión pediatra")</label>
        <input id="medida-notas" v-model="nuevaMedida.notas" type="text" />
      </div>
      <button class="boton" type="submit">Guardar</button>
    </form>

    <GraficaLinea titulo="Peso" :puntos="seriePeso" unidad="g" />
    <GraficaLinea titulo="Altura" :puntos="serieAltura" unidad="cm" />
    <GraficaLinea titulo="Perímetro craneal" :puntos="seriePerimetro" unidad="cm" />

    <div class="tarjeta">
      <h3>Mediciones</h3>
      <p v-if="medidas.length === 0" class="suave">Todavía no hay mediciones.</p>
      <div v-for="medida in medidasRecientes" :key="medida.id" class="fila-registro">
        <span class="hora">{{ medida.fecha }}</span>
        <span class="detalle">
          <template v-if="medida.peso_gramos">{{ medida.peso_gramos }} g</template>
          <template v-if="medida.altura_cm"> · {{ medida.altura_cm }} cm</template>
          <template v-if="medida.perimetro_craneal_cm">
            · PC {{ medida.perimetro_craneal_cm }} cm
          </template>
          <template v-if="medida.notas"> · {{ medida.notas }}</template>
        </span>
        <button class="boton peligro" @click="borrarMedida(medida.id)">✕</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.cabecera-evolucion {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
