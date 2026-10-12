import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { sumarDias } from './fecha';
import { dineroLibre, type EntradaLibre } from './libre';

/**
 * RNF-01 (parte Node, M13): E4 en < 50 ms en el teléfono de referencia. Aquí, con una entrada mucho más grande que
 * la de una persona real (2,000 compromisos, 40 tarjetas con pagos planeados, 1,000 cuotas MSI y 200 deudas), la
 * mediana de 7 corridas debe quedar por debajo de 15 ms (en el contenedor de CI da unos 3 ms): margen para runners
 * lentos y aun así un tercio del presupuesto del teléfono. La medición en el teléfono sigue pendiente en
 * `docs/ESTADO.md`.
 */
describe('RNF-01 · rendimiento de E4 (Node)', () => {
  const hoy = '2026-10-11';
  const entrada: EntradaLibre = {
    hoy,
    fin_horizonte: '2026-10-30',
    liquidez: 5_000_000_00,
    colchon: 200_000,
    compromisos: Array.from({ length: 2000 }, (_, i) => ({
      concepto: `c${i}`,
      fecha: sumarDias(hoy, (i % 60) - 10),
      monto: 1_000 + (i % 977),
    })),
    tarjetas: Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? { id: `t${i}`, modo: 'totalero' as const, saldo_revolvente: 50_000 + i }
        : {
            id: `t${i}`,
            modo: 'plan' as const,
            saldo_revolvente: 900_000,
            pagos_planeados: Array.from({ length: 12 }, (_, j) => ({
              fecha: sumarDias(hoy, j * 15),
              monto: 75_000,
            })),
          },
    ),
    cuotas_msi_no_facturadas: Array.from({ length: 1000 }, (_, i) => ({
      plan: `p${i % 50}`,
      fecha_limite: sumarDias(hoy, (i % 12) * 30),
      monto: 33_333,
    })),
    deudas_personas: Array.from({ length: 200 }, (_, i) => ({
      contraparte: `persona${i}`,
      monto: 10_000 + i,
      apartar: i % 3 !== 0,
    })),
  };

  it('entrada grande: mediana de 7 corridas < 15 ms (presupuesto del teléfono: 50 ms)', () => {
    const r = dineroLibre(entrada); // calentamiento del JIT
    expect(r.dias).toBe(19);
    const tiempos: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      dineroLibre(entrada);
      tiempos.push(performance.now() - t0);
    }
    tiempos.sort((a, b) => a - b);
    // Solo el tiempo (regla 9); se registra en docs/ESTADO.md → Mediciones.
    console.info(`RNF-01 (Node): E4 con entrada grande, mediana ${tiempos[3]?.toFixed(2)} ms`);
    expect(tiempos[3]).toBeLessThan(15);
  });
});
