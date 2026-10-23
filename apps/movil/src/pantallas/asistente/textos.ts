import { etiquetaHablada, formatearCentavos } from '../../ui/formato';

/**
 * Redacción del asistente (Ola 7, `docs/diseno/OLA-7-ASISTENTE.md` §1.4): es-MX, tuteo, sin exclamaciones ni
 * consejos (`08 §1`), cada turno en dos líneas como máximo. Solo presenta lo que ya calculó `servicios/`.
 */

// ——— Cabecera y barra del día ———

export const LEYENDA_RESERVADO = 'Reservado';
export const LEYENDA_COLCHON = 'Colchón';
export const LEYENDA_LIBRE = 'Libre';

/** Etiqueta hablada de la barra reservado · colchón · libre (las cifras en palabras, `02 §15`). */
export function etiquetaBarraDia(reservado: number, colchon: number, libre: number): string {
  return etiquetaHablada(
    `${LEYENDA_RESERVADO} ${formatearCentavos(reservado)}, ${LEYENDA_COLCHON.toLowerCase()} ${formatearCentavos(colchon)}, ${LEYENDA_LIBRE.toLowerCase()} ${formatearCentavos(libre)}`,
  );
}

export const BTN_ME_ALCANZA = '¿Me alcanza?';
export const TITULO_DESGLOSE = 'De dónde sale';

// ——— Conversación ———

export const TITULO_ENTENDI_REGISTRO = 'Entendí · ¿lo registro?';
export const TITULO_ENTENDI_GUARDO = 'Entendí · ¿lo guardo?';
export const BTN_SI_REGISTRALO = 'Sí, regístralo';
export const BTN_SI_GUARDALO = 'Sí, guárdalo';
export const BTN_CAMBIAR = 'Cambiar';
export const BTN_DESHACER = 'Deshacer';
export const PISTA_DESHACER = 'Borra lo que acabo de registrar';
export const TEXTO_DESHICE = 'Deshice el registro.';
export const BTN_VER_MOVIMIENTOS = 'Ver movimientos';
export const PISTA_VER_MOVIMIENTOS = 'Abre Movimientos con los movimientos de esta respuesta';
export const TEXTO_INTERPRETANDO = 'Déjame entenderlo…';
export const TEXTO_EXPLICANDO = 'Revisando tus datos…';

/** Filas de la tarjeta «Entendí» (R1). */
export const FILA_QUE = 'Qué';
export const FILA_CUENTA = 'Cuenta';
export const FILA_CATEGORIA = 'Categoría';
export const FILA_CUANDO = 'Cuándo';
export const VALOR_SIN_ELEGIR = 'Elige una';
/** Bajo «Sí, regístralo» mientras falta la cuenta: el botón está inactivo y la fila «Cuenta» abre los chips. */
export const MOTIVO_ELIGE_CUENTA = 'Elige la cuenta para poder registrarlo.';

/** «Hoy, dom 11 oct» · «Ayer, sáb 10 oct» · «Vie 9 oct». */
export function valorCuando(etiqueta: string, relativo: 'hoy' | 'ayer' | null): string {
  if (relativo === 'hoy') return `Hoy, ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`;
  if (relativo === 'ayer') return `Ayer, ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`;
  return etiqueta;
}

/** Pista bajo «Sí, regístralo» cuando la frase vino por voz. */
export function pistaDecirSi(otraCuenta: string | null): string {
  return otraCuenta
    ? `También puedes decir «sí» o «no, fue con ${otraCuenta}».`
    : 'También puedes decir «sí» o «no».';
}

/** «Entendí · ¿cambio tu ingreso?» a partir del título de la tarjeta de ajuste («¿Cambio tu ingreso?»). */
export function tituloEntendiDe(pregunta: string): string {
  const cuerpo = pregunta.startsWith('¿')
    ? `¿${pregunta.charAt(1).toLowerCase()}${pregunta.slice(2)}`
    : pregunta;
  return `Entendí · ${cuerpo}`;
}

/** Turno de la persona para el lector: «Dijiste: tacos 80 en efectivo». */
export function etiquetaTurnoPersona(texto: string, porVoz: boolean): string {
  return `${porVoz ? 'Dijiste' : 'Escribiste'}: ${etiquetaHablada(texto)}`;
}

// ——— No entendí y reparación ———

export const BTN_CORREGIR_OIDO = 'Corregir lo que oí';
export const PISTA_CORREGIR_OIDO = 'Abre lo que oí en el teclado para corregirlo';

export function textoNoEntendi(oido: string): string {
  return `Oí «${oido}», pero no supe qué pasó.`;
}

export const TEXTO_NO_ENTENDI_VACIO = 'No te entendí. Dímelo otra vez o escríbelo.';
export const TEXTO_FRASE_LARGA = 'Es una frase muy larga. Dímelo en una más corta.';

/** Chips cuando la frase quedó por interpretar (sin red, sin cupo o error). */
export const CHIP_ES_GASTO = 'Es un gasto';
export const CHIP_ES_INGRESO = 'Es un ingreso';
export const CHIP_ESCRIBIRLO = 'Escribirlo';

// ——— Estado vacío (Hoy C cuando todavía no hay turnos) ———

export const TEXTO_PRUEBA_DECIR = 'Prueba decir «tacos 80 en efectivo».';
export const TEXTO_MANTEN_O_TOCA = 'Mantén para hablar · toca para escribir';
export const TITULO_ULTIMO_ENTENDIDO = 'Lo último que entendí';

// ——— Barra de voz ———

export const ETIQUETA_TECLADO = 'Escribir';
export const PISTA_TECLADO = 'Abre un campo para escribir lo que quieres registrar';
export const ETIQUETA_CERRAR_TECLADO = 'Cerrar el teclado';
export const ETIQUETA_CAMPO_REGISTRAR = '¿Qué registro?';
export const BTN_ENVIAR_REGISTRO = 'Registrar';
export const BTN_FORMULARIO = 'Registrar con formulario';
export const PISTA_FORMULARIO = 'Abre el formulario corto para llenar los datos';
export const ETIQUETA_CHIPS_INTENCION = 'Atajos para hablar';

// ——— R2 (formulario corto, modal) ———

export const TITULO_R2 = 'Registrar';
export const BTN_CERRAR_R2 = 'Cerrar';
export const ACCESIBILIDAD_CERRAR_R2 = 'Cerrar registro';
export const PISTA_CERRAR_R2 = 'Vuelve al asistente; lo que no guardaste no se registra';

export function textoEstoOiR2(oido: string): string {
  return `Esto oí: «${oido}». Revisa y registra.`;
}

// ——— Confirmación por voz ———

export const TEXTO_ESPERO_SI = 'Te escucho: di «sí» o «no».';

// ——— «¿Puedo gastar en esto?» (función estrella, describe qué pasa con tu dinero; nunca qué deberías hacer) ———

export const PREGUNTA_CUANTO_CUESTA = '¿Cuánto cuesta?';
export const TEXTO_PUEDO_SIN_INGRESO = 'Para decirte cómo queda tu día, dime cada cuándo te pagan.';
export const TEXTO_CALCULANDO_OPCIONES = 'Calculando cómo llegas con cada opción…';
export const BTN_REGISTRALO = 'Regístralo';
export const BTN_VER_OPCIONES = 'Ver opciones';

function enMinuscula(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** «Lo compré a 3 MSI con la Oro». */
export function btnLoCompreA(etiqueta: string): string {
  return `Lo compré ${enMinuscula(etiqueta)}`;
}

/** «A 3 MSI con la Oro: 92 % de llegar sin tocar tu colchón.» */
export function lineaEscenario(etiqueta: string, porcentaje: string): string {
  return `${etiqueta}: ${porcentaje} de llegar sin tocar tu colchón.`;
}

/** «Cabe en lo que puedes gastar hoy ($214).» · «Es más de lo que puedes gastar hoy ($214).» */
export function textoComparaHoy(cabe: boolean, hoy: string): string {
  return cabe ? `Cabe en lo que puedes gastar hoy (${hoy}).` : `Es más de lo que puedes gastar hoy (${hoy}).`;
}

/**
 * «Si compras unos tenis de $500 hoy, tu día pasa de $214 a $180 hasta tu quincena (jue 15).» (sin qué: «Si gastas
 * $500 hoy, …») o, si no alcanza, «…, te faltarían $340 para cubrir lo que viene antes de tu quincena (jue 15).»
 * Las cifras ya vienen de `core`.
 */
export function textoPuedoGastar(d: {
  /** «Unos tenis de $500»; `null` sin descripción. */
  titulo: string | null;
  monto: string;
  antes: string;
  despues: string;
  faltante: string | null;
  proximo: { concepto: string; etiqueta: string } | null;
}): string {
  const si = d.titulo ? `Si compras ${enMinuscula(d.titulo)} hoy` : `Si gastas ${d.monto} hoy`;
  if (d.faltante) {
    const cuando = d.proximo
      ? `antes de tu ${d.proximo.concepto} (${d.proximo.etiqueta})`
      : 'en los próximos días';
    return `${si}, te faltarían ${d.faltante} para cubrir lo que viene ${cuando}.`;
  }
  const hasta = d.proximo ? ` hasta tu ${d.proximo.concepto} (${d.proximo.etiqueta})` : '';
  return d.antes === d.despues
    ? `${si}, tu día sigue en ${d.despues}${hasta}.`
    : `${si}, tu día pasa de ${d.antes} a ${d.despues}${hasta}.`;
}

// ——— Saludo del estado vacío ———

/** «Hola. Hoy puedes gastar $214.» */
export function saludoDelDia(hoy: string | null): string {
  return hoy ? `Hola. Hoy puedes gastar ${hoy}.` : 'Hola. Soy tu asistente de dinero.';
}

export const SUGERENCIA_DECIR =
  'Pregúntame «¿puedo gastar 500 en unos tenis?» o dime un gasto, como «tacos 80 en efectivo».';

// ——— Escuchando ———

export const TEXTO_TERMINO_SOLO = 'Cuando dejes de hablar, termino solo.';
export const BTN_CANCELAR_ESCUCHA = 'Cancelar';
export const PISTA_CANCELAR_ESCUCHA = 'Deja de escuchar sin registrar nada';

// ——— Preguntas que se contestan con una cifra, fecha o texto (sin campos en la conversación) ———

export const TEXTO_DIMELO_RESPUESTA = 'Dímelo con el micrófono o escríbelo abajo.';
export const CHIP_ESCRIBIR_RESPUESTA = 'Escribirlo';
export const PISTA_ESCRIBIR_RESPUESTA = 'Abre el campo de abajo para escribir tu respuesta';
