import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import type { ErrorAccionCompartido } from './compartido';
import { MENSAJE_MOVIMIENTO_COMPARTIDO } from './formulario';
import {
  MENSAJE_ERROR_GENERAL,
  MENSAJE_LIMITE_NUBE,
  MENSAJE_NO_ENTENDI,
  MENSAJE_SERVIDOR,
  MENSAJE_SIN_RED,
  MENSAJE_SIN_RED_REINTENTO,
  MENSAJE_SIN_VINCULO,
  mensajeError,
  mensajeErrorCompartido,
  mensajePorCodigo,
} from './mensajes-error';

const error = (codigo: string) => new ErrorDominio(codigo, 'detalle técnico con $1,500 de OXXO');

describe('mensajes de error (02 §14: qué pasó y qué hacer)', () => {
  it('cada código conocido tiene su mensaje concreto', () => {
    expect(mensajeError(error('ya_anulada'))).toBe(
      'Ese movimiento ya estaba borrado. No tienes que hacer nada más.',
    );
    expect(mensajeError(error('transaccion_inexistente'))).toBe(
      'Ya no encuentro ese movimiento. Revísalo en Movimientos.',
    );
    expect(mensajeError(error('monto_invalido'))).toBe('Revisa el monto: tiene que ser mayor que cero.');
    expect(mensajeError(error('correccion_no_soportada'))).toBe(
      'Ese movimiento no lo puedo corregir así. Ábrelo en Movimientos.',
    );
    expect(mensajeError(error('movimiento_compartido'))).toBe(MENSAJE_MOVIMIENTO_COMPARTIDO);
    expect(mensajeError(error('no_miembro'))).toBe(MENSAJE_SIN_VINCULO);
    expect(mensajeError(error('llaves_compartido_invalidas'))).toBe(MENSAJE_SIN_VINCULO);
    expect(mensajeError(error('sin_red'))).toBe(MENSAJE_SIN_RED);
    expect(mensajeError(error('limite_mensual'))).toBe(MENSAJE_LIMITE_NUBE);
    expect(mensajeError(error('respuesta_invalida'))).toBe(MENSAJE_NO_ENTENDI);
  });

  it('el texto de "no te entendí" es el de 02 §5 y el de sin red dice qué hacer', () => {
    expect(MENSAJE_NO_ENTENDI).toBe('No te entendí. Prueba así: «tacos 80 en efectivo».');
    expect(MENSAJE_SIN_RED).toBe('No tengo internet ahora. Inténtalo de nuevo cuando tengas conexión.');
    expect(MENSAJE_SIN_RED_REINTENTO).toBe(
      'No tengo internet ahora. Lo guardé y lo intento cuando vuelva la conexión.',
    );
  });

  it('un código desconocido o un error que no es de dominio usa el mensaje de respaldo', () => {
    expect(mensajeError(error('otra_cosa'))).toBe(MENSAJE_ERROR_GENERAL);
    expect(mensajeError(new Error('ya_anulada'))).toBe(MENSAJE_ERROR_GENERAL);
    expect(mensajeError('ya_anulada')).toBe(MENSAJE_ERROR_GENERAL);
    expect(mensajeError(error('otra_cosa'), MENSAJE_NO_ENTENDI)).toBe(MENSAJE_NO_ENTENDI);
    expect(mensajePorCodigo('toString')).toBeNull();
    expect(mensajePorCodigo('constructor')).toBeNull();
  });

  it('nunca muestra el detalle técnico del error (puede traer montos o comercios)', () => {
    for (const codigo of ['ya_anulada', 'monto_invalido', 'otra_cosa']) {
      expect(mensajeError(error(codigo))).not.toMatch(/\$|OXXO|técnico/);
    }
  });

  it('gastos compartidos: "lo guardé y lo intento" solo cuando de verdad se reintenta', () => {
    expect(mensajeErrorCompartido('sin_red')).toBe(MENSAJE_SIN_RED);
    expect(mensajeErrorCompartido('sin_red', { reintenta: true })).toBe(MENSAJE_SIN_RED_REINTENTO);
    expect(mensajeErrorCompartido('no_miembro')).toBe(MENSAJE_SIN_VINCULO);
    expect(mensajeErrorCompartido('sin_llave')).toBe(MENSAJE_SIN_VINCULO);
    expect(mensajeErrorCompartido('servidor')).toBe(MENSAJE_SERVIDOR);
    const todos: ErrorAccionCompartido[] = [
      'sin_red',
      'sin_sesion',
      'no_miembro',
      'grupo_cerrado',
      'codigo_invalido',
      'ya_miembro',
      'conflicto',
      'servidor',
      'sin_servicio',
      'qr_invalido',
      'sin_llave',
      'evento_ilegible',
      'otro_lugar',
    ];
    for (const e of todos) expect(mensajeErrorCompartido(e)).toMatch(/^[A-ZÉ].+\.$/);
  });
});
