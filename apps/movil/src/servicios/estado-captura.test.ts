import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import {
  activarCaptura,
  apagarCapturaTrasRestaurar,
  desactivarCaptura,
  obtenerEstadoCaptura,
  reactivarCapturaPendiente,
  registrarSenalesCaptura,
} from './estado-captura';
import { abrirPrueba } from './__pruebas__/base';

function conCapturaActiva() {
  const p = abrirPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
  registrarSenalesCaptura(p.ctx, {
    permiso: 'concedido',
    appsInstaladas: ['mx.ejemplo.bancoa'],
    ultimoEvento: 1_000,
  });
  return p;
}

describe('captura tras restaurar un respaldo (pendiente 47)', () => {
  it('apaga la captura, olvida las señales del teléfono anterior y deja la marca de reactivar', () => {
    const p = conCapturaActiva();
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
    apagarCapturaTrasRestaurar(p.ctx);
    expect(obtenerEstadoCaptura(p.ctx)).toMatchObject({
      divulgacionAceptada: true,
      activada: false,
      apps: ['mx.ejemplo.bancoa'],
      appsInstaladas: [],
      permiso: 'desconocido',
      inactiva: false,
    });
    expect(reactivarCapturaPendiente(p.ctx)).toBe(true);
    // Restaurar dos veces no cambia nada.
    apagarCapturaTrasRestaurar(p.ctx);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(true);
  });

  it('sin captura activa en el respaldo no hay nada que pedir', () => {
    const p = abrirPrueba('2026-10-11');
    apagarCapturaTrasRestaurar(p.ctx);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
    expect(obtenerEstadoCaptura(p.ctx).activada).toBe(false);
  });

  it('reactivarla quita la marca', () => {
    const p = conCapturaActiva();
    apagarCapturaTrasRestaurar(p.ctx);
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
    // Apagarla después en Ajustes no vuelve a pedirla.
    desactivarCaptura(p.ctx);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
  });

  it('"Ahora no" (desactivar) la descarta y la captura sigue apagada', () => {
    const p = conCapturaActiva();
    apagarCapturaTrasRestaurar(p.ctx);
    desactivarCaptura(p.ctx);
    expect(reactivarCapturaPendiente(p.ctx)).toBe(false);
    expect(obtenerEstadoCaptura(p.ctx).activada).toBe(false);
  });
});
