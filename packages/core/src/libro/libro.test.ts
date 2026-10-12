import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ErrorDominio } from '../errores';
import {
  construirAjusteArqueo,
  construirAportacionTanda,
  construirCobroPrestamo,
  construirCobroTanda,
  construirCompraMsi,
  construirConciliacion,
  construirCuentaDividida,
  construirGasto,
  construirGastoPareja,
  construirIngreso,
  construirLiquidacionMsi,
  construirMsiExistente,
  construirPagoPrestamo,
  construirPagoRecibidoPendiente,
  construirPagoTarjeta,
  construirPrestamoOtorgado,
  construirPrestamoRecibido,
  construirReclasificacionMsi,
  construirReembolso,
  construirRetiroEfectivo,
  construirReversa,
  construirSalidaPendiente,
  construirSaldoInicial,
  construirTransferencia,
  validarPatron,
  validarTransaccion,
  type CuentaParaPatron,
  type MovimientoPropuesto,
  type TipoTransaccion,
} from '../libro';

function cuenta(
  id: string,
  naturaleza: CuentaParaPatron['naturaleza'],
  subtipo: string,
  extra: Partial<CuentaParaPatron> = {},
): CuentaParaPatron {
  return {
    id,
    naturaleza,
    subtipo,
    liquida: false,
    espacio: 'personal',
    archivada: false,
    padreId: null,
    categoriaSlug: null,
    ...extra,
  };
}

const PLAN = [
  cuenta('efectivo', 'activo', 'efectivo', { liquida: true }),
  cuenta('bbva', 'activo', 'debito', { liquida: true }),
  cuenta('ahorro', 'activo', 'ahorro'),
  cuenta('externas', 'activo', 'externa'),
  cuenta('transito', 'activo', 'transito'),
  cuenta('entradas', 'activo', 'por_asignar_entradas'),
  cuenta('por_asignar', 'pasivo', 'por_asignar'),
  cuenta('nu', 'pasivo', 'tarjeta_credito'),
  cuenta('oro', 'pasivo', 'tarjeta_credito'),
  cuenta('oro_msi', 'pasivo', 'msi', { padreId: 'oro' }),
  cuenta('juan', 'contraparte', 'persona'),
  cuenta('ana', 'contraparte', 'persona'),
  cuenta('tanda', 'contraparte', 'tanda'),
  cuenta('pareja', 'contraparte', 'pareja'),
  cuenta('antojos', 'gasto', 'categoria', { categoriaSlug: 'antojos' }),
  cuenta('hogar', 'gasto', 'categoria', { categoriaSlug: 'hogar' }),
  cuenta('sueldo', 'ingreso', 'categoria', { categoriaSlug: 'sueldo' }),
  cuenta('ing_reembolso', 'ingreso', 'categoria', { categoriaSlug: 'reembolso' }),
  cuenta('saldos_iniciales', 'capital', 'saldos_iniciales'),
  cuenta('ajuste', 'capital', 'ajuste_conciliacion'),
  cuenta('caja', 'activo', 'efectivo', { liquida: true, espacio: 'negocio' }),
  cuenta('ventas_neg', 'ingreso', 'categoria', { espacio: 'negocio', categoriaSlug: 'ventas' }),
  cuenta('archivada', 'activo', 'debito', { liquida: true, archivada: true }),
];
const CUENTAS = new Map(PLAN.map((c) => [c.id, c]));

const registrable = (m: MovimientoPropuesto, fecha = '2026-10-12') =>
  validarTransaccion({ tipo: m.tipo, fecha, asientos: m.asientos, estimada: m.estimada ?? false }, CUENTAS);

function codigo(f: () => unknown): string | undefined {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorDominio) return e.codigo;
    throw e;
  }
  return undefined;
}

describe('E2 · validarTransaccion (forma)', () => {
  const ok = construirGasto({ categoria: 'antojos', pago: 'efectivo', monto: 2500 });

  it('acepta un gasto válido', () => expect(() => registrable(ok)).not.toThrow());
  it('rechaza un tipo fuera de la lista', () =>
    expect(codigo(() => validarTransaccion({ ...ok, tipo: 'regalo', fecha: '2026-10-12' }, CUENTAS))).toBe(
      'tipo_invalido',
    ));
  it('rechaza una fecha inválida', () =>
    expect(codigo(() => registrable(ok, '2026-02-30'))).toBe('fecha_invalida'));
  it('rechaza menos de 2 asientos', () =>
    expect(codigo(() => registrable({ tipo: 'gasto', asientos: [{ cuentaId: 'antojos', monto: 1 }] }))).toBe(
      'asientos_insuficientes',
    ));
  it('rechaza un monto 0 o con decimales', () => {
    const cero = {
      tipo: 'gasto' as const,
      asientos: [
        { cuentaId: 'antojos', monto: 0 },
        { cuentaId: 'efectivo', monto: 0 },
      ],
    };
    expect(codigo(() => registrable(cero))).toBe('monto_invalido');
    const decimal = {
      tipo: 'gasto' as const,
      asientos: [
        { cuentaId: 'antojos', monto: 25.5 },
        { cuentaId: 'efectivo', monto: -25.5 },
      ],
    };
    expect(codigo(() => registrable(decimal))).toBe('monto_invalido');
  });
  it('rechaza una suma distinta de cero', () => {
    const m = {
      tipo: 'gasto' as const,
      asientos: [
        { cuentaId: 'antojos', monto: 2500 },
        { cuentaId: 'efectivo', monto: -2400 },
      ],
    };
    expect(codigo(() => registrable(m))).toBe('suma_distinta_de_cero');
  });
  it('rechaza cuentas inexistentes y archivadas', () => {
    expect(codigo(() => registrable(construirGasto({ categoria: 'antojos', pago: 'x', monto: 1 })))).toBe(
      'cuenta_inexistente',
    );
    expect(
      codigo(() => registrable(construirGasto({ categoria: 'antojos', pago: 'archivada', monto: 1 }))),
    ).toBe('cuenta_archivada');
  });
  it('rechaza registrar una reversa directamente', () =>
    expect(codigo(() => registrable(construirReversa(ok.asientos)))).toBe('patron_invalido'));
  it('los constructores rechazan montos ≤ 0', () => {
    expect(codigo(() => construirGasto({ categoria: 'antojos', pago: 'efectivo', monto: 0 }))).toBe(
      'monto_invalido',
    );
    expect(codigo(() => construirGasto({ categoria: 'antojos', pago: 'efectivo', monto: -5 }))).toBe(
      'monto_invalido',
    );
    expect(
      codigo(() => construirSaldoInicial({ cuenta: 'bbva', capital: 'saldos_iniciales', saldo: 0 })),
    ).toBe('monto_invalido');
    expect(
      codigo(() => construirConciliacion({ cuenta: 'bbva', capital: 'ajuste', saldoLibro: 5, saldoReal: 5 })),
    ).toBe('sin_diferencia');
  });
});

describe('E2 · patrón por tipo (04 §3.1)', () => {
  const validos: [string, MovimientoPropuesto][] = [
    ['gasto con tarjeta', construirGasto({ categoria: 'antojos', pago: 'nu', monto: 1 })],
    ['gasto por asignar', construirGasto({ categoria: 'antojos', pago: 'por_asignar', monto: 1 })],
    ['ingreso por asignar', construirIngreso({ destino: 'entradas', categoria: 'sueldo', monto: 1 })],
    ['ingreso bonificación en tarjeta', construirIngreso({ destino: 'nu', categoria: 'sueldo', monto: 1 })],
    ['transferencia a externa', construirTransferencia({ origen: 'bbva', destino: 'externas', monto: 1 })],
    ['transferencia a ahorro', construirTransferencia({ origen: 'bbva', destino: 'ahorro', monto: 1 })],
    ['salida pendiente', construirSalidaPendiente({ origen: 'bbva', transito: 'transito', monto: 1 })],
    [
      'pago recibido pendiente',
      construirPagoRecibidoPendiente({ tarjeta: 'nu', transito: 'transito', monto: 1 }),
    ],
    ['retiro con tarjeta', construirRetiroEfectivo({ efectivo: 'efectivo', origen: 'oro', monto: 1 })],
    ['pago de tarjeta desde externa', construirPagoTarjeta({ tarjeta: 'nu', origen: 'externas', monto: 1 })],
    ['préstamo con tarjeta', construirPrestamoOtorgado({ persona: 'juan', origen: 'nu', monto: 1 })],
    ['cobro de préstamo', construirCobroPrestamo({ persona: 'juan', destino: 'bbva', monto: 1 })],
    ['préstamo recibido en tarjeta', construirPrestamoRecibido({ persona: 'juan', destino: 'nu', monto: 1 })],
    ['pago de préstamo', construirPagoPrestamo({ persona: 'juan', origen: 'bbva', monto: 1 })],
    ['compra MSI', construirCompraMsi({ categoria: 'hogar', cuentaMsi: 'oro_msi', monto: 1 })],
    [
      'reclasificación MSI',
      construirReclasificacionMsi({ planId: 'p', k: 1, cuentaMsi: 'oro_msi', tarjeta: 'oro', cuota: 1 }),
    ],
    ['liquidación MSI', construirLiquidacionMsi({ cuentaMsi: 'oro_msi', tarjeta: 'oro', monto: 1 })],
    [
      'cuenta dividida',
      construirCuentaDividida({ categoria: 'antojos', personas: ['juan', 'ana'], pago: 'nu', total: 300 }),
    ],
    ['aportación tanda', construirAportacionTanda({ tanda: 'tanda', origen: 'efectivo', monto: 1 })],
    ['cobro tanda', construirCobroTanda({ tanda: 'tanda', destino: 'efectivo', monto: 1 })],
    [
      'ajuste de arqueo',
      construirAjusteArqueo({ efectivo: 'efectivo', propuestas: [{ cuentaId: 'antojos', monto: 1 }] }),
    ],
    ['reembolso a gasto', construirReembolso({ destino: 'oro', contra: 'antojos', monto: 1 })],
    ['reembolso sin cargo', construirReembolso({ destino: 'oro', contra: 'ing_reembolso', monto: 1 })],
    ['saldo inicial', construirSaldoInicial({ cuenta: 'bbva', capital: 'saldos_iniciales', saldo: 1 })],
    [
      'saldo inicial de deuda',
      construirSaldoInicial({ cuenta: 'nu', capital: 'saldos_iniciales', saldo: -1 }),
    ],
    [
      'MSI existente',
      construirMsiExistente({
        cuentaMsi: 'oro_msi',
        capital: 'saldos_iniciales',
        mensualidad: 1,
        restantes: 2,
      }),
    ],
    [
      'conciliación al alza',
      construirConciliacion({ cuenta: 'bbva', capital: 'ajuste', saldoLibro: 1, saldoReal: 9 }),
    ],
  ];
  for (const [nombre, m] of validos) {
    it(`acepta ${nombre}`, () => expect(() => registrable(m)).not.toThrow());
  }

  const invalidos: [string, TipoTransaccion, [string, number][], boolean?][] = [
    [
      'gasto contra ahorro',
      'gasto',
      [
        ['antojos', 1],
        ['ahorro', -1],
      ],
    ],
    [
      'gasto contra ingreso',
      'gasto',
      [
        ['antojos', 1],
        ['sueldo', -1],
      ],
    ],
    [
      'gasto con dos pagos',
      'gasto',
      [
        ['antojos', 2],
        ['bbva', -1],
        ['efectivo', -1],
      ],
    ],
    [
      'gasto de por_asignar_entradas',
      'gasto',
      [
        ['antojos', 1],
        ['entradas', -1],
      ],
    ],
    [
      'ingreso a por_asignar (puente al revés)',
      'ingreso',
      [
        ['por_asignar', 1],
        ['sueldo', -1],
      ],
    ],
    [
      'pago de tarjeta que es gasto',
      'pago_tarjeta',
      [
        ['antojos', 1],
        ['bbva', -1],
      ],
    ],
    [
      'transferencia a la misma cuenta',
      'transferencia',
      [
        ['bbva', 1],
        ['bbva', -1],
      ],
    ],
    [
      'transferencia a tarjeta',
      'transferencia',
      [
        ['nu', 1],
        ['bbva', -1],
      ],
    ],
    [
      'transferencia por asignar',
      'transferencia',
      [
        ['bbva', 1],
        ['entradas', -1],
      ],
    ],
    [
      'retiro a débito',
      'retiro_efectivo',
      [
        ['bbva', 1],
        ['efectivo', -1],
      ],
    ],
    [
      'retiro desde por_asignar',
      'retiro_efectivo',
      [
        ['efectivo', 1],
        ['por_asignar', -1],
      ],
    ],
    [
      'préstamo a una tanda',
      'prestamo_otorgado',
      [
        ['tanda', 1],
        ['efectivo', -1],
      ],
    ],
    [
      'cobro de préstamo como ingreso',
      'cobro_prestamo',
      [
        ['bbva', 1],
        ['sueldo', -1],
      ],
    ],
    [
      'compra MSI contra tarjeta',
      'compra_msi',
      [
        ['hogar', 1],
        ['oro', -1],
      ],
    ],
    [
      'reclasificación a otra tarjeta',
      'reclasificacion_msi',
      [
        ['oro_msi', 1],
        ['nu', -1],
      ],
    ],
    [
      'cuenta dividida sin parte ajena',
      'cuenta_dividida',
      [
        ['antojos', 1],
        ['nu', -1],
      ],
    ],
    [
      'tanda contra persona',
      'aportacion_tanda',
      [
        ['juan', 1],
        ['efectivo', -1],
      ],
    ],
    [
      'ajuste de arqueo no estimado',
      'ajuste_arqueo',
      [
        ['antojos', 1],
        ['efectivo', -1],
      ],
    ],
    [
      'ajuste de arqueo contra débito',
      'ajuste_arqueo',
      [
        ['antojos', 1],
        ['bbva', -1],
      ],
      true,
    ],
    [
      'reembolso contra sueldo',
      'reembolso',
      [
        ['oro', 1],
        ['sueldo', -1],
      ],
    ],
    [
      'saldo inicial contra conciliación',
      'saldo_inicial',
      [
        ['bbva', 1],
        ['ajuste', -1],
      ],
    ],
    [
      'saldo inicial de una categoría',
      'saldo_inicial',
      [
        ['antojos', 1],
        ['saldos_iniciales', -1],
      ],
    ],
    [
      'conciliación sin capital',
      'conciliacion',
      [
        ['bbva', 1],
        ['efectivo', -1],
      ],
    ],
    [
      'gasto personal con la caja del negocio',
      'gasto',
      [
        ['antojos', 1],
        ['caja', -1],
      ],
    ],
    [
      'venta a crédito en lo personal',
      'venta_credito',
      [
        ['juan', 1],
        ['sueldo', -1],
      ],
    ],
    [
      'retiro del dueño al revés',
      'retiro_dueno',
      [
        ['caja', 1],
        ['bbva', -1],
      ],
    ],
  ];
  for (const [nombre, tipo, asientos, estimada] of invalidos) {
    it(`rechaza ${nombre}`, () => {
      const a = asientos.map(([cuentaId, monto]) => ({ cuentaId, monto }));
      expect(codigo(() => validarPatron(tipo, a, CUENTAS, { estimada: estimada ?? false }))).toBe(
        'patron_invalido',
      );
    });
  }

  it('acepta un retiro del dueño de la caja a lo personal', () =>
    expect(() =>
      validarPatron(
        'retiro_dueno',
        [
          { cuentaId: 'efectivo', monto: 1 },
          { cuentaId: 'caja', monto: -1 },
        ],
        CUENTAS,
      ),
    ).not.toThrow());
});

describe('E2 · constructores', () => {
  it('cuenta dividida: el centavo extra cae en tu parte', () => {
    const m = construirCuentaDividida({
      categoria: 'antojos',
      personas: ['juan', 'ana'],
      pago: 'nu',
      total: 100,
    });
    expect(m.asientos).toEqual([
      { cuentaId: 'antojos', monto: 34 },
      { cuentaId: 'juan', monto: 33 },
      { cuentaId: 'ana', monto: 33 },
      { cuentaId: 'nu', monto: -100 },
    ]);
  });
  it('reclasificación MSI sugiere la clave msi:{plan}:{k}', () =>
    expect(
      construirReclasificacionMsi({ planId: 'p1', k: 3, cuentaMsi: 'oro_msi', tarjeta: 'oro', cuota: 1 })
        .claveIdempotencia,
    ).toBe('msi:p1:3'));
  it('la reversa es el espejo exacto', () =>
    expect(
      construirReversa([
        { cuentaId: 'a', monto: 5 },
        { cuentaId: 'b', monto: -5 },
      ]).asientos,
    ).toEqual([
      { cuentaId: 'a', monto: -5 },
      { cuentaId: 'b', monto: 5 },
    ]));
});

// ── I1 (CA-M1-02): todo movimiento de los constructores suma cero y respeta su patrón ─────────────────
const montoArb = fc.integer({ min: 1, max: 1_000_000_000 });
const movimientoArb: fc.Arbitrary<MovimientoPropuesto> = fc.oneof(
  fc
    .tuple(montoArb, fc.constantFrom('efectivo', 'bbva', 'nu', 'por_asignar'))
    .map(([m, pago]) => construirGasto({ categoria: 'antojos', pago, monto: m })),
  montoArb.map((m) => construirIngreso({ destino: 'bbva', categoria: 'sueldo', monto: m })),
  montoArb.map((m) => construirTransferencia({ origen: 'bbva', destino: 'ahorro', monto: m })),
  montoArb.map((m) => construirSalidaPendiente({ origen: 'bbva', transito: 'transito', monto: m })),
  montoArb.map((m) => construirPagoRecibidoPendiente({ tarjeta: 'nu', transito: 'transito', monto: m })),
  montoArb.map((m) => construirRetiroEfectivo({ efectivo: 'efectivo', origen: 'bbva', monto: m })),
  montoArb.map((m) => construirPagoTarjeta({ tarjeta: 'nu', origen: 'bbva', monto: m })),
  montoArb.map((m) => construirPrestamoOtorgado({ persona: 'juan', origen: 'efectivo', monto: m })),
  montoArb.map((m) => construirCobroPrestamo({ persona: 'juan', destino: 'bbva', monto: m })),
  montoArb.map((m) => construirPrestamoRecibido({ persona: 'juan', destino: 'bbva', monto: m })),
  montoArb.map((m) => construirPagoPrestamo({ persona: 'juan', origen: 'bbva', monto: m })),
  montoArb.map((m) => construirCompraMsi({ categoria: 'hogar', cuentaMsi: 'oro_msi', monto: m })),
  fc
    .tuple(montoArb, fc.integer({ min: 1, max: 48 }))
    .map(([m, k]) =>
      construirReclasificacionMsi({ planId: 'p', k, cuentaMsi: 'oro_msi', tarjeta: 'oro', cuota: m }),
    ),
  montoArb.map((m) => construirLiquidacionMsi({ cuentaMsi: 'oro_msi', tarjeta: 'oro', monto: m })),
  fc
    .tuple(fc.integer({ min: 3, max: 1_000_000_000 }), fc.subarray(['juan', 'ana'], { minLength: 1 }))
    .map(([total, personas]) =>
      construirCuentaDividida({ categoria: 'antojos', personas, pago: 'nu', total }),
    ),
  montoArb.map((m) => construirAportacionTanda({ tanda: 'tanda', origen: 'efectivo', monto: m })),
  montoArb.map((m) => construirCobroTanda({ tanda: 'tanda', destino: 'efectivo', monto: m })),
  fc
    .array(fc.tuple(fc.constantFrom('antojos', 'hogar'), montoArb), { minLength: 1, maxLength: 4 })
    .map((ps) =>
      construirAjusteArqueo({
        efectivo: 'efectivo',
        propuestas: ps.map(([cuentaId, monto]) => ({ cuentaId, monto })),
      }),
    ),
  fc
    .tuple(montoArb, fc.constantFrom('antojos', 'ing_reembolso'))
    .map(([m, contra]) => construirReembolso({ destino: 'oro', contra, monto: m })),
  fc
    .tuple(
      fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }).filter((s) => s !== 0),
      fc.constantFrom('bbva', 'nu'),
    )
    .map(([s, c]) => construirSaldoInicial({ cuenta: c, capital: 'saldos_iniciales', saldo: s })),
  fc
    .tuple(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 1, max: 48 }))
    .map(([mensualidad, restantes]) =>
      construirMsiExistente({ cuentaMsi: 'oro_msi', capital: 'saldos_iniciales', mensualidad, restantes }),
    ),
  fc
    .tuple(montoArb, montoArb)
    .filter(([a, b]) => a !== b)
    .map(([saldoLibro, saldoReal]) =>
      construirConciliacion({ cuenta: 'bbva', capital: 'ajuste', saldoLibro, saldoReal }),
    ),
);

describe('E2 · gasto compartido en pareja (caso 31, E12.2)', () => {
  it('pagó tu pareja: tu parte a gasto contra lo que le debes; sin parte tuya no hay asiento', () => {
    const m = construirGastoPareja({
      categoria: 'antojos',
      pareja: 'pareja',
      parteMia: 48000,
      partePareja: 72000,
    });
    expect(m).toEqual({
      tipo: 'cuenta_dividida',
      asientos: [
        { cuentaId: 'antojos', monto: 48000 },
        { cuentaId: 'pareja', monto: -48000 },
      ],
    });
    registrable(m as MovimientoPropuesto);
    expect(
      construirGastoPareja({ categoria: 'antojos', pareja: 'pareja', parteMia: 0, partePareja: 5 }),
    ).toBe(null);
  });

  it('pagaste tú: cuenta dividida con las partes dadas, gasto si no le toca nada, préstamo si no te toca nada', () => {
    const base = { categoria: 'antojos', pareja: 'pareja', pago: 'nu' };
    const dividida = construirGastoPareja({ ...base, parteMia: 49999, partePareja: 50000 });
    expect(dividida?.asientos).toEqual([
      { cuentaId: 'antojos', monto: 49999 },
      { cuentaId: 'pareja', monto: 50000 },
      { cuentaId: 'nu', monto: -99999 },
    ]);
    const solo = construirGastoPareja({ ...base, parteMia: 45000, partePareja: 0 });
    const prestado = construirGastoPareja({ ...base, parteMia: 0, partePareja: 45000 });
    expect([dividida?.tipo, solo?.tipo, prestado?.tipo]).toEqual([
      'cuenta_dividida',
      'gasto',
      'prestamo_otorgado',
    ]);
    for (const m of [dividida, solo, prestado]) registrable(m as MovimientoPropuesto);
  });

  it('rechaza partes negativas, no enteras o un total de cero', () => {
    const base = { categoria: 'antojos', pareja: 'pareja' };
    expect(codigo(() => construirGastoPareja({ ...base, parteMia: -1, partePareja: 2 }))).toBe(
      'monto_invalido',
    );
    expect(codigo(() => construirGastoPareja({ ...base, parteMia: 1.5, partePareja: 2 }))).toBe(
      'monto_invalido',
    );
    expect(codigo(() => construirGastoPareja({ ...base, parteMia: 0, partePareja: 0 }))).toBe(
      'monto_invalido',
    );
  });
});

describe('E2 · I1 sobre los constructores', () => {
  it('I1: Σ montos = 0 y el patrón corresponde al tipo (1,000 corridas)', () => {
    fc.assert(
      fc.property(movimientoArb, (m) => {
        expect(m.asientos.reduce((s, a) => s + a.monto, 0)).toBe(0);
        expect(m.asientos.every((a) => Number.isSafeInteger(a.monto) && a.monto !== 0)).toBe(true);
        registrable(m);
        const r = construirReversa(m.asientos);
        expect(r.asientos.reduce((s, a) => s + a.monto, 0)).toBe(0);
      }),
      { numRuns: 1000 },
    );
  });

  it('I1: asientos con suma distinta de cero siempre se rechazan (1,000 corridas)', () => {
    fc.assert(
      fc.property(montoArb, montoArb, (a, b) => {
        fc.pre(a !== b);
        const m = {
          tipo: 'gasto' as const,
          asientos: [
            { cuentaId: 'antojos', monto: a },
            { cuentaId: 'efectivo', monto: -b },
          ],
        };
        expect(codigo(() => registrable(m))).toBe('suma_distinta_de_cero');
      }),
      { numRuns: 1000 },
    );
  });
});
