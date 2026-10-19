import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { fijarBloqueo, fijarColchon } from '../servicios/ajustes';
import { registrarMovimiento } from '../servicios/formulario';
import {
  agregarCuenta,
  agregarPagoFijo,
  agregarTarjetaCredito,
  configurarIngreso,
} from '../servicios/onboarding';
import { crearPersona } from '../servicios/personas';
import { registrarTexto } from '../servicios/registrar';
import { abrirPrueba } from '../servicios/__pruebas__/base';
import { exportarJson } from './exportar';
import {
  aceptarConsentimiento,
  enSoloLectura,
  exigirConsentimiento,
  obtenerConsentimiento,
  obtenerHistorialConsentimiento,
  rechazarReconsentimiento,
  requiereReconsentimiento,
  VERSION_CONSENTIMIENTO,
} from './consentimiento';

const TABLAS_DE_USUARIO = [
  'contacto',
  'alias_contacto',
  'alias_cuenta',
  'tarjeta',
  'transaccion',
  'asiento',
  'plan_msi',
  'programado',
  'ocurrencia',
  'ajuste',
  'auditoria',
];

function huella(p: ReturnType<typeof abrirPrueba>): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const t of [...TABLAS_DE_USUARIO, 'cuenta']) {
    conteo[t] = Number(p.ctx.db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM "${t}"`))?.n);
  }
  return conteo;
}

describe('consentimiento con evidencia', () => {
  it('CA-M2-05 · sin aceptar no se escribe ningún dato; al aceptar queda la evidencia local', async () => {
    const p = abrirPrueba();
    const antes = huella(p);
    for (const t of TABLAS_DE_USUARIO) expect(antes[t]).toBe(0);

    const intentos: (() => unknown)[] = [
      () => agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 10_000 }),
      () =>
        agregarTarjetaCredito(p.ctx, {
          nombre: 'Nu',
          diaCorte: 28,
          diaLimitePago: 18,
          limiteCredito: 100_000,
          modo: 'totalero',
          saldo: 0,
        }),
      () => configurarIngreso(p.ctx, { monto: 100_000, regla: { tipo: 'quincenal_15_ultimo' } }),
      () => agregarPagoFijo(p.ctx, { concepto: 'renta', monto: 1_000, regla: { tipo: 'mensual', dia: 1 } }),
      () => fijarColchon(p.ctx, 10_000),
      () => fijarBloqueo(p.ctx, { activo: true }),
      () => crearPersona(p.ctx, { nombre: 'Juan' }),
      () =>
        registrarMovimiento(p.ctx, {
          tipo: 'gasto',
          monto: 100,
          categoria: 'antojos',
          origenId: 'sis:personal:por_asignar',
        }),
    ];
    for (const intento of intentos) {
      expect(intento).toThrow(expect.objectContaining({ codigo: 'sin_consentimiento' }));
    }
    for (const frase of ['coca 25 en efectivo', 'frase que no entiende el nivel cero']) {
      await expect(registrarTexto(p.ctx, frase)).rejects.toMatchObject({ codigo: 'sin_consentimiento' });
    }
    expect(huella(p)).toEqual(antes);
    expect(obtenerConsentimiento(p.ctx)).toBeNull();

    // Sin la casilla obligatoria tampoco.
    expect(() => aceptarConsentimiento(p.ctx, { datosFinancieros: false })).toThrow(
      expect.objectContaining({ codigo: 'consentimiento_requerido' }),
    );
    expect(huella(p)).toEqual(antes);

    const evidencia = aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: false });
    expect(evidencia).toEqual({
      version: VERSION_CONSENTIMIENTO,
      aceptado_en: expect.any(Number),
      fecha: '2026-10-11',
      datos_financieros: true,
      estadisticas: false,
      medio: 'onboarding',
    });
    const fila = p.ctx.db.get<{ valor: string; actualizado_en: number }>(
      sql`SELECT valor, actualizado_en FROM ajuste WHERE clave = 'consentimiento'`,
    );
    expect(JSON.parse(fila?.valor ?? 'null')).toEqual(evidencia);
    expect(fila?.actualizado_en).toBeGreaterThanOrEqual(evidencia.aceptado_en);

    // La evidencia original no se reescribe y ya se puede guardar.
    expect(aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true })).toEqual(evidencia);
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 10_000 });
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('pendiente 31 · aviso desactualizado pide reconsentimiento; rechazar deja solo lectura; aceptar archiva en historial', async () => {
    const p = abrirPrueba();
    const vieja = '2026-10-m2';
    aceptarConsentimiento(p.ctx, { datosFinancieros: true, version: vieja });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 10_000 });

    expect(requiereReconsentimiento(p.ctx)).toBe(true);
    expect(enSoloLectura(p.ctx)).toBe(false);

    rechazarReconsentimiento(p.ctx);
    expect(requiereReconsentimiento(p.ctx)).toBe(false);
    expect(enSoloLectura(p.ctx)).toBe(true);
    expect(() => exigirConsentimiento(p.ctx)).toThrow(expect.objectContaining({ codigo: 'solo_lectura' }));
    expect(() =>
      agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'Nu', saldo: 0, institucion: 'nu' }),
    ).toThrow(expect.objectContaining({ codigo: 'solo_lectura' }));
    await expect(registrarTexto(p.ctx, 'coca 25 en efectivo')).rejects.toMatchObject({
      codigo: 'solo_lectura',
    });
    expect(() => exportarJson(p.ctx)).not.toThrow();

    const nueva = aceptarConsentimiento(p.ctx, { datosFinancieros: true, medio: 'reconsentimiento' });
    expect(nueva.version).toBe(VERSION_CONSENTIMIENTO);
    expect(nueva.medio).toBe('reconsentimiento');
    expect(enSoloLectura(p.ctx)).toBe(false);
    expect(obtenerHistorialConsentimiento(p.ctx)).toEqual([
      expect.objectContaining({ version: vieja, medio: 'onboarding' }),
    ]);
    agregarCuenta(p.ctx, { subtipo: 'billetera', nombre: 'Mercado', saldo: 0 });
  });
});
