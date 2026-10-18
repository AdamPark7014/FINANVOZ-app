import { performance } from 'node:perf_hooks';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { construirGasto, construirIngreso, simular, sumarDias, type PlainDate } from '@cartera/core';
import type { Contexto } from './contexto';
import { calcularLibre, obtenerHoy } from './hoy';
import { prepararProbabilidadHoy } from './probabilidad';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/**
 * RNF-01 en la app (parte Node, M13): lo que Hoy calcula al abrir, leyendo el libro real de SQLite (cifrado como
 * en la app) con `e4-01` y 50,000 asientos repartidos en los 2 años siguientes al alta (unos 34 movimientos al día:
 * muy por encima de una persona real; E8.2 solo usa el historial desde el alta, así que el reloj avanza 731 días).
 *
 * - E4 con sus lecturas (`calcularLibre`: saldos, ocurrencias, tarjetas, cuotas y deudas): presupuesto del
 *   teléfono 50 ms; en Node la mediana debe quedar < 50 ms (mismo techo que el teléfono: runners cargados llegan a ~35–40 ms).
 * - E8 de Hoy (K = 1, N = 10,000) con el historial que arma la app del mismo libro (`prepararProbabilidadHoy` +
 *   `simular`): presupuesto del teléfono 150 ms; en Node la mediana debe quedar < 100 ms (margen sobre 75 ms para
 *   runners lentos; el simulador puro sigue en `packages/core/src/simulador/rendimiento.test.ts` < 50 ms).
 *
 * El margen ×2 cubre runners de CI lentos sin dejar pasar una regresión de orden de magnitud. Solo se imprimen
 * tiempos (regla 9); van a `docs/ESTADO.md` → Mediciones. El teléfono de referencia sigue pendiente.
 */

const N_ASIENTOS = 50_000;
const DIAS = 730;

function generarAsientos(ctx: Contexto, cuentaId: string, n: number, desde: PlainDate): void {
  ctx.db.transaction(() => {
    for (let i = 0; i < n / 2; i++) {
      const monto = 1 + (i % 97);
      const mov =
        i % 2 === 0
          ? construirGasto({ categoria: 'cat:personal:super', pago: cuentaId, monto })
          : construirIngreso({ destino: cuentaId, categoria: 'cat:personal:ventas', monto });
      ctx.libro.registrar({
        ...mov,
        fecha: sumarDias(desde, 1 + (i % DIAS)),
        origen: 'manual',
        claveIdempotencia: `rendimiento:${i}`,
        descripcion: `movimiento ${i}`,
      });
    }
  });
}

function mediana(veces: number, f: () => void): number {
  f(); // calentamiento (JIT y caché de sentencias)
  const tiempos: number[] = [];
  for (let i = 0; i < veces; i++) {
    const t0 = performance.now();
    f();
    tiempos.push(performance.now() - t0);
  }
  tiempos.sort((a, b) => a - b);
  return tiempos[Math.floor(veces / 2)] as number;
}

describe('RNF-01 · Hoy con un libro grande (Node)', () => {
  it(`e4-01 + ${N_ASIENTOS.toLocaleString('es-MX')} asientos: E4 < 50 ms y E8 (K = 1, N = 10,000) < 100 ms`, () => {
    const p = abrirPrueba('2026-10-11');
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    generarAsientos(p.ctx, e.cuentas.bbva ?? '', N_ASIENTOS, e.hoy);
    p.reloj.fijar(sumarDias(e.hoy, DIAS + 1));
    const asientos = Number(p.ctx.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM asiento`)?.n);
    expect(asientos).toBeGreaterThanOrEqual(N_ASIENTOS);
    obtenerHoy(p.ctx); // materializa ocurrencias una vez, como la primera apertura del día

    const tE4 = mediana(7, () => calcularLibre(p.ctx));

    const preparada = prepararProbabilidadHoy(p.ctx);
    expect(preparada.estado).toBe('listo');
    if (preparada.estado !== 'listo') throw new Error('sin entrada de E8');
    expect(preparada.entrada.n).toBe(10_000);
    expect(preparada.entrada.horizontes).toHaveLength(1);
    const tE8 = mediana(7, () => {
      const q = prepararProbabilidadHoy(p.ctx);
      if (q.estado === 'listo') simular(q.entrada);
    });

    console.info(
      `RNF-01 (Node): ${asientos} asientos, ${preparada.diasHistorial} días de historial; E4 ${tE4.toFixed(1)} ms, E8 ${tE8.toFixed(1)} ms (medianas de 7)`,
    );
    expect(tE4).toBeLessThan(50);
    expect(tE8).toBeLessThan(100);
    p.base.cerrar();
  }, 120_000);
});
