/**
 * semanasDesarrollo.ts — "¿Qué hay de nuevo esta semana?": cambios de
 * desarrollo y ajustes de sueño/tomas esperables para cada semana de vida
 * (0-100), precargados por etapas.
 *
 * Basado en los hitos estándar de desarrollo infantil (CDC "Learn the
 * Signs", AAP/HealthyChildren, NHS). ORIENTATIVO: cada bebé va a su ritmo;
 * las dudas se hablan con el pediatra.
 */

export interface EtapaDesarrollo {
  desdeSemana: number
  hastaSemana: number // inclusive
  titulo: string
  cambios: string[]
  sueno: string
  tomas: string
}

export const ETAPAS_DESARROLLO: EtapaDesarrollo[] = [
  {
    desdeSemana: 0,
    hastaSemana: 1,
    titulo: 'Recién nacida',
    cambios: [
      'Pierde un poco de peso los primeros días y lo recupera hacia los 10-14 días',
      'Enfoca a 20-30 cm: justo la distancia a tu cara cuando la coges',
      'Se calma con el contacto piel con piel, tu voz y el movimiento suave',
      'La caída del cordón suele llegar entre la primera y la segunda semana',
    ],
    sueno:
      'Duerme casi todo el día (14-17 h) en tramos cortos de 2-4 h, sin distinguir día y noche.',
    tomas: 'A demanda, 8-12 tomas al día; estómago pequeño, tomas cortas y frecuentes.',
  },
  {
    desdeSemana: 2,
    hastaSemana: 3,
    titulo: 'Primeros estirones',
    cambios: [
      'Cada vez más ratos despierta y alerta',
      'Sigue brevemente con la mirada una cara u objeto que se mueve despacio',
      'Reconoce tu voz y tu olor',
      'Primer brote de crecimiento (~2-3 semanas): días de querer comer sin parar',
    ],
    sueno:
      'Sigue sin patrón fijo; siestas irregulares. Sacarla a la luz de día ayuda a montar el reloj interno.',
    tomas: 'El brote de crecimiento aumenta el apetito unos días: es normal y pasa solo.',
  },
  {
    desdeSemana: 4,
    hastaSemana: 5,
    titulo: 'Un mes: cabeza arriba',
    cambios: [
      'Boca abajo levanta la cabeza unos segundos (¡tummy time a diario!)',
      'Fija la mirada en caras y contrastes',
      'Primeros sonidos guturales',
      'El llanto de la tarde puede ir a más: su pico llega hacia la semana 6',
    ],
    sueno:
      'Empieza a distinguir día y noche. Noches con algo más de agrupación; paciencia con la tarde.',
    tomas: 'Se van espaciando un poco; sigue mandando la demanda.',
  },
  {
    desdeSemana: 6,
    hastaSemana: 7,
    titulo: '¡Primera sonrisa social!',
    cambios: [
      'Sonríe en respuesta a vosotros: la primera sonrisa "de verdad" 🎉',
      'Sigue objetos en un arco completo (180°)',
      'Aguanta más el tummy time y empuja con los antebrazos',
      'El llanto/cólico toca techo esta semana y empieza a bajar',
    ],
    sueno: 'Puede alargar un primer tramo nocturno de 4-5 h. Una mini-rutina de noche ya ayuda.',
    tomas: 'Tomas más eficientes: come lo mismo en menos tiempo.',
  },
  {
    desdeSemana: 8,
    hastaSemana: 9,
    titulo: 'Dos meses: gorjeos',
    cambios: [
      'Revisión y vacunas de los 2 meses',
      'Gorjea y hace "ajo"; conversa por turnos si le hablas',
      'Mantiene la cabeza bastante más firme',
      'Abre las manos y empieza a mirárselas',
    ],
    sueno: 'Ventanas despierta de ~60-90 min; puede consolidar 5-6 h nocturnas seguidas.',
    tomas:
      'Patrón más regular, tomas algo más grandes y espaciadas. Tras las vacunas puede comer menos 1-2 días.',
  },
  {
    desdeSemana: 10,
    hastaSemana: 12,
    titulo: 'Tres meses: se ríe',
    cambios: [
      'Sostiene la cabeza con firmeza',
      'Primeras carcajadas',
      'Agarra lo que le pones en la mano y lo agita',
      'Descubre sus manos y se entretiene con ellas',
    ],
    sueno: 'La noche se consolida; las siestas empiezan a definirse (3-4 al día).',
    tomas: 'Rápidas y regulares; suelen caer tomas nocturnas.',
  },
  {
    desdeSemana: 13,
    hastaSemana: 16,
    titulo: 'Cuatro meses: gira y balbucea',
    cambios: [
      'Se gira de boca abajo a boca arriba',
      'Alcanza objetos y se lo lleva todo a la boca',
      'Balbucea encadenando sonidos',
      'Revisión y vacunas de los 4 meses',
    ],
    sueno:
      'Posible "regresión de los 4 meses": el sueño madura y hay más despertares unas semanas. Rutina constante y calma: pasa.',
    tomas: 'Se distrae comiendo con cualquier cosa: mejor un sitio tranquilo y con poca luz.',
  },
  {
    desdeSemana: 17,
    hastaSemana: 21,
    titulo: 'Cinco meses: todo a la mano',
    cambios: [
      'Gira en ambos sentidos: ¡no dejarla sola en alturas!',
      'Pasa objetos de una mano a otra',
      'Empieza a reaccionar a su nombre',
      'Le fascina lo que hay en vuestro plato',
    ],
    sueno: 'Unas 12-15 h; 3 siestas típicas y la noche cada vez más larga.',
    tomas: 'Solo leche todavía; el interés por la comida anuncia los sólidos (~6 meses).',
  },
  {
    desdeSemana: 22,
    hastaSemana: 26,
    titulo: 'Seis meses: llegan los sólidos',
    cambios: [
      'Se sienta con apoyo y va ganando equilibrio',
      'Empieza la alimentación complementaria (~6 meses cumplidos)',
      'Vacunas de los 6 meses',
      'Responde claramente a su nombre',
    ],
    sueno: 'Muchos bebés duermen ya tramos nocturnos largos; 2-3 siestas.',
    tomas:
      'La leche sigue siendo lo principal (500-600 ml/día mínimo). Sólidos suaves, de uno en uno; sin sal ni miel.',
  },
  {
    desdeSemana: 27,
    hastaSemana: 34,
    titulo: 'Siete-ocho meses: se sienta sola',
    cambios: [
      'Se sienta sin apoyo y juega sentada',
      'Se arrastra o prepara el gateo',
      'Rastrilla objetos pequeños con la mano',
      'Empieza la cautela con desconocidos: es un avance, no un retroceso',
    ],
    sueno:
      'Hacia 2 siestas. Los hitos motores pueden dar despertares: practica de día, calma de noche.',
    tomas: '2-3 comidas de sólidos + su leche; trocitos blandos para practicar.',
  },
  {
    desdeSemana: 35,
    hastaSemana: 43,
    titulo: 'Nueve-diez meses: gateo y pinza',
    cambios: [
      'Gatea y se pone de pie agarrándose',
      'Pinza con pulgar e índice: coge trocitos pequeños',
      'Dice "mamá/papá" (todavía a cualquiera 😄)',
      'Busca objetos que le escondes: permanencia del objeto',
    ],
    sueno:
      '2 siestas; la angustia de separación puede asomar de noche — despedidas cortas y previsibles.',
    tomas: '3 comidas + algún tentempié; practica con vaso abierto o con boquilla.',
  },
  {
    desdeSemana: 44,
    hastaSemana: 52,
    titulo: 'Once-doce meses: casi andando',
    cambios: [
      'Camina agarrada a los muebles; quizá primeros pasos sueltos',
      'Primeras palabras con intención',
      'Señala lo que quiere e imita gestos (adiós, palmas)',
      'Revisión de los 12 meses a la vista',
    ],
    sueno: 'Se acerca al rango de 11-14 h; 2 siestas estables.',
    tomas:
      'Come casi de todo (miel ya sí a partir del año; ojo con frutos secos enteros). Al año puede pasar a leche entera de vaca.',
  },
  {
    desdeSemana: 53,
    hastaSemana: 65,
    titulo: 'Trece-quince meses: pasitos y cuchara',
    cambios: [
      'Anda sola y se agacha a coger cosas',
      'Usa la cuchara (con estropicio incluido)',
      'Torres de 2 cubos; mete y saca objetos',
      'De 3 a 5 palabras y subiendo; entiende muchísimo más',
    ],
    sueno:
      'Entre los 12 y 18 meses se pasa de 2 siestas a 1: días raros de transición son normales.',
    tomas: '3 comidas + 2 meriendas; leche ~2 raciones al día (350-500 ml).',
  },
  {
    desdeSemana: 66,
    hastaSemana: 78,
    titulo: 'Dieciséis-dieciocho meses: a correr',
    cambios: [
      'Corre (y se cae, y se levanta)',
      'Sube escalones gateando o de la mano',
      '10-20 palabras; señala partes del cuerpo',
      'Primeras rabietas: frustración normal de querer más de lo que puede',
    ],
    sueno:
      '1 siesta (1,5-3 h) y 11-14 h en total. Rutina firme y cariñosa contra la resistencia a dormir.',
    tomas:
      'Come lo de la familia, troceado. El apetito irregular a esta edad es completamente normal.',
  },
  {
    desdeSemana: 79,
    hastaSemana: 91,
    titulo: 'Diecinueve-veintiún meses: frases y juego simbólico',
    cambios: [
      'Empieza a juntar 2 palabras ("más agua")',
      'Juego simbólico: da de comer al muñeco, habla por teléfono',
      'Chuta una pelota; ayuda a vestirse',
      'Sigue instrucciones sencillas de un paso',
    ],
    sueno:
      '1 siesta; puede aparecer resistencia a acostarse (autonomía). Elecciones pequeñas ayudan ("¿este pijama o este?").',
    tomas: 'Cuchara y vaso con soltura; raciones pequeñas y variadas, sin forzar.',
  },
  {
    desdeSemana: 92,
    hastaSemana: 100,
    titulo: 'Camino de los dos años',
    cambios: [
      'Sube escaleras con apoyo, salta con los dos pies',
      'Torres de 4-6 cubos; garabatea',
      '50+ palabras y frases de 2; sigue instrucciones de 2 pasos',
      'Revisión de los 2 años a la vuelta de la esquina',
    ],
    sueno:
      '11-14 h con 1 siesta. Los miedos nocturnos tempranos se calman con rutina y compañía breve.',
    tomas: '3 comidas + 2 meriendas como la familia; leche ~2 raciones al día.',
  },
]

/** La etapa de desarrollo de la semana pedida (0-100), o null fuera de rango */
export function desarrolloSemana(semana: number): EtapaDesarrollo | null {
  const s = Math.floor(semana)
  return ETAPAS_DESARROLLO.find((e) => s >= e.desdeSemana && s <= e.hastaSemana) ?? null
}
