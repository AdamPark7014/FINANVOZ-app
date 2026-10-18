import type { EntradaMovimiento } from '../../servicios';
import { NOMBRE_TIPO } from './textos';

/** Redacción del formulario de movimiento (`02 §5`, M2): tuteo; sin términos contables. */

export type TipoMovimiento = EntradaMovimiento['tipo'];
export type TipoFormulario = TipoMovimiento | 'cuenta_dividida';

type ClaseCuenta = 'efectivo' | 'liquida' | 'tarjeta';

export const ETIQUETA_QUE_PASO = '¿Qué pasó?';
export const ETIQUETA_MONTO = '¿Cuánto?';
export const ETIQUETA_DESCRIPCION = '¿En qué? (opcional)';
export const EJEMPLO_DESCRIPCION = 'tacos';
export const ETIQUETA_CATEGORIA = 'Categoría';
export const ETIQUETA_AGREGAR_PERSONA = 'Agregar persona';
export const EJEMPLO_NUEVA_PERSONA = 'Mi jefa';
export const BTN_AGREGAR_PERSONA = 'Agregar';
export const BTN_GUARDAR_MOVIMIENTO = 'Guardar';

export const ERROR_MONTO_CERO = 'Escribe un monto mayor a $0.';
export const ERROR_ELEGIR_CATEGORIA = 'Elige una categoría.';
export const ERROR_ELEGIR_PERSONA = 'Elige a la persona.';
export const ERROR_CUENTAS_DISTINTAS = 'Elige dos cuentas distintas.';

export const AVISO_RETIRO_EFECTIVO_TARJETA =
  'Sacar efectivo con tarjeta de crédito suele cobrar comisión e intereses desde el primer día.';

export const NOMBRE_TIPO_FORMULARIO: Record<TipoFormulario, string> = {
  ...NOMBRE_TIPO,
  cuenta_dividida: 'Cuenta dividida',
};

/** Qué cuentas pide cada tipo y con qué pregunta (sin vocabulario contable). */
export const CAMPOS_FORMULARIO_MOVIMIENTO: Record<
  TipoMovimiento,
  {
    origen?: { pregunta: string; clases: readonly ClaseCuenta[] };
    destino?: { pregunta: string; clases: readonly ClaseCuenta[] };
    persona?: string;
    categoria?: 'gasto' | 'ingreso';
  }
> = {
  gasto: {
    categoria: 'gasto',
    origen: { pregunta: '¿Con qué pagaste?', clases: ['efectivo', 'liquida', 'tarjeta'] },
  },
  ingreso: {
    categoria: 'ingreso',
    destino: { pregunta: '¿A dónde llegó?', clases: ['efectivo', 'liquida'] },
  },
  transferencia: {
    origen: { pregunta: '¿De qué cuenta sale?', clases: ['efectivo', 'liquida'] },
    destino: { pregunta: '¿A qué cuenta llega?', clases: ['efectivo', 'liquida'] },
  },
  retiro_efectivo: {
    origen: { pregunta: '¿De dónde lo sacaste?', clases: ['liquida', 'tarjeta'] },
    destino: { pregunta: '¿Dónde lo traes?', clases: ['efectivo'] },
  },
  pago_tarjeta: {
    origen: { pregunta: '¿Con qué pagaste?', clases: ['efectivo', 'liquida'] },
    destino: { pregunta: '¿Qué tarjeta pagaste?', clases: ['tarjeta'] },
  },
  prestamo_otorgado: {
    persona: '¿A quién le prestaste?',
    origen: { pregunta: '¿De dónde salió?', clases: ['efectivo', 'liquida'] },
  },
  prestamo_recibido: {
    persona: '¿Quién te prestó?',
    destino: { pregunta: '¿A dónde llegó?', clases: ['efectivo', 'liquida'] },
  },
  cobro_prestamo: {
    persona: '¿Quién te pagó?',
    destino: { pregunta: '¿A dónde llegó?', clases: ['efectivo', 'liquida'] },
  },
  pago_prestamo: {
    persona: '¿A quién le pagaste?',
    origen: { pregunta: '¿De dónde salió?', clases: ['efectivo', 'liquida'] },
  },
};
