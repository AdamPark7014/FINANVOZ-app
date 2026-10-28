import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { registrarMovimiento } from './formulario';
import { diasSeguidos, rachaAnotando } from './racha';
import { registrarTextoLocal } from './registrar';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** «6 días seguidos anotando todo» (B+, D3) sale de aquí: un servicio puro y su lectura del libro. */
describe('racha de días anotando', () => {
  it('diasSeguidos: cuenta hacia atrás desde hoy; si hoy no hay nada, desde ayer; un hueco la corta', () => {
    const f = ['2026-10-26', '2026-10-25', '2026-10-24', '2026-10-22'];
    expect(diasSeguidos(f, '2026-10-26')).toBe(3);
    expect(diasSeguidos(f, '2026-10-27')).toBe(3);
    expect(diasSeguidos(f, '2026-10-28')).toBe(0);
    expect(diasSeguidos([], '2026-10-26')).toBe(0);
    // Repetidos y desordenados no cambian nada.
    expect(diasSeguidos(['2026-10-25', '2026-10-26', '2026-10-26'], '2026-10-26')).toBe(2);
  });

  it('rachaAnotando: cuenta lo que anotas tú (voz, texto, formulario), no los saldos de apertura', () => {
    const p = abrirPrueba('2026-10-11');
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    expect(rachaAnotando(p.ctx)).toBe(0);
    const efectivo = e.cuentas['efectivo'] as string;
    for (const fecha of ['2026-10-09', '2026-10-10'] as const) {
      registrarMovimiento(p.ctx, {
        tipo: 'gasto',
        categoria: 'antojos',
        origenId: efectivo,
        monto: 2_000,
        fecha,
      });
    }
    expect(rachaAnotando(p.ctx)).toBe(2);
    registrarTextoLocal(p.ctx, 'coca 25 en efectivo', 'voz');
    expect(rachaAnotando(p.ctx)).toBe(3);
  });
});
