import { describe, expect, it } from 'vitest';
import { construirGasto } from '@cartera/core';
import { abrirBase, C } from './__pruebas__/base';
import { comprobarIntegridad } from './libro';

describe('comprobarIntegridad', () => {
  it('detecta montos no enteros aunque la transacción sume cero (respaldo manipulado)', () => {
    const { cliente, db } = abrirBase();
    expect(comprobarIntegridad(db)).toEqual([]);
    // Se salta el Libro a propósito: así llegaría un respaldo alterado a mano.
    cliente
      .prepare(
        `INSERT INTO transaccion (id, fecha, registrada_en, tipo, origen, clave_idempotencia)
         VALUES ('t-medio', '2026-10-12', 0, 'gasto', 'manual', 'k-medio')`,
      )
      .run();
    const asiento = cliente.prepare(
      `INSERT INTO asiento (id, transaccion_id, cuenta_id, monto) VALUES (?, 't-medio', ?, ?)`,
    );
    asiento.run('a1', C.antojos, 0.5);
    asiento.run('a2', C.efectivo, -0.5);
    expect(cliente.prepare(`SELECT typeof(monto) AS t FROM asiento WHERE id = 'a1'`).get()).toEqual({
      t: 'real',
    });
    expect(comprobarIntegridad(db)).toEqual([{ tipo: 'monto_no_entero', transaccionId: 't-medio' }]);
  });

  it('un libro registrado por el Libro sigue sano', () => {
    const { db, libro } = abrirBase();
    libro.registrar({
      ...construirGasto({ categoria: C.antojos, pago: C.efectivo, monto: 2500 }),
      fecha: '2026-10-12',
      origen: 'manual',
      claveIdempotencia: 'k1',
    });
    expect(comprobarIntegridad(db)).toEqual([]);
  });
});
