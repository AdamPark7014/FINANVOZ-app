import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { sumarDias } from '../fecha';
import { claseDia, crearSimulacion, semillaDelDia, simular, type DiaHistorial } from './index';

/**
 * CA-M6-02 (parte Node): Hoy con K = 1 y N = 10 000 sobre 90 días de historial y un horizonte de 16 días. El
 * presupuesto en el teléfono de referencia es 150 ms; en Node se exige la mediana muy por debajo (la medición en
 * el teléfono sigue pendiente, `docs/ESTADO.md`).
 */
describe('CA-M6-02 · rendimiento de E8 (Node)', () => {
  const pagos = new Set(['2026-07-15', '2026-07-31', '2026-08-14', '2026-08-31', '2026-09-15', '2026-09-30']);
  const historial: DiaHistorial[] = Array.from({ length: 90 }, (_, i) => {
    const fecha = sumarDias('2026-07-13', i);
    return { fecha, clase: claseDia(fecha, pagos), consumo: ((i * 7919) % 50000) + (i % 3 === 0 ? 0 : 1500) };
  });
  const entrada = {
    historial,
    horizontes: [{ inicio: '2026-10-11', fin: '2026-10-27', ingreso: 0, compromisos: 0 }],
    excedente_inicial: 300000,
    n: 10000,
    semilla: semillaDelDia('2026-10-11'),
  };

  it('K = 1, N = 10 000: mediana de 7 corridas < 50 ms (presupuesto del teléfono: 150 ms)', () => {
    simular(entrada); // calentamiento del JIT
    const tiempos: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      simular(entrada);
      tiempos.push(performance.now() - t0);
    }
    tiempos.sort((a, b) => a - b);
    // Solo el tiempo (regla 9); se registra en docs/ESTADO.md → Mediciones.
    console.info(`RNF-01 (Node): E8 K = 1, N = 10 000, mediana ${tiempos[3]?.toFixed(1)} ms`);
    expect(tiempos[3]).toBeLessThan(50);
  });

  it('un bloque de 1 000 trayectorias tarda poco (la UI cede el hilo entre bloques)', () => {
    const paso = crearSimulacion(entrada);
    paso.avanzar(1000);
    const t0 = performance.now();
    paso.avanzar(1000);
    expect(performance.now() - t0).toBeLessThan(16);
  });
});
