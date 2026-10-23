import * as Speech from 'expo-speech';
import { AccessibilityInfo, Platform } from 'react-native';
import type { VelocidadVoz } from '../servicios/preferencias';
import {
  fraseHablada,
  segundosHablados,
  type DatosHablados,
  type TurnoHablable,
} from '../servicios/voz-respuesta';
import { cargarVoces, hayInternet } from './catalogo';
import { prepararAudioRespuestaIOS, soltarAudioRespuestaIOS } from './motor-expo';
import { IDIOMA_DICTADO } from './useDictado';
import { calidadVoz, elegirVoz, parametrosVoz, type PlataformaVoz } from './voces';

export { fraseRespuestaVoz } from './respuesta-textos';

/**
 * La respuesta hablada del asistente, con la voz del teléfono (`expo-speech`): sin red salvo la voz de Google en
 * Android cuando hay internet, y sin tokens. Nada de lo que se dice va a logs (regla 9).
 *
 * - Una frase a la vez: la nueva corta a la anterior; `callarVoz` corta todo (al tocar o al volver a hablar).
 * - Con VoiceOver o TalkBack no habla (el lector ya anuncia el turno), salvo que la persona lo pida (`forzar`).
 * - iPhone: con el interruptor de silencio puesto no se oye (sesión `ambient`), salvo «Hablar aunque el iPhone
 *   esté en silencio» en Ajustes › Voz o `forzar`.
 */

/** Cómo suena (Ajustes › Voz). `useVozAsistente` y Ajustes la mantienen al día. */
export interface ConfigVoz {
  /** `OpcionVoz.id` elegida; `null`: la mejor disponible (`voz/voces`). */
  readonly voz: string | null;
  readonly velocidad: VelocidadVoz;
  /** iPhone: hablar aunque esté en silencio. */
  readonly enSilencio: boolean;
}

export const CONFIG_VOZ_INICIAL: ConfigVoz = { voz: null, velocidad: 'normal', enSilencio: false };

let config: ConfigVoz = CONFIG_VOZ_INICIAL;

export function configurarVoz(cambios: Partial<ConfigVoz>): void {
  config = { ...config, ...cambios };
}

export function configuracionVoz(): ConfigVoz {
  return config;
}

/**
 * Cómo terminó una frase: `dicha` (completa), `cortada` (la cortó un toque, el micrófono u otra frase), `omitida`
 * (no se habló: lector de pantalla o texto vacío), `error` (el teléfono no pudo).
 */
export type FinHabla = 'dicha' | 'cortada' | 'omitida' | 'error';

export interface OpcionesHabla {
  /** La pidió la persona (p. ej. «Escuchar» en Ajustes): habla aunque haya lector de pantalla o silencio. */
  readonly forzar?: boolean;
  /** Para esta frase, en vez de la configurada. */
  readonly voz?: string | null;
  readonly velocidad?: VelocidadVoz;
  readonly enSilencio?: boolean;
}

interface Pendiente {
  readonly id: number;
  readonly terminar: (fin: FinHabla) => void;
  /** Bajó la música (`duckOthers`): al cortarla hay que soltar la sesión. */
  readonly bajaMusica: boolean;
}

let turno = 0;
let pendiente: Pendiente | null = null;
const oyentes = new Set<(hablando: boolean) => void>();

function avisar(hablando: boolean): void {
  for (const f of [...oyentes]) {
    try {
      f(hablando);
    } catch {
      // Un oyente roto no detiene la voz.
    }
  }
}

/** Avisa cuando empieza y termina de hablar (animaciones, cortar al tocar). */
export function suscribirHabla(f: (hablando: boolean) => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

export function estaHablando(): boolean {
  return pendiente !== null;
}

function plataforma(): PlataformaVoz {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

async function lectorActivo(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch {
    return false;
  }
}

function detenerNativo(): void {
  try {
    Promise.resolve(Speech.stop()).catch(() => {});
  } catch {
    // Sin módulo nativo (pruebas, web): no hay nada que callar.
  }
}

/**
 * Dice `texto` (ya en palabras: `fraseHablada`) y resuelve cuando termina. Úsalo con `await` antes de volver a
 * escuchar (p. ej. la confirmación por voz): si el micrófono empieza mientras habla, la corta.
 */
export async function hablar(texto: string, o: OpcionesHabla = {}): Promise<FinHabla> {
  const frase = texto.trim();
  if (frase === '') return 'omitida';
  const id = ++turno;
  if (pendiente) {
    pendiente.terminar('cortada');
    detenerNativo();
  }
  if (!o.forzar && (await lectorActivo())) return turno === id ? 'omitida' : 'cortada';
  const p = plataforma();
  const [voces, enLinea] = await Promise.all([cargarVoces(), p === 'android' ? hayInternet() : false]);
  if (turno !== id) return 'cortada';

  const voz = elegirVoz(voces, { plataforma: p, enLinea }, o.voz !== undefined ? o.voz : config.voz);
  const { rate, pitch } = parametrosVoz(voz ? calidadVoz(voz, p) : null, o.velocidad ?? config.velocidad);
  const enSilencio = o.forzar === true || (o.enSilencio ?? config.enSilencio);
  const sesionApp = p === 'ios' && prepararAudioRespuestaIOS(enSilencio);
  const bajaMusica = sesionApp && enSilencio;

  return new Promise<FinHabla>((resolve) => {
    let hecho = false;
    // Por si el teléfono nunca avisa que terminó: quien espera (la confirmación por voz) no se queda colgado.
    const limite = setTimeout(() => terminar('dicha'), (segundosHablados(frase, rate) * 2 + 3) * 1000);
    function terminar(fin: FinHabla): void {
      if (hecho) return;
      hecho = true;
      clearTimeout(limite);
      if (pendiente?.id === id) {
        pendiente = null;
        avisar(false);
      }
      // Cortada por otra frase o por el micrófono: ellos usan el audio enseguida (callarVoz suelta si hace falta).
      if (bajaMusica && fin !== 'cortada') soltarAudioRespuestaIOS();
      resolve(fin);
    }
    pendiente = { id, terminar, bajaMusica };
    avisar(true);
    detenerNativo();
    try {
      Speech.speak(frase, {
        language: IDIOMA_DICTADO,
        ...(voz ? { voice: voz.identifier } : {}),
        rate,
        pitch,
        ...(p === 'ios' ? { useApplicationAudioSession: sesionApp } : {}),
        onDone: () => terminar('dicha'),
        onStopped: () => terminar('cortada'),
        onError: () => terminar('error'),
      });
    } catch {
      terminar('error');
    }
  });
}

/** Dice un turno del asistente (`fraseHablada`); `omitida` si el turno no se dice (los de la persona). */
export function decirTurno(
  turnoAsistente: TurnoHablable,
  datos: DatosHablados = {},
  o: OpcionesHabla = {},
): Promise<FinHabla> {
  const frase = fraseHablada(turnoAsistente, datos);
  return frase ? hablar(frase, o) : Promise.resolve('omitida');
}

/** Dice el texto con la voz configurada. Igual que `hablar`; se conserva el nombre de antes. */
export function decirEnVoz(texto: string): Promise<FinHabla> {
  return hablar(texto);
}

/**
 * Calla la respuesta en curso y la que esté por empezar: al tocar la pantalla o el micrófono (para no grabarla).
 * Quien la esperaba recibe `cortada`.
 */
export function callarVoz(): void {
  const actual = pendiente;
  turno++;
  if (actual) {
    actual.terminar('cortada');
    if (actual.bajaMusica) soltarAudioRespuestaIOS();
  }
  detenerNativo();
}
