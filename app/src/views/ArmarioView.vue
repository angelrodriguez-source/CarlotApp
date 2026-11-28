<script setup lang="ts">
/**
 * ArmarioView.vue — El armario de Carlota: su ropa clasificada por tipo
 * de prenda y color, con foto. Rejilla con filtros (chips de tipo +
 * swatches de color), alta y edición en hoja inferior. Las fotos se
 * comprimen en el cliente (components/imagen.ts) y viven en el bucket
 * privado 'armario' de Supabase Storage (URLs firmadas, RLS manda).
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBebeStore } from '../stores/bebeStore'
import * as servicio from '../services/carlotaService'
import { usarAutorrecarga } from '../components/autorrecarga'
import { comprimirImagen } from '../components/imagen'
import HojaInferior from '../components/HojaInferior.vue'
import { mensajeError } from '../models/CarlotaModel'
import {
  COLORES_PRENDA,
  DUENOS_ARMARIO,
  TIPOS_PRENDA,
  etiquetaDueno,
  filtrarPrendas,
  gruposPorTipo,
  ordenarPrendas,
  resumenArmario,
  tiposPara,
  tituloPrenda,
  ubicacionesUsadas,
} from '../models/armario'
import type { ColorPrenda, DuenoArmario, Prenda, TipoPrenda } from '../types'

const bebeStore = useBebeStore()
const route = useRoute()
const router = useRouter()

const cargando = ref(true)
const error = ref('')
const prendas = ref<Prenda[]>([])
// ruta del bucket → URL firmada (1 h); se rehace en cada carga
const fotos = ref<Map<string, string>>(new Map())

// Token anti-pisado: si dos cargas se solapan, la vieja no machaca
let versionCarga = 0

async function cargar() {
  const version = ++versionCarga
  const bebe = await bebeStore.cargar()
  if (!bebe) return
  const lista = await servicio.listarPrendas(bebe.id)
  const rutas = lista.map((p) => p.foto_path).filter((r): r is string => r !== null)
  const urls = await servicio.urlsFotosPrendas(rutas)
  if (version !== versionCarga) return
  prendas.value = lista
  fotos.value = urls
  error.value = ''
}

cargar()
  .catch((e) => (error.value = mensajeError(e)))
  .finally(() => (cargando.value = false))

// Escrituras (propias o de la otra persona, via Realtime) y primer plano
const { recargarAhora } = usarAutorrecarga(() =>
  cargar().catch((e) => (error.value = mensajeError(e))),
)

// ---- Armario activo (Carlota / Cristina / Ángel) ----
const CLAVE_DUENO = 'carlotapp-armario-dueno'

function duenoGuardado(): DuenoArmario {
  const valor = localStorage.getItem(CLAVE_DUENO)
  return DUENOS_ARMARIO.some((d) => d.id === valor) ? (valor as DuenoArmario) : 'carlota'
}

const duenoActivo = ref<DuenoArmario>(duenoGuardado())

// Cambiar de armario: filtros fuera (los tipos son otros) y se recuerda
watch(duenoActivo, (dueno) => {
  filtroTipo.value = null
  filtroColor.value = null
  localStorage.setItem(CLAVE_DUENO, dueno)
})

/** Las prendas del armario activo (todas viajan juntas; se parte aquí) */
const prendasDueno = computed(() => prendas.value.filter((p) => p.dueno === duenoActivo.value))

/** Tipos que ofrece el armario activo (catálogo del + y chips) */
const tiposCatalogo = computed(() => tiposPara(duenoActivo.value))

// ---- Filtros ----
const filtroTipo = ref<TipoPrenda | null>(null)
const filtroColor = ref<ColorPrenda | null>(null)

const prendasVisibles = computed(() =>
  ordenarPrendas(
    filtrarPrendas(prendasDueno.value, { tipo: filtroTipo.value, color: filtroColor.value }),
  ),
)

// Sin filtro de tipo, la rejilla va AGRUPADA por tipo con su cabecera;
// con filtro de tipo activo ya es un único grupo y se muestra plana
const gruposVisibles = computed(() => gruposPorTipo(prendasVisibles.value))
const agrupada = computed(() => filtroTipo.value === null)

const resumen = computed(() => resumenArmario(prendasDueno.value))

function alternarTipo(tipo: TipoPrenda) {
  filtroTipo.value = filtroTipo.value === tipo ? null : tipo
}

function alternarColor(color: ColorPrenda) {
  filtroColor.value = filtroColor.value === color ? null : color
}

// ---- Catálogo de tipos (lo abre el + de la nav y el botón + Prenda) ----
const hojaTipos = ref(false)

function abrirCatalogoTipos() {
  hojaAbierta.value = false
  hojaTipos.value = true
}

function elegirTipo(tipo: TipoPrenda) {
  hojaTipos.value = false
  abrirAlta(tipo)
}

// El FAB ＋ estando en el Armario llega con ?nueva=...: catálogo y limpiar
function atenderQueryNueva() {
  if (route.query.nueva) {
    abrirCatalogoTipos()
    router.replace({ query: {} })
  }
}

watch(() => route.query.nueva, atenderQueryNueva)
atenderQueryNueva()

// ---- Alta / edición (misma hoja; editandoId null = alta) ----
const hojaAbierta = ref(false)
const guardando = ref(false)
const editando = ref<Prenda | null>(null)

const formulario = ref({
  dueno: 'carlota' as DuenoArmario,
  tipo: 'body' as TipoPrenda,
  color: 'blanco' as ColorPrenda,
  talla: '',
  ubicacion: '',
  notas: '',
})

// Ubicaciones ya usadas EN ese armario → <datalist> (autocompletar)
const ubicaciones = computed(() =>
  ubicacionesUsadas(prendas.value.filter((p) => p.dueno === formulario.value.dueno)),
)

/**
 * Tipos que ofrece el select del formulario: los del armario elegido y,
 * si la prenda trae un tipo de otro armario (se está moviendo), ese
 * tipo se antepone para no perderlo de la lista.
 */
const tiposFormulario = computed(() => {
  const lista = tiposPara(formulario.value.dueno)
  if (lista.some((t) => t.id === formulario.value.tipo)) return lista
  const actual = TIPOS_PRENDA.find((t) => t.id === formulario.value.tipo)
  return actual ? [actual, ...lista] : lista
})

// Foto elegida en el formulario (se comprime al guardar)
const archivoFoto = ref<File | null>(null)
const vistaPrevia = ref<string | null>(null)

function limpiarVistaPrevia() {
  if (vistaPrevia.value) URL.revokeObjectURL(vistaPrevia.value)
  vistaPrevia.value = null
  archivoFoto.value = null
}

onUnmounted(limpiarVistaPrevia)

function alElegirFoto(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const archivo = entrada.files?.[0] ?? null
  limpiarVistaPrevia()
  if (archivo) {
    archivoFoto.value = archivo
    vistaPrevia.value = URL.createObjectURL(archivo)
  }
  // Permite re-elegir el mismo archivo tras cancelar
  entrada.value = ''
}

function abrirAlta(tipo?: TipoPrenda) {
  editando.value = null
  formulario.value = {
    dueno: duenoActivo.value,
    tipo: tipo ?? tiposCatalogo.value[0]!.id,
    color: 'blanco',
    talla: '',
    ubicacion: '',
    notas: '',
  }
  limpiarVistaPrevia()
  hojaAbierta.value = true
}

function abrirEdicion(prenda: Prenda) {
  editando.value = prenda
  formulario.value = {
    dueno: prenda.dueno,
    tipo: prenda.tipo,
    color: prenda.color,
    talla: prenda.talla ?? '',
    ubicacion: prenda.ubicacion ?? '',
    notas: prenda.notas ?? '',
  }
  limpiarVistaPrevia()
  hojaAbierta.value = true
}

/** Foto que enseña la hoja: la nueva elegida, o la actual de la prenda */
const fotoHoja = computed(
  () =>
    vistaPrevia.value ??
    (editando.value?.foto_path ? (fotos.value.get(editando.value.foto_path) ?? null) : null),
)

async function guardarPrenda() {
  const bebe = bebeStore.bebe
  if (!bebe || guardando.value) return
  guardando.value = true
  error.value = ''
  try {
    // 1) Si hay foto nueva: comprimir y subir ANTES de tocar la fila
    let fotoNueva: string | null = null
    if (archivoFoto.value) {
      const comprimida = await comprimirImagen(archivoFoto.value)
      fotoNueva = await servicio.subirFotoPrenda(bebe.id, comprimida)
    }
    const datos = formulario.value
    if (editando.value) {
      const anterior = editando.value.foto_path
      await servicio.actualizarPrenda(editando.value.id, {
        dueno: datos.dueno,
        tipo: datos.tipo,
        color: datos.color,
        talla: datos.talla.trim() || null,
        ubicacion: datos.ubicacion.trim() || null,
        notas: datos.notas.trim() || null,
        ...(fotoNueva ? { foto_path: fotoNueva } : {}),
      })
      // La foto sustituida se borra al final (huérfana es mejor que rota)
      if (fotoNueva && anterior) {
        await servicio.eliminarFotoPrenda(anterior).catch(() => undefined)
      }
    } else {
      await servicio.crearPrenda({
        bebe_id: bebe.id,
        dueno: datos.dueno,
        tipo: datos.tipo,
        color: datos.color,
        talla: datos.talla.trim() || null,
        ubicacion: datos.ubicacion.trim() || null,
        notas: datos.notas.trim() || null,
        foto_path: fotoNueva,
      })
    }
    hojaAbierta.value = false
    limpiarVistaPrevia()
    await recargarAhora()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    guardando.value = false
  }
}

async function borrarPrenda() {
  const prenda = editando.value
  if (!prenda || guardando.value) return
  if (!window.confirm(`¿Borrar "${tituloPrenda(prenda)}" del armario?`)) return
  guardando.value = true
  error.value = ''
  try {
    await servicio.eliminarPrenda(prenda)
    hojaAbierta.value = false
    limpiarVistaPrevia()
    await recargarAhora()
  } catch (e) {
    error.value = mensajeError(e)
  } finally {
    guardando.value = false
  }
}

function emojiTipo(tipo: TipoPrenda): string {
  return TIPOS_PRENDA.find((t) => t.id === tipo)?.emoji ?? '⭐'
}

function hexColor(color: ColorPrenda): string {
  return COLORES_PRENDA.find((c) => c.id === color)?.hex ?? '#ccc'
}
</script>

<template>
  <main class="pantalla">
    <div class="tarjeta cabecera-armario">
      <div>
        <h2 class="titulo-vista">👕 Armario</h2>
        <div class="selector-armario" role="group" aria-label="De quién es el armario">
          <button
            v-for="d in DUENOS_ARMARIO"
            :key="d.id"
            class="dueno"
            :class="{ activo: duenoActivo === d.id }"
            :aria-pressed="duenoActivo === d.id"
            @click="duenoActivo = d.id"
          >
            {{ d.emoji }} {{ d.etiqueta }}
          </button>
        </div>
      </div>
      <button class="boton" @click="abrirCatalogoTipos">+ Prenda</button>
    </div>

    <template v-if="cargando">
      <div class="esqueleto" style="height: 90px"></div>
      <div class="esqueleto" style="height: 220px"></div>
    </template>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!cargando">
      <!-- Filtros: chips de tipo (solo los que tienen prendas) + colores -->
      <div v-if="prendasDueno.length > 0" class="tarjeta">
        <div class="chips">
          <button
            v-for="r in resumen"
            :key="r.tipo"
            class="chip"
            :class="{ activo: filtroTipo === r.tipo }"
            @click="alternarTipo(r.tipo)"
          >
            {{ emojiTipo(r.tipo) }} {{ r.etiqueta }} · {{ r.n }}
          </button>
        </div>
        <div class="swatches" role="group" aria-label="Filtrar por color">
          <button
            v-for="c in COLORES_PRENDA"
            :key="c.id"
            class="swatch"
            :class="{ activo: filtroColor === c.id, multicolor: c.id === 'multicolor' }"
            :style="c.id === 'multicolor' ? {} : { background: c.hex }"
            :aria-label="`Color ${c.etiqueta}`"
            :aria-pressed="filtroColor === c.id"
            :title="c.etiqueta"
            @click="alternarColor(c.id)"
          ></button>
        </div>
        <p class="suave contador">
          {{ prendasVisibles.length }}
          {{ prendasVisibles.length === 1 ? 'prenda' : 'prendas' }}
          <template v-if="filtroTipo || filtroColor"> (de {{ prendasDueno.length }})</template>
        </p>
      </div>

      <p v-if="prendasDueno.length === 0" class="tarjeta suave">
        El armario de {{ etiquetaDueno(duenoActivo) }} está vacío. Dale a «+ Prenda» y estrénalo con
        una foto 📸
      </p>

      <!-- Rejilla por tipos: cabecera de grupo (tocarla filtra ese tipo);
           con un tipo ya filtrado, la lista va plana -->
      <section v-for="grupo in gruposVisibles" :key="grupo.tipo" class="grupo-tipo">
        <button
          v-if="agrupada"
          class="cabecera-grupo"
          :aria-label="`Ver solo ${grupo.etiqueta}`"
          @click="alternarTipo(grupo.tipo)"
        >
          <span>{{ grupo.emoji }} {{ grupo.etiqueta }}</span>
          <span class="suave">{{ grupo.prendas.length }} ›</span>
        </button>
        <div class="rejilla">
          <button
            v-for="prenda in grupo.prendas"
            :key="prenda.id"
            class="prenda"
            :aria-label="`Editar: ${tituloPrenda(prenda)}`"
            @click="abrirEdicion(prenda)"
          >
            <span class="prenda-foto">
              <img
                v-if="prenda.foto_path && fotos.get(prenda.foto_path)"
                :src="fotos.get(prenda.foto_path)"
                alt=""
                loading="lazy"
              />
              <span v-else class="prenda-emoji" aria-hidden="true">{{
                emojiTipo(prenda.tipo)
              }}</span>
            </span>
            <span class="prenda-datos">
              <span
                class="punto-color"
                :class="{ multicolor: prenda.color === 'multicolor' }"
                :style="prenda.color === 'multicolor' ? {} : { background: hexColor(prenda.color) }"
              ></span>
              <span class="prenda-titulo">
                {{ tituloPrenda(prenda) }}
                <span v-if="prenda.ubicacion" class="suave prenda-ubicacion">
                  📍 {{ prenda.ubicacion }}
                </span>
              </span>
            </span>
          </button>
        </div>
      </section>
    </template>

    <!-- Catálogo de tipos: qué prenda vas a dar de alta -->
    <HojaInferior
      :abierta="hojaTipos"
      :titulo="`¿Qué prenda es? (${etiquetaDueno(duenoActivo)})`"
      @cerrar="hojaTipos = false"
    >
      <div class="catalogo-tipos">
        <button
          v-for="t in tiposCatalogo"
          :key="t.id"
          class="tipo-acceso"
          @click="elegirTipo(t.id)"
        >
          <span class="tipo-emoji" aria-hidden="true">{{ t.emoji }}</span>
          <span>{{ t.etiqueta }}</span>
        </button>
      </div>
    </HojaInferior>

    <!-- Alta / edición -->
    <HojaInferior
      :abierta="hojaAbierta"
      :titulo="editando ? 'Editar prenda' : 'Nueva prenda'"
      @cerrar="hojaAbierta = false"
    >
      <form @submit.prevent="guardarPrenda">
        <!-- Foto: vista previa (la elegida o la actual) + cámara/galería -->
        <div v-if="fotoHoja" class="zona-foto">
          <img :src="fotoHoja" alt="Foto de la prenda" />
        </div>
        <div class="botones-foto">
          <label class="boton secundario boton-foto">
            📷 {{ fotoHoja ? 'Repetir con cámara' : 'Hacer foto' }}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              @change="alElegirFoto"
            />
          </label>
          <label class="boton secundario boton-foto">
            🖼️ Galería
            <input type="file" accept="image/*" hidden @change="alElegirFoto" />
          </label>
        </div>

        <div class="campo">
          <label for="prenda-dueno">Armario de</label>
          <select id="prenda-dueno" v-model="formulario.dueno">
            <option v-for="d in DUENOS_ARMARIO" :key="d.id" :value="d.id">
              {{ d.emoji }} {{ d.etiqueta }}
            </option>
          </select>
        </div>

        <div class="campo">
          <label for="prenda-tipo">Tipo de prenda</label>
          <select id="prenda-tipo" v-model="formulario.tipo">
            <option v-for="t in tiposFormulario" :key="t.id" :value="t.id">
              {{ t.emoji }} {{ t.etiqueta }}
            </option>
          </select>
        </div>

        <div class="campo">
          <label>Color</label>
          <div class="swatches" role="radiogroup" aria-label="Color de la prenda">
            <button
              v-for="c in COLORES_PRENDA"
              :key="c.id"
              type="button"
              class="swatch"
              :class="{ activo: formulario.color === c.id, multicolor: c.id === 'multicolor' }"
              :style="c.id === 'multicolor' ? {} : { background: c.hex }"
              :aria-label="c.etiqueta"
              :aria-pressed="formulario.color === c.id"
              :title="c.etiqueta"
              @click="formulario.color = c.id"
            ></button>
          </div>
          <p class="suave color-elegido">
            {{ COLORES_PRENDA.find((c) => c.id === formulario.color)?.etiqueta }}
          </p>
        </div>

        <div class="campo">
          <label for="prenda-talla">Talla (como diga la etiqueta)</label>
          <input
            id="prenda-talla"
            v-model="formulario.talla"
            type="text"
            placeholder="3-6 m, 68…"
          />
        </div>

        <div class="campo">
          <label for="prenda-ubicacion">Dónde se guarda</label>
          <input
            id="prenda-ubicacion"
            v-model="formulario.ubicacion"
            type="text"
            list="ubicaciones-usadas"
            placeholder="Cómoda, cajón de arriba…"
          />
          <datalist id="ubicaciones-usadas">
            <option v-for="u in ubicaciones" :key="u" :value="u" />
          </datalist>
        </div>

        <div class="campo">
          <label for="prenda-notas">Notas</label>
          <input
            id="prenda-notas"
            v-model="formulario.notas"
            type="text"
            placeholder="Regalo de la abuela…"
          />
        </div>

        <div class="botones-prenda">
          <button class="boton" type="submit" :disabled="guardando">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
          <button
            v-if="editando"
            class="boton peligro"
            type="button"
            :disabled="guardando"
            @click="borrarPrenda"
          >
            Borrar
          </button>
        </div>
      </form>
    </HojaInferior>
  </main>
</template>

<style scoped>
.cabecera-armario {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

/* Selector del armario de la familia (Carlota / Cristina / Ángel) */
.selector-armario {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.dueno {
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  color: var(--color-texto);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.dueno.activo {
  background: var(--color-accion);
  border-color: var(--color-accion);
  color: #fff;
}

/* Catálogo de tipos (hoja del +): rejilla de accesos como la de Hoy */
.catalogo-tipos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.tipo-acceso {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.7rem 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: var(--color-fondo);
  color: var(--color-texto);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  transition: background 0.15s;
}

.tipo-acceso:hover {
  background: var(--color-borde);
}

.tipo-emoji {
  font-size: 1.5rem;
  line-height: 1;
}

/* Chips de tipo */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  color: var(--color-texto);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font-size: 0.85rem;
}

.chip.activo {
  background: var(--color-accion);
  border-color: var(--color-accion);
  color: #fff;
}

/* Swatches de color (filtro y formulario) */
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.7rem;
}

.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--color-borde);
  padding: 0;
  flex-shrink: 0;
}

.swatch.activo {
  border-color: var(--color-accion);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accion) 45%, transparent);
}

.swatch.multicolor,
.punto-color.multicolor {
  background: conic-gradient(#d64545, #f5d442, #5ca86f, #3f6fb5, #9b6bbf, #d64545);
}

.contador {
  margin: 0.6rem 0 0;
  font-size: 0.82rem;
}

/* Grupos por tipo */
.grupo-tipo {
  margin-bottom: 1rem;
}

.cabecera-grupo {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  padding: 0.2rem 0.15rem 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-texto);
}

/* Rejilla de prendas */
.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.prenda {
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-s);
  background: var(--color-tarjeta);
  box-shadow: var(--sombra);
  overflow: hidden;
  text-align: left;
  color: var(--color-texto);
}

.prenda-foto {
  display: block;
  aspect-ratio: 1;
  background: var(--color-primario-suave);
  position: relative;
}

.prenda-foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.prenda-emoji {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.6rem;
}

.prenda-datos {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
}

.punto-color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--color-borde);
  flex-shrink: 0;
}

.prenda-titulo {
  font-size: 0.82rem;
  line-height: 1.25;
}

.prenda-ubicacion {
  display: block;
  font-size: 0.74rem;
}

/* Hoja de alta/edición */
.zona-foto {
  display: block;
  aspect-ratio: 4 / 3;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-s);
  background: var(--color-fondo);
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.botones-foto {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.boton-foto {
  flex: 1;
  text-align: center;
  cursor: pointer;
}

.zona-foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.color-elegido {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
}

.botones-prenda {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
