import { interpretarPaso, type ContextoPaso, type LecturaPaso } from '@cartera/nlu';
import { describe, expect, it } from 'vitest';
import { PAGOS_FIJOS_SUGERIDOS } from '../../servicios/onboarding';
import { RESPUESTAS_PAGO_INICIALES } from '../onboarding/pagos-fijos';
import { prellenadoDePagoLeido, type PagoLeido } from './prellenado';

const CONTEXTO: ContextoPaso = {
  fecha_referencia: '2026-10-11',
  espacios: ['personal'],
  cuentas: [{ tipo: 'debito', alias: ['bbva'], espacio: 'personal' }],
};
const CUENTAS = [
  { id: 'c-bbva', nombre: 'BBVA' },
  { id: 'c-nu', nombre: 'Nu' },
];

/** El único pago que lee el nivel 0 en la frase (O5 dicta uno a la vez). */
function leer(texto: string): PagoLeido {
  const l: LecturaPaso | null = interpretarPaso('pagos_fijos', texto, CONTEXTO);
  if (l?.paso !== 'pagos_fijos' || l.pagos.length !== 1 || !l.pagos[0])
    throw new Error(`sin lectura: ${texto}`);
  return l.pagos[0];
}

const pago = (p: Partial<PagoLeido>): PagoLeido => ({
  concepto: 'Renta',
  monto: { monto: 450_000, aproximado: false },
  ...p,
});

describe('prellenadoDePagoLeido («O dímelo» de un pago fijo)', () => {
  it('«pago 4500 de renta cada mes el 5»: chip Renta, día 5, $4,500', () => {
    expect(
      prellenadoDePagoLeido(leer('pago 4500 de renta cada mes el 5'), PAGOS_FIJOS_SUGERIDOS, CUENTAS),
    ).toEqual({
      clave: 'renta',
      nombre: 'Renta',
      monto: 450_000,
      respuestas: { ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'mensual', diaMes: '5' },
      cuentaId: null,
    });
  });

  it('un concepto fuera del catálogo va a «Otro» con el nombre como se dijo', () => {
    const p = prellenadoDePagoLeido(
      pago({ concepto: 'Netflix', frecuencia: 'mensual' }),
      PAGOS_FIJOS_SUGERIDOS,
    );
    expect(p).toMatchObject({ clave: 'otro', nombre: 'Netflix' });
    expect(p.respuestas.diaMes).toBe('');
  });

  it('cada regla llena su frecuencia; toda quincena es la del 15 y último y la catorcena queda por elegir', () => {
    const r = (regla: NonNullable<PagoLeido['regla']>, frecuencia?: PagoLeido['frecuencia']) =>
      prellenadoDePagoLeido(pago({ regla, ...(frecuencia ? { frecuencia } : {}) }), PAGOS_FIJOS_SUGERIDOS)
        .respuestas;
    expect(r({ tipo: 'anual', mes: 3, dia: 15 }, 'anual')).toMatchObject({
      frecuencia: 'anual',
      mes: 3,
      diaMes: '15',
    });
    expect(r({ tipo: 'semanal', dia_semana: 5 }, 'semanal')).toMatchObject({
      frecuencia: 'semanal',
      diaSemana: 5,
    });
    expect(r({ tipo: 'quincenal_dias', dias: [10, 25] }, 'quincenal')).toMatchObject({
      frecuencia: 'quincenal',
    });
    expect(r({ tipo: 'quincenal_15_ultimo' }, 'quincenal')).toMatchObject({ frecuencia: 'quincenal' });
    expect(r({ tipo: 'catorcenal', ancla: '2026-10-09' })).toEqual(RESPUESTAS_PAGO_INICIALES);
  });

  it('la cuenta dicha se elige solo si coincide con una; cuántos pagos faltan, si se dijo', () => {
    expect(
      prellenadoDePagoLeido(
        pago({ cuentaAlias: 'la BBVA', pagosRestantes: 12 }),
        PAGOS_FIJOS_SUGERIDOS,
        CUENTAS,
      ),
    ).toMatchObject({ cuentaId: 'c-bbva', respuestas: { pagosRestantes: '12' } });
    expect(
      prellenadoDePagoLeido(pago({ cuentaAlias: 'Santander' }), PAGOS_FIJOS_SUGERIDOS, CUENTAS).cuentaId,
    ).toBeNull();
  });

  it('«cada dos meses» no tiene regla: el monto se llena y la frecuencia la elige la persona', () => {
    const p = prellenadoDePagoLeido(leer('la luz son como 400 cada dos meses'), PAGOS_FIJOS_SUGERIDOS);
    expect(p).toMatchObject({ clave: 'luz', nombre: 'Luz', monto: 40_000 });
    expect(p.respuestas).toEqual(RESPUESTAS_PAGO_INICIALES);
  });
});
