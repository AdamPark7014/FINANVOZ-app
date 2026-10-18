import { describe, expect, it } from 'vitest';
import {
  mensajeAjustado,
  mensajeGuardado,
  mensajeNoReconocido,
  MENSAJE_ESCANEADO,
  preguntaConciliacion,
  preguntaMismoMovimiento,
  TEXTO_SIN_NUEVOS,
  tituloNuevos,
} from './textos';

describe('textos de estado de cuenta en PDF', () => {
  it('mensajeNoReconocido lista bancos soportados', () => {
    expect(mensajeNoReconocido([])).toMatch(/Todavía no sé leer/);
    expect(mensajeNoReconocido(['Banco B', 'Banco E'])).toBe(
      'Todavía no sé leer estados de cuenta de ese banco. Por ahora leo: Banco B, Banco E.',
    );
  });

  it('tituloNuevos y vacío sin renglones nuevos', () => {
    expect(tituloNuevos(1)).toBe('El que no tenía');
    expect(tituloNuevos(3)).toBe('Los que no tenía');
    expect(TEXTO_SIN_NUEVOS).toMatch(/movimientos nuevos/);
  });

  it('mensajes de guardado y ajuste', () => {
    expect(mensajeGuardado(0, 'Oro')).toBe('No agregué nada: tu Oro ya tenía todo.');
    expect(mensajeGuardado(3, 'Oro')).toBe('Agregué 3 movimientos a tu Oro.');
    expect(mensajeAjustado('Oro')).toBe('Listo: tu Oro quedó como dice tu banco.');
  });

  it('CA-M15-03: escaneado y pregunta por movimiento dudoso', () => {
    expect(MENSAJE_ESCANEADO).toBe('No puedo leer PDFs escaneados');
    expect(preguntaMismoMovimiento('SORIANA', '2026-09-18', 153275)).toMatch(
      /¿Es el mismo que ya tenías: SORIANA del 18 sep por \$1,532\.75\?/,
    );
  });

  it('preguntaConciliacion en palabras (`02 §26`)', () => {
    expect(
      preguntaConciliacion({
        saldoBanco: 1_402_195,
        saldoCartera: 1_387_195,
        tarjetaId: 'x',
        nombreTarjeta: 'Oro',
        corte: '2026-10-10',
      }),
    ).toBe('Según tu banco debes $14,021.95; según Cartera, $13,871.95. ¿Ajusto?');
  });
});
