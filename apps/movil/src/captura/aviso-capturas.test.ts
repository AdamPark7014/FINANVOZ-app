import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import {
  acumularAvisoCaptura,
  fijarAcumuloAvisoCaptura,
  fijarModoAvisoCaptura,
  obtenerModoAvisoCaptura,
} from '../servicios/estado-captura';
import { abrirPrueba } from '../servicios/__pruebas__/base';
import {
  avisarCapturasNuevas,
  INTERVALO_AGRUPADO_MS,
  liquidarAvisosCapturaPendientes,
  publicadorEnMemoria,
  textoAvisoCaptura,
} from './aviso-capturas';

function ctxConConsentimiento() {
  const p = abrirPrueba('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  return p.ctx;
}

describe('textoAvisoCaptura', () => {
  it('no lleva montos ni comercios', () => {
    expect(textoAvisoCaptura(1)).toBe('1 movimiento nuevo. Revísalo en Movimientos.');
    expect(textoAvisoCaptura(3)).toBe('3 movimientos nuevos. Revísalos en Movimientos.');
    expect(textoAvisoCaptura(0)).toBe('');
  });
});

describe('avisarCapturasNuevas', () => {
  it('por omisión agrupa en un solo aviso', async () => {
    const ctx = ctxConConsentimiento();
    const pub = publicadorEnMemoria();
    await avisarCapturasNuevas(ctx, 3, pub, { enSegundoPlano: true, ahora: 1000 });
    expect(pub.cuerpos()).toEqual(['3 movimientos nuevos. Revísalos en Movimientos.']);
    expect(acumularAvisoCaptura(ctx, 0).pendiente).toBe(0);
  });

  it('en primer plano no publica nada', async () => {
    const ctx = ctxConConsentimiento();
    const pub = publicadorEnMemoria();
    await avisarCapturasNuevas(ctx, 2, pub, { enSegundoPlano: false, ahora: 1000 });
    expect(pub.cuerpos()).toEqual([]);
  });

  it('modo cada uno: un aviso por movimiento, sin montos', async () => {
    const ctx = ctxConConsentimiento();
    fijarModoAvisoCaptura(ctx, 'cada_uno');
    const pub = publicadorEnMemoria();
    await avisarCapturasNuevas(ctx, 2, pub, { enSegundoPlano: true, ahora: 1000 });
    expect(pub.cuerpos()).toEqual([
      '1 movimiento nuevo. Revísalo en Movimientos.',
      '1 movimiento nuevo. Revísalo en Movimientos.',
    ]);
  });

  it('modo nunca: no publica', async () => {
    const ctx = ctxConConsentimiento();
    fijarModoAvisoCaptura(ctx, 'nunca');
    const pub = publicadorEnMemoria();
    await avisarCapturasNuevas(ctx, 5, pub, { enSegundoPlano: true, ahora: 1000 });
    expect(pub.cuerpos()).toEqual([]);
  });

  it('agrupados: acumula si no pasaron 30 min', async () => {
    const ctx = ctxConConsentimiento();
    const pub = publicadorEnMemoria();
    const t0 = 1_000_000;
    await avisarCapturasNuevas(ctx, 2, pub, { enSegundoPlano: true, ahora: t0 });
    expect(pub.cuerpos()).toEqual(['2 movimientos nuevos. Revísalos en Movimientos.']);
    await avisarCapturasNuevas(ctx, 1, pub, { enSegundoPlano: true, ahora: t0 + 5 * 60 * 1000 });
    expect(pub.cuerpos()).toEqual(['2 movimientos nuevos. Revísalos en Movimientos.']);
    expect(acumularAvisoCaptura(ctx, 0).pendiente).toBe(1);
  });

  it('agrupados: tras 30 min publica lo acumulado al liquidar', async () => {
    const ctx = ctxConConsentimiento();
    const pub = publicadorEnMemoria();
    const t0 = 2_000_000;
    fijarAcumuloAvisoCaptura(ctx, { pendiente: 4, ultimoAviso: t0 });
    await liquidarAvisosCapturaPendientes(ctx, pub, {
      enSegundoPlano: true,
      ahora: t0 + INTERVALO_AGRUPADO_MS,
    });
    expect(pub.cuerpos()).toEqual(['4 movimientos nuevos. Revísalos en Movimientos.']);
  });
});

describe('fijarModoAvisoCaptura', () => {
  it('nunca limpia el acumulado', () => {
    const ctx = ctxConConsentimiento();
    fijarAcumuloAvisoCaptura(ctx, { pendiente: 2, ultimoAviso: 100 });
    fijarModoAvisoCaptura(ctx, 'nunca');
    expect(obtenerModoAvisoCaptura(ctx)).toBe('nunca');
    expect(acumularAvisoCaptura(ctx, 0).pendiente).toBe(0);
  });
});
