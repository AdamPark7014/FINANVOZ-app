import { describe, expect, it } from 'vitest';
import type { Interpretacion, TurnoAnterior } from '@cartera/nlu';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarMovimientos } from './movimientos';
import { agregarCuenta } from './onboarding';
import { sincronizarPlan } from './plan';
import { registrarTexto, registrarTextoLocal, type OrigenDictado } from './registrar';
import { abrirPrueba } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

const HOY = '2026-10-11';

/** La conversación del asistente (06 §15): cada frase lleva el turno anterior y deja el suyo. */
function conversacion() {
  const p = abrirPrueba(HOY);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  sincronizarPlan(p.ctx, { plus: { vigenteHasta: null, enPrueba: false, renovara: true } });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 64_000 });
  let anterior: TurnoAnterior | null = null;
  const opciones = (frase: string) => ({
    anterior,
    alInterpretar: (i: Interpretacion) => {
      anterior = { frase, interpretacion: i };
    },
  });
  return {
    ...p,
    efectivo,
    decir: (frase: string, origen: OrigenDictado = 'voz') =>
      registrarTextoLocal(p.ctx, frase, origen, opciones(frase)),
    decirConNube: (frase: string, nube: ReturnType<typeof nubeFalsa>['nube']) =>
      registrarTexto(p.ctx, frase, 'voz', { nube, ...opciones(frase) }),
    anterior: () => anterior,
  };
}

describe('conversación en el teléfono (06 §15)', () => {
  it('«¿y la semana pasada?» repite la consulta con otro periodo', () => {
    const c = conversacion();
    const a = c.decir('¿cuánto gasté en comida esta semana?');
    expect(a).toMatchObject({ resultado: 'consulta', respuesta: { plantilla: 'gasto_por_categoria' } });
    const b = c.decir('¿y la semana pasada?');
    if (b?.resultado !== 'consulta') throw new Error(String(b?.resultado));
    expect(b.respuesta.filtro).toMatchObject({ desde: '2026-09-28', hasta: '2026-10-04' });
    // Sin el turno anterior, el fragmento no se adivina.
    expect(registrarTextoLocal(c.ctx, '¿y la semana pasada?', 'voz')).toBeNull();
  });

  it('«no, en efectivo» corrige lo que se acaba de registrar y «otra igual» lo repite', () => {
    const c = conversacion();
    expect(c.decir('me compré una coca de 25')).toMatchObject({ resultado: 'registrado' });
    expect(c.decir('no, en efectivo')).toMatchObject({ resultado: 'corregido' });
    expect(c.ctx.libro.saldo(c.efectivo)).toBe(64_000 - 2_500);
    expect(c.decir('otra igual')).toBeNull(); // tras una corrección sin cifra no se sabe qué repetir
    expect(c.decir('coca 25 en efectivo')).toMatchObject({ resultado: 'registrado' });
    expect(c.decir('otra igual')).toMatchObject({ resultado: 'registrado' });
    expect(c.ctx.libro.saldo(c.efectivo)).toBe(64_000 - 3 * 2_500);
  });

  it('«quítale 5» calcula en el teléfono y «bórrala» anula con Deshacer', () => {
    const c = conversacion();
    c.decir('coca 25 en efectivo');
    expect(c.decir('quítale 5')).toMatchObject({ resultado: 'corregido' });
    expect(c.ctx.libro.saldo(c.efectivo)).toBe(64_000 - 2_000);
    expect(c.decir('bórrala')).toMatchObject({ resultado: 'anulado' });
    expect(c.ctx.libro.saldo(c.efectivo)).toBe(64_000);
    expect(c.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('la respuesta a «¿De cuándo?» completa la consulta', () => {
    const c = conversacion();
    expect(c.decir('¿cuánto gasté?')).toMatchObject({
      resultado: 'aclarar',
      motivo: 'fecha_ambigua',
      opciones: ['Hoy', 'Esta semana', 'Este mes'],
    });
    // La app manda el chip pegado a la pregunta.
    const r = c.decir('¿cuánto gasté?, Esta semana');
    expect(r).toMatchObject({ resultado: 'consulta', respuesta: { plantilla: 'gasto_total' } });
  });

  it('a la nube va el turno anterior (lo dicho y lo entendido) y su respuesta se vuelve el siguiente', async () => {
    const c = conversacion();
    c.decir('coca 25 en efectivo');
    const frase = 'y la de anoche también fue igual';
    const f = nubeFalsa({
      [frase]: {
        intencion: 'registrar',
        movimientos: [
          {
            tipo: 'gasto',
            monto: 2_500,
            fecha: '2026-10-10',
            categoria: 'antojos',
            origen: { tipo: 'efectivo' },
          },
        ],
      },
    });
    expect(await c.decirConNube(frase, f.nube)).toMatchObject({ resultado: 'registrado' });
    const [recibida] = f.recibidas;
    expect(recibida?.contexto.anterior).toEqual({
      frase: 'coca 25 en efectivo',
      interpretacion: expect.objectContaining({ intencion: 'registrar' }),
    });
    // Ni cifras de respuestas ni ids en lo que viaja.
    expect(JSON.stringify(recibida?.contexto.anterior)).not.toMatch(/cuenta_|"id"|saldo/);
    expect(c.anterior()).toMatchObject({ frase, interpretacion: { intencion: 'registrar' } });
    expect(listarMovimientos(c.ctx).flatMap((d) => d.movimientos)).toHaveLength(2);
  });
});
