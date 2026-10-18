import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui';

/** Redacción del arqueo (`02 §7`, `02 §14`): tuteo, sin tecnicismos contables. */

export const TITULO = 'Contar mi efectivo';

/** TalkBack en Cuentas › fila de efectivo. */
export const etiquetaContarEnCuenta = (nombre: string): string => `${TITULO} en ${nombre}`;
export const CERRAR = 'Cerrar';
/** TalkBack: más contexto que el botón «Cerrar». */
export const ACCESIBILIDAD_CERRAR = 'Cerrar conteo de efectivo';
export const LISTO = 'Listo';
/** TalkBack: cierra tras confirmar el conteo. */
export const ACCESIBILIDAD_LISTO = 'Listo, cerrar conteo de efectivo';
/** TalkBack: abre la pantalla desde Hoy o la tarjeta de arqueo. */
export const ACCESIBILIDAD_ABRIR = 'Abrir conteo de efectivo';
export const CONTINUAR = 'Continuar';
export const CONFIRMAR = 'Confirmar';
export const TOTAL = 'Total';
export const AHORA_NO = 'Ahora no';
export const MENSAJE_POSPONER = 'Va. Te pregunto mañana.';

/** Sin cuenta de efectivo (`02 §7`). */
export const TEXTO_SIN_CUENTA_EFECTIVO =
  'No llevas una cuenta de efectivo. Agrégala en Cuentas para poder contarla.';

/** Vacío sin cuenta de efectivo: título + copy para TalkBack (`02 §15`). */
export function etiquetaVacioSinEfectivo(): string {
  return `${TITULO}. ${TEXTO_SIN_CUENTA_EFECTIVO}`;
}

/** Gasto por asignar sin descripción en el paso 1. */
export const ETIQUETA_GASTO_SIN_DESCRIPCION = 'Gasto';

export const PASO_MARCAR_TITULO = 'Antes: ¿pagaste alguno de estos en efectivo?';
export const PASO_MARCAR_AYUDA =
  'Los que marques pasan a tu efectivo antes de contar, para no contarlos dos veces.';

/** Tarjeta de Hoy cuando hay gastos por asignar viejos (paso 1 del arqueo). */
export const AYUDA_POR_ASIGNAR =
  'Antes revisemos unos gastos que no sé con qué pagaste.';

/** Chips del paso «Deberías traer…» (`02 §7`). */
export const ETIQUETA_OTRA_CANTIDAD = 'Otra cantidad';

/** Campo cuando eliges «Otra cantidad». */
export const ETIQUETA_MONTO_TRAES = '¿Cuánto traes?';

/** Radios al registrar sobrante como cobro de préstamo (`02 §7`, E7-09). */
export const ETIQUETA_QUIEN_TE_PAGO = '¿Quién te pagó?';

export const OPCIONES_SOBRANTE = {
  me_dieron: 'Me dieron dinero',
  me_pagaron: 'Me pagaron lo que me debían',
  anote_de_mas: 'Anoté algo de más',
  no_se: 'No sé, solo corrígelo',
} as const;

export const mensajeCuadra = (): string => 'Listo: tu efectivo cuadra.';

export const mensajeEfectivoQuedo = (monto: Centavos): string =>
  `Listo: tu efectivo quedó en ${formatearCentavos(monto)}.`;

/** "Deberías traer $640 en efectivo. ¿Cuánto traes?" */
export const textoDeberiasTraer = (esperado: Centavos): string =>
  `Deberías traer ${formatearCentavos(esperado)} en efectivo. ¿Cuánto traes?`;

/** "Faltan $340. Lo repartí según tus gastos en efectivo:" */
export const textoFaltante = (hueco: Centavos): string =>
  `Faltan ${formatearCentavos(hueco)}. Lo repartí según tus gastos en efectivo:`;

/** "Traes $15 más de lo esperado. ¿De dónde salió?" */
export const textoSobrante = (extra: Centavos): string =>
  `Traes ${formatearCentavos(extra)} más de lo esperado. ¿De dónde salió?`;

export const mensajeSumaPropuesta = (debe: Centavos, tiene: Centavos): string =>
  `Los montos deben sumar ${formatearCentavos(debe)}; ahora suman ${formatearCentavos(tiene)}.`;
