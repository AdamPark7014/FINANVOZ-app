import { abrirBaseCifrada } from '../db/abrir';
import { almacenEnMemoria } from '../db/llave';
import { aleatorioNode, puertoNode } from '../db/node';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { crearContexto, crearGeneradorSecuencial, relojFijo } from '.';
import { activarCaptura, obtenerEstadoCaptura, reactivarCapturaPendiente } from './estado-captura';
import type { RespaldoListo } from './respaldo';
import { restaurarSesion } from './sesion';

// Los módulos nativos no existen en jest: el respaldo "restaurado" es una base en memoria ya preparada.
jest.mock('../db/expo', () => ({
  abrirBaseApp: jest.fn(),
  aleatorioExpo: (n: number) =>
    new Uint8Array(jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes(n)),
  almacenExpo: {},
  puertoExpo: {},
}));
jest.mock('../respaldo/expo', () => ({ dependenciasRespaldoExpo: {} }));
jest.mock('../privacidad/borrar', () => ({ borrarTodo: jest.fn() }));
jest.mock('./respaldo', () => ({ restaurarRespaldo: jest.fn() }));

const { restaurarRespaldo } = jest.requireMock<{ restaurarRespaldo: jest.Mock }>('./respaldo');

function respaldoConCaptura(activa: boolean) {
  const base = abrirBaseCifrada({
    puerto: puertoNode(':memory:'),
    almacen: almacenEnMemoria(),
    aleatorio: aleatorioNode,
  });
  const ctx = crearContexto({
    db: base.db,
    reloj: relojFijo('2026-10-01'),
    generarId: crearGeneradorSecuencial(),
  });
  aceptarConsentimiento(ctx, { datosFinancieros: true });
  if (activa) activarCaptura(ctx, ['mx.ejemplo.bancoa']);
  restaurarRespaldo.mockReturnValueOnce(base);
  return base;
}

const listo = { fecha: '2026-10-01' } as unknown as RespaldoListo;

describe('restaurar un respaldo en un teléfono nuevo (pendiente 47)', () => {
  it('apaga la captura que venía activada y deja la marca para reactivarla en Hoy', () => {
    respaldoConCaptura(true);
    const sesion = restaurarSesion(listo, relojFijo('2026-10-11'));
    expect(obtenerEstadoCaptura(sesion.ctx)).toMatchObject({ activada: false, permiso: 'desconocido' });
    expect(reactivarCapturaPendiente(sesion.ctx)).toBe(true);
    sesion.base.cerrar();
  });

  it('sin captura en el respaldo no pide nada', () => {
    respaldoConCaptura(false);
    const sesion = restaurarSesion(listo, relojFijo('2026-10-11'));
    expect(obtenerEstadoCaptura(sesion.ctx).activada).toBe(false);
    expect(reactivarCapturaPendiente(sesion.ctx)).toBe(false);
    sesion.base.cerrar();
  });
});
