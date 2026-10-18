import { describe, expect, it } from 'vitest';
import {
  ALIAS_MAXIMO_CONTEXTO,
  CONTEXTO_MAXIMO_BYTES,
  contextoMinimo,
  LISTA_MAXIMA_CONTEXTO,
} from './contexto-minimo';

const HOY = '2026-10-13';
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe('contextoMinimo · límites del proxy (contrato de POST /nlu/interpretar)', () => {
  it('con 80 contactos viajan los primeros 50, en el orden recibido', () => {
    const contactos = Array.from({ length: 80 }, (_, i) => [
      `contacto ${String.fromCharCode(97 + (i % 26))}${i}`,
    ]);
    const c = contextoMinimo({ hoy: HOY, cuentas: [], contactos });
    expect(c.contactos).toHaveLength(LISTA_MAXIMA_CONTEXTO);
    expect(c.contactos?.[0]).toEqual(['contacto a0']);
    expect(c.contactos?.[49]).toEqual(['contacto x49']);
  });

  it('descarta alias de más de 60 caracteres y deja hasta 50 por cuenta, contacto o cliente', () => {
    const largo = 'a'.repeat(ALIAS_MAXIMO_CONTEXTO + 1);
    const exacto = 'b'.repeat(ALIAS_MAXIMO_CONTEXTO);
    const muchos = Array.from({ length: 70 }, (_, i) => `alias ${i}`);
    const c = contextoMinimo({
      hoy: HOY,
      espacios: ['personal', 'negocio'],
      cuentas: [{ tipo: 'debito', alias: [largo, exacto, ...muchos] }],
      contactos: [[largo], [largo, 'jefa'], muchos],
      clientes: [muchos],
    });
    expect(c.cuentas[0]?.alias).toHaveLength(LISTA_MAXIMA_CONTEXTO);
    expect(c.cuentas[0]?.alias[0]).toBe(exacto);
    expect(c.contactos).toEqual([['jefa'], muchos.slice(0, LISTA_MAXIMA_CONTEXTO)]);
    expect(c.clientes).toEqual([muchos.slice(0, LISTA_MAXIMA_CONTEXTO)]);
  });

  it('limita a 50 cuentas y el contexto entero cabe en el presupuesto de bytes', () => {
    const alias = (p: string) =>
      Array.from({ length: LISTA_MAXIMA_CONTEXTO }, (_, i) => `${p} ${'x'.repeat(45)} ${i}`);
    const c = contextoMinimo({
      hoy: HOY,
      espacios: ['personal', 'negocio'],
      cuentas: Array.from({ length: 60 }, () => ({ tipo: 'efectivo' as const, alias: alias('cuenta') })),
      contactos: Array.from({ length: 60 }, () => alias('contacto')),
      clientes: Array.from({ length: 60 }, () => alias('cliente')),
    });
    expect(c.cuentas.length).toBeLessThanOrEqual(LISTA_MAXIMA_CONTEXTO);
    expect(c.cuentas.length).toBeGreaterThan(0);
    expect(bytes(c)).toBeLessThanOrEqual(CONTEXTO_MAXIMO_BYTES);
    // Primero las cuentas: si no cabe nada más, los contactos y clientes se quedan fuera.
    expect(c.contactos).toEqual([]);
    expect(c.clientes).toEqual([]);
  });

  it('es determinista y no recorta nada cuando todo cabe', () => {
    const datos = {
      hoy: HOY,
      cuentas: [{ tipo: 'credito' as const, nombre: 'Nu ••4410', alias: ['morada'] }],
      contactos: [['Jefa', 'mamá']],
    };
    expect(contextoMinimo(datos)).toEqual(contextoMinimo(datos));
    expect(contextoMinimo(datos)).toMatchObject({
      cuentas: [{ tipo: 'credito', alias: ['morada', 'nu'] }],
      contactos: [['jefa', 'mama']],
    });
  });
});
