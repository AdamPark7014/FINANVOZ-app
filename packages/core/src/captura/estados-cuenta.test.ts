import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '../errores';
import {
  aJson,
  BANCOS_PDF,
  cargarAnalizadoresEjemplo,
  jsonEsperado,
  rutaPdf,
  textoPdf,
} from '../__pruebas__/estados-cuenta';
import {
  analizarEstadoCuenta,
  compilarAnalizadores,
  deudaDeMovimiento,
  esPdfEscaneado,
  leerEstadoCuentaPdf,
  normalizarParaTipo,
  normalizarTextoPdf,
  parsearFechaEstado,
  parsearMontoEstado,
  type EstadoCuentaLeido,
  type LecturaEstado,
} from './estados-cuenta';

const catalogo = compilarAnalizadores(cargarAnalizadoresEjemplo());

function leido(r: LecturaEstado): EstadoCuentaLeido {
  if (r.tipo !== 'leido') throw new Error(`esperaba leido y fue ${r.tipo}`);
  return r.estado;
}

describe('CA-M15-01 · los PDF sintéticos de 3 bancos producen exactamente el JSON esperado', () => {
  for (const banco of BANCOS_PDF) {
    it(`${banco}: periodo, corte, límite, saldo al corte, PNGI, movimientos y MSI`, () => {
      const r = leerEstadoCuentaPdf([textoPdf(banco)], catalogo);
      expect(aJson(leido(r))).toStrictEqual(jsonEsperado(banco));
    });
  }

  it('Banco B trae los 42 movimientos de CA-M15-02 en dos páginas', () => {
    const texto = textoPdf('banco_b');
    const corte = texto.indexOf('BANCO B · ESTADO DE CUENTA Página 2');
    const paginas = [texto.slice(0, corte), texto.slice(corte)];
    const e = leido(leerEstadoCuentaPdf(paginas, catalogo));
    expect(e.movimientos).toHaveLength(42);
    expect(e.cuadra).toBe(true);
  });

  it('el generador reproduce byte a byte los PDF, textos y JSON de fixtures/pdf', () => {
    // `--verificar` sale con código 1 (y `execFileSync` lanza) si algún archivo difiere.
    expect(() =>
      execFileSync(process.execPath, [rutaPdf('generar.mjs'), '--verificar'], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});

describe('07 §8 · lectura del texto', () => {
  it('normaliza espacios, finales de línea, NFC y renglones vacíos', () => {
    expect(normalizarTextoPdf(['  A\u00a0\u00a0 B \r\n\r\n', 'Cafe\u0301\tdel  bosque\rX'])).toBe(
      'A B\nCafé del bosque\nX',
    );
  });

  it('un PDF sin texto, o con casi nada, es escaneado (CA-M15-03)', () => {
    expect(esPdfEscaneado([])).toBe(true);
    expect(esPdfEscaneado([''])).toBe(true);
    expect(esPdfEscaneado(['  \n\n  ', 'Página 2'])).toBe(true);
    expect(leerEstadoCuentaPdf(['', ''], catalogo)).toStrictEqual({ tipo: 'escaneado' });
    expect(esPdfEscaneado([textoPdf('banco_f')])).toBe(false);
  });

  it('un texto que ningún analizador reconoce', () => {
    const texto = 'ESTADO DE CUENTA DE OTRO BANCO\n'.repeat(5);
    expect(leerEstadoCuentaPdf([texto], catalogo)).toStrictEqual({ tipo: 'no_reconocido' });
  });

  it('sin corte, saldo o sección de movimientos queda incompleto (sin texto del estado en el resultado)', () => {
    const texto = textoPdf('banco_b')
      .replace(/^Fecha de corte:.*$/m, '')
      .replace(/^Saldo al corte:.*$/m, 'Saldo al corte: $1,2,3')
      .replace('MOVIMIENTOS DEL PERIODO', 'OTRA COSA');
    const r = analizarEstadoCuenta(normalizarTextoPdf([texto]), catalogo);
    expect(r).toStrictEqual({
      tipo: 'incompleto',
      analizador: 'banco_b.estado.v1',
      faltan: ['corte', 'saldo_corte', 'movimientos'],
    });
    const sinSaldo = textoPdf('banco_e').replace(/^Saldo al corte.*$/m, '');
    expect(analizarEstadoCuenta(normalizarTextoPdf([sinSaldo]), catalogo)).toMatchObject({
      tipo: 'incompleto',
      faltan: ['saldo_corte'],
    });
  });

  it('un monto o una fecha mal escritos en el encabezado lo dejan incompleto', () => {
    // Un analizador permisivo deja pasar un monto que no es monto.
    const archivo = cargarAnalizadoresEjemplo() as { analizadores: { campos: Record<string, string> }[] };
    const b = archivo.analizadores[0] as { campos: Record<string, string> };
    b.campos['pago_minimo'] = '^Pago mínimo: (?<v>.+)$';
    const permisivo = compilarAnalizadores({ analizadores: [b] });
    const texto = textoPdf('banco_b')
      .replace(/^Pago mínimo: .*$/m, 'Pago mínimo: $1.2.3')
      .replace(/^Periodo: .*$/m, 'Periodo: 31/02/2026 al 10/10/2026')
      .replace(/^Fecha límite de pago: .*$/m, 'Fecha límite de pago: 99/99/2026');
    expect(analizarEstadoCuenta(normalizarTextoPdf([texto]), permisivo)).toMatchObject({
      tipo: 'incompleto',
      faltan: ['periodo', 'limite', 'pago_minimo'],
    });
  });

  it('los renglones que no se pueden leer se cuentan y los totales dejan de cuadrar', () => {
    const texto = textoPdf('banco_b')
      .replace('13/09/2026 STARBUCKS INSURGENTES $98.00', '13/09/2026 STARBUCKS INSURGENTES $9 8.00')
      .replace('22/09/2026 SPOTIFY $129.00', '31/09/2026 SPOTIFY $129.00')
      .replace('DESCRIPCIÓN ORIGINAL PENDIENTE MENSUALIDAD NÚM.', 'RENGLÓN RARO')
      .replace(
        'ELECTRONICA SINTETICA $6,000.00 $5,000.00 $1,000.00 1 de 6',
        'ELECTRONICA SINTETICA $6,000.00 $5,000.00 $1,000.00 7 de 6',
      );
    const e = leido(analizarEstadoCuenta(normalizarTextoPdf([texto]), catalogo));
    expect(e.movimientos).toHaveLength(40);
    expect(e.msi).toHaveLength(1);
    expect(e.renglonesSinLeer).toBe(4);
    expect(e.cuadra).toBe(false);
    // Los índices siguen siendo consecutivos: identifican el renglón leído.
    expect(e.movimientos.map((m) => m.indice)).toStrictEqual([...Array(40).keys()]);
  });

  it('sin sección de MSI no hay MSI; sin totales, cuadra es null', () => {
    const texto = textoPdf('banco_e')
      .replace('MESES SIN INTERESES', 'OTRA SECCIÓN')
      .replace(/^Total abonos.*$/m, '')
      .replace(/^Total cargos.*$/m, 'Total cargos 2,648.40');
    const e = leido(analizarEstadoCuenta(normalizarTextoPdf([texto]), catalogo));
    expect(e.msi).toStrictEqual([]);
    expect(e.cuadra).toBe(true);
    expect(e.totalAbonos).toBeNull();
  });

  it('pagos y comisiones salen de la descripción; un saldo a favor es negativo', () => {
    const texto = textoPdf('banco_e').replace(/^Saldo al corte .*$/m, 'Saldo al corte 150.00 CR');
    const e = leido(analizarEstadoCuenta(normalizarTextoPdf([texto]), catalogo));
    expect(e.saldoCorte).toBe(-15000);
    expect(e.movimientos.filter((m) => m.tipo === 'pago').map((m) => m.descripcion)).toStrictEqual([
      'SU PAGO SPEI RECIBIDO',
    ]);
    expect(e.movimientos.filter((m) => m.tipo === 'abono').map((m) => m.descripcion)).toStrictEqual([
      'DEVOLUCION MERCADO LIBRE',
    ]);
    expect(deudaDeMovimiento({ monto: 100, tipo: 'pago' })).toBe(-100);
    expect(deudaDeMovimiento({ monto: 100, tipo: 'comision' })).toBe(100);
    expect(normalizarParaTipo(' Comisión  anual-IVA ')).toBe('COMISION ANUAL IVA');
  });
});

describe('montos y fechas de estados de cuenta', () => {
  it.each([
    ['$1,234.56', 123456],
    ['-$1,234.56', -123456],
    ['- $ 1,234.56', -123456],
    ['1,234.56 CR', -123456],
    ['(1,234.56)', -123456],
    ['-$ 5', -500],
    ['$ 0.00', 0],
    ['12', 1200],
  ])('%s → %d', (s, esperado) => expect(parsearMontoEstado(s)).toBe(esperado));

  it.each(['', 'abc', '$1.234,56', '--5'])('%s no es un monto', (s) =>
    expect(parsearMontoEstado(s)).toBeNull(),
  );

  it.each([
    ['11/09/2026', null, '2026-09-11'],
    ['1-9-2026', null, '2026-09-01'],
    ['11-sep-2026', null, '2026-09-11'],
    ['11 SEPT. 2026', null, '2026-09-11'],
    ['3 de Octubre de 2026', null, '2026-10-03'],
    ['1 de septiembre de 2026', null, '2026-09-01'],
    ['02 SEP', '2026-09-30', '2026-09-02'],
    ['28 DIC', '2027-01-10', '2026-12-28'],
    ['05/01', '2027-01-10', '2027-01-05'],
    ['29 FEB', '2028-03-10', '2028-02-29'],
  ] as const)('%s (ancla %s) → %s', (s, ancla, esperado) =>
    expect(parsearFechaEstado(s, ancla)).toBe(esperado),
  );

  it.each([
    ['31/02/2026', null],
    ['11-xyz-2026', null],
    ['11 SEP', null],
    ['13/13/2026', null],
    ['11/09/1999', null],
    ['hoy', null],
    ['30 FEB', '2026-03-10'],
  ] as const)('%s (ancla %s) no es fecha', (s, ancla) => expect(parsearFechaEstado(s, ancla)).toBeNull());
});

describe('compilarAnalizadores · un error invalida el archivo completo', () => {
  const base = cargarAnalizadoresEjemplo() as { analizadores: Record<string, unknown>[] };
  const primero = base.analizadores[0] as Record<string, unknown>;
  const con = (cambio: Record<string, unknown>) => ({
    version: 1,
    analizadores: [{ ...primero, ...cambio }],
  });
  const falla = (archivo: unknown) => {
    try {
      compilarAnalizadores(archivo);
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorDominio);
      expect((e as ErrorDominio).codigo).toBe('analizadores_invalidos');
      return;
    }
    throw new Error('no falló');
  };

  it('el ejemplo compila con sus tres bancos', () => {
    expect(catalogo.version).toBe(1);
    expect(catalogo.analizadores.map((a) => a.banco)).toStrictEqual(['banco_b', 'banco_e', 'banco_f']);
    expect(compilarAnalizadores({ analizadores: [] }).version).toBeNull();
  });

  it.each([
    ['no objeto', null],
    ['version', { version: 1.5, analizadores: [] }],
    ['sin lista', { version: 1 }],
    ['sin id', { analizadores: [{}] }],
    ['repetido', { analizadores: [primero, primero] }],
    ['sin banco', con({ banco: '' })],
    ['flags no texto', con({ flags: 3 })],
    ['flags g', con({ flags: 'gm' })],
    ['campos', con({ campos: [] })],
    ['campo desconocido', con({ campos: { corte: '(?<v>x)', saldo_corte: '(?<v>x)', otro: 'x' } })],
    ['campo sin grupo', con({ campos: { corte: 'x', saldo_corte: '(?<v>x)' } })],
    ['periodo sin grupos', con({ campos: { corte: '(?<v>x)', saldo_corte: '(?<v>x)', periodo: '(?<v>x)' } })],
    ['falta requerido', con({ campos: { corte: '(?<v>x)' } })],
    ['no compila', con({ reconocer: '(' })],
    ['reconocer vacío', con({ reconocer: '' })],
    ['sin movimientos', con({ movimientos: undefined })],
    ['renglón sin grupo', con({ movimientos: { inicio: 'a', renglon: '(?<fecha>x) (?<monto>y)' } })],
    ['ignorar', con({ movimientos: { inicio: 'a', renglon: 'x', ignorar: [1] } })],
    ['msi sin grupos', con({ msi: { inicio: 'a', renglon: '(?<descripcion>x)' } })],
    ['tipos', con({ tipos: 'x' })],
    ['tipos no compila', con({ tipos: { pago: '[' } })],
  ])('%s', (_, archivo) => falla(archivo));
});
