import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { fijarBloqueo } from './ajustes';
import { obtenerHoy } from './hoy';
import { registrarTextoLocal } from './registrar';
import { cargarEscenario } from './semilla';
import {
  construirVistaWidget,
  ENLACE_WIDGET,
  fijarOcultarMontosWidget,
  obtenerAjustesWidget,
  obtenerVistaWidget,
  type VistaWidget,
} from './widget';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** Ninguna cifra (ni "$", ni dígitos) en lo que muestra o lee en voz alta el widget. */
function sinCifras(v: VistaWidget): void {
  const todo = [v.titulo, v.cifra, v.detalle, v.texto].filter((t) => t !== null).join(' ');
  expect(todo).not.toMatch(/[$\d]/);
}

describe('construirVistaWidget (pura)', () => {
  const normal = { estado: 'normal', hoyPuedesPesos: 214, dias: 4 } as const;

  it('estado normal: "Hoy puedes $214 · 4 días" y tocarlo abre Hoy', () => {
    expect(construirVistaWidget(normal, { ocultarMontos: false })).toEqual({
      tipo: 'cifra',
      titulo: 'Hoy puedes',
      cifra: '$214',
      detalle: '4 días',
      texto: 'Hoy puedes $214 · 4 días',
      enlace: ENLACE_WIDGET,
    });
  });

  it('miles con coma y "1 día" en singular', () => {
    const v = construirVistaWidget({ estado: 'retrasado', hoyPuedesPesos: 1500, dias: 1 }, { ocultarMontos: false });
    expect(v.texto).toBe('Hoy puedes $1,500 · 1 día');
  });

  it('día de pago e ingreso variable también muestran la cifra con sus días', () => {
    expect(
      construirVistaWidget({ estado: 'dia_de_pago', hoyPuedesPesos: 456, dias: 3 }, { ocultarMontos: false }).texto,
    ).toBe('Hoy puedes $456 · 3 días');
    expect(
      construirVistaWidget({ estado: 'ingreso_variable', hoyPuedesPesos: 90, dias: 30 }, { ocultarMontos: false })
        .texto,
    ).toBe('Hoy puedes $90 · 30 días');
  });

  it('libre negativo: "Hoy: $0" como en Hoy (`02 §4.2`)', () => {
    const v = construirVistaWidget({ estado: 'libre_negativo', hoyPuedesPesos: 0, dias: 4 }, { ocultarMontos: false });
    expect(v).toMatchObject({ tipo: 'cifra', titulo: 'Hoy:', cifra: '$0', texto: 'Hoy: $0 · 4 días' });
  });

  it('sin ingreso configurado: pide la frecuencia, sin cifra', () => {
    const v = construirVistaWidget({ estado: 'sin_ingreso', hoyPuedesPesos: 0, dias: 0 }, { ocultarMontos: false });
    expect(v).toMatchObject({ tipo: 'mensaje', texto: 'Dime cada cuándo te pagan', cifra: null });
    sinCifras(v);
  });

  it('sin datos (antes del onboarding o sin poder leer la base): "Toca para empezar"', () => {
    const v = construirVistaWidget(null, { ocultarMontos: false });
    expect(v).toMatchObject({ tipo: 'mensaje', texto: 'Toca para empezar', enlace: ENLACE_WIDGET });
    sinCifras(v);
  });

  it('"Ocultar montos": "Toca para ver tu día" en todos los estados, sin ninguna cifra', () => {
    for (const estado of ['normal', 'dia_de_pago', 'retrasado', 'libre_negativo', 'sin_ingreso'] as const) {
      const v = construirVistaWidget({ estado, hoyPuedesPesos: 214, dias: 4 }, { ocultarMontos: true });
      expect(v).toEqual({
        tipo: 'oculto',
        titulo: null,
        cifra: null,
        detalle: null,
        texto: 'Toca para ver tu día',
        enlace: ENLACE_WIDGET,
      });
      sinCifras(v);
    }
  });
});

describe('widget con la base', () => {
  it('CA-M10-05 · con la semilla e4-01 el widget dice "Hoy puedes $214 · 4 días" (la misma cifra que Hoy)', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const v = obtenerVistaWidget(p.ctx);
    expect(v.texto).toBe('Hoy puedes $214 · 4 días');
    expect(v.cifra).toBe(`$${obtenerHoy(p.ctx).hoyPuedesPesos}`);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M10-05 · tras registrar un gasto la vista del widget cambia con Hoy', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    const antes = obtenerVistaWidget(p.ctx);
    const r = registrarTextoLocal(p.ctx, 'gasté 200 en tacos');
    expect(r?.resultado).toBe('registrado');
    const despues = obtenerVistaWidget(p.ctx);
    const hoy = obtenerHoy(p.ctx);
    expect(despues.texto).not.toBe(antes.texto);
    expect(despues.texto).toBe(`Hoy puedes $${hoy.hoyPuedesPesos} · 4 días`);
  });

  it('CA-M10-05 · "Ocultar montos" se guarda y oculta las cifras; apagarlo las devuelve', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    expect(obtenerAjustesWidget(p.ctx)).toEqual({ ocultarMontos: false });
    fijarOcultarMontosWidget(p.ctx, true);
    expect(obtenerAjustesWidget(p.ctx)).toEqual({ ocultarMontos: true });
    const oculto = obtenerVistaWidget(p.ctx);
    expect(oculto.texto).toBe('Toca para ver tu día');
    sinCifras(oculto);
    fijarOcultarMontosWidget(p.ctx, false);
    expect(obtenerVistaWidget(p.ctx).texto).toBe('Hoy puedes $214 · 4 días');
  });

  it('"Ocultar montos" está encendido por omisión si el bloqueo biométrico está activo (`02 §21`)', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    fijarBloqueo(p.ctx, { activo: true });
    expect(obtenerAjustesWidget(p.ctx)).toEqual({ ocultarMontos: true });
    expect(obtenerVistaWidget(p.ctx).tipo).toBe('oculto');
    // La elección explícita gana sobre el valor por omisión.
    fijarOcultarMontosWidget(p.ctx, false);
    expect(obtenerVistaWidget(p.ctx).texto).toBe('Hoy puedes $214 · 4 días');
  });

  it('antes del consentimiento o del onboarding no calcula nada: "Toca para empezar"', () => {
    const p = abrirPrueba();
    expect(obtenerVistaWidget(p.ctx).texto).toBe('Toca para empezar');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    expect(obtenerVistaWidget(p.ctx).texto).toBe('Toca para empezar');
  });
});
