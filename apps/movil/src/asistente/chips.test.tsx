import { chipsIntencion, MAX_CHIPS_INTENCION, unirPrefijo } from './chips';

describe('asistente/chips · chips de intención (§5)', () => {
  it('con efectivo y tarjetas: los cinco, con «¿Puedo gastar…?» primero', () => {
    const chips = chipsIntencion({ hayEfectivo: true, hayTarjetas: true });
    expect(chips.map((c) => c.etiqueta)).toEqual([
      '¿Puedo gastar…?',
      'Gasté…',
      'Me pagaron…',
      'Contar efectivo',
      'Pagar tarjeta',
    ]);
    expect(chips.length).toBeLessThanOrEqual(MAX_CHIPS_INTENCION);
  });

  it('«Contar efectivo» solo con efectivo y «Pagar tarjeta» solo con tarjetas', () => {
    expect(chipsIntencion({ hayEfectivo: false, hayTarjetas: false }).map((c) => c.clave)).toEqual([
      'puedo_gastar',
      'gaste',
      'me_pagaron',
    ]);
    expect(chipsIntencion({ hayEfectivo: true, hayTarjetas: false }).map((c) => c.clave)).toEqual([
      'puedo_gastar',
      'gaste',
      'me_pagaron',
      'contar_efectivo',
    ]);
    expect(chipsIntencion({ hayEfectivo: false, hayTarjetas: true }).map((c) => c.clave)).toEqual([
      'puedo_gastar',
      'gaste',
      'me_pagaron',
      'pagar_tarjeta',
    ]);
  });

  it('los de prefijo abren el dictado con el arranque; los de flujo empiezan una conversación', () => {
    const chips = chipsIntencion({ hayEfectivo: true, hayTarjetas: true });
    const accion = Object.fromEntries(chips.map((c) => [c.clave, c.accion]));
    expect(accion.puedo_gastar).toEqual({ tipo: 'prefijo', texto: 'puedo gastar ' });
    expect(accion.gaste).toEqual({ tipo: 'prefijo', texto: 'gasté ' });
    expect(accion.me_pagaron).toEqual({ tipo: 'prefijo', texto: 'me pagaron ' });
    expect(accion.contar_efectivo).toEqual({ tipo: 'flujo', flujo: 'arqueo' });
    expect(accion.pagar_tarjeta).toEqual({ tipo: 'flujo', flujo: 'pagar_tarjeta' });
    for (const c of chips) expect(c.pista.length).toBeGreaterThan(0);
  });

  it('unirPrefijo: «gasté » + «tacos 80 en efectivo»', () => {
    expect(unirPrefijo('gasté ', 'tacos 80 en efectivo')).toBe('gasté tacos 80 en efectivo');
    expect(unirPrefijo('puedo gastar ', '500 en unos tenis')).toBe('puedo gastar 500 en unos tenis');
  });

  it('unirPrefijo no repite el arranque si ya se dijo (con o sin acento ni mayúsculas)', () => {
    expect(unirPrefijo('gasté ', 'gasté 80 en tacos')).toBe('gasté 80 en tacos');
    expect(unirPrefijo('gasté ', 'Gaste 80 en tacos')).toBe('Gaste 80 en tacos');
    expect(unirPrefijo('me pagaron ', '  me pagaron 300 ')).toBe('me pagaron 300');
  });

  it('unirPrefijo sin nada dicho deja solo el arranque', () => {
    expect(unirPrefijo('gasté ', '   ')).toBe('gasté');
  });
});
