import { describe, expect, it } from 'vitest';
import { deshacer } from '../../servicios/deshacer';
import { agregarCuenta } from '../../servicios/onboarding';
import { tarjetaPorId } from '../../servicios/tarjetas';
import { iniciarFlujo, siguientePregunta } from './index';
import { flujoPagarTarjeta } from './pagar-tarjeta';
import { tomarPrellenado } from './prellenado';
import * as T from './textos';
import { baseVacia, chip, conEscenario, contestar, dicho, entendi, monto } from './__pruebas__/base';

describe('flujo pagar tarjeta', () => {
  it('e4-01 (una tarjeta): ¿cuánto? con el sugerido, ¿de qué cuenta?, «Entendí» y el pago con Deshacer', async () => {
    const p = conEscenario('e4-01');
    const nu = p.e.cuentas['nu'] as string;
    const bbva = p.e.cuentas['bbva'] as string;
    const e0 = flujoPagarTarjeta.inicial(p.ctx, null);
    const { estado, preguntas } = contestar(flujoPagarTarjeta, e0, [chip('200000'), dicho('de la bbva')]);
    expect(preguntas.map((q) => q.paso)).toEqual(['monto', 'origen']);
    // Sin corte cerrado desde el alta no hay pago para no generar intereses: se sugiere lo que debes.
    expect(preguntas[0]).toMatchObject({
      texto: '¿Cuánto pagas a tu Nu ••4410?',
      ayuda: 'Debes $2,000.',
      chips: [{ valor: '200000', etiqueta: 'Pagar $2,000' }],
      campo: 'monto',
    });
    expect(preguntas[1]?.chips.map((c) => c.etiqueta)).toEqual(['Cartera', 'BBVA Débito ••5521']);

    const { propuesta, fila } = entendi(flujoPagarTarjeta, p.ctx, estado);
    expect(propuesta).toMatchObject({ titulo: 'Entendí · ¿lo registro?', monto: 200_000 });
    expect(fila('tarjeta').valor).toBe('Nu ••4410');
    expect(fila('origen').valor).toBe('BBVA Débito ••5521');

    const m = await flujoPagarTarjeta.guardar(p.ctx, estado);
    expect(m.texto).toBe('Registré: pago a tu Nu ••4410 $2,000.');
    expect(Math.abs(tarjetaPorId(p.ctx, nu).saldoRevolvente)).toBe(0);
    expect(p.ctx.libro.saldo(bbva)).toBe(359_000 - 200_000);
    deshacer(p.ctx, m.deshacer as string);
    expect(tarjetaPorId(p.ctx, nu).saldoRevolvente).toBe(200_000);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('e5-10 (tres tarjetas, una cuenta): pregunta cuál tarjeta y no de qué cuenta', () => {
    const p = conEscenario('e5-10');
    const e0 = flujoPagarTarjeta.inicial(p.ctx, null);
    const q = siguientePregunta(flujoPagarTarjeta, e0);
    expect(q).toMatchObject({ paso: 'tarjeta', texto: T.PREGUNTA_CUAL_TARJETA });
    expect(q?.chips.map((c) => c.etiqueta)).toEqual(['Banamex Oro ••8812', 'Nu ••4410', 'BBVA Azul ••1022']);
    const { estado, preguntas } = contestar(flujoPagarTarjeta, e0, [dicho('la oro'), monto(50_000)]);
    expect(preguntas.map((x) => x.paso)).toEqual(['tarjeta', 'monto']);
    expect(estado).toMatchObject({
      tarjetaId: p.e.cuentas['oro'],
      monto: 50_000,
      origenId: p.e.cuentas['efectivo'],
    });
    expect(siguientePregunta(flujoPagarTarjeta, estado)).toBeNull();
  });

  it('desde el aviso de una tarjeta ya viene elegida', () => {
    const p = conEscenario('e5-10');
    const azul = p.e.cuentas['azul'] as string;
    const e0 = flujoPagarTarjeta.inicial(p.ctx, { desde: { tarjetaId: azul } });
    expect(siguientePregunta(flujoPagarTarjeta, e0)).toMatchObject({
      paso: 'monto',
      texto: '¿Cuánto pagas a tu BBVA Azul ••1022?',
    });
  });

  it('un monto en cero o que no se entiende es un error; otra tarjeta en «Entendí» se elige tocando la fila', () => {
    const p = conEscenario('e5-10');
    const e0 = flujoPagarTarjeta.inicial(p.ctx, { desde: { tarjetaId: p.e.cuentas['nu'] } });
    const pasoMonto = flujoPagarTarjeta.pasos[1];
    expect(pasoMonto?.aplicar(e0, monto(0))).toEqual({ error: T.ERROR_MONTO });
    expect(pasoMonto?.aplicar(e0, dicho('lo de siempre'))).toEqual({ error: T.ERROR_MONTO });
    const { estado } = contestar(flujoPagarTarjeta, e0, [dicho('mil quinientos')]);
    expect(estado.monto).toBe(150_000);
    const { fila, acciones } = entendi(flujoPagarTarjeta, p.ctx, estado);
    fila('tarjeta').alCambiar?.(p.e.cuentas['oro'] as string);
    expect(acciones.actualizar).toHaveBeenCalledWith(
      expect.objectContaining({ tarjetaId: p.e.cuentas['oro'] }),
    );
  });

  it('«Cambiar algo» abre el detalle de la tarjeta con el monto en memoria', () => {
    const p = conEscenario('e4-01');
    const nu = p.e.cuentas['nu'] as string;
    const { estado } = contestar(flujoPagarTarjeta, flujoPagarTarjeta.inicial(p.ctx, null), [monto(80_000)]);
    expect(flujoPagarTarjeta.formularioLargo(estado)).toEqual({
      pathname: '/tarjetas/[id]',
      params: { id: nu },
    });
    expect(tomarPrellenado('pagar_tarjeta')).toEqual({ tarjetaId: nu, monto: 80_000, origenId: null });
  });

  it('sin tarjetas no se puede empezar', () => {
    const p = baseVacia();
    agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 100_000 });
    expect(iniciarFlujo('pagar_tarjeta', p.ctx, null)).toEqual({ noDisponible: T.SIN_TARJETAS });
  });
});
