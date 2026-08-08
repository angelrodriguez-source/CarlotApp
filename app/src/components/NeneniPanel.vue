<script setup lang="ts">
/**
 * NeneniPanel.vue — El bocadillo de Ñeñeñi (la cara del Mime Predictor).
 *
 * Se abre desde su icono de la cabecera: carga los últimos días de
 * registros, ejecuta `predecir()` y cuenta en primera persona la próxima
 * toma y la próxima siesta; en franja nocturna (21:00-07:00) añade el
 * pronóstico de la noche. El botón "¿Por qué llora?" despliega el
 * diagrama de probabilidades Sueño/Hambre/Incomodidad de `porQueLlora()`.
 *
 * Es un diálogo modal de verdad (mismo patrón que HojaInferior): captura
 * y devuelve el foco, atrapa Tab, cierra con Escape y bloquea el scroll
 * del fondo (contador compartido en modal.ts). Las frases viven en
 * models/frasesNeneni.ts (lógica pura, testeada).
 *
 * El cálculo se memoiza 60 s (reabrir el bocadillo no repite consultas) y
 * se persiste en `predicciones` (una fila viva por bebé) en segundo
 * plano; si falla, el bocadillo funciona igual.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useBebeStore } from '../stores/bebeStore'
import {
  guardarPrediccion,
  listarPanales,
  listarSuenos,
  listarTomas,
} from '../services/carlotaService'
import {
  AJUSTES,
  aFilaPrediccion,
  esHoraNocturna,
  porQueLlora,
  predecir,
  pronosticoNoche,
  type DatosPredictor,
  type Predicciones,
  type PorQueLlora,
  type PronosticoNoche,
} from '../models/MimePredictor'
import { frasesNeneni, notaAprendizaje } from '../models/frasesNeneni'
import { desarrolloSemana } from '../models/semanasDesarrollo'
import { edadDias, hoyLocal, mensajeError } from '../models/CarlotaModel'
import { ICONOS_REGISTRO, neneniUrl } from '../assets/branding'
import { EVENTO_DATOS_CAMBIADOS } from '../services/carlotaService'
import { atraparTab, usarModal } from './modal'

const props = defineProps<{ abierta: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const bebeStore = useBebeStore()

const panel = ref<HTMLElement | null>(null)
const cargando = ref(false)
const error = ref('')
const prediccion = ref<Predicciones | null>(null)
const noche = ref<PronosticoNoche | null>(null)
const llanto = ref<PorQueLlora | null>(null)
const esNoche = ref(false)
const mostrarLlanto = ref(false)
const nombreBebe = ref('la bebé')

// Memoización: reabrir el bocadillo antes de 1 min no repite las
// consultas. Se invalida al registrar/editar/borrar cualquier dato (el
// servicio emite EVENTO_DATOS_CAMBIADOS): recién apuntada una toma, el
// bocadillo debe recalcular aunque no haya pasado el minuto.
const FRESCURA_MS = 60_000
let calculadoEnMs = 0

function invalidarMemo() {
  calculadoEnMs = 0
}

onMounted(() => window.addEventListener(EVENTO_DATOS_CAMBIADOS, invalidarMemo))
onUnmounted(() => window.removeEventListener(EVENTO_DATOS_CAMBIADOS, invalidarMemo))

// Token de generación: si se cierra y reabre con red lenta, el cálculo
// viejo no debe pisar al nuevo (ni al revés)
let generacion = 0

// Ciclo de vida modal compartido (scroll-lock, foco, immediate: el
// componente es async y puede montarse con el bocadillo YA pedido)
usarModal(() => props.abierta, panel, {
  alAbrir() {
    if (Date.now() - calculadoEnMs >= FRESCURA_MS || !prediccion.value) void calcular()
  },
  alCerrar() {
    mostrarLlanto.value = false
    mostrarSemana.value = false
  },
})

async function calcular() {
  const gen = ++generacion
  cargando.value = true
  error.value = ''
  try {
    const bebe = await bebeStore.cargar()
    if (!bebe) throw new Error('Sin acceso a los datos de la bebé')
    const ahora = new Date()
    const desdeIso = new Date(
      ahora.getTime() - (AJUSTES.historicoDias + 1) * 86_400_000,
    ).toISOString()
    const [tomas, suenos, panales] = await Promise.all([
      listarTomas(bebe.id, desdeIso),
      listarSuenos(bebe.id, desdeIso),
      listarPanales(bebe.id, desdeIso),
    ])
    if (gen !== generacion) return // hay un cálculo más nuevo en vuelo
    const datos: DatosPredictor = { tomas, suenos, panales }
    const edad = edadDias(bebe.fecha_nacimiento, hoyLocal(ahora))
    nombreBebe.value = bebe.nombre.split(' ')[0] ?? 'la bebé'
    prediccion.value = predecir(datos, edad, ahora)
    noche.value = pronosticoNoche(datos, edad, ahora)
    llanto.value = porQueLlora(datos, edad, ahora)
    esNoche.value = esHoraNocturna(ahora)
    calculadoEnMs = Date.now()
    // Persistir el cálculo (fila viva) sin bloquear el bocadillo
    void guardarPrediccion({ bebe_id: bebe.id, ...aFilaPrediccion(prediccion.value) }).catch(
      () => undefined,
    )
  } catch (e) {
    if (gen === generacion) error.value = mensajeError(e)
  } finally {
    if (gen === generacion) cargando.value = false
  }
}

const frases = computed<string[]>(() =>
  prediccion.value ? frasesNeneni(prediccion.value, noche.value, nombreBebe.value) : [],
)

const nota = computed(() => notaAprendizaje(prediccion.value, nombreBebe.value))

const barrasLlanto = computed(() => {
  const r = llanto.value
  if (!r) return []
  return [
    { etiqueta: 'Sueño', p: r.sueno, icono: ICONOS_REGISTRO.sueno },
    { etiqueta: 'Hambre', p: r.hambre, icono: ICONOS_REGISTRO.toma },
    { etiqueta: 'Incomodidad', p: r.incomodidad, icono: ICONOS_REGISTRO.panal },
  ].sort((a, b) => b.p - a.p)
})

// ---- Qué esperar esta semana (voz de experto, datos macro CDC/AAP/NHS) ----
const mostrarSemana = ref(false)
const semanaActual = computed(() =>
  prediccion.value ? Math.floor(prediccion.value.edadDias / 7) : null,
)
const etapaSemana = computed(() =>
  semanaActual.value === null ? null : desarrolloSemana(semanaActual.value),
)
</script>

<template>
  <Teleport to="body">
    <Transition name="aparecer">
      <div
        v-if="abierta"
        class="nenei-fondo"
        @click.self="emit('cerrar')"
        @keydown.esc="emit('cerrar')"
        @keydown.tab="atraparTab(panel, $event)"
      >
        <div
          ref="panel"
          class="nenei-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Ñeñeñi, el Mime experto en bebés"
          tabindex="-1"
        >
          <button class="nenei-cerrar" aria-label="Cerrar" @click="emit('cerrar')">✕</button>

          <div class="nenei-cabecera">
            <img :src="neneniUrl" alt="" class="nenei-grande" />
            <div class="nenei-quien">
              <strong>Ñeñeñi</strong>
              <span class="suave">Mime experto en bebés</span>
            </div>
          </div>

          <div v-if="cargando" class="nenei-bocadillo pulso">Pensando…</div>
          <div v-else-if="error" class="nenei-bocadillo nenei-error">
            {{ error }}
            <button class="boton nenei-reintentar" @click="calcular()">Reintentar</button>
          </div>
          <template v-else>
            <p v-for="(frase, i) in frases" :key="i" class="nenei-bocadillo">{{ frase }}</p>
            <p class="nenei-nota suave">{{ nota }}</p>

            <button
              v-if="llanto && !mostrarLlanto"
              class="boton nenei-boton-llanto"
              @click="mostrarLlanto = true"
            >
              ¿Por qué llora?
            </button>

            <div v-if="mostrarLlanto && llanto" class="nenei-llanto">
              <div v-for="barra in barrasLlanto" :key="barra.etiqueta" class="nenei-barra">
                <span class="nenei-barra-etiqueta">
                  <img v-if="barra.icono" :src="barra.icono" alt="" />
                  {{ barra.etiqueta }}
                </span>
                <span class="nenei-barra-pista" aria-hidden="true">
                  <span
                    class="nenei-barra-relleno"
                    :style="{ width: Math.round(barra.p * 100) + '%' }"
                  />
                </span>
                <strong class="nenei-barra-pct">{{ Math.round(barra.p * 100) }}%</strong>
              </div>
              <ul class="nenei-explicaciones suave">
                <li v-for="texto in llanto.explicaciones" :key="texto">{{ texto }}</li>
              </ul>
            </div>

            <p v-if="esNoche && !noche" class="nenei-nota suave">
              Es de noche pero no tengo tomas recientes para el pronóstico nocturno.
            </p>

            <!-- Qué esperar esta semana: voz de experto (macro CDC/AAP/NHS) -->
            <div v-if="etapaSemana" class="nenei-semana">
              <button
                class="nenei-semana-cabecera"
                :aria-expanded="mostrarSemana"
                @click="mostrarSemana = !mostrarSemana"
              >
                <span>
                  <strong>Semana {{ semanaActual }}</strong> · {{ etapaSemana.titulo }}
                </span>
                <span class="suave">{{ mostrarSemana ? '▲' : '▼' }}</span>
              </button>
              <template v-if="mostrarSemana">
                <p class="nenei-bocadillo">
                  Esta semana {{ nombreBebe }} anda con esto entre manos:
                </p>
                <ul class="nenei-cambios">
                  <li v-for="cambio in etapaSemana.cambios" :key="cambio">{{ cambio }}</li>
                </ul>
                <p class="nenei-ajuste">
                  <img v-if="ICONOS_REGISTRO.sueno" :src="ICONOS_REGISTRO.sueno" alt="Sueño" />
                  {{ etapaSemana.sueno }}
                </p>
                <p class="nenei-ajuste">
                  <img v-if="ICONOS_REGISTRO.toma" :src="ICONOS_REGISTRO.toma" alt="Tomas" />
                  {{ etapaSemana.tomas }}
                </p>
                <p class="nenei-nota suave">
                  Orientativo (hitos CDC/AAP/NHS): cada bebé va a su ritmo. Las dudas, al pediatra.
                </p>
              </template>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nenei-fondo {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: var(--color-scrim);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: calc(3.6rem + env(safe-area-inset-top)) 1rem 1rem;
  overflow-y: auto;
}

.nenei-panel {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: var(--color-tarjeta);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-s);
  box-shadow: var(--sombra);
  padding: 1rem 1rem 1.1rem;
}

.nenei-panel:focus {
  outline: none;
}

.nenei-cerrar {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  min-width: 40px;
  min-height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--color-fondo);
  color: var(--color-texto-suave);
  font-size: 0.9rem;
}

.nenei-cabecera {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.nenei-grande {
  width: 76px;
  height: 76px;
}

.nenei-quien {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.nenei-quien strong {
  font-size: 1.15rem;
}

.nenei-quien .suave {
  font-size: 0.8rem;
}

/* Bocadillos: lo que dice Ñeñeñi, con su rabito hacia la carita */
.nenei-bocadillo {
  position: relative;
  margin: 0 0 0.55rem;
  background: var(--color-primario-suave);
  border-radius: 14px;
  border-top-left-radius: 4px;
  padding: 0.6rem 0.8rem;
  font-size: 0.92rem;
  line-height: 1.45;
}

.nenei-error {
  background: color-mix(in srgb, var(--color-peligro) 12%, var(--color-tarjeta));
}

.nenei-reintentar {
  display: block;
  margin-top: 0.6rem;
}

.nenei-nota {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.nenei-boton-llanto {
  width: 100%;
  margin-top: 0.75rem;
}

/* Diagrama de ¿Por qué llora? */
.nenei-llanto {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.nenei-barra {
  display: grid;
  grid-template-columns: 7.2rem 1fr 2.6rem;
  align-items: center;
  gap: 0.5rem;
}

.nenei-barra-etiqueta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
}

.nenei-barra-etiqueta img {
  width: 18px;
  height: 18px;
}

.nenei-barra-pista {
  display: block;
  height: 10px;
  border-radius: 5px;
  background: var(--color-fondo);
  overflow: hidden;
}

.nenei-barra-relleno {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: var(--color-primario);
  transition: width 0.3s;
}

.nenei-barra-pct {
  font-size: 0.85rem;
  text-align: right;
}

.nenei-explicaciones {
  margin: 0.25rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.78rem;
  line-height: 1.5;
}

/* Qué esperar esta semana (plegable, tras ¿Por qué llora?) */
.nenei-semana {
  margin-top: 0.85rem;
  border-top: 1px solid var(--color-borde);
  padding-top: 0.6rem;
}

.nenei-semana-cabecera {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0.35rem 0;
  font-size: 0.92rem;
  color: var(--color-texto);
  text-align: left;
}

.nenei-semana .nenei-bocadillo {
  margin-top: 0.5rem;
}

.nenei-cambios {
  margin: 0.35rem 0 0.5rem;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  line-height: 1.5;
}

.nenei-ajuste {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0.35rem 0;
  font-size: 0.85rem;
  line-height: 1.45;
}

.nenei-ajuste img {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* Transición del bocadillo: fundido + caída suave desde la cabecera */
.aparecer-enter-active,
.aparecer-leave-active {
  transition: opacity 0.18s ease;
}

.aparecer-enter-active .nenei-panel,
.aparecer-leave-active .nenei-panel {
  transition: transform 0.2s ease;
}

.aparecer-enter-from,
.aparecer-leave-to {
  opacity: 0;
}

.aparecer-enter-from .nenei-panel,
.aparecer-leave-to .nenei-panel {
  transform: translateY(-10px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .aparecer-enter-active,
  .aparecer-leave-active,
  .aparecer-enter-active .nenei-panel,
  .aparecer-leave-active .nenei-panel {
    transition: none;
  }
}
</style>
