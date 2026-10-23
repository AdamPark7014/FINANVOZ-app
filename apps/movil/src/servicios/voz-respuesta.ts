import type { Centavos } from '@cartera/core';
import { z } from 'zod';
import type { ChipRespuesta, TurnoAsistente } from '../asistente/tipos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import type { PropuestaEntendi } from '../ui/entendi';
import { enteroEnPalabras, etiquetaHablada } from '../ui/formato';
import { obtenerBloqueo } from './ajustes';
import type { Contexto } from './contexto';
import { escribirAjuste, leerAjuste } from './preferencias';

const AjustesVozRespuesta = z.strictObject({ activa: z.boolean() });
export type AjustesVozRespuesta = z.infer<typeof AjustesVozRespuesta>;

/**
 * "Contestarte en voz": tras dictar, Finanvoz dice lo que registró y cuánto puedes gastar hoy. Encendido por
 * omisión, salvo con el bloqueo biométrico activo (quien protege la app tampoco quiere cifras en voz alta).
 */
export function obtenerVozRespuesta(ctx: Contexto): AjustesVozRespuesta {
  return leerAjuste(ctx, 'voz_respuesta', AjustesVozRespuesta) ?? { activa: !obtenerBloqueo(ctx).activo };
}

export function fijarVozRespuesta(ctx: Contexto, activa: boolean): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, 'voz_respuesta', AjustesVozRespuesta, { activa });
}

// ——— Lo que dice el asistente (Ola 7) ———
//
// El texto hablado no es el de la pantalla: frases cortas y cálidas, cifras como se dicen («veinticinco», «mil
// quinientos») y nada de símbolos ni abreviaturas («Nu ••4410» → «tu Nu»). Describe, no aconseja (`08 §1`), sin
// exclamaciones. Las cifras ya vienen calculadas en el turno (regla 4): aquí solo se dicen. Nada de esto va a logs.

/** «No te entendí» sin repetir lo que se oyó (la pantalla lo muestra y se puede tocar). */
export const FRASE_NO_ENTENDI = 'No te entendí bien. Elige una opción o dímelo de otra forma.';
export const FRASE_NO_ENTENDI_SIN_OPCIONES = 'No te entendí bien. ¿Me lo dices de otra forma?';
/** Tras un registro que deja el día en cero o menos. */
export const FRASE_SIN_DIA = 'Por hoy ya no te queda para gastar.';
/** Tarjeta «Entendí» cuyo título no trae pregunta. */
export const PREGUNTA_ENTENDI = '¿Está bien así?';

/** Lo mínimo de un turno: los de la persona no se dicen; las clases que no conoce, tampoco. */
export interface TurnoHablable {
  readonly de: string;
  readonly clase?: string;
}

export interface DatosHablados {
  /** «Hoy puedes» después del registro (`obtenerHoy`), si el turno no trae «Tu día pasa de… a…». */
  readonly hoyPuedes?: Centavos | null;
}

const CIFRA = String.raw`[−-]?\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?`;
const SOLO_CIFRA = new RegExp(`^${CIFRA}$`);
const MOVIMIENTO = new RegExp(`^(.+?)\\s+(${CIFRA})$`);
const CAMBIO_DIA = new RegExp(`de\\s+(${CIFRA})\\s+a\\s+(${CIFRA})`);
const REGISTRE = /^Registré:?\s+/;
const ES_INGRESO = /^(ingreso|sueldo|n[oó]mina|quincena|me pagaron|pago recibido|cobro|reembolso)/i;

/** `$1,099.90` → 109990; `−$374` → −37400; `null` si no es una cifra con el formato de la UI. */
function centavosDe(cifra: string): Centavos | null {
  const t = cifra.trim();
  if (!SOLO_CIFRA.test(t)) return null;
  const negativo = /^[−-]/.test(t);
  const [pesos = '0', cent = '0'] = t
    .replace(/^[−-]?\$/, '')
    .replace(/,/g, '')
    .split('.');
  const c = Number(pesos) * 100 + Number(cent);
  return negativo ? -c : c;
}

/** «uno» se apocopa ante sustantivo: «veintiún centavos». */
function apocopar(t: string): string {
  return t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
}

/**
 * Una cifra como se dice en una frase corta, sin «pesos» (el contexto ya lo dice): 2500 → «veinticinco»,
 * 150000 → «mil quinientos», 2550 → «veinticinco con cincuenta», 100 → «un peso», 50 → «cincuenta centavos».
 * Con `modo: 'pesos'` se queda con los pesos enteros hacia abajo, como «Hoy puedes» en pantalla.
 */
export function montoDicho(c: Centavos, modo: 'auto' | 'pesos' = 'auto'): string {
  if (!Number.isSafeInteger(c)) return 'una cifra que no tengo';
  const abs = Math.abs(c);
  const pesos = Math.floor(abs / 100);
  const cent = modo === 'pesos' ? 0 : abs % 100;
  if (pesos === 0 && cent === 0) return 'cero';
  const signo = c < 0 ? 'menos ' : '';
  const centavos = cent === 1 ? 'un centavo' : `${apocopar(enteroEnPalabras(cent))} centavos`;
  if (pesos === 0) return `${signo}${centavos}`;
  const base = pesos === 1 ? 'un peso' : enteroEnPalabras(pesos);
  return `${signo}${base}${cent === 0 ? '' : cent === 1 ? ' con un centavo' : ` con ${enteroEnPalabras(cent)}`}`;
}

/** Quita lo que no se dice de un nombre de cuenta: «Nu ••4410», «terminación 4410», «(nómina)». */
function sinMarcas(t: string): string {
  return t
    .replace(/\s*[•*]{2,}\s?\d{2,4}\b/g, '')
    .replace(/\s*terminaci[oó]n\s+\d{2,4}\b/gi, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * La cuenta como se dice: «Efectivo» → «en efectivo»; «Nu ••4410» → «con tu Nu»; «BBVA débito» → «con tu BBVA»;
 * «BBVA crédito» → «con tu BBVA de crédito». Un ingreso entra «en tu BBVA». «Por asignar» no se dice.
 */
export function cuentaDicha(cuenta: string, ingreso = false): string | null {
  const n = sinMarcas(cuenta);
  if (n === '' || /^por asignar$/i.test(n)) return null;
  if (/^efectivo$/i.test(n)) return 'en efectivo';
  const nombre = n
    .replace(/^(mi|tu)\s+/i, '')
    .replace(/\s+(?:de\s+)?d[eé]bito$/i, '')
    .replace(/\s+(?:de\s+)?cr[eé]dito$/i, ' de crédito');
  return `${ingreso ? 'en' : 'con'} tu ${nombre}`;
}

const ABREVIATURAS: readonly (readonly [RegExp, string])[] = [
  [/\bMSI\b/g, 'meses sin intereses'],
  [/\bTDC\b/g, 'tarjeta de crédito'],
  [/\bCFDI\b/g, 'factura'],
  [/\baprox\./gi, 'aproximadamente'],
  [/\bp\. ?ej\./gi, 'por ejemplo'],
  [/\bnúm\./gi, 'número'],
  [/\bmín\./gi, 'mínimo'],
  [/\bmáx\./gi, 'máximo'],
];

/**
 * Un texto de pantalla listo para decirse: sin comillas, viñetas, terminaciones de tarjeta ni exclamaciones; «·» y
 * «→» como pausas; «×2» → «2 veces»; «15 %» → «15 por ciento»; «3/12» → «3 de 12»; abreviaturas completas y cada
 * `$1,500` en palabras (`etiquetaHablada`: «mil quinientos pesos»).
 */
export function limpiarParaVoz(texto: string): string {
  let t = texto
    .replace(/[«»“”"]/g, '')
    .replace(/[¡!]/g, '')
    .replace(/\s*[•*]{2,}\s?\d{2,4}\b/g, '')
    .replace(/\s*terminaci[oó]n\s+\d{2,4}\b/gi, '')
    .replace(/\s+[·—→]\s+/g, ', ')
    .replace(/\s*→\s*/g, ', ')
    .replace(/×\s?(\d+)/g, '$1 veces')
    .replace(/(\d)\s?%/g, '$1 por ciento')
    .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, '$1 de $2')
    .replace(/\+\s?(?=[−-]?\$)/g, 'más ');
  for (const [patron, completa] of ABREVIATURAS) t = t.replace(patron, completa);
  return etiquetaHablada(t)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:?…])/g, '$1')
    .replace(/,\s*([.?…])/g, '$1')
    .trim();
}

function conPunto(t: string): string {
  return t === '' || /[.?…]$/.test(t) ? t : `${t}.`;
}

function mayusculaInicial(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «Coca» → «coca», pero «CFE» o «BBVA» se quedan (se leerían como palabra). */
function minusculaInicial(t: string): string {
  return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/** «a, b y c» (con «e» ante «i»: «coca e iced tea») · «a, b o c» (con «u» ante «o»: «Santander u Oxxo»). */
function unirLista(items: readonly string[], conjuncion: 'y' | 'o'): string {
  if (items.length <= 1) return items[0] ?? '';
  const ultimo = items[items.length - 1] ?? '';
  const c =
    conjuncion === 'y'
      ? /^h?[ií](?![aeouáéóú])/i.test(ultimo)
        ? 'e'
        : 'y'
      : /^h?[oó]/i.test(ultimo)
        ? 'u'
        : 'o';
  return `${items.slice(0, -1).join(', ')} ${c} ${ultimo}`;
}

/** Las primeras `max` oraciones: la voz no lee párrafos (la pantalla muestra todo). */
function recortar(t: string, max = 2): string {
  const oraciones = (t.match(/[^.?…]+(?:[.?…]+|$)/g) ?? []).map((o) => o.trim()).filter((o) => o !== '');
  return oraciones.length <= max ? t : oraciones.slice(0, max).join(' ');
}

/** «Coca $25 · Antojos · Efectivo» → «coca de veinticinco en efectivo» (`resumenMovimiento`). */
function movimientoDicho(texto: string): string | null {
  const partes = texto.split(' · ');
  const m = MOVIMIENTO.exec((partes[0] ?? '').trim());
  if (!m) return null;
  const centavos = centavosDe(m[2] ?? '');
  if (centavos === null) return null;
  const que = minusculaInicial(limpiarParaVoz(sinMarcas(m[1] ?? '')));
  if (que === '') return null;
  // La cuenta siempre va al final; la categoría, si hay, en medio (no se dice: la pantalla la muestra).
  const cuenta =
    partes.length > 1 ? cuentaDicha(partes[partes.length - 1] ?? '', ES_INGRESO.test(que)) : null;
  return `${que} de ${montoDicho(centavos)}${cuenta ? ` ${cuenta}` : ''}`;
}

/** «Registré Coca $25 · Antojos · Efectivo.» → «Listo, coca de veinticinco en efectivo.»; `null` si es otro texto. */
function registroDicho(texto: string): string | null {
  if (!REGISTRE.test(texto)) return null;
  const items = texto
    .replace(REGISTRE, '')
    .replace(/\.\s*$/, '')
    .split('; ')
    .map(movimientoDicho);
  if (items.length === 0 || items.some((i) => i === null)) return null;
  return `Listo, ${unirLista(items as string[], 'y')}.`;
}

/**
 * Cómo queda el día, dicho: de «Tu día pasa de $220 a $189.» (o de `hoyPuedes`) → «Te quedan ciento ochenta y
 * nueve para hoy.»; si subió, «Ahora puedes gastar … hoy.»; en cero o menos, `FRASE_SIN_DIA`. Pesos enteros hacia
 * abajo, como en pantalla.
 */
export function diaDicho(
  cambioDia: string | undefined,
  hoyPuedes: Centavos | null | undefined,
): string | null {
  const m = cambioDia ? CAMBIO_DIA.exec(cambioDia) : null;
  const antes = m ? centavosDe(m[1] ?? '') : null;
  let despues = m ? centavosDe(m[2] ?? '') : null;
  if (despues === null && typeof hoyPuedes === 'number' && Number.isSafeInteger(hoyPuedes))
    despues = hoyPuedes;
  if (despues === null) return null;
  const pesos = Math.floor(despues / 100);
  if (pesos <= 0) return FRASE_SIN_DIA;
  const cifra = montoDicho(pesos * 100, 'pesos');
  if (antes !== null && despues > antes) return `Ahora puedes gastar ${cifra} hoy.`;
  return pesos === 1 ? 'Te queda un peso para hoy.' : `Te quedan ${cifra} para hoy.`;
}

function fraseRegistro(t: Extract<TurnoAsistente, { clase: 'registro' }>, datos: DatosHablados): string {
  const registro = registroDicho(t.texto) ?? recortar(conPunto(limpiarParaVoz(t.texto)), 2);
  const dia = diaDicho(t.cambioDia, datos.hoyPuedes);
  return dia ? `${registro} ${dia}` : registro;
}

/** «Entendí · ¿lo registro?» → «¿Lo registro?». */
function preguntaDe(titulo: string): string {
  const i = titulo.indexOf('¿');
  if (i < 0) return PREGUNTA_ENTENDI;
  const q = limpiarParaVoz(titulo.slice(i));
  return q.length > 2 ? `¿${q.charAt(1).toUpperCase()}${q.slice(2)}` : PREGUNTA_ENTENDI;
}

/**
 * Tarjeta «Entendí»: qué y cuánto, el efecto en tu día si lo trae, y la pregunta con la cuenta
 * («Luz de cuatrocientos cincuenta. ¿Lo registro con tu BBVA?»). La pregunta va al final: luego se escucha el «sí».
 */
function fraseEntendi(p: PropuestaEntendi): string {
  const valor = (...claves: string[]): string | null => {
    for (const clave of claves) {
      const f = p.filas.find((x) => x.clave === clave);
      if (f && f.valor.trim() !== '') return f.valor;
    }
    return null;
  };
  const que = valor('que');
  const filaMonto = valor('monto');
  const centavos = p.monto ?? (filaMonto !== null ? centavosDe(filaMonto) : null);
  const monto =
    centavos !== null ? montoDicho(centavos) : filaMonto !== null ? limpiarParaVoz(filaMonto) : null;
  const filaCuenta = valor('cuenta', 'tarjeta');
  const cuenta = filaCuenta !== null ? cuentaDicha(filaCuenta, que !== null && ES_INGRESO.test(que)) : null;

  let pregunta = preguntaDe(p.titulo);
  const cuentaEnPregunta = cuenta !== null && /^¿(lo|la) (registro|guardo|agrego)\?$/i.test(pregunta);
  if (cuentaEnPregunta) pregunta = `${pregunta.slice(0, -1)} ${cuenta}?`;

  // Sin «qué»: la cifra, o la fila que dice el cambio (ingreso nuevo, colchón), o la primera.
  const principal = valor('despues', 'colchon') ?? p.filas[0]?.valor ?? '';
  let lead =
    que !== null
      ? `${minusculaInicial(limpiarParaVoz(sinMarcas(que)))}${monto ? ` de ${monto}` : ''}`
      : (monto ?? limpiarParaVoz(principal));
  if (cuenta !== null && !cuentaEnPregunta) lead = `${lead} ${cuenta}`.trim();
  const efecto = p.efecto ? conPunto(limpiarParaVoz(p.efecto)) : '';
  return [lead ? `${mayusculaInicial(lead)}.` : '', efecto, pregunta].filter((x) => x !== '').join(' ');
}

/** «¿Cuál tarjeta?» con 2 o 3 opciones cortas → «¿Cuál tarjeta? Nu, BBVA o Santander.» */
function frasePregunta(texto: string, chips: readonly ChipRespuesta[]): string {
  const base = conPunto(limpiarParaVoz(texto));
  if (!base.endsWith('?') || chips.length < 2 || chips.length > 3) return base;
  const opciones = chips.map((c) => limpiarParaVoz(sinMarcas(c.etiqueta)));
  const distintas = new Set(opciones.map((o) => o.toLowerCase())).size === opciones.length;
  if (!distintas || opciones.some((o) => o === '' || o.split(/\s+/).length > 3)) return base;
  return `${base} ${mayusculaInicial(unirLista(opciones, 'o'))}.`;
}

/** Sin dobles espacios ni exclamaciones (`08 §1`), con punto final. */
function pulir(t: string): string {
  return conPunto(
    t
      .replace(/[¡!]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );
}

const CLASES_HABLADAS = new Set(['registro', 'entendi', 'pregunta', 'aviso', 'no_entendi', 'texto']);

/**
 * Lo que el asistente dice en voz alta de un turno suyo (Ola 7): frases cortas, cálidas y claras, distintas del
 * texto de la pantalla. `null` para los turnos de la persona y para las clases que no se dicen.
 *
 * - registro: «Listo, coca de veinticinco en efectivo. Te quedan ciento ochenta y nueve para hoy.»
 * - entendí: «Luz de cuatrocientos cincuenta. ¿Lo registro con tu BBVA?»
 * - pregunta: «¿Cuál tarjeta? Nu, BBVA o Santander.»
 * - aviso y texto: el texto, dicho (dos oraciones como máximo).
 * - no entendí: `FRASE_NO_ENTENDI` (sin repetir lo que se oyó).
 */
export function fraseHablada(turno: TurnoHablable, datos: DatosHablados = {}): string | null {
  if (turno.de !== 'asistente' || turno.clase === undefined || !CLASES_HABLADAS.has(turno.clase)) return null;
  const t = turno as unknown as TurnoAsistente;
  let frase: string;
  switch (t.clase) {
    case 'registro':
      frase = fraseRegistro(t, datos);
      break;
    case 'entendi':
      frase = fraseEntendi(t.propuesta);
      break;
    case 'pregunta':
      frase = frasePregunta(t.texto, t.chips);
      break;
    case 'aviso':
    case 'texto':
      frase = recortar(conPunto(limpiarParaVoz(t.texto)), 2);
      break;
    case 'no_entendi':
      frase = t.opciones.length > 0 ? FRASE_NO_ENTENDI : FRASE_NO_ENTENDI_SIN_OPCIONES;
      break;
  }
  const lista = pulir(frase);
  return lista === '' ? null : lista;
}

// ——— Duración (para mantener las frases cortas) ———

/**
 * Sílabas por segundo de una voz del sistema a velocidad 1 (`expo-speech` `rate: 1`). Medido con siete frases
 * reales de `fraseHablada` en una voz española de Windows (22-10-2026: 4.0 a 6.6 s por frase, unas 6 sílabas/s y
 * 0.3 s por pausa); el habla conversacional en español va de 6 a 7, y «normal» (0.95) queda en unas 5.7.
 */
export const SILABAS_POR_SEGUNDO = 6;
/** Cada coma, punto o signo de pregunta es una pausa breve. */
export const PAUSA_SEGUNDOS = 0.3;

/** Núcleos vocálicos («hoy», «muy» cuentan uno; la «y» sola, uno): basta para estimar. */
export function silabasAproximadas(texto: string): number {
  return (texto.toLowerCase().match(/[aeiouáéíóúü]+y?|\by\b/g) ?? []).length;
}

/** Segundos que tarda en decirse a la velocidad `rate` de `expo-speech` (1 = la del sistema). */
export function segundosHablados(texto: string, rate = 1): number {
  const pausas = (texto.match(/[,.;:?…]/g) ?? []).length;
  return silabasAproximadas(texto) / (SILABAS_POR_SEGUNDO * Math.max(rate, 0.1)) + pausas * PAUSA_SEGUNDOS;
}
