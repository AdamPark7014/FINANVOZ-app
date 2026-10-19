import { describe, expect, it } from 'vitest';
import { validarEvento, type EventoAnalitica } from '../analitica/eventos';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { fijarEstadisticas } from '../privacidad/estadisticas';
import { abrirPrueba, escenario } from './__pruebas__/base';
import { aplicarCorreccion, camposCorreccionAnalitica, enlaceAnaliticaCorreccion } from './correcciones';
import { registrarMovimiento } from './formulario';
import { cargarEscenario } from './semilla';

describe('analítica de correcciones por voz (pendiente 30, 03 §8)', () => {
  it('camposCorreccionAnalitica solo devuelve catálogos de la lista blanca', () => {
    expect(camposCorreccionAnalitica({ monto: 8000, origenId: 'x', aliasDicho: 'nu' })).toEqual([
      'monto',
      'cuenta',
    ]);
    expect(camposCorreccionAnalitica({})).toEqual([]);
  });

  it('aplicarCorreccion con registrarEvento emite correccion {campo} sin montos ni comercios', () => {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
    fijarEstadisticas(p.ctx, true);
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const nu = e.cuentas.nu as string;
    const efectivo = e.cuentas.efectivo as string;
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 8_000,
      categoria: 'comida_fuera',
      origenId: nu,
      descripcion: 'tacos',
    });
    const eventos: EventoAnalitica[] = [];
    aplicarCorreccion(
      p.ctx,
      r.transaccionId,
      { origenId: efectivo, aliasDicho: 'efectivo' },
      { origen: 'voz', registrarEvento: (ev) => eventos.push(ev) },
    );
    expect(eventos).toEqual([{ nombre: 'correccion', propiedades: { campo: 'cuenta' } }]);
    const json = JSON.stringify(eventos);
    expect(json).not.toMatch(/\d/);
    for (const ev of eventos) expect(validarEvento(ev, new Set())).toEqual(ev);
    p.base.cerrar();
  });

  it('enlaceAnaliticaCorreccion enlaza aplicarCorreccion sin opciones explícitas', () => {
    const p = abrirPrueba();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true, estadisticas: true });
    fijarEstadisticas(p.ctx, true);
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const nu = e.cuentas.nu as string;
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 8_000,
      categoria: 'comida_fuera',
      origenId: nu,
      descripcion: 'tacos',
    });
    const eventos: EventoAnalitica[] = [];
    enlaceAnaliticaCorreccion((ev) => eventos.push(ev));
    try {
      aplicarCorreccion(p.ctx, r.transaccionId, { monto: 9_000 }, { origen: 'texto' });
      expect(eventos).toEqual([{ nombre: 'correccion', propiedades: { campo: 'monto' } }]);
    } finally {
      enlaceAnaliticaCorreccion(null);
    }
    p.base.cerrar();
  });
});
