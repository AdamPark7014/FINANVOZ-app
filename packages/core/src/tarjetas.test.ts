import { describe, expect, it } from 'vitest';
import { ErrorDominio } from './errores';
import {
  cicloDe,
  cortesAProcesar,
  pngiDe,
  recomendarTarjeta,
  type TarjetaCredito,
  type TarjetaRecomendable,
} from './tarjetas';
import { cargarVectores } from './__pruebas__/vectores';

interface TarjetaVector {
  id: string;
  modo?: 'totalero' | 'plan';
  dia_corte?: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
  limite_credito?: number;
  saldo_revolvente?: number;
  msi_no_facturado?: number;
}

interface VectorCiclo {
  id: string;
  tarjeta: TarjetaVector;
  fecha_compra: string;
  esperado: { corte: string; limite: string; dias: number };
}

interface VectorRecomendacion {
  id: string;
  compra: { fecha: string; monto: number };
  tarjetas: TarjetaVector[];
  esperado: {
    tarjeta: string | null;
    dias: number | null;
    uso_bp: number | null;
    advertencia: string | null;
  };
}

interface VectoresE5 {
  tarjetas_fixture: TarjetaVector[];
  ciclo: VectorCiclo[];
  recomendacion: VectorRecomendacion[];
}

const e5 = cargarVectores()['E5'] as VectoresE5;

function aTarjeta(t: TarjetaVector): TarjetaCredito {
  return {
    diaCorte: t.dia_corte as number,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
  };
}

/** Las tarjetas de `recomendacion` solo traen lo que cambia; el resto sale de `tarjetas_fixture` por `id`. */
function aRecomendable(t: TarjetaVector): TarjetaRecomendable {
  const base = e5.tarjetas_fixture.find((f) => f.id === t.id);
  if (!base) throw new Error(`tarjeta ${t.id} no está en tarjetas_fixture`);
  const v = { ...base, ...t };
  return {
    ...aTarjeta(v),
    id: v.id,
    modo: v.modo as 'totalero' | 'plan',
    limiteCredito: v.limite_credito as number,
    saldoRevolvente: v.saldo_revolvente as number,
    msiNoFacturado: v.msi_no_facturado as number,
  };
}

describe('E5.1 ciclo', () => {
  it('carga los vectores', () => expect(e5.ciclo.length).toBeGreaterThan(0));

  for (const v of e5.ciclo) {
    it(`${v.id} · compra ${v.fecha_compra} → corte ${v.esperado.corte}, límite ${v.esperado.limite}`, () => {
      expect(cicloDe(aTarjeta(v.tarjeta), v.fecha_compra)).toEqual(v.esperado);
    });
  }

  it('exige uno solo de dias_para_pagar o dia_limite_pago', () => {
    expect(() => cicloDe({ diaCorte: 10 }, '2026-10-11')).toThrow(ErrorDominio);
    expect(() => cicloDe({ diaCorte: 10, diasParaPagar: 20, diaLimitePago: 5 }, '2026-10-11')).toThrow(
      ErrorDominio,
    );
    expect(() => cicloDe({ diaCorte: 32, diasParaPagar: 20 }, '2026-10-11')).toThrow(ErrorDominio);
  });
});

describe('E5.2 recomendarTarjeta', () => {
  it('carga los vectores', () => expect(e5.recomendacion.length).toBeGreaterThan(0));

  for (const v of e5.recomendacion) {
    it(`${v.id} · ${v.esperado.tarjeta ?? 'ninguna'} (${v.esperado.advertencia ?? 'sin advertencia'})`, () => {
      const r = recomendarTarjeta(v.compra, v.tarjetas.map(aRecomendable));
      expect(r.tarjeta?.id ?? null).toBe(v.esperado.tarjeta);
      expect(r.tarjeta?.dias ?? null).toBe(v.esperado.dias);
      expect(r.tarjeta?.usoBp ?? null).toBe(v.esperado.uso_bp);
      expect(r.advertencia).toBe(v.esperado.advertencia);
    });
  }

  it('una tarjeta con límite 0 nunca es elegible', () => {
    const r = recomendarTarjeta({ fecha: '2026-10-11', monto: 100 }, [
      {
        id: 'x',
        modo: 'totalero',
        diaCorte: 10,
        diasParaPagar: 20,
        limiteCredito: 0,
        saldoRevolvente: 0,
        msiNoFacturado: 0,
      },
    ]);
    expect(r.tarjeta).toBeNull();
    expect(r.advertencia).toBe('sin_credito_disponible');
  });
});

describe('E5.3 cierre de periodo', () => {
  it('pngiDe nunca es negativo', () => {
    expect(pngiDe(150000, 50000)).toBe(100000);
    expect(pngiDe(150000, 200000)).toBe(0);
  });

  it('cortesAProcesar con dia_limite_pago usa los mismos cortes', () => {
    expect(cortesAProcesar({ diaCorte: 31, diaLimitePago: 20 }, '2027-01-31', '2027-04-30', [])).toEqual([
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
  });
});
