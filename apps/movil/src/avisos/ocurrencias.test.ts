// Pendiente 40 · `02 §13`: "Compromiso sin cubrir" (1 día después) e "Ingreso que no llegó" (3 días después).
import { describe, expect, it } from 'vitest';
import {
  planificarAvisosOcurrencias,
  TITULO_AVISO_COMPROMISO,
  TITULO_AVISO_INGRESO,
  type EntradaAvisosOcurrencias,
} from './ocurrencias';

const base: EntradaAvisosOcurrencias = {
  hoy: '2026-10-14',
  horaActual: '10:00',
  compromisos: [
    { programadoId: 'luz', fecha: '2026-10-15' },
    { programadoId: 'renta', fecha: '2026-11-01' },
  ],
  ingresos: [{ programadoId: 'quincena', fecha: '2026-10-15' }],
  avisarCompromiso: true,
  avisarIngreso: true,
};

describe('avisos de compromiso sin cubrir e ingreso que no llegó', () => {
  it('compromiso 1 día después y el ingreso 3 días después, uno por ocurrencia y en orden de salida', () => {
    expect(planificarAvisosOcurrencias(base).map((a) => [a.id, a.fecha, a.hora, a.titulo])).toEqual([
      ['compromiso:luz:2026-10-15', '2026-10-16', '09:00', TITULO_AVISO_COMPROMISO],
      ['ingreso:quincena:2026-10-15', '2026-10-18', '09:00', TITULO_AVISO_INGRESO],
      ['compromiso:renta:2026-11-01', '2026-11-02', '09:00', TITULO_AVISO_COMPROMISO],
    ]);
  });

  it('una ocurrencia vencida cuyo aviso todavía no sale se programa; si ya salió, no se repite', () => {
    const ayer = { ...base, compromisos: [{ programadoId: 'luz', fecha: '2026-10-13' }], ingresos: [] };
    expect(planificarAvisosOcurrencias({ ...ayer, horaActual: '08:00' }).map((a) => a.fecha)).toEqual([
      '2026-10-14',
    ]);
    expect(planificarAvisosOcurrencias(ayer)).toEqual([]);
  });

  it('cada interruptor apaga solo su aviso', () => {
    expect(planificarAvisosOcurrencias({ ...base, avisarCompromiso: false }).map((a) => a.id)).toEqual([
      'ingreso:quincena:2026-10-15',
    ]);
    expect(
      planificarAvisosOcurrencias({ ...base, avisarIngreso: false }).every((a) =>
        a.id.startsWith('compromiso:'),
      ),
    ).toBe(true);
  });

  it('respeta el horario silencioso y la ventana de planeación', () => {
    expect(planificarAvisosOcurrencias({ ...base, horaPreferida: '22:30' })[0]).toMatchObject({
      id: 'compromiso:luz:2026-10-15',
      fecha: '2026-10-17',
      hora: '08:00',
    });
    expect(planificarAvisosOcurrencias({ ...base, diasPlaneacion: 5 }).map((a) => a.id)).toEqual([
      'compromiso:luz:2026-10-15',
      'ingreso:quincena:2026-10-15',
    ]);
  });

  it('los textos no llevan concepto, monto ni fecha (se ven con el teléfono bloqueado)', () => {
    for (const a of planificarAvisosOcurrencias(base)) {
      expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/\$|\d|luz|renta|quincena/i);
    }
  });
});
