import { describe, expect, it } from 'vitest';
import { capacidadEndeudamiento, PLAZOS_MSI } from './capacidad';
import { ErrorDominio } from './errores';
import { cargarVectores } from './__pruebas__/vectores';

interface VectorE10 {
  id: string;
  entrada: {
    ingreso_mensual_neto: number;
    pagos_deuda_mensuales: number;
    pagos_msi_mensuales: number;
    compra?: { precio: number; meses: number };
  };
  esperado: {
    tope_deuda: number;
    tope_msi: number;
    capacidad_mensual: number;
    limitante: string;
    precio_maximo: Record<string, number>;
    compra?: { cuota_maxima: number; cabe: boolean; margen: number };
  };
}

const vectores = (cargarVectores()['E10'] as VectorE10[] | undefined) ?? [];

describe('E10 capacidadEndeudamiento', () => {
  it('carga los vectores', () => expect(vectores.length).toBeGreaterThan(0));

  for (const v of vectores) {
    it(`${v.id} · capacidad ${v.esperado.capacidad_mensual}, limitante ${v.esperado.limitante}`, () => {
      const r = capacidadEndeudamiento({
        ingresoMensualNeto: v.entrada.ingreso_mensual_neto,
        pagosDeudaMensuales: v.entrada.pagos_deuda_mensuales,
        pagosMsiMensuales: v.entrada.pagos_msi_mensuales,
        compra: v.entrada.compra,
      });
      expect(r.topeDeuda).toBe(v.esperado.tope_deuda);
      expect(r.topeMsi).toBe(v.esperado.tope_msi);
      expect(r.capacidadMensual).toBe(v.esperado.capacidad_mensual);
      expect(r.limitante).toBe(v.esperado.limitante);
      expect(Object.fromEntries(PLAZOS_MSI.map((n) => [String(n), r.precioMaximo[n]]))).toEqual(
        v.esperado.precio_maximo,
      );
      if (v.esperado.compra) {
        expect(r.compra).toEqual({
          cuotaMaxima: v.esperado.compra.cuota_maxima,
          cabe: v.esperado.compra.cabe,
          margen: v.esperado.compra.margen,
        });
      }
    });
  }

  it('rebasaRecomendacion distingue estar en el tope de pasarlo', () => {
    const base = { ingresoMensualNeto: 2000000, pagosMsiMensuales: 0 };
    expect(capacidadEndeudamiento({ ...base, pagosDeudaMensuales: 600000 }).rebasaRecomendacion).toBe(false);
    expect(capacidadEndeudamiento({ ...base, pagosDeudaMensuales: 600001 }).rebasaRecomendacion).toBe(true);
    expect(
      capacidadEndeudamiento({
        ingresoMensualNeto: 1500000,
        pagosDeudaMensuales: 500000,
        pagosMsiMensuales: 200000,
      }).rebasaRecomendacion,
    ).toBe(true);
  });

  it('sin compra no devuelve veredicto', () => {
    const r = capacidadEndeudamiento({
      ingresoMensualNeto: 2000000,
      pagosDeudaMensuales: 0,
      pagosMsiMensuales: 0,
    });
    expect(r.compra).toBeUndefined();
  });

  it('rechaza MSI mayores que el total de deudas, montos con decimales y meses inválidos', () => {
    const base = { ingresoMensualNeto: 2000000, pagosDeudaMensuales: 100, pagosMsiMensuales: 0 };
    expect(() => capacidadEndeudamiento({ ...base, pagosMsiMensuales: 200 })).toThrow(ErrorDominio);
    expect(() => capacidadEndeudamiento({ ...base, ingresoMensualNeto: 10.5 })).toThrow(ErrorDominio);
    expect(() => capacidadEndeudamiento({ ...base, ingresoMensualNeto: -1 })).toThrow(ErrorDominio);
    expect(() => capacidadEndeudamiento({ ...base, compra: { precio: 100, meses: 0 } })).toThrow(
      ErrorDominio,
    );
  });
});
