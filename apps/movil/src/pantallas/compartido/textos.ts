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

export const OPCIONES_CATEGORIA: readonly { valor: string; etiqueta: string }[] = [
  { valor: 'super', etiqueta: 'Súper' },
  { valor: 'comida_fuera', etiqueta: 'Comida fuera' },
  { valor: 'hogar', etiqueta: 'Hogar' },
  { valor: 'servicios', etiqueta: 'Servicios' },
  { valor: 'entretenimiento', etiqueta: 'Salidas' },
  { valor: 'otros_gastos', etiqueta: 'Otro' },
];
