import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { abrirBase, C, type BaseDePrueba } from './__pruebas__/base';
import type { TransaccionNueva } from './libro';
import {
  construirAjusteArqueo,
  construirAportacionTanda,
  construirCobroPrestamo,
  construirCobroTanda,
  construirCompraMsi,
  construirConciliacion,
  construirCuentaDividida,
  construirGasto,
  construirIngreso,
  construirLiquidacionMsi,
  construirPagoPrestamo,
  construirPagoRecibidoPendiente,
  construirPagoTarjeta,
  construirPrestamoOtorgado,
  construirPrestamoRecibido,
  construirReembolso,
  construirRetiroEfectivo,
  construirSalidaPendiente,
  construirSaldoInicial,
  construirTransferencia,
  type MovimientoPropuesto,
} from '@cartera/core';

/**
 * CA-M1-02 · Invariantes I1–I5 de E2 (`docs/05-MOTORES.md §E2`) como propiedades de fast-check con 1,000
 * corridas cada una, contra el repositorio real sobre SQLite (`better-sqlite3`, el mismo SQL de la app).
 */

const CORRIDAS = { numRuns: 1000 };
const FECHAS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] as const;
const HASTAS = [undefined, ...FECHAS, '2026-09-30'] as const;

/** Todas las cuentas que tocan los movimientos generados. */
const CUENTAS = [
  C.efectivo,
  C.bbva,
  C.ahorro,
  C.nu,
  C.oro,
  C.oroMsi,
  C.t8812,
  C.juan,
  C.hermano,
  C.amigo1,
  C.amigo2,
  C.tanda,
  C.porAsignar,
  C.porAsignarEntradas,
  C.transito,
  C.cuentasExternas,
  C.saldosIniciales,
  C.ajusteConciliacion,
  C.antojos,
  C.comidaFuera,
  C.hogar,
  C.ropa,
  C.variosEfectivo,
  C.sueldo,
  C.honorarios,
  C.ingresoReembolso,
];

const montoArb = fc.integer({ min: 1, max: 100_000_000 });
const liquidaArb = fc.constantFrom(C.efectivo, C.bbva);
const pagoArb = fc.constantFrom(C.efectivo, C.bbva, C.nu, C.oro, C.porAsignar);
const tarjetaArb = fc.constantFrom(C.nu, C.oro, C.t8812);
const personaArb = fc.constantFrom(C.juan, C.hermano);
const gastoArb = fc.constantFrom(C.antojos, C.comidaFuera, C.hogar, C.ropa);

/** Un movimiento válido de cualquiera de los constructores de E2. */
const movimientoArb: fc.Arbitrary<MovimientoPropuesto> = fc.oneof(
  fc
    .tuple(gastoArb, pagoArb, montoArb)
    .map(([categoria, pago, monto]) => construirGasto({ categoria, pago, monto })),
  fc
    .tuple(
      fc.constantFrom(C.bbva, C.efectivo, C.porAsignarEntradas),
      fc.constantFrom(C.sueldo, C.honorarios),
      montoArb,
    )
    .map(([destino, categoria, monto]) => construirIngreso({ destino, categoria, monto })),
  fc
    .tuple(
      fc.constantFrom(C.bbva, C.ahorro, C.cuentasExternas),
      fc.constantFrom(C.efectivo, C.ahorro),
      montoArb,
    )
    .filter(([o, d]) => o !== d)
    .map(([origen, destino, monto]) => construirTransferencia({ origen, destino, monto })),
  fc
    .tuple(liquidaArb, montoArb)
    .map(([origen, monto]) => construirSalidaPendiente({ origen, transito: C.transito, monto })),
  fc
    .tuple(tarjetaArb, montoArb)
    .map(([tarjeta, monto]) => construirPagoRecibidoPendiente({ tarjeta, transito: C.transito, monto })),
  fc
    .tuple(fc.constantFrom(C.bbva, C.oro), montoArb)
    .map(([origen, monto]) => construirRetiroEfectivo({ efectivo: C.efectivo, origen, monto })),
  fc
    .tuple(tarjetaArb, fc.constantFrom(C.bbva, C.cuentasExternas), montoArb)
    .map(([tarjeta, origen, monto]) => construirPagoTarjeta({ tarjeta, origen, monto })),
  fc
    .tuple(personaArb, liquidaArb, montoArb)
    .map(([persona, origen, monto]) => construirPrestamoOtorgado({ persona, origen, monto })),
  fc
    .tuple(personaArb, liquidaArb, montoArb)
    .map(([persona, destino, monto]) => construirCobroPrestamo({ persona, destino, monto })),
  fc
    .tuple(personaArb, fc.constantFrom(C.bbva, C.nu), montoArb)
    .map(([persona, destino, monto]) => construirPrestamoRecibido({ persona, destino, monto })),
  fc
    .tuple(personaArb, liquidaArb, montoArb)
    .map(([persona, origen, monto]) => construirPagoPrestamo({ persona, origen, monto })),
  fc
    .tuple(gastoArb, montoArb)
    .map(([categoria, monto]) => construirCompraMsi({ categoria, cuentaMsi: C.oroMsi, monto })),
  montoArb.map((monto) => construirLiquidacionMsi({ cuentaMsi: C.oroMsi, tarjeta: C.oro, monto })),
  fc
    .tuple(
      gastoArb,
      fc.subarray([C.amigo1, C.amigo2], { minLength: 1 }),
      pagoArb,
      fc.integer({ min: 3, max: 1e8 }),
    )
    .map(([categoria, personas, pago, total]) =>
      construirCuentaDividida({ categoria, personas, pago, total }),
    ),
  fc
    .tuple(liquidaArb, montoArb)
    .map(([origen, monto]) => construirAportacionTanda({ tanda: C.tanda, origen, monto })),
  fc
    .tuple(liquidaArb, montoArb)
    .map(([destino, monto]) => construirCobroTanda({ tanda: C.tanda, destino, monto })),
  fc
    .array(fc.tuple(fc.constantFrom(C.comidaFuera, C.antojos, C.variosEfectivo), montoArb), {
      minLength: 1,
      maxLength: 4,
    })
    .map((ps) =>
      construirAjusteArqueo({
        efectivo: C.efectivo,
        propuestas: ps.map(([cuentaId, monto]) => ({ cuentaId, monto })),
      }),
    ),
  fc
    .tuple(fc.constantFrom(C.oro, C.bbva), fc.constantFrom(C.ropa, C.ingresoReembolso), montoArb)
    .map(([destino, contra, monto]) => construirReembolso({ destino, contra, monto })),
  fc
    .tuple(
      fc.constantFrom(C.bbva, C.nu, C.oroMsi, C.tanda, C.ahorro),
      fc.integer({ min: -1e8, max: 1e8 }).filter((s) => s !== 0),
    )
    .map(([cuenta, s]) => construirSaldoInicial({ cuenta, capital: C.saldosIniciales, saldo: s })),
  fc
    .tuple(fc.constantFrom(C.bbva, C.efectivo), montoArb, montoArb)
    .filter(([, a, b]) => a !== b)
    .map(([cuenta, saldoLibro, saldoReal]) =>
      construirConciliacion({ cuenta, capital: C.ajusteConciliacion, saldoLibro, saldoReal }),
    ),
);

const fechaArb = fc.constantFrom(...FECHAS);
const hastaArb = fc.constantFrom(...HASTAS);

type Operacion =
  | { readonly op: 'registrar'; readonly mov: MovimientoPropuesto; readonly fecha: string }
  | { readonly op: 'anular'; readonly indice: number }
  | {
      readonly op: 'reemplazar';
      readonly indice: number;
      readonly mov: MovimientoPropuesto;
      readonly fecha: string;
    };

const operacionArb: fc.Arbitrary<Operacion> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({ op: fc.constant('registrar' as const), mov: movimientoArb, fecha: fechaArb }),
  },
  { weight: 1, arbitrary: fc.record({ op: fc.constant('anular' as const), indice: fc.nat() }) },
  {
    weight: 1,
    arbitrary: fc.record({
      op: fc.constant('reemplazar' as const),
      indice: fc.nat(),
      mov: movimientoArb,
      fecha: fechaArb,
    }),
  },
);
const operacionesArb = fc.array(operacionArb, { maxLength: 8 });

let clave = 0;
function tx(mov: MovimientoPropuesto, fecha: string, claveIdempotencia = `k${++clave}`): TransaccionNueva {
  return {
    tipo: mov.tipo,
    asientos: mov.asientos,
    estimada: mov.estimada ?? false,
    fecha,
    origen: 'manual',
    claveIdempotencia,
  };
}

/** Modelo independiente: asientos aplicados, con su fecha. */
type Modelo = { cuentaId: string; monto: number; fecha: string }[];

function saldoModelo(modelo: Modelo, cuenta: string, hasta?: string): number {
  return modelo
    .filter((a) => a.cuentaId === cuenta && (hasta === undefined || a.fecha <= hasta))
    .reduce((s, a) => s + a.monto, 0);
}

/** Aplica las operaciones; `alPaso` corre después de cada una. Devuelve el modelo y las transacciones vivas. */
function aplicar(base: BaseDePrueba, ops: readonly Operacion[], alPaso: () => void = () => {}) {
  const modelo: Modelo = [];
  const vivas: { id: string; fecha: string; asientos: readonly { cuentaId: string; monto: number }[] }[] = [];
  const anotar = (fecha: string, asientos: readonly { cuentaId: string; monto: number }[], signo: 1 | -1) => {
    for (const a of asientos) modelo.push({ cuentaId: a.cuentaId, monto: signo * a.monto, fecha });
  };
  for (const o of ops) {
    if (o.op === 'registrar') {
      const t = base.libro.registrar(tx(o.mov, o.fecha)).transaccion;
      vivas.push(t);
      anotar(t.fecha, t.asientos, 1);
    } else if (vivas.length > 0) {
      const [x] = vivas.splice(o.indice % vivas.length, 1);
      if (!x) continue;
      if (o.op === 'anular') {
        base.libro.anular(x.id);
        anotar(x.fecha, x.asientos, -1);
      } else {
        const { nueva } = base.libro.reemplazar(x.id, tx(o.mov, o.fecha));
        anotar(x.fecha, x.asientos, -1);
        vivas.push(nueva);
        anotar(nueva.fecha, nueva.asientos, 1);
      }
    }
    alPaso();
  }
  return { modelo, vivas };
}

function saldos(base: BaseDePrueba): number[] {
  return HASTAS.flatMap((h) => CUENTAS.map((c) => base.libro.saldo(c, h)));
}

function conBase<T>(f: (base: BaseDePrueba) => T): T {
  const base = abrirBase();
  try {
    return f(base);
  } finally {
    base.cliente.close();
  }
}

// 1,000 corridas sobre SQLite tardan unos segundos por propiedad.
describe(
  'CA-M1-02 · invariantes de E2 sobre el repositorio (1,000 corridas cada una)',
  { timeout: 60_000 },
  () => {
    it('I1: toda transacción registrada suma cero y tiene ≥ 2 asientos', () => {
      fc.assert(
        fc.property(operacionesArb, (ops) =>
          conBase((base) => {
            aplicar(base, ops);
            const ids = base.cliente.prepare('SELECT id FROM transaccion').all() as { id: string }[];
            for (const { id } of ids) {
              const t = base.libro.obtener(id);
              expect(t?.asientos.length).toBeGreaterThanOrEqual(2);
              expect(t?.asientos.reduce((s, a) => s + a.monto, 0)).toBe(0);
            }
            expect(base.libro.comprobarIntegridad()).toEqual([]);
          }),
        ),
        CORRIDAS,
      );
    });

    it('I2: Σ saldos de todas las cuentas = 0 después de cada operación', () => {
      fc.assert(
        fc.property(operacionesArb, hastaArb, (ops, hasta) =>
          conBase((base) => {
            const todas = (base.cliente.prepare('SELECT id FROM cuenta').all() as { id: string }[]).map(
              (f) => f.id,
            );
            aplicar(base, ops, () => {
              expect(todas.reduce((s, c) => s + base.libro.saldo(c, hasta), 0)).toBe(0);
            });
          }),
        ),
        CORRIDAS,
      );
    });

    it('I3: anular(x) deja los saldos como antes de registrar x', () => {
      fc.assert(
        fc.property(operacionesArb, movimientoArb, fechaArb, (ops, x, fecha) =>
          conBase((base) => {
            aplicar(base, ops);
            const antes = saldos(base);
            const t = base.libro.registrar(tx(x, fecha)).transaccion;
            base.libro.anular(t.id);
            expect(saldos(base)).toEqual(antes);
          }),
        ),
        CORRIDAS,
      );
    });

    it('I3: reemplazar(x, y) deja los mismos saldos que registrar solo y', () => {
      fc.assert(
        fc.property(
          operacionesArb,
          movimientoArb,
          fechaArb,
          movimientoArb,
          fechaArb,
          (ops, x, fechaX, y, fechaY) => {
            const conReemplazo = conBase((base) => {
              aplicar(base, ops);
              const t = base.libro.registrar(tx(x, fechaX)).transaccion;
              base.libro.reemplazar(t.id, tx(y, fechaY));
              return saldos(base);
            });
            const soloY = conBase((base) => {
              aplicar(base, ops);
              base.libro.registrar(tx(y, fechaY));
              return saldos(base);
            });
            expect(conReemplazo).toEqual(soloY);
          },
        ),
        CORRIDAS,
      );
    });

    it('I4: registrar dos veces con la misma clave produce una sola transacción', () => {
      fc.assert(
        fc.property(operacionesArb, movimientoArb, movimientoArb, fechaArb, (ops, x, otro, fecha) =>
          conBase((base) => {
            aplicar(base, ops);
            const cuenta = () =>
              (base.cliente.prepare('SELECT COUNT(*) AS n FROM transaccion').get() as { n: number }).n;
            const antes = cuenta();
            const primera = base.libro.registrar(tx(x, fecha, 'misma'));
            const saldosPrimera = saldos(base);
            // La segunda llega con la misma clave (aunque el contenido difiera): devuelve la existente.
            const segunda = base.libro.registrar(tx(otro, fecha, 'misma'));
            expect(primera.nueva).toBe(true);
            expect(segunda.nueva).toBe(false);
            expect(segunda.transaccion).toEqual(primera.transaccion);
            expect(cuenta()).toBe(antes + 1);
            expect(saldos(base)).toEqual(saldosPrimera);
          }),
        ),
        CORRIDAS,
      );
    });

    it('I5: todo saldo sale del libro (Σ de asientos), incluidos saldos iniciales y conciliaciones', () => {
      // Ninguna tabla de 0001 guarda un saldo editable de una cuenta.
      conBase((base) => {
        const columnas = (base.cliente.prepare('PRAGMA table_info(cuenta)').all() as { name: string }[]).map(
          (c) => c.name,
        );
        expect(columnas.filter((c) => c.includes('saldo'))).toEqual([]);
      });
      fc.assert(
        fc.property(operacionesArb, (ops) =>
          conBase((base) => {
            const { modelo } = aplicar(base, ops);
            for (const h of HASTAS) {
              for (const c of CUENTAS) expect(base.libro.saldo(c, h)).toBe(saldoModelo(modelo, c, h));
            }
            // Saldos iniciales y conciliaciones solo existen como transacciones contra capital.
            const capital = base.cliente
              .prepare(
                `SELECT t.tipo, a.cuenta_id FROM asiento a JOIN transaccion t ON t.id = a.transaccion_id
               JOIN cuenta c ON c.id = a.cuenta_id WHERE c.naturaleza = 'capital'`,
              )
              .all() as { tipo: string; cuenta_id: string }[];
            for (const f of capital) {
              expect(['saldo_inicial', 'conciliacion', 'reversa']).toContain(f.tipo);
              if (f.tipo === 'saldo_inicial') expect(f.cuenta_id).toBe(C.saldosIniciales);
              if (f.tipo === 'conciliacion') expect(f.cuenta_id).toBe(C.ajusteConciliacion);
            }
          }),
        ),
        CORRIDAS,
      );
    });
  },
);
