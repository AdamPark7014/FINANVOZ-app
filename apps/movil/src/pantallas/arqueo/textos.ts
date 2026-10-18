import type { Centavos } from '@cartera/core';
import { cifraEnPalabras, formatearCentavos } from '../../ui';

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
/** TalkBack: cierra sin registrar cambios. */
export const PISTA_CERRAR = 'Cierra la pantalla; nada se guarda hasta Confirmar';
/** TalkBack: paso 1 → cantidad en mano. */
export const PISTA_CONTINUAR = 'Pasa a decir cuánto efectivo traes';
/** TalkBack: compara con lo esperado. */
export const PISTA_CALCULAR = 'Compara lo que traes con lo esperado';
/** TalkBack: guarda conteo y ajustes. */
export const PISTA_CONFIRMAR = 'Guarda el conteo y los ajustes';
/** TalkBack: casilla de gasto por asignar en paso 1. */
export const PISTA_CASILLA_GASTO = 'Marca o desmarca si lo pagaste en efectivo';
/** TalkBack: ayuda bajo el título del paso 1. */
export const PISTA_PASO_MARCAR = 'Los marcados pasan a tu efectivo antes de contar';
/** TalkBack: tarjeta de éxito tras confirmar. */
export const ETIQUETA_TARJETA_CONTEO_LISTO = 'Conteo terminado';
export const PISTA_TARJETA_CONTEO_LISTO = 'Abajo está el botón para cerrar';
/** TalkBack: reparto del faltante. */
export const PISTA_GRUPO_PROPUESTA = 'Ajusta cuánto falta en cada parte; deben sumar lo que falta';
/** TalkBack: origen del sobrante. */
export const PISTA_GRUPO_SOBRANTE = 'Elige de dónde salió el efectivo de más';
/** TalkBack: tras mensaje de listo. */
export const PISTA_LISTO = 'Cierra la pantalla después del conteo';
/** TalkBack: tarjeta de Hoy con gastos por asignar. */
export const PISTA_ABRIR_DESDE_TARJETA = 'Abre el conteo completo, empezando por esos gastos';
/** TalkBack: posponer tarjeta de Hoy. */
export const PISTA_POSPONER = 'Oculta la tarjeta; te pregunto mañana';
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

/** TalkBack: chip «traigo justo lo esperado». */
export const etiquetaChipExacto = (esperado: Centavos): string =>
  `Llevo ${cifraEnPalabras(esperado)}`;

/** Visible en la casilla del paso 1. */
export const etiquetaCasillaGasto = (
  descripcion: string | null | undefined,
  monto: Centavos,
  etiqueta: string,
): string =>
  `${descripcion ?? ETIQUETA_GASTO_SIN_DESCRIPCION} ${formatearCentavos(monto)} · ${etiqueta}`;

/** TalkBack en la casilla del paso 1 (montos en palabras). */
export const etiquetaAccesibleCasillaGasto = (
  descripcion: string | null | undefined,
  monto: Centavos,
  etiqueta: string,
): string => {
  const nombre = descripcion ?? ETIQUETA_GASTO_SIN_DESCRIPCION;
  return `${nombre}, ${cifraEnPalabras(monto)}, ${etiqueta}`;
};

/** Campo cuando eliges «Otra cantidad». */
export const ETIQUETA_MONTO_TRAES = '¿Cuánto traes?';
/** TalkBack: total en pesos al contar efectivo. */
export const PISTA_MONTO_TRAES = 'Escribe el total de efectivo que traes';

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
