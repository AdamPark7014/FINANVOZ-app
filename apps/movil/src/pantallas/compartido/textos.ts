import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui';

/** Mensajes de error de gastos compartidos: viven con los demás en `servicios/mensajes-error`. */
export { mensajeErrorCompartido } from '../../servicios';

export const TEXTO_SALIR =
  'Si sales, el grupo se cierra para los dos. Cada quien conserva lo que ya registró.';

export const OPCIONES_REPARTO: readonly { valor: number; etiqueta: string }[] = [
  { valor: 5000, etiqueta: 'Mitad y mitad' },
  { valor: 6000, etiqueta: 'Yo 60 %' },
  { valor: 4000, etiqueta: 'Yo 40 %' },
  { valor: 7000, etiqueta: 'Yo 70 %' },
  { valor: 3000, etiqueta: 'Yo 30 %' },
];

export const ETIQUETA_OTRA_PROPORCION = 'Otra proporción';
export const EJEMPLO_PROPORCION = '70/30';
export const AYUDA_PROPORCION = 'Tu parte y la de tu pareja; deben sumar 100.';

export type ResultadoProporcionReparto =
  | { ok: true; miParteBp: number }
  | { ok: false; mensaje: string };

/** "70/30" → 7000 bp (tu parte primero). Vacío o inválido devuelve mensaje para la UI. */
export function parsearProporcionReparto(texto: string): ResultadoProporcionReparto {
  const t = texto.trim();
  if (t === '') return { ok: false, mensaje: 'Escribe cómo se reparte, por ejemplo 70/30.' };
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(t);
  if (!m) return { ok: false, mensaje: 'Usa dos números con una diagonal, por ejemplo 70/30.' };
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a < 1 || a > 99 || b < 1 || b > 99 || a + b !== 100) {
    return { ok: false, mensaje: 'Cada parte va del 1 al 99 y deben sumar 100.' };
  }
  return { ok: true, miParteBp: a * 100 };
}

/** 6500 bp → "65/35" para el campo de otra proporción. */
export function formatoProporcionReparto(miParteBp: number): string {
  return `${miParteBp / 100}/${(10000 - miParteBp) / 100}`;
}

export const MENSAJE_SIN_PAREJA = 'Primero vincúlate con tu pareja en Gastos compartidos.';
export const MENSAJE_COMPARTIDO_GUARDADO = 'Listo: lo agregué a tus gastos compartidos.';

/** Chip de un reparto dictado que no está entre los de siempre: 6500 → "Yo 65 %". */
export const etiquetaReparto = (miParteBp: number): string => `Yo ${miParteBp / 100} %`;

/** "Súper $1,200.00 · pagaste tú · tú 60 % / tu pareja 40 %": lo dictado antes de compartirlo. */
export function resumenGastoCompartido(g: {
  descripcion: string;
  total: Centavos;
  pagueYo: boolean | null;
  miParteBp: number | null;
}): string {
  const partes = [
    `${g.descripcion === '' ? 'Gasto' : g.descripcion} ${formatearCentavos(g.total, 'centavos')}`,
  ];
  partes.push(g.pagueYo === null ? 'falta quién pagó' : g.pagueYo ? 'pagaste tú' : 'pagó tu pareja');
  if (g.miParteBp !== null)
    partes.push(`tú ${g.miParteBp / 100} % / tu pareja ${(10000 - g.miParteBp) / 100} %`);
  return partes.join(' · ');
}

