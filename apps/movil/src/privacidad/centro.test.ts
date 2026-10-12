import { describe, expect, it } from 'vitest';
import { crearPersona } from '../servicios/personas';
import { registrarTexto } from '../servicios/registrar';
import { cargarEscenario } from '../servicios/semilla';
import { abrirPrueba, escenario } from '../servicios/__pruebas__/base';
import { obtenerCentroPrivacidad } from './centro';
import { aceptarConsentimiento, VERSION_CONSENTIMIENTO } from './consentimiento';
import { fijarEstadisticas } from './estadisticas';

describe('centro de privacidad (RF-PRI-03)', () => {
  it('sin consentimiento: nada guardado y estadísticas apagadas', () => {
    const p = abrirPrueba();
    expect(obtenerCentroPrivacidad(p.ctx)).toEqual({
      consentimiento: null,
      estadisticas: false,
      captura: { activada: false, apps: 0 },
      guardado: {
        cuentas: 0,
        tarjetas: 0,
        movimientos: 0,
        personas: 0,
        textosNotificacion: 0,
        frasesPorInterpretar: 0,
      },
    });
    p.base.cerrar();
  });

  it('cuenta lo que vive en el teléfono y refleja el interruptor de estadísticas', async () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    const antes = obtenerCentroPrivacidad(p.ctx);
    expect(antes.consentimiento).toEqual({ version: expect.any(String), fecha: '2026-10-11' });
    expect(antes.estadisticas).toBe(false);
    expect(antes.guardado.cuentas).toBeGreaterThan(0);
    expect(antes.guardado.tarjetas).toBeGreaterThan(0);

    await registrarTexto(p.ctx, 'coca 25 en efectivo');
    await registrarTexto(p.ctx, 'tacos, "al pastor" 80 con la nu');
    crearPersona(p.ctx, { nombre: 'Juan' });
    const despues = obtenerCentroPrivacidad(p.ctx);
    expect(despues.guardado.movimientos).toBe(antes.guardado.movimientos + 1);
    expect(despues.guardado.personas).toBe(antes.guardado.personas + 1);
    expect(despues.guardado.frasesPorInterpretar).toBe(1);

    fijarEstadisticas(p.ctx, true);
    expect(obtenerCentroPrivacidad(p.ctx).estadisticas).toBe(true);
    p.base.cerrar();
  });

  it('la casilla opcional de O2 es el valor inicial; la evidencia no se reescribe al cambiarla', () => {
    const p = abrirPrueba();
    const evidencia = aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
    expect(obtenerCentroPrivacidad(p.ctx)).toMatchObject({
      consentimiento: { version: VERSION_CONSENTIMIENTO, fecha: '2026-10-11' },
      estadisticas: true,
    });
    fijarEstadisticas(p.ctx, false);
    expect(obtenerCentroPrivacidad(p.ctx).estadisticas).toBe(false);
    expect(aceptarConsentimiento(p.ctx, { datosFinancieros: true })).toEqual(evidencia);
    p.base.cerrar();
  });

  it('sin consentimiento no se puede encender', () => {
    const p = abrirPrueba();
    expect(() => fijarEstadisticas(p.ctx, true)).toThrow(
      expect.objectContaining({ codigo: 'sin_consentimiento' }),
    );
    p.base.cerrar();
  });
});
