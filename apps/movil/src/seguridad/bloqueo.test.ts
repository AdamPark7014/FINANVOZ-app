import { describe, expect, it } from 'vitest';
import { debeBloquear, ESPERA_BLOQUEO_MS, transicionBloqueo, type SeguimientoBloqueo } from './bloqueo';

const T0 = 1_760_000_000_000;

describe('debeBloquear (CA-M2-11)', () => {
  it.each([
    [true, 60_000, true],
    [true, 59_999, false],
    [true, 3_600_000, true],
    [true, 0, false],
    [false, 3_600_000, false],
  ])('activo=%s, fuera %i ms → %s', (activo, fuera, esperado) => {
    expect(debeBloquear({ activo, salioEn: T0, ahora: T0 + fuera })).toBe(esperado);
  });

  it('sin salida registrada no bloquea', () => {
    expect(debeBloquear({ activo: true, salioEn: null, ahora: T0 })).toBe(false);
  });

  it('si el reloj retrocede, bloquea', () => {
    expect(debeBloquear({ activo: true, salioEn: T0, ahora: T0 - 1 })).toBe(true);
  });

  it('respeta una espera configurada', () => {
    expect(debeBloquear({ activo: true, salioEn: T0, ahora: T0 + 10_000, esperaMs: 5_000 })).toBe(true);
  });

  it('la espera es de un minuto', () => {
    expect(ESPERA_BLOQUEO_MS).toBe(60_000);
  });
});

describe('transicionBloqueo', () => {
  const libre: SeguimientoBloqueo = { bloqueado: false, salioEn: null };

  it('fondo ≥ 1 min y regreso → bloqueado', () => {
    const fuera = transicionBloqueo(libre, 'background', { activo: true, ahora: T0 });
    expect(fuera.salioEn).toBe(T0);
    const vuelta = transicionBloqueo(fuera, 'active', { activo: true, ahora: T0 + 61_000 });
    expect(vuelta).toEqual({ bloqueado: true, salioEn: null });
  });

  it('regreso antes de 1 min → sigue libre', () => {
    const fuera = transicionBloqueo(libre, 'background', { activo: true, ahora: T0 });
    expect(transicionBloqueo(fuera, 'active', { activo: true, ahora: T0 + 30_000 }).bloqueado).toBe(false);
  });

  it('inactive (iOS, aviso de Face ID) no cuenta como salir', () => {
    const s = transicionBloqueo(libre, 'inactive', { activo: true, ahora: T0 });
    expect(transicionBloqueo(s, 'active', { activo: true, ahora: T0 + 120_000 }).bloqueado).toBe(false);
  });

  it('cuenta desde la primera salida aunque haya varios eventos de fondo', () => {
    let s = transicionBloqueo(libre, 'background', { activo: true, ahora: T0 });
    s = transicionBloqueo(s, 'inactive', { activo: true, ahora: T0 + 40_000 });
    s = transicionBloqueo(s, 'background', { activo: true, ahora: T0 + 50_000 });
    expect(transicionBloqueo(s, 'active', { activo: true, ahora: T0 + 61_000 }).bloqueado).toBe(true);
  });

  it('ya bloqueado se queda bloqueado al volver pronto', () => {
    const s = transicionBloqueo({ bloqueado: true, salioEn: null }, 'background', {
      activo: true,
      ahora: T0,
    });
    expect(transicionBloqueo(s, 'active', { activo: true, ahora: T0 + 1 }).bloqueado).toBe(true);
  });

  it('con el bloqueo apagado nunca bloquea', () => {
    const fuera = transicionBloqueo(libre, 'background', { activo: false, ahora: T0 });
    expect(transicionBloqueo(fuera, 'active', { activo: false, ahora: T0 + 10 * 60_000 }).bloqueado).toBe(
      false,
    );
  });
});
