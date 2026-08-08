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
 * El cálculo se persiste en `predicciones` (una fila viva por bebé) en
 * segundo plano; si falla, el bocadillo funciona igual.
 */
import { computed, ref, watch } from 'vue'
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
import { edadDias, formatoDuracion, horaCorta, hoyLocal, mensajeError } from '../models/CarlotaModel'
import { ICONOS_REGISTRO, neneniUrl } from '../assets/branding'

const props = defineProps<{ abierta: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const bebeStore = useBebeStore()

const cargando = ref(false)
const error = ref('')
const prediccion = ref<Predicciones | null>(null)
const noche = ref<PronosticoNoche | null>(null)
const llanto = ref<PorQueLlora | null>(null)
const mostrarLlanto = ref(false)
const nombreBebe = ref('la bebé')

watch(
  () => props.abierta,
  (abierta) => {
    if (abierta) void calcular()
    else mostrarLlanto.value = false
  },
)

async function calcular() {
  cargando.value = true
  error.value = ''
  llanto.value = null
  try {
    const bebe = await bebeStore.cargar()
    if (!bebe) throw new Error('Sin acceso a los datos de la bebé')
    nombreBebe.value = bebe.nombre.split(' ')[0] ?? 'la bebé'
    const ahora = new Date()
    const desdeIso = new Date(
      ahora.getTime() - (AJUSTES.historicoDias + 1) * 86_400_000,
    ).toISOString()
    const [tomas, suenos, panales] = await Promise.all([
      listarTomas(bebe.id, desdeIso),
      listarSuenos(bebe.id, desdeIso),
      listarPanales(bebe.id, desdeIso),
    ])
    const datos: DatosPredictor = { tomas, suenos, panales }
    const edad = edadDias(bebe.fecha_nacimiento, hoyLocal(ahora))
    prediccion.value = predecir(datos, edad, ahora)
    noche.value = pronosticoNoche(datos, edad, ahora)
    llanto.value = porQueLlora(datos, edad, ahora)
    // Persistir el cálculo (fila viva) sin bloquear el bocadillo
    void guardarPrediccion({ bebe_id: bebe.id, ...aFilaPrediccion(prediccion.value) }).catch(
      () => undefined,
    )
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    cargando.value = false
  }
}

/** Frases del bocadillo, en el orden en que las "dice" Ñeñeñi */
const frases = computed<string[]>(() => {
  const p = prediccion.value
  if (!p) return []
  const lista: string[] = []

  // Próxima toma
  if (p.proximaToma) {
    const t = p.proximaToma
    if (t.minutosRestantes <= 0) {
      lista.push(
        `¡La próxima toma ya toca! La esperaba hacia las ${horaCorta(t.prevista)}.`,
      )
    } else {
      lista.push(
        `Yo creo que la próxima toma será a las ${horaCorta(t.prevista)} (entre las ${horaCorta(t.franja.desde)} y las ${horaCorta(t.franja.hasta)}).`,
      )
    }
  } else {
    lista.push('Todavía no tengo tomas registradas para predecir la siguiente.')
  }

  // Sueño
  if (p.durmiendo) {
    lista.push(`Ahora mismo ${nombreBebe.value} está durmiendo… ¡a aprovechar!`)
  } else if (p.proximaSiesta) {
    const s = p.proximaSiesta
    if (s.minutosRestantes <= 0) {
      lista.push('Ya le va tocando dormir: lleva despierta más de lo habitual en ella.')
    } else {
      lista.push(
        `Y en unos ${formatoDuracion(s.minutosRestantes)} le tocará dormir, hacia las ${horaCorta(s.prevista)}.`,
      )
    }
  }

  // Pronóstico de la noche (solo en franja nocturna)
  const n = noche.value
  if (n) {
    if (n.tomas.length === 0) {
      lista.push('Con su ritmo, no espero más tomas hasta las 07:00. ¡Feliz noche!')
    } else {
      const horas = n.tomas.map((t) => horaCorta(t)).join(' y a las ')
      lista.push(
        `Esta noche creo que ${nombreBebe.value} pedirá ${n.tomas.length === 1 ? 'una toma más' : `${n.tomas.length} tomas más`}, más o menos cada ${formatoDuracion(n.intervaloMin)}: a las ${horas}.`,
      )
    }
  }
  return lista
})

/** Nota de honestidad: cuánto pesa ya el patrón propio frente a la base */
const notaAprendizaje = computed(() => {
  const t = prediccion.value?.proximaToma
  if (!t) return 'Ñeñeñi aprende del ritmo real según se registran tomas, sueños y pañales.'
  const pct = Math.round(t.pesoPersonal * 100)
  if (pct < 40)
    return `Aún estoy aprendiendo su ritmo (el patrón propio solo pesa un ${pct}%): de momento me apoyo en lo típico para su edad.`
  const reciente = t.pesoReciente > 0 ? ` y lo que va de hoy un ${Math.round(t.pesoReciente * 100)}%` : ''
  return `El ritmo propio de ${nombreBebe.value} ya pesa un ${pct}% en mi cálculo${reciente}.`
})

const barrasLlanto = computed(() => {
  const r = llanto.value
  if (!r) return []
  return [
    { etiqueta: 'Sueño', p: r.sueno, icono: ICONOS_REGISTRO.sueno },
    { etiqueta: 'Hambre', p: r.hambre, icono: ICONOS_REGISTRO.toma },
    { etiqueta: 'Incomodidad', p: r.incomodidad, icono: ICONOS_REGISTRO.panal },
  ].sort((a, b) => b.p - a.p)
})

const esNoche = computed(() => esHoraNocturna(new Date()))
</script>

<template>
  <Transition name="aparecer">
    <div v-if="abierta" class="nenei-fondo" @click.self="emit('cerrar')">
      <div class="nenei-panel" role="dialog" aria-label="Ñeñeñi, el Mime experto en bebés">
        <button class="nenei-cerrar" aria-label="Cerrar" @click="emit('cerrar')">✕</button>

        <div class="nenei-cabecera">
          <img :src="neneniUrl" alt="" class="nenei-grande" />
          <div class="nenei-quien">
            <strong>Ñeñeñi</strong>
            <span class="suave">Mime experto en bebés</span>
          </div>
        </div>

        <div v-if="cargando" class="nenei-bocadillo esqueleto pulso">Pensando…</div>
        <div v-else-if="error" class="nenei-bocadillo nenei-error">{{ error }}</div>
        <template v-else>
          <p v-for="(frase, i) in frases" :key="i" class="nenei-bocadillo">{{ frase }}</p>
          <p class="nenei-nota suave">{{ notaAprendizaje }}</p>

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
              <span class="nenei-barra-pista">
                <span class="nenei-barra-relleno" :style="{ width: Math.round(barra.p * 100) + '%' }" />
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
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nenei-fondo {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: rgba(0, 0, 0, 0.35);
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

.nenei-cerrar {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 32px;
  height: 32px;
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
