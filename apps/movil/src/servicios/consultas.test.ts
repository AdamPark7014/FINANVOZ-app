import { describe, expect, it } from 'vitest';
import { listarCuentas } from './cuentas';
import { responderConsulta, type Consulta } from './consultas';
import { registrarMovimiento } from './formulario';
import { listarMovimientos } from './movimientos';
import { crearPersona, registrarPrestamo } from './personas';
import { registrarTexto } from './registrar';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario, golden } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

/** CA-M7-03: Q01–Q11 del golden set (Q12 y Q13 llegan en M10). */
const IDS = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11'] as const;

/** Plantilla y respuesta esperadas sobre la semilla `e4-01` (hoy dom 11 oct, sin gastos registrados). */
const ESPERADO: Record<(typeof IDS)[number], { plantilla: string; texto: string }> = {
  Q01: { plantilla: 'hoy_puedes', texto: 'Hoy puedes gastar $214; faltan 4 días para tu quincena.' },
  Q02: { plantilla: 'gasto_por_categoria', texto: 'Esta semana llevas $0 en comida.' },
  Q03: { plantilla: 'gasto_total', texto: 'Este mes llevas $0.' },
  Q04: { plantilla: 'saldo', texto: 'En BBVA Débito tienes $3,590.' },
  Q05: { plantilla: 'deuda_tarjetas', texto: 'Debes $2,000 en total.' },
  Q06: { plantilla: 'compromisos', texto: 'En los próximos 7 días tienes 2 pagos por $1,174.' },
  Q07: { plantilla: 'por_cobrar', texto: 'Nadie te debe dinero.' },
  Q08: {
    plantilla: 'comparar_periodos',
    texto: 'Vas igual en comida que a estas alturas del mes pasado.',
  },
  Q09: { plantilla: 'mayores_gastos', texto: 'En los últimos 30 días no tienes gastos registrados.' },
  Q10: { plantilla: 'gasto_total', texto: 'Ayer gastaste $0.' },
  Q11: { plantilla: 'gasto_total', texto: 'Desde tu quincena del 30 sep llevas $0.' },
};

function semilla() {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario('e4-01'));
  const cuentas = listarCuentas(p.ctx);
  const id = (prefijo: string) =>
    [...cuentas.tienes, ...cuentas.debes].find((c) => c.nombre.startsWith(prefijo))?.id as string;
  return { ...p, e, efectivo: id('Cartera'), bbva: id('BBVA'), nu: id('Nu') };
}

function consultaDe(id: string): Consulta {
  return (golden(id).esperado as { consulta: Consulta }).consulta;
}

describe('consultas tipadas sobre la semilla e4-01 (CA-M7-03)', () => {
  for (const id of IDS) {
    it(`${id} · ${golden(id).texto}`, async () => {
      const p = semilla();
      const f = nubeFalsa({ [golden(id).texto]: golden(id).esperado });
      const r = await registrarTexto(p.ctx, golden(id).texto, 'voz', { nube: f.nube });
      if (r.resultado !== 'consulta') throw new Error(r.resultado);
      expect(r.respuesta.plantilla).toBe(ESPERADO[id].plantilla);
      expect(r.respuesta.texto).toBe(ESPERADO[id].texto);
      // Q01 lo resuelve el nivel 0 (reglas: true); las demás pasan por la nube.
      expect(f.recibidas).toHaveLength(id === 'Q01' ? 0 : 1);
      // Nada se escribió en el libro.
      expect(listarMovimientos(p.ctx)).toEqual([]);
    });
  }

  it('Q06 lista los pagos con fecha y Q04 filtra Movimientos por la cuenta', () => {
    const p = semilla();
    const q06 = responderConsulta(p.ctx, consultaDe('Q06'));
    expect(q06.lineas).toEqual([
      { etiqueta: 'tanda · mar 13 oct', valor: '$500' },
      { etiqueta: 'internet · mié 14 oct', valor: '$674' },
    ]);
    expect(q06.filtro).toEqual({ desde: '2026-10-11', hasta: '2026-10-17' });
    expect(responderConsulta(p.ctx, consultaDe('Q04')).filtro).toEqual({ cuentaId: p.bbva });
    expect(responderConsulta(p.ctx, consultaDe('Q05')).filtro).toEqual({ cuentaId: p.nu });
    expect(responderConsulta(p.ctx, consultaDe('Q02')).filtro).toEqual({
      desde: '2026-10-05',
      hasta: '2026-10-11',
      soloGastos: true,
      categorias: ['comida_fuera', 'antojos', 'super'],
    });
  });
});

describe('consultas con gastos registrados', () => {
  function conGastos() {
    const p = semilla();
    const gasto = (fecha: string, monto: number, categoria: string, origenId = p.efectivo) =>
      registrarMovimiento(p.ctx, { tipo: 'gasto', fecha, monto, categoria, origenId });
    gasto('2026-10-11', 8_000, 'comida_fuera');
    gasto('2026-10-10', 2_500, 'antojos');
    gasto('2026-10-06', 50_000, 'super', p.bbva);
    gasto('2026-10-03', 12_000, 'transporte');
    gasto('2026-09-05', 20_000, 'comida_fuera');
    gasto('2026-09-20', 9_000, 'comida_fuera');
    return p;
  }

  it('suma por periodo y por grupo de categorías; ver movimientos muestra exactamente esos', () => {
    const p = conGastos();
    expect(responderConsulta(p.ctx, consultaDe('Q03')).texto).toBe('Este mes llevas $725.');
    expect(responderConsulta(p.ctx, consultaDe('Q10')).texto).toBe('Ayer gastaste $25.');
    const q02 = responderConsulta(p.ctx, consultaDe('Q02'));
    expect(q02.texto).toBe('Esta semana llevas $605 en comida (3 movimientos).');
    const vistos = listarMovimientos(p.ctx, q02.filtro).flatMap((d) => d.movimientos);
    expect(vistos.map((m) => m.monto)).toEqual([8_000, 2_500, 50_000]);
    expect(
      responderConsulta(p.ctx, {
        tipo: 'gasto_por_categoria',
        categoria: 'transporte',
        desde: '2026-10-01',
        hasta: '2026-10-11',
      }).texto,
    ).toBe('Este mes llevas $120 en transporte (1 movimiento).');
  });

  it('compara con los mismos días del mes pasado (Q08) y arma el top (Q09)', () => {
    const p = conGastos();
    const q08 = responderConsulta(p.ctx, consultaDe('Q08'));
    // Del 1 al 11 oct: 80 + 25 + 500 = $605; del 1 al 11 sep: $200 (el del 20 sep no cuenta).
    expect(q08.texto).toBe('Vas $405 arriba en comida que a estas alturas del mes pasado.');
    expect(q08.lineas).toEqual([
      { etiqueta: 'Del 1 al 11 oct', valor: '$605' },
      { etiqueta: 'Del 1 al 11 sep', valor: '$200' },
    ]);
    const q09 = responderConsulta(p.ctx, consultaDe('Q09'));
    expect(q09.texto).toBe('En los últimos 30 días, lo que más pesa es súper: $500.');
    expect(q09.lineas.map((l) => [l.etiqueta, l.valor])).toEqual([
      ['Súper', '$500'],
      // 80 de hoy + 90 del 20 sep, que entra en los últimos 30 días (12 sep – 11 oct); el del 5 sep no.
      ['Comida fuera', '$170'],
      ['Transporte', '$120'],
      ['Antojos', '$25'],
    ]);
  });

  it('por cobrar con personas, saldo sin alias y alias que no existe', () => {
    const p = conGastos();
    const juan = crearPersona(p.ctx, { nombre: 'Juan' });
    const caro = crearPersona(p.ctx, { nombre: 'Caro' });
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_otorgado',
      personaId: juan,
      cuentaId: p.efectivo,
      monto: 20_000,
    });
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_otorgado',
      personaId: caro,
      cuentaId: p.efectivo,
      monto: 30_000,
    });
    expect(responderConsulta(p.ctx, { tipo: 'por_cobrar' }).texto).toBe('Caro te debe $300; Juan, $200.');
    expect(responderConsulta(p.ctx, { tipo: 'saldo', alias: 'azul' }).texto).toBe(
      'No tengo una cuenta «azul».',
    );
    const todas = responderConsulta(p.ctx, { tipo: 'saldo' });
    expect(todas.texto).toMatch(/^En tus cuentas tienes \$/);
    expect(todas.lineas.map((l) => l.etiqueta)).toEqual(['Cartera', 'BBVA Débito']);
  });

  it('después del corte, la deuda dice el próximo pago con su fecha límite', () => {
    const p = semilla();
    p.reloj.fijar('2026-10-29');
    expect(responderConsulta(p.ctx, { tipo: 'deuda_tarjetas' }).texto).toBe(
      'Debes $2,000 en total; el próximo pago es Nu, $2,000 el mié 18 nov.',
    );
  });

  it('saldo de una tarjeta dice lo que debes', () => {
    const p = semilla();
    expect(responderConsulta(p.ctx, { tipo: 'saldo', alias: 'nu' }).texto).toBe('En tu Nu debes $2,000.');
  });

  it('Hoy en negativo y consultas de M10–M12 no se responden con plantilla', () => {
    const p = semilla();
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 300_000,
      categoria: 'otros_gastos',
      origenId: p.bbva,
    });
    expect(responderConsulta(p.ctx, { tipo: 'hoy_puedes' }).texto).toMatch(
      /^Hoy: \$0\. Te faltan \$[\d,]+ para cubrir lo que viene antes de tu quincena\.$/,
    );
    expect(() => responderConsulta(p.ctx, { tipo: 'suscripciones' })).toThrow(
      expect.objectContaining({ codigo: 'consulta_no_soportada' }),
    );
  });
});
