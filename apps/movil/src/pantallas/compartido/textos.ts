import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui';

/** Mensajes de error de gastos compartidos: viven con los demás en `servicios/mensajes-error`. */
export { mensajeErrorCompartido } from '../../servicios';

/** Redacción de Gastos compartidos (`02 §27`, `02 §14`): copy de pantallas; cifras vienen de `servicios/`. */

export const ETIQUETA_VOLVER = 'Volver';
/** Botón Volver en la lista de grupos (vuelve a Cuentas). */
export const PISTA_VOLVER_CUENTAS = 'Regresa a Cuentas';
export const TITULO_GASTOS_COMPARTIDOS = 'Gastos compartidos';
/** Sin grupos vinculados (`02 §27`). */
export const TEXTO_COMPARTIDOS_VACIO =
  'Crea un grupo con tu pareja o escanea su código. Los dos ven lo compartido; cada quien conserva su libro privado.';
export const AVISO_REVINCULAR_LISTA = 'Vuelve a vincular este teléfono';
export const BTN_CREAR_CON_ALGUIEN = 'Crear con alguien';
export const BTN_ESCANEAR_CODIGO = 'Escanear código';
export const BTN_ESCANEAR_SU_CODIGO = 'Escanear su código';
export const BTN_CREAR_CODIGO = 'Crear código';
export const BTN_LISTO = 'Listo';
export const ETIQUETA_NOMBRE_PAREJA = '¿Cómo se llama tu pareja?';
export const AYUDA_NOMBRE_PAREJA = 'Solo se guarda en tu teléfono.';
export const ERROR_NOMBRE_PAREJA = 'Escribe cómo se llama tu pareja.';

export function instruccionQrTrasCrear(nombre: string): string {
  return `Pídele a ${nombre} que abra Finanvoz → Cuentas → Gastos compartidos → Escanear código. El código sirve una sola vez y vence en 10 minutos.`;
}

export const ETIQUETA_ACCESIBILIDAD_QR_UNION = 'Código QR para unirse a tu grupo compartido';

export const INSTRUCCION_ESCANER_QR =
  'Apunta la cámara al código QR que aparece en el teléfono de tu pareja.';
export const INSTRUCCION_PERMISO_CAMARA =
  'Para unirte necesito la cámara: solo la uso para leer el código QR de tu pareja, sin tomar fotos.';
export const BTN_PERMITIR_CAMARA = 'Permitir la cámara';
export const ETIQUETA_VISTA_CAMARA = 'Vista de la cámara para escanear el código';
export const BTN_CANCELAR = 'Cancelar';

export const BTN_VOLVER_A_VINCULAR = 'Volver a vincular';
export const BTN_AGREGAR_GASTO = 'Agregar gasto';
export const BTN_SALDAR = 'Saldar';
export const BTN_MOSTRAR_CODIGO = 'Mostrar código';
export const BTN_REGISTRAR_PAGO = 'Registrar pago';
export const BTN_DEJAR_DE_COMPARTIR = 'Dejar de compartir';
export const BTN_ANULAR = 'Anular';
export const TITULO_LO_COMPARTIDO = 'Lo compartido';
/** Grupo abierto sin movimientos compartidos aún (`02 §27`). */
export const TEXTO_GRUPO_MOVIMIENTOS_VACIO = 'Todavía no hay gastos compartidos.';
export const ETIQUETA_ANULADO = 'Anulado';
export const ETIQUETA_POR_COMPARTIR = 'Por compartir';
export const ETIQUETA_A_DONDE_LLEGO = '¿A dónde te llegó?';

export function instruccionRevincularGrupo(nombre: string): string {
  return `Este teléfono ya no está vinculado al grupo. Pídele a ${nombre} que toque "Mostrar código" y escanéalo.`;
}

export function instruccionQrMostrarCodigo(nombre: string): string {
  return `Pídele a ${nombre} que toque "Volver a vincular" y escanee este código. Sirve una sola vez y vence en 10 minutos.`;
}

export function textoPendientesCompartir(pendientes: number): string {
  return pendientes === 1 ? '1 movimiento por compartir' : `${pendientes} movimientos por compartir`;
}

export function textoRegistroPagoSaldar(
  debe: 'yo' | 'otro',
  nombre: string,
  monto: Centavos,
): string {
  const cifra = formatearCentavos(monto);
  return debe === 'yo'
    ? `Registra que le pagaste ${cifra} a ${nombre}.`
    : `Registra que ${nombre} te pagó ${cifra}.`;
}

export const TEXTO_SALIR =
  'Si sales, el grupo se cierra para los dos. Cada quien conserva lo que ya registró.';

export const TITULO_REVISAR_GASTO = 'Revisa el gasto compartido';
export const TITULO_AGREGAR_GASTO = 'Agregar gasto';
export const ERROR_MONTO_GASTO = 'Escribe cuánto fue el gasto.';
export const ERROR_CAMPOS_GASTO = 'Elige en qué fue, quién pagó y cómo se reparte.';
export const ETIQUETA_MONTO_GASTO = '¿Cuánto fue?';
export const ETIQUETA_DESCRIPCION_GASTO = '¿Qué fue? (opcional)';
export const EJEMPLO_DESCRIPCION_GASTO = 'Súper';
export const ETIQUETA_CATEGORIA_GASTO = 'Categoría';
export const ETIQUETA_QUIEN_PAGO = '¿Quién pagó?';
export const ETIQUETA_PAGUE_YO = 'Pagué yo';
export const ETIQUETA_REPARTO = '¿Cómo se reparte?';
export const ETIQUETA_CON_QUE_PAGASTE = '¿Con qué pagaste?';
export const BTN_GUARDAR = 'Guardar';

export function etiquetaPagoPareja(nombre: string): string {
  return `Pagó ${nombre}`;
}

export const ETIQUETA_CON_QUIEN_COMPARTES = '¿Con quién lo compartes?';

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
