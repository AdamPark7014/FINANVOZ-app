import type { Centavos } from '@cartera/core';
import { etiquetaFecha, type OrigenCompromiso } from '../../servicios';
import { cifraEnPalabras, etiquetaHablada, formatearCentavos } from '../../ui/formato';

/**
 * Redacción de Cuentas después del onboarding (`02 §11`, `02 §14`): agregar cuentas y pagos fijos, detalle de una
 * cuenta (corregir saldo, ver movimientos), detalle de un pago fijo (cambiar monto, quitar) y la lista de personas.
 * Tuteo, verbo primero en botones, sin tecnicismos contables. Las cifras llegan ya calculadas por `servicios/`.
 */

export const ETIQUETA_VOLVER = 'Volver';
export const PISTA_VOLVER_CUENTAS = 'Regresa a Cuentas';
export const ERROR_GUARDAR = 'No pude guardar eso. Revisa los datos e intenta de nuevo.';
export const BTN_CANCELAR = 'Cancelar';

// ——— Cuentas › Tienes ———

export const BTN_AGREGAR_CUENTA = 'Agregar cuenta';
export const PISTA_AGREGAR_CUENTA =
  'Abre el formulario para agregar una cuenta de débito, billetera o ahorro';
/** VoiceOver y TalkBack en el vacío de Tienes: dónde está el botón. */
export const PISTA_CTA_AGREGAR_CUENTA = `Más abajo, botón ${BTN_AGREGAR_CUENTA.toLowerCase()}`;
export const PISTA_ABRIR_CUENTA = 'Abre la cuenta para corregir su saldo o ver sus movimientos';
export const PISTA_ABRIR_EFECTIVO = 'Abre tu efectivo para contarlo o ver sus movimientos';
export const BTN_VER = 'Ver';

export function etiquetaVerCuenta(nombre: string): string {
  return `Ver ${nombre}`;
}

/** Fila tocable de Tienes o Compromisos: todo en una sola frase para el lector, con la cifra en palabras. */
export function etiquetaFila(partes: {
  titulo: string;
  subtitulo: string | null;
  contexto: string;
  centavos: Centavos;
}): string {
  const encabezado = partes.subtitulo ? `${partes.titulo}, ${partes.subtitulo}` : partes.titulo;
  return `${encabezado}. ${partes.contexto} ${cifraEnPalabras(partes.centavos)}`;
}

// ——— Agregar cuenta ———

export const TITULO_NUEVA_CUENTA = 'Agregar cuenta';
export const INTRO_NUEVA_CUENTA =
  'Débito, billetera (como Mercado Pago) o ahorro. Las tarjetas de crédito se agregan aparte, en Debes.';
export const ETIQUETA_TIPO_CUENTA = '¿Qué tipo de cuenta es?';
export const ETIQUETA_CHIP_DEBITO = 'Débito';
export const ETIQUETA_CHIP_BILLETERA = 'Billetera';
export const ETIQUETA_CHIP_AHORRO = 'Ahorro';
export const ETIQUETA_NOMBRE_CUENTA = 'Nombre';
export const EJEMPLOS_NOMBRE_CUENTA = {
  debito: 'BBVA',
  billetera: 'Mercado Pago',
  ahorro: 'Ahorro Nu',
} as const;
export const ETIQUETA_SALDO_CUENTA = '¿Cuánto tienes hoy?';
export const AYUDA_SALDO_CUENTA = 'Si no sabes exacto, pon lo que calcules. Lo corriges después.';
export const ETIQUETA_ULTIMOS4 = 'Últimos 4 números (opcional)';
export const AYUDA_ULTIMOS4 = 'Te ayudan a distinguirla si tienes dos cuentas del mismo banco.';
export const ERROR_CUENTA_INCOMPLETA = 'Escribe el nombre y el saldo de la cuenta.';
export const ERROR_ULTIMOS4 = 'Los últimos 4 son cuatro números. Si no los sabes, deja el campo vacío.';
export const BTN_GUARDAR_CUENTA = 'Guardar cuenta';
export const PISTA_GUARDAR_CUENTA = 'Guarda la cuenta con su saldo de hoy y regresa a Cuentas';

export function confirmacionCuentaAgregada(nombre: string): string {
  return `Listo: agregué ${nombre}.`;
}

// ——— Detalle de una cuenta ———

export const SUBTITULO_DETALLE: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  billetera: 'Billetera',
  ahorro: 'Ahorro',
};
export const ETIQUETA_TIENES = 'Tienes';

export function etiquetaTerminacion(ultimos4: string): string {
  return `Termina en ${ultimos4}`;
}

export function etiquetaTerminacionHablada(ultimos4: string): string {
  return `Termina en ${ultimos4.split('').join(' ')}`;
}

export const BTN_CORREGIR_SALDO = 'Corregir saldo';
export const PISTA_CORREGIR_SALDO = 'Escribe cuánto tienes de verdad en esta cuenta';
export const ETIQUETA_SALDO_REAL = '¿Cuánto tienes de verdad?';
export const AYUDA_SALDO_REAL =
  'Revisa el saldo en la app de tu banco. Anoto la diferencia como un ajuste; tus movimientos no cambian.';
export const BTN_GUARDAR_SALDO = 'Guardar saldo';
export const PISTA_GUARDAR_SALDO = 'Guarda el saldo y anota la diferencia como un ajuste';
export const ERROR_SALDO_REAL = 'Escribe cuánto tienes, aunque sea $0.';
export const MENSAJE_SALDO_IGUAL = 'El saldo ya era ese. No cambié nada.';

export function confirmacionSaldo(nombre: string, saldo: Centavos): string {
  return `Listo: en ${nombre} tienes ${formatearCentavos(saldo)}.`;
}

export function etiquetaConfirmacionSaldo(nombre: string, saldo: Centavos): string {
  return etiquetaHablada(confirmacionSaldo(nombre, saldo));
}

export const TEXTO_EFECTIVO_SE_CUENTA =
  'El efectivo se corrige contándolo: te digo cuánto debería haber y anoto la diferencia.';
export const BTN_VER_MOVIMIENTOS = 'Ver movimientos';
export const PISTA_VER_MOVIMIENTOS_CUENTA = 'Abre Movimientos con solo los de esta cuenta';
export const TEXTO_CUENTA_NO_ENCONTRADA = 'No encontré esa cuenta. Puede que ya no exista.';

// ——— Pagos fijos ———

export const BTN_AGREGAR_PAGO_FIJO = 'Agregar pago fijo';
export const PISTA_AGREGAR_PAGO_FIJO = 'Abre el formulario para agregar la renta, la luz u otro pago';
export const BTN_VER_PAGOS_FIJOS = 'Ver todos tus pagos fijos';
export const PISTA_VER_PAGOS_FIJOS = 'Abre la lista completa, también los que caen en más de 30 días';
export const PISTA_ABRIR_COMPROMISO = 'Abre el pago para cambiar su monto o quitarlo';

export const TITULO_PAGOS_FIJOS = 'Tus pagos fijos';
export const INTRO_PAGOS_FIJOS =
  'Lo que pagas cada mes, quincena, semana o año. Lo aparto antes de decirte cuánto puedes gastar.';
export const TEXTO_PAGOS_FIJOS_VACIO =
  'Todavía no tienes pagos fijos. Agrega la renta, la luz o lo que pagues seguido.';

export function textoProximoPago(fecha: string | null): string {
  return fecha ? `Próximo: ${etiquetaFecha(fecha)}` : 'Sin pagos en los próximos 3 meses';
}

export const TITULO_NUEVO_PAGO = 'Agregar pago fijo';
export const PREGUNTA_PAGO = '¿Qué pago es?';
export const CHIP_PAGO_OTRO = 'Otro';
export const ETIQUETA_PAGO_NOMBRE = '¿Cómo le llamas?';
export const EJEMPLO_PAGO_NOMBRE = 'Netflix, colegiatura, seguro del coche';
export const ETIQUETA_PAGO_FRECUENCIA = '¿Cada cuándo lo pagas?';
export const ETIQUETA_PAGO_DIA_SEMANA = '¿Qué día de la semana?';
export const ETIQUETA_PAGO_MES = '¿En qué mes?';
export const ETIQUETA_PAGO_DIA_MES = '¿Qué día del mes?';
export const ETIQUETA_PAGO_MONTO_FIJO = '¿Cuánto pagas?';
export const ETIQUETA_PAGO_MONTO_VARIABLE = '¿Cuánto pagas más o menos?';
export const AYUDA_PAGO_VARIABLE = 'Cambia cada vez: pon lo de un recibo normal y lo ajustas cuando llegue.';
export const CASILLA_PAGO_VARIABLE = 'El monto cambia cada vez, como un recibo';
export const BTN_PAGO_MAS_OPCIONES = 'Más opciones';
export const BTN_PAGO_MENOS_OPCIONES = 'Menos opciones';
export const PISTA_PAGO_MAS_OPCIONES = 'Muestra de dónde sale el pago y cuántos pagos te faltan';
export const PISTA_PAGO_MENOS_OPCIONES = 'Oculta las opciones extra del pago';
export const ETIQUETA_PAGO_CUENTA = '¿De dónde sale?';
export const CHIP_PAGO_CUENTA_DESPUES = 'Lo decido después';
export const ETIQUETA_PAGO_RESTANTES = '¿Cuántos pagos te faltan?';
export const AYUDA_PAGO_RESTANTES = 'Si tiene fin, como un crédito. Si no, déjalo vacío.';
export const ERROR_PAGO_NOMBRE = 'Escribe cómo le llamas a este pago.';
export const ERROR_PAGO_FIJO_INCOMPLETO = 'Escribe cuánto pagas y cuándo lo pagas.';
export const ERROR_PAGO_RESTANTES = 'Los pagos que faltan van de 1 a 999, o deja el campo vacío.';
export const PISTA_GUARDAR_PAGO = 'Guarda el pago y empiezo a apartarlo';

export function etiquetaGuardarPago(concepto: string): string {
  return `Agregar ${concepto}`;
}

export function confirmacionPagoAgregado(concepto: string): string {
  return `Listo: agregué ${concepto}. Ya lo aparto.`;
}

// ——— Detalle de un pago fijo ———

export const ETIQUETA_MONTO_PAGO = 'Monto';
export const TEXTO_MONTO_VARIABLE = 'Cambia cada vez; aparto lo de un recibo normal.';
export const BTN_CAMBIAR_MONTO = 'Cambiar monto';
export const PISTA_CAMBIAR_MONTO = 'Escribe el monto nuevo de este pago';
export const ETIQUETA_MONTO_NUEVO = '¿Cuánto pagas ahora?';
export const BTN_GUARDAR_MONTO = 'Guardar monto';
export const PISTA_GUARDAR_MONTO = 'Aparta el monto nuevo desde hoy';
export const ERROR_MONTO_NUEVO = 'Escribe un monto mayor que cero.';
export const BTN_QUITAR_PAGO = 'Quitar este pago';
export const PISTA_QUITAR_PAGO = 'Muestra la confirmación para dejar de apartarlo';
export const TEXTO_QUITAR_CONFIRMA =
  'Dejo de apartarlo desde hoy. Lo que ya pagaste se queda en tus movimientos.';
export const BTN_QUITAR_CONFIRMAR = 'Sí, quitarlo';
export const PISTA_QUITAR_CONFIRMAR = 'Quita el pago y regresa a Cuentas';
export const PISTA_QUITAR_CANCELAR = 'Cierra la confirmación sin quitar nada';
export const TEXTO_PAGO_NO_ENCONTRADO = 'No encontré ese pago. Puede que ya lo hayas quitado.';

export function textoSaleDe(cuenta: string): string {
  return `Sale de ${cuenta}`;
}

export function textoHasta(fecha: string): string {
  return `Último pago: ${etiquetaFecha(fecha)}`;
}

export function confirmacionMonto(concepto: string, monto: Centavos): string {
  return `Listo: ${concepto} ahora es de ${formatearCentavos(monto)}.`;
}

export function confirmacionPagoQuitado(concepto: string): string {
  return `Listo: quité ${concepto}.`;
}

/** Compromisos que no son pagos fijos: se manejan en su propia pantalla. */
export const COMPROMISO_DE_OTRA_PANTALLA: Record<
  Exclude<OrigenCompromiso, 'pago_fijo'>,
  { texto: string; boton: string; pista: string }
> = {
  tarjeta: {
    texto: 'Es un pago planeado de tu tarjeta. Se cambia o se quita desde la tarjeta.',
    boton: 'Ver la tarjeta',
    pista: 'Abre la tarjeta de este pago',
  },
  tanda: {
    texto: 'Es la aportación de tu tanda. Se cambia desde la tanda.',
    boton: 'Ver la tanda',
    pista: 'Abre la tanda de esta aportación',
  },
  suscripcion: {
    texto: 'Es una suscripción que apartas como pago fijo. Se cambia o se quita en Suscripciones.',
    boton: 'Ver suscripciones',
    pista: 'Abre tus suscripciones',
  },
};

// ——— Personas ———

export const BTN_VER_PERSONAS = 'Ver a todas las personas';
export const PISTA_VER_PERSONAS =
  'Abre la lista de personas: a quién le debes, quién te debe y con quién estás a mano';
export const TITULO_PERSONAS = 'Personas';
export const INTRO_PERSONAS = 'A quién le prestaste, quién te prestó y con quién dividiste cuentas.';
export const TEXTO_PERSONAS_VACIO =
  'Todavía no hay personas. Aparecen cuando registras algo como «le presté 200 a Caro».';
export const PISTA_ABRIR_PERSONA = 'Abre su ficha: cobrar, registrar un pago o el recordatorio';

export function estadoPersona(saldo: Centavos): string {
  if (saldo > 0) return 'Te debe';
  if (saldo < 0) return 'Le debes';
  return 'Están a mano';
}

/** Lector: «Caro te debe cuatrocientos pesos» · «Le debes a la jefa…» · «Con Caro están a mano». */
export function etiquetaPersona(nombre: string, saldo: Centavos): string {
  if (saldo > 0) return `${nombre} te debe ${cifraEnPalabras(saldo)}`;
  if (saldo < 0) return `Le debes a ${nombre} ${cifraEnPalabras(-saldo)}`;
  return `Con ${nombre} están a mano`;
}
