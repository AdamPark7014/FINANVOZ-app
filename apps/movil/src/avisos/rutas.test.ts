// Pendiente 33: tocar un aviso abre la pantalla relacionada (la ruta sale del prefijo del id).
import { describe, expect, it } from 'vitest';
import { PREFIJO_RECORDATORIO_COBRO } from './cobros';
import { PREFIJO_AVISO_COMPROMISO, PREFIJO_AVISO_INGRESO } from './ocurrencias';
import { PREFIJO_AVISOS_TARJETA } from './planificar';
import { crearPuertoExpo, type ModuloNotificaciones } from './puerto';
import { PREFIJO_AVISO_RESPALDO } from './respaldo';
import { PREFIJO_AVISO_RIESGO } from './riesgo';
import { destinoDeAviso, RUTA_HOY, rutaDeAviso, rutaSegura } from './rutas';
import { PREFIJO_AVISO_TANDA } from './tandas';

describe('ruta de cada aviso', () => {
  it.each([
    [`${PREFIJO_RECORDATORIO_COBRO}per-1`, '/persona/per-1'],
    [`${PREFIJO_AVISOS_TARJETA}corte:tc-1:2026-10-20`, '/tarjetas/tc-1'],
    [`${PREFIJO_AVISOS_TARJETA}limite:tc-1:2026-11-09`, '/tarjetas/tc-1'],
    [`${PREFIJO_AVISO_TANDA}tan-1:2026-10-16`, '/tandas/tan-1'],
    [`${PREFIJO_AVISO_RESPALDO}2026-10-25`, '/respaldo'],
    ['me-alcanza:2026-10-15', '/me-alcanza'],
    [`${PREFIJO_AVISO_RIESGO}2026-10-30`, RUTA_HOY],
    [`${PREFIJO_AVISO_COMPROMISO}prog-1:2026-10-15`, RUTA_HOY],
    [`${PREFIJO_AVISO_INGRESO}prog-2:2026-10-15`, RUTA_HOY],
    ['otro:algo', RUTA_HOY],
    ['sin-prefijo', RUTA_HOY],
    ['', RUTA_HOY],
  ])('%s → %s', (id, ruta) => {
    expect(rutaDeAviso(id)).toBe(ruta);
  });

  it('ids con dos puntos o caracteres raros se codifican; ids incompletos van a Hoy', () => {
    expect(rutaDeAviso('cobro:contraparte:persona/1')).toBe('/persona/contraparte%3Apersona%2F1');
    expect(rutaDeAviso('tarjeta:corte:a:b:2026-10-20')).toBe('/tarjetas/a%3Ab');
    expect(rutaDeAviso('tanda:x:y:2026-10-16')).toBe('/tandas/x%3Ay');
    expect(rutaDeAviso('cobro:')).toBe(RUTA_HOY);
    expect(rutaDeAviso('tarjeta:corte')).toBe(RUTA_HOY);
    expect(rutaDeAviso('tanda:2026-10-16')).toBe(RUTA_HOY);
  });

  it('solo se usa la ruta guardada si es interna; si no, la del id', () => {
    expect(rutaSegura('/tandas/tan-1')).toBe('/tandas/tan-1');
    for (const mala of ['https://x.mx', '//x.mx', 'tandas/1', '/a?b=1', '/a:b', 1, null, undefined]) {
      expect(rutaSegura(mala)).toBeNull();
    }
    expect(destinoDeAviso({ id: 'cobro:per-1', ruta: '/persona/per-1' })).toBe('/persona/per-1');
    expect(destinoDeAviso({ id: 'cobro:per-1', ruta: 'https://x.mx' })).toBe('/persona/per-1');
    expect(destinoDeAviso({ id: 'cobro:per-1' })).toBe('/persona/per-1');
  });

  it('el adaptador de Expo guarda la ruta en los datos del aviso (sin nada sensible)', async () => {
    const solicitudes: Parameters<ModuloNotificaciones['scheduleNotificationAsync']>[0][] = [];
    const puerto = crearPuertoExpo({
      scheduleNotificationAsync: async (s) => {
        solicitudes.push(s);
        return s.identifier;
      },
      cancelScheduledNotificationAsync: async () => {},
      getAllScheduledNotificationsAsync: async () => [],
    });
    await puerto.programar({
      id: 'cobro:per-1',
      fecha: '2026-10-15',
      hora: '09:00',
      titulo: 'Recordatorio de cobro',
      cuerpo: 'Hoy querías cobrar lo que te deben.',
    });
    expect(solicitudes[0]?.content.data).toEqual({
      fecha: '2026-10-15',
      hora: '09:00',
      ruta: '/persona/per-1',
    });
  });
});
