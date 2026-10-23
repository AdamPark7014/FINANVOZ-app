import type { VelocidadVoz } from '../servicios/preferencias';

/**
 * Qué voz del teléfono usa la respuesta hablada (`expo-speech`, todo en el teléfono: sin tokens). Sin React ni
 * módulos nativos: recibe la lista de `Speech.getAvailableVoicesAsync()` y decide. Criterio:
 *
 * 1. Español de México; si no hay, de Estados Unidos; luego Latinoamérica; luego España.
 * 2. iPhone: «premium» (identificador `.premium.`) > «mejorada» (`Enhanced`, p. ej. «Paulina (mejorada)») >
 *    compacta; las voces Eloquence (Eddy, Flo…) al final porque suenan robóticas; las de Siri y las de novedad no
 *    se pueden usar desde una app y se descartan.
 * 3. Android: México y Estados Unidos van juntos; con internet, las voces de red de Google (`-network`) primero;
 *    sin internet se descartan y gana la local (`-local`, mejor si es `Enhanced`). La voz de red y su gemela local
 *    son la misma persona: se guarda una sola clave (sin el sufijo) y al hablar se elige según haya red.
 * 4. Empates: la voz por omisión del sistema para la región (Paulina en iPhone, `sfb` en Google), luego el
 *    identificador, para que la elección sea estable.
 */

export type PlataformaVoz = 'ios' | 'android';
export type CalidadVoz = 'premium' | 'mejorada' | 'red' | 'basica';

/** La forma de `Voice` de expo-speech (`quality`: `'Default'` | `'Enhanced'`). */
export interface VozSistema {
  readonly identifier: string;
  readonly name: string;
  readonly quality: string;
  readonly language: string;
}

export interface CondicionesVoz {
  readonly plataforma: PlataformaVoz;
  /** Hay internet (Android usa las voces de red solo así). */
  readonly enLinea: boolean;
}

/** Una voz para elegir en Ajustes › Voz. */
export interface OpcionVoz {
  /** Lo que se guarda (`AjustesVoz.voz`): identificador en iPhone; en Android, sin `-network`/`-local`. */
  readonly id: string;
  /** «Paulina (mejorada)» · «Voz 1». */
  readonly etiqueta: string;
  /** «Español de México · mejorada». */
  readonly descripcion: string;
  readonly calidad: CalidadVoz;
  readonly idioma: string;
}

const LATAM = new Set([
  '419',
  'AR',
  'BO',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'GT',
  'HN',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
]);

const NOMBRE_REGION: Readonly<Record<string, string>> = {
  MX: 'México',
  US: 'Estados Unidos',
  ES: 'España',
  '419': 'Latinoamérica',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
  PE: 'Perú',
};

const TEXTO_CALIDAD: Readonly<Record<CalidadVoz, string>> = {
  premium: 'premium',
  mejorada: 'mejorada',
  red: 'más natural con internet',
  basica: 'básica',
};

const PUNTOS_CALIDAD: Readonly<Record<CalidadVoz, number>> = { premium: 4, red: 3, mejorada: 2, basica: 1 };

/** Voces por omisión de cada sistema (las más cuidadas): Paulina (es-MX) y Mónica (es-ES) en iPhone, `sfb` en Google. */
const PREFERIDAS = /(\.|^)(paulina|m[oó]nica)\b|-x-sfb-/i;

/** `es_mx` → `es-MX`. */
export function normalizarIdioma(idioma: string): string {
  const [lengua = '', region = ''] = idioma.replace(/_/g, '-').split('-');
  return region ? `${lengua.toLowerCase()}-${region.toUpperCase()}` : lengua.toLowerCase();
}

function regionDe(v: VozSistema): string {
  return normalizarIdioma(v.language).split('-')[1] ?? '';
}

function esEspanol(v: VozSistema): boolean {
  return normalizarIdioma(v.language).split('-')[0] === 'es';
}

/** 0 México · 1 Estados Unidos · 2 Latinoamérica · 3 España · 4 otro español. */
function rangoRegion(v: VozSistema): number {
  const r = regionDe(v);
  if (r === 'MX') return 0;
  if (r === 'US') return 1;
  if (LATAM.has(r)) return 2;
  if (r === 'ES') return 3;
  return 4;
}

function esDeRed(v: VozSistema): boolean {
  return /-network$/i.test(v.identifier);
}

/** Lo que se guarda: en Android la voz de red y su gemela local comparten clave. */
export function claveVoz(v: VozSistema, plataforma: PlataformaVoz): string {
  return plataforma === 'android' ? v.identifier.replace(/-(network|local)$/i, '') : v.identifier;
}

export function calidadVoz(v: VozSistema, plataforma: PlataformaVoz): CalidadVoz {
  const id = v.identifier.toLowerCase();
  if (plataforma === 'ios') {
    if (id.includes('.premium.')) return 'premium';
    if (v.quality === 'Enhanced' || id.includes('.enhanced.') || id.includes('-premium')) return 'mejorada';
    return 'basica';
  }
  if (esDeRed(v)) return 'red';
  return v.quality === 'Enhanced' ? 'mejorada' : 'basica';
}

/** Voces que una app no puede usar (Siri) o que no son para hablar (Bells, Bubbles…). */
function inservible(v: VozSistema, c: CondicionesVoz): boolean {
  const id = v.identifier.toLowerCase();
  if (c.plataforma === 'ios') return id.includes('siri') || id.includes('speech.synthesis.voice');
  return esDeRed(v) && !c.enLinea;
}

/** Eloquence (iPhone) y la pseudo-voz `-language` de Android: solo si no hay otra. */
function relleno(v: VozSistema): boolean {
  const id = v.identifier.toLowerCase();
  return id.includes('eloquence') || /-language$/.test(id);
}

/** Menor es mejor, comparado posición por posición. */
function puntaje(v: VozSistema, c: CondicionesVoz): readonly number[] {
  const region = rangoRegion(v);
  const calidad = -PUNTOS_CALIDAD[calidadVoz(v, c.plataforma)];
  const sobra = relleno(v) ? 1 : 0;
  const preferida = PREFERIDAS.test(v.identifier) || PREFERIDAS.test(v.name) ? 0 : 1;
  if (c.plataforma === 'android') {
    // México y Estados Unidos juntos (las voces de red de Google de la región), luego la calidad.
    const grupo = region <= 1 ? 0 : region - 1;
    return [sobra, grupo, calidad, region, preferida];
  }
  return [sobra, region, calidad, preferida];
}

function comparar(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Voces en español que se pueden usar ahora, de la mejor a la peor. */
export function ordenarVoces(voces: readonly VozSistema[], c: CondicionesVoz): VozSistema[] {
  return voces
    .filter(
      (v) => typeof v.identifier === 'string' && v.identifier !== '' && esEspanol(v) && !inservible(v, c),
    )
    .map((v) => ({ v, p: puntaje(v, c) }))
    .sort((a, b) => comparar(a.p, b.p) || a.v.identifier.localeCompare(b.v.identifier))
    .map(({ v }) => v);
}

/**
 * La voz con la que se habla: la guardada (`preferida`, una `OpcionVoz.id`) si todavía existe —en Android, su
 * versión de red con internet o la local sin él—; si no, la mejor. `null` si el teléfono no tiene voces en español.
 */
export function elegirVoz(
  voces: readonly VozSistema[],
  c: CondicionesVoz,
  preferida: string | null = null,
): VozSistema | null {
  const orden = ordenarVoces(voces, c);
  if (preferida) {
    if (c.plataforma === 'ios') {
      // La misma persona en su mejor versión: si guardaste «Paulina» y luego descargas la mejorada, se usa esa.
      const persona = personaDeIdIos(preferida);
      const guardada = orden.find(
        (v) => v.identifier === preferida || (persona !== null && personaIos(v) === persona),
      );
      if (guardada) return orden.find((v) => personaIos(v) === personaIos(guardada)) ?? guardada;
    } else {
      const guardada = orden.find((v) => claveVoz(v, c.plataforma) === preferida);
      if (guardada) return guardada;
    }
  }
  return orden[0] ?? null;
}

function nombreLimpio(v: VozSistema): string {
  return v.name.replace(/\s*\([^)]*\)/g, '').trim() || v.identifier;
}

/** «es-MX|paulina»: una persona de iPhone, sea compacta, mejorada o premium. */
function personaIos(v: VozSistema): string {
  return `${normalizarIdioma(v.language)}|${nombreLimpio(v).toLowerCase()}`;
}

/** `com.apple.voice.compact.es-MX.Paulina` → «es-MX|paulina» (por si esa versión ya no está instalada). */
function personaDeIdIos(id: string): string | null {
  const m = /\.([a-z]{2}-[A-Za-z]{2,3})\.([^.]+)$/.exec(id);
  return m ? `${normalizarIdioma(m[1] ?? '')}|${(m[2] ?? '').toLowerCase()}` : null;
}

/** «Español de México». */
export function textoIdioma(idioma: string): string {
  const region = normalizarIdioma(idioma).split('-')[1] ?? '';
  const nombre = NOMBRE_REGION[region];
  return nombre ? `Español de ${nombre}` : 'Español';
}

/**
 * Las `n` mejores voces distintas para Ajustes › Voz. En iPhone la compacta y la mejorada de la misma persona son
 * una sola opción (la mejor); en Android, la de red y la local.
 */
export function opcionesVoz(voces: readonly VozSistema[], c: CondicionesVoz, n = 3): OpcionVoz[] {
  const vistas = new Set<string>();
  const opciones: OpcionVoz[] = [];
  for (const v of ordenarVoces(voces, c)) {
    const persona = c.plataforma === 'ios' ? personaIos(v) : claveVoz(v, c.plataforma);
    if (vistas.has(persona)) continue;
    vistas.add(persona);
    const calidad = calidadVoz(v, c.plataforma);
    const nombre = c.plataforma === 'ios' ? nombreLimpio(v) : `Voz ${opciones.length + 1}`;
    const etiqueta =
      c.plataforma === 'ios' && (calidad === 'premium' || calidad === 'mejorada')
        ? `${nombre} (${TEXTO_CALIDAD[calidad]})`
        : nombre;
    opciones.push({
      id: claveVoz(v, c.plataforma),
      etiqueta,
      descripcion: `${textoIdioma(v.language)} · ${TEXTO_CALIDAD[calidad]}`,
      calidad,
      idioma: normalizarIdioma(v.language),
    });
    if (opciones.length >= n) break;
  }
  return opciones;
}

/** iPhone sin una voz mejorada o premium en español de México: vale la pena descargar «Paulina (mejorada)». */
export function faltaVozMejorada(voces: readonly VozSistema[], plataforma: PlataformaVoz): boolean {
  if (plataforma !== 'ios') return false;
  return !voces.some(
    (v) =>
      normalizarIdioma(v.language) === 'es-MX' &&
      !inservible(v, { plataforma, enLinea: false }) &&
      !relleno(v) &&
      calidadVoz(v, plataforma) !== 'basica',
  );
}

/**
 * Ritmo de `expo-speech` por velocidad (1 = el del sistema: `AVSpeechUtteranceDefaultSpeechRate` en iPhone, el de
 * Text-to-Speech en Android). «Normal» queda un poco por debajo: con cifras se entiende mejor y no suena apurado.
 */
export const RITMO_VELOCIDAD: Readonly<Record<VelocidadVoz, number>> = {
  pausada: 0.85,
  normal: 0.95,
  rapida: 1.1,
};

/** Las voces básicas suenan más robóticas mientras más rápido hablan: van un 5 % más lento. */
export const FACTOR_VOZ_BASICA = 0.95;

/**
 * Velocidad y tono para `Speech.speak`. El tono se queda en 1: subirlo o bajarlo es lo que más delata a una voz
 * sintética (y en las voces mejoradas y de red distorsiona el timbre).
 */
export function parametrosVoz(
  calidad: CalidadVoz | null,
  velocidad: VelocidadVoz,
): { readonly rate: number; readonly pitch: number } {
  const factor = calidad === null || calidad === 'basica' ? FACTOR_VOZ_BASICA : 1;
  return { rate: Math.round(RITMO_VELOCIDAD[velocidad] * factor * 100) / 100, pitch: 1 };
}
