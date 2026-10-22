import type { Centavos } from '@cartera/core';
import { formatearCentavos } from '../../ui/formato';

/** Mensajes de error de gastos compartidos: viven con los demás en `servicios/mensajes-error`. */
export { mensajeErrorCompartido } from '../../servicios';

/** Redacción de Gastos compartidos (`02 §27`, `02 §14`): copy de pantallas; cifras vienen de `servicios/`. */

export const ETIQUETA_VOLVER = 'Volver';
/** Botón Volver en la lista de grupos (vuelve a Cuentas). */
export const PISTA_VOLVER_CUENTAS = 'Regresa a Cuentas';
/** Volver desde crear, escanear o el código QR. */
export const PISTA_VOLVER_LISTA = 'Regresa a la lista de grupos';
export const TITULO_GASTOS_COMPARTIDOS = 'Gastos compartidos';
/** Entrada desde Cuentas (`02 §27`). */
export const BTN_COMPARTIDOS_CUENTAS = 'Gastos con tu pareja';
/** Sin grupos vinculados (`02 §27`). */
export const TEXTO_COMPARTIDOS_VACIO =
  'Crea un grupo con tu pareja o escanea su código. Los dos ven lo compartido; cada quien conserva su libro privado.';

/** Vacío de lista: título de pantalla + copy para TalkBack (`02 §15`). */
export function etiquetaVacioCompartidos(): string {
  return `${TITULO_GASTOS_COMPARTIDOS}. ${TEXTO_COMPARTIDOS_VACIO}`;
}
export const AVISO_REVINCULAR_LISTA = 'Vuelve a vincular este teléfono';
export const BTN_CREAR_CON_ALGUIEN = 'Crear con alguien';
/** Lista de grupos: abre el flujo para generar un código QR (`02 §15`). */
export const PISTA_CREAR_CON_ALGUIEN =
  'Escribe cómo se llama tu pareja y te muestro el código para vincularlos';
export const BTN_ESCANEAR_CODIGO = 'Escanear código';
/** Lista de grupos: une tu teléfono al grupo de tu pareja (`02 §15`). */
export const PISTA_ESCANEAR_CODIGO = 'Lee el código QR que aparece en el teléfono de tu pareja';
export const BTN_ESCANEAR_SU_CODIGO = 'Escanear su código';
export const BTN_CREAR_CODIGO = 'Crear código';
/** Tras escribir el nombre de tu pareja (`02 §15`). */
export const PISTA_CREAR_CODIGO = 'Genera el código QR para que tu pareja te escanee';
export const BTN_LISTO = 'Listo';
/** Tras crear el grupo y mostrar el QR (`02 §15`). */
export const PISTA_LISTO_TRAS_QR = 'Abre el grupo que acabas de crear';
/** Antes de abrir la cámara en unirse (`02 §15`). */
export const PISTA_ABRIR_ESCANER = 'Abre la cámara para leer el código QR de tu pareja';
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
/** Sin permiso de cámara (`02 §15`). */
export const PISTA_PERMISO_CAMARA = 'Solo la uso para leer el código QR, sin tomar fotos';
export const ETIQUETA_VISTA_CAMARA = 'Vista de la cámara para escanear el código';
/** Cámara activa en unirse (`02 §15`). */
export const PISTA_VISTA_CAMARA =
  'Apunta al código QR de tu pareja; al leerlo te unes al grupo automáticamente';
/** Unirse sin nombre escrito (`02 §15`). */
export const PISTA_ESCRIBIR_NOMBRE_PAREJA = 'Escribe cómo se llama tu pareja arriba';
export const BTN_CANCELAR = 'Cancelar';
/** Cierra el escáner (`02 §15`). */
export const PISTA_CANCELAR_ESCANER = 'Cierra la cámara y vuelve atrás';
/** Cámara negada sin poder volver a preguntar (iOS no muestra el diálogo otra vez). */
export const TEXTO_CAMARA_BLOQUEADA =
  'La cámara está apagada para Finanvoz. Actívala en Ajustes del teléfono y vuelve aquí para escanear.';
export const BTN_ABRIR_AJUSTES = 'Abrir Ajustes';
export const PISTA_ABRIR_AJUSTES_CAMARA = 'Abre los ajustes del teléfono para permitir la cámara';
/** Cancelar en crear y unirse: vuelve a la lista de grupos (Volver siempre sale de la pantalla). */
export const PISTA_CANCELAR_CREAR = 'Cierra sin crear el código y vuelves a tus grupos';
export const PISTA_CANCELAR_UNIRSE = 'Cierra sin escanear y vuelves a tus grupos';
/** Código para volver a vincular: se cierra con "Listo". */
export const PISTA_CERRAR_CODIGO = 'Oculta el código y vuelves al grupo';

export const BTN_VOLVER_A_VINCULAR = 'Volver a vincular';
export const BTN_AGREGAR_GASTO = 'Agregar gasto';
export const BTN_SALDAR = 'Saldar';
export const BTN_MOSTRAR_CODIGO = 'Mostrar código';
export const BTN_REGISTRAR_PAGO = 'Registrar pago';
export const BTN_DEJAR_DE_COMPARTIR = 'Dejar de compartir';
export const BTN_ANULAR = 'Anular';

/** Detalle del grupo: vuelve a Gastos compartidos (`02 §15`). */
export const PISTA_VOLVER_GRUPO = 'Regresa a la lista de grupos';
/** Detalle del grupo: cada panel (agregar, saldar, código, salir) se cierra con su propio botón (`02 §15`). */
export const PISTA_VOLVER_PANEL_GRUPO = 'Cierra este paso y vuelves al grupo';
/** Pista TalkBack al abrir un grupo desde la lista (`02 §15`). */
export const PISTA_ABRIR_GRUPO = 'Abre el detalle de este grupo compartido';
/** Grupo (`02 §15`). */
export const PISTA_AGREGAR_GASTO = 'Registra un gasto que se reparte con tu pareja';
export const PISTA_SALDAR = 'Registra el pago para quedar a mano';
export const PISTA_MOSTRAR_CODIGO = 'Muestra un código QR para que tu pareja vuelva a vincularse';
export const PISTA_VOLVER_A_VINCULAR = 'Abre la cámara para escanear el código de tu pareja';
export const PISTA_REGISTRAR_PAGO = 'Guarda el pago en tu libro y lo comparte cuando haya red';
export const PISTA_DEJAR_DE_COMPARTIR = 'Cierra el grupo para los dos; cada quien conserva lo registrado';
export const PISTA_CONFIRMAR_SALIR_GRUPO = 'Confirma que quieres dejar de compartir con tu pareja';
export const PISTA_CANCELAR_PANEL = 'Cierra sin guardar ni confirmar';
export const PISTA_ANULAR_MOVIMIENTO = 'Pregunta antes de anular este gasto compartido en tu libro';
export const BTN_SI_ANULAR = 'Sí, anular';
export const PISTA_CONFIRMAR_ANULAR = 'Anula el gasto en tu libro y se lo comparte a tu pareja';
/** Confirmación en línea: anular no tiene Deshacer (se corrige registrándolo otra vez). */
export function textoConfirmarAnular(titulo: string, nombre: string): string {
  return `¿Anular «${titulo}»? Lo quito de tu libro y se lo comparto a ${nombre}. Si fue un error, regístralo otra vez.`;
}
export const PISTA_CANCELAR_GASTO = 'Cierra el formulario sin guardar el gasto';
export const TITULO_LO_COMPARTIDO = 'Lo compartido';
/** Grupo abierto sin movimientos compartidos aún (`02 §27`). */
export const TEXTO_GRUPO_MOVIMIENTOS_VACIO = 'Todavía no hay gastos compartidos.';

export function etiquetaVacioGrupoMovimientos(): string {
  return `${TITULO_LO_COMPARTIDO}. ${TEXTO_GRUPO_MOVIMIENTOS_VACIO}`;
}

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

export function textoRegistroPagoSaldar(debe: 'yo' | 'otro', nombre: string, monto: Centavos): string {
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
/** Formulario de gasto compartido (`02 §27`). */
export const PISTA_GUARDAR_GASTO_COMPARTIDO =
  'Registra el gasto compartido en tu libro y lo comparte cuando haya red';

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

export type ResultadoProporcionReparto = { ok: true; miParteBp: number } | { ok: false; mensaje: string };

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
