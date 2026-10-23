import type { IdFlujo } from './tipos';

/**
 * Chips de intención de la barra de voz (Ola 7 §5): atajos de una frase. Los de prefijo abren el dictado (o
 * escriben en el campo abierto) con el arranque de la frase; los de flujo empiezan una conversación (arqueo,
 * pagar tarjeta). Máximo 5; «¿Puedo gastar…?» va primero (la función estrella: se contesta en la conversación, en
 * Gratis con tu día y en Plus también con la probabilidad); los dos últimos solo si hay efectivo / tarjetas.
 */
export type ClaveIntencion = 'puedo_gastar' | 'gaste' | 'me_pagaron' | 'contar_efectivo' | 'pagar_tarjeta';

export type AccionIntencion =
  { readonly tipo: 'prefijo'; readonly texto: string } | { readonly tipo: 'flujo'; readonly flujo: IdFlujo };

export interface ChipIntencion {
  readonly clave: ClaveIntencion;
  readonly etiqueta: string;
  /** Qué pasa al tocarlo, para el lector de pantalla. */
  readonly pista: string;
  readonly accion: AccionIntencion;
}

export interface DisponiblesIntencion {
  readonly hayEfectivo: boolean;
  readonly hayTarjetas: boolean;
}

export const MAX_CHIPS_INTENCION = 5;

const TODOS: readonly ChipIntencion[] = [
  {
    clave: 'puedo_gastar',
    etiqueta: '¿Puedo gastar…?',
    pista: 'Empieza a escucharte con «puedo gastar»; te digo cómo queda tu día',
    accion: { tipo: 'prefijo', texto: 'puedo gastar ' },
  },
  {
    clave: 'gaste',
    etiqueta: 'Gasté…',
    pista: 'Empieza a escucharte con «gasté»',
    accion: { tipo: 'prefijo', texto: 'gasté ' },
  },
  {
    clave: 'me_pagaron',
    etiqueta: 'Me pagaron…',
    pista: 'Empieza a escucharte con «me pagaron»',
    accion: { tipo: 'prefijo', texto: 'me pagaron ' },
  },
  {
    clave: 'contar_efectivo',
    etiqueta: 'Contar efectivo',
    pista: 'Te pregunto cuánto efectivo traes',
    accion: { tipo: 'flujo', flujo: 'arqueo' },
  },
  {
    clave: 'pagar_tarjeta',
    etiqueta: 'Pagar tarjeta',
    pista: 'Te pregunto qué tarjeta pagaste y cuánto',
    accion: { tipo: 'flujo', flujo: 'pagar_tarjeta' },
  },
];

export function chipsIntencion(d: DisponiblesIntencion): readonly ChipIntencion[] {
  return TODOS.filter((c) => {
    if (c.clave === 'contar_efectivo') return d.hayEfectivo;
    if (c.clave === 'pagar_tarjeta') return d.hayTarjetas;
    return true;
  }).slice(0, MAX_CHIPS_INTENCION);
}

/**
 * La frase completa tras un chip de prefijo: «gasté » + «tacos 80» → «gasté tacos 80». Si la persona ya dijo el
 * arranque («gasté 80 en tacos»), no se repite.
 */
export function unirPrefijo(prefijo: string, dicho: string): string {
  const p = prefijo.trim();
  const d = dicho.trim();
  if (d === '') return p;
  if (sinAcentos(d).toLowerCase().startsWith(sinAcentos(p).toLowerCase())) return d;
  return `${p} ${d}`;
}

function sinAcentos(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
