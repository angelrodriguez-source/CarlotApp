<script setup lang="ts">
/**
 * CitasView.vue — Citas médicas y trámites: próximas, pasadas y alta.
 */
import { computed, onMounted, ref } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import { aInputLocal, mensajeError } from '../models/CarlotaModel'
import { ETIQUETAS_CITA, type Cita, type TipoCita } from '../types'

const bebeStore = useBebeStore()

const cargando = ref(true)
const error = ref('')
const citas = ref<Cita[]>([])
const mostrarFormulario = ref(false)
const mostrarPasadas = ref(false)

const nuevaCita = ref({
  titulo: '',
  tipo: 'medica' as TipoCita,
  fecha: aInputLocal(new Date()),
  lugar: '',
  notas: '',
})

async function cargar() {
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  citas.value = await servicio.listarCitas(bebe.id)
}

onMounted(async () => {
  try {
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
})

/** Ejecuta y recarga; devuelve true solo si la acción principal fue bien */
/** Marca/desmarca una cita; si la petición falla, repone el checkbox */
async function alternarCita(evento: Event, cita: Cita, completada: boolean) {
  const ok = await ejecutar(() => servicio.marcarCita(cita.id, completada))
  if (!ok && evento.target instanceof HTMLInputElement) {
    evento.target.checked = cita.completada
  }
}

function borrarCita(cita: Cita) {
  if (!window.confirm(`¿Borrar la cita "${cita.titulo}"?`)) return
  ejecutar(() => servicio.eliminarCita(cita.id))
}

async function ejecutar(accion: () => Promise<unknown>): Promise<boolean> {
  error.value = ''
  try {
    await accion()
  } catch (e) {
    error.value = mensajeError(e)
    return false
  }
  try {
    await cargar()
  } catch (e) {
    error.value = mensajeError(e)
  }
  return true
}

async function guardarCita() {
  const bebe = bebeStore.bebe
  if (!bebe) return
  const datos = nuevaCita.value
  const guardada = await ejecutar(() =>
    servicio.crearCita({
      bebe_id: bebe.id,
      fecha: new Date(datos.fecha).toISOString(),
      titulo: datos.titulo,
      tipo: datos.tipo,
      lugar: datos.lugar || null,
      notas: datos.notas || null,
    }),
  )
  // Solo limpiar y cerrar si se guardó: si falló, conservar lo escrito
  if (!guardada) return
  mostrarFormulario.value = false
  nuevaCita.value = {
    titulo: '',
    tipo: 'medica',
    fecha: aInputLocal(new Date()),
    lugar: '',
    notas: '',
  }
}

const pendientes = computed(() =>
  citas.value.filter((c) => !c.completada).sort((a, b) => a.fecha.localeCompare(b.fecha)),
)
const pasadas = computed(() =>
  citas.value.filter((c) => c.completada).sort((a, b) => b.fecha.localeCompare(a.fecha)),
)

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function icono(tipo: TipoCita): string {
  return tipo === 'medica' ? '🩺' : tipo === 'tramite' ? '📋' : '📌'
}
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-citas">
      <h2>🗓️ Citas y trámites</h2>
      <button class="boton" @click="mostrarFormulario = !mostrarFormulario">+ Cita</button>
    </div>

    <template v-if="cargando">
      <div class="esqueleto" style="height: 120px"></div>
      <div class="esqueleto" style="height: 70px"></div>
    </template>
    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="mostrarFormulario" class="tarjeta" @submit.prevent="guardarCita">
      <h3>🗓️ Nueva cita</h3>
      <div class="campo">
        <label for="cita-titulo">Título</label>
        <input
          id="cita-titulo"
          v-model="nuevaCita.titulo"
          type="text"
          required
          placeholder="Revisión 4 meses, vacunas…"
        />
      </div>
      <div class="campo">
        <label for="cita-tipo">Tipo</label>
        <select id="cita-tipo" v-model="nuevaCita.tipo">
          <option v-for="(etiqueta, valor) in ETIQUETAS_CITA" :key="valor" :value="valor">
            {{ etiqueta }}
          </option>
        </select>
      </div>
      <div class="campo">
        <label for="cita-fecha">Fecha y hora</label>
        <input id="cita-fecha" v-model="nuevaCita.fecha" type="datetime-local" required />
      </div>
      <div class="campo">
        <label for="cita-lugar">Lugar</label>
        <input id="cita-lugar" v-model="nuevaCita.lugar" type="text" />
      </div>
      <div class="campo">
        <label for="cita-notas">Notas</label>
        <input id="cita-notas" v-model="nuevaCita.notas" type="text" />
      </div>
      <button class="boton" type="submit">Guardar</button>
    </form>

    <div class="tarjeta">
      <h3>🔜 Próximas</h3>
      <p v-if="pendientes.length === 0" class="suave">No hay citas pendientes 🎉</p>
      <div v-for="cita in pendientes" :key="cita.id" class="fila-registro">
        <input
          type="checkbox"
          :checked="cita.completada"
          :aria-label="`Marcar hecha: ${cita.titulo}`"
          @change="alternarCita($event, cita, true)"
        />
        <span class="detalle">
          {{ icono(cita.tipo) }} <strong>{{ cita.titulo }}</strong>
          <br />
          <span class="suave">
            {{ fechaLegible(cita.fecha) }}
            <template v-if="cita.lugar"> · {{ cita.lugar }}</template>
            <template v-if="cita.notas"> · {{ cita.notas }}</template>
          </span>
        </span>
        <button
          class="boton peligro"
          :aria-label="`Borrar cita: ${cita.titulo}`"
          @click="borrarCita(cita)"
        >
          ✕
        </button>
      </div>
    </div>

    <div class="tarjeta">
      <button class="boton secundario" @click="mostrarPasadas = !mostrarPasadas">
        {{ mostrarPasadas ? '✅ Ocultar hechas' : `✅ Ver hechas (${pasadas.length})` }}
      </button>
      <template v-if="mostrarPasadas">
        <div v-for="cita in pasadas" :key="cita.id" class="fila-registro hecha">
          <input
            type="checkbox"
            checked
            :aria-label="`Desmarcar: ${cita.titulo}`"
            @change="alternarCita($event, cita, false)"
          />
          <span class="detalle">
            {{ icono(cita.tipo) }} {{ cita.titulo }}
            <span class="suave"> · {{ fechaLegible(cita.fecha) }}</span>
          </span>
          <button
            class="boton peligro"
            :aria-label="`Borrar cita: ${cita.titulo}`"
            @click="borrarCita(cita)"
          >
            ✕
          </button>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.cabecera-citas {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hecha .detalle {
  text-decoration: line-through;
  color: var(--color-texto-suave);
}
</style>
