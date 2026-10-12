import { describe, expect, it } from 'vitest';
import { ErrorDominio } from './errores';
import { calendarioTanda, posicionTanda, tandaExistente } from './tandas';
import { proximasFechas, type Regla } from './recurrencia';
import { cargarVectores } from './__pruebas__/vectores';

interface PosicionVector {
  t: number;
  fecha: string;
  aportado: number;
  recibido: number;
  posicion: number;
  en_riesgo: number;
  por_aportar: number;
}

interface ExistenteVector {
  aportaciones_hechas: number;
  ya_cobro: boolean;
  saldo_inicial: number;
  ocurrencias_omitidas: string[];
  ocurrencias_pendientes: string[];
  fecha_cobro: string;
}

interface VectorE11 {
  id: string;
  aportacion: number;
  participantes: number;
  turno: number;
  regla: Regla;
  inicio: string;
  hoy?: string;
  esperado: PosicionVector[] | ExistenteVector;
}

const vectores = (cargarVectores()['E11'] as VectorE11[] | undefined) ?? [];

function aTanda(v: VectorE11) {
  return {
    aportacion: v.aportacion,
    participantes: v.participantes,
    turno: v.turno,
    regla: v.regla,
    inicio: v.inicio,
  };
}

describe('E11 tandas', () => {
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));

  for (const v of vectores) {
    if (v.hoy === undefined) {
      it(`${v.id} · calendario, ${v.participantes} participantes, turno ${v.turno}`, () => {
        const esperado = v.esperado as PosicionVector[];
        const r = calendarioTanda(aTanda(v), proximasFechas);
        expect(
          r.posiciones.map((p) => ({
            t: p.t,
            fecha: p.fecha,
            aportado: p.aportado,
            recibido: p.recibido,
            posicion: p.posicion,
            en_riesgo: p.enRiesgo,
            por_aportar: p.porAportar,
          })),
        ).toEqual(esperado);
        expect(r.fechaCobro).toBe(esperado[v.turno - 1]?.fecha);
      });
    } else {
      const hoy = v.hoy;
      it(`${v.id} · tanda que ya existía al ${hoy}`, () => {
        const e = v.esperado as ExistenteVector;
        expect(tandaExistente(aTanda(v), hoy, proximasFechas)).toEqual({
          aportacionesHechas: e.aportaciones_hechas,
          yaCobro: e.ya_cobro,
          saldoInicial: e.saldo_inicial,
          ocurrenciasOmitidas: e.ocurrencias_omitidas,
          ocurrenciasPendientes: e.ocurrencias_pendientes,
          fechaCobro: e.fecha_cobro,
        });
      });
    }
  }

  it('antes de aportar la posición es cero', () => {
    expect(posicionTanda(50000, 10, 4, 0)).toEqual({
      aportado: 0,
      recibido: 0,
      posicion: 0,
      enRiesgo: 0,
      porAportar: 500000,
    });
  });

  it('rechaza turnos fuera de rango', () => {
    expect(() => posicionTanda(50000, 10, 11, 1)).toThrow(ErrorDominio);
    expect(() => posicionTanda(50000, 10, 0, 1)).toThrow(ErrorDominio);
    expect(() => posicionTanda(50000, 10, 1, 11)).toThrow(ErrorDominio);
  });

  it('rechaza un generador que no da una fecha por ronda', () => {
    const tanda = { aportacion: 100, participantes: 3, turno: 1, regla: null, inicio: '2026-10-01' };
    expect(() => calendarioTanda(tanda, () => ['2026-10-01'])).toThrow(ErrorDominio);
  });
});
