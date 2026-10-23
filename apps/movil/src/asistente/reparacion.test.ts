import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContextoInterprete } from '@cartera/nlu';
import { ETIQUETAS_REPARACION, etiquetaDeFrase, sugerirReparacion } from './reparacion';

const contexto: ContextoInterprete = {
  fecha_referencia: '2026-10-11',
  espacios: ['personal'],
  cuentas: [
    { tipo: 'efectivo', alias: ['efectivo', 'cartera'] },
    { tipo: 'debito', alias: ['bbva'] },
    { tipo: 'debito', alias: ['mercado pago'] },
    { tipo: 'credito', alias: ['nu'] },
  ],
  contactos: [['juan']],
};

describe('sugerirReparacion (fachada de la app)', () => {
  it('con frase: el valor es la frase (se manda a registrarTexto) y la etiqueta la muestra en pesos', () => {
    const opciones = sugerirReparacion('los 300 del Beto', contexto);
    expect(opciones.map((o) => [o.valor, o.etiqueta])).toEqual([
      ['le presté 300 a Beto', 'Le presté $300 a Beto'],
      ['el Beto me pagó 300 de lo que me debía', 'El Beto me pagó $300 de lo que me debía'],
      ['registra 300', 'Gasté $300'],
      ['otra', 'Otra cosa'],
    ]);
    expect(opciones[0]).toMatchObject({ tipo: 'prestamo', frase: 'le presté 300 a Beto', monto: 30000 });
  });

  it('sin frase: el valor es el tipo reservado (abre R2) y lleva el monto oído', () => {
    const opciones = sugerirReparacion('pasé 500 a Mercado Pago', contexto);
    expect(opciones[0]).toEqual({
      tipo: 'transferencia',
      valor: 'transferencia',
      etiqueta: ETIQUETAS_REPARACION.transferencia,
      monto: 50000,
    });
    expect(sugerirReparacion('pagué la Nu', contexto).map((o) => o.valor)).toEqual([
      'pago_tarjeta',
      'gasto',
      'otra',
    ]);
  });

  it('sin sentido: tres opciones para reparar en un toque (criterio 3)', () => {
    const opciones = sugerirReparacion('blablá');
    expect(opciones.map((o) => o.etiqueta)).toEqual(['Fue un gasto', 'Me entró dinero', 'Otra cosa']);
    expect(sugerirReparacion('   ')).toEqual([]);
  });

  it('el contexto se usa: alias y fecha entran a la frase', () => {
    expect(sugerirReparacion('ayer 500 de BBVA a Mercado Pago', contexto)[0]).toMatchObject({
      valor: 'ayer pasé 500 de BBVA a Mercado Pago',
      etiqueta: 'Ayer pasé $500 de BBVA a Mercado Pago',
    });
  });

  it('etiquetaDeFrase: cifras con miles y centavos, sin tocar otros números', () => {
    expect(etiquetaDeFrase('pagué 1500 de la Nu', 150000)).toBe('Pagué $1,500 de la Nu');
    expect(etiquetaDeFrase('gasté 120.50 en tacos', 12050)).toBe('Gasté $120.50 en tacos');
    expect(etiquetaDeFrase('ayer registra como 300', 30000)).toBe('Ayer gasté como $300');
    expect(etiquetaDeFrase('le presté 300 a Beto')).toBe('Le presté 300 a Beto');
  });

  it('textos: tuteo, sin exclamaciones ni tecnicismos', () => {
    for (const t of Object.values(ETIQUETAS_REPARACION)) {
      expect(t).not.toMatch(/[!¡]/);
      expect(t).not.toMatch(/asiento|cargo|abono|contrapartida/i);
    }
  });

  it('nada de lo oído va a la consola (regla 9)', () => {
    const fuente = readFileSync(new URL('./reparacion.ts', import.meta.url), 'utf8');
    expect(fuente).not.toMatch(/console\./);
  });
});
